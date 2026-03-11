"""
api/routers/portal.py

Client portal endpoints — scoped to a single client.

Each client (e.g. SmileCare, LexisPro) gets their own login.
They can see only their own conversations, appointments, and escalations.
They cannot see other clients' data or any admin-level information.

Auth:
    POST /portal/auth/login       — client slug + password → JWT with role=client
    GET  /portal/auth/me          — verify token, return client info

Data (all filtered to the authenticated client):
    GET  /portal/stats            — headline numbers
    GET  /portal/conversations    — their conversations (paginated)
    GET  /portal/appointments     — their appointments (paginated, filterable)
    PATCH /portal/appointments/{id} — confirm / cancel an appointment
    GET  /portal/escalations      — their escalations
    GET  /portal/agents           — their agents with status
    PATCH /portal/agents/{id}/toggle — turn their agent on or off
"""

import hashlib
import logging
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from config.settings import get_settings
from core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/portal", tags=["portal"])

_security = HTTPBearer(auto_error=False)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hash_password(password: str, slug: str) -> str:
    """Deterministic hash: SHA-256(password + ':' + slug). Stored in clients table."""
    raw = f"{password}:{slug}".encode()
    return hashlib.sha256(raw).hexdigest()


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Portal JWT — separate from admin JWT (role=client in payload)
# ---------------------------------------------------------------------------

def _create_portal_token(client_id: str, slug: str, name: str) -> str:
    settings = get_settings()
    expires = _now_utc() + timedelta(hours=settings.jwt_expire_hours)
    payload = {
        "sub":    client_id,
        "slug":   slug,
        "name":   name,
        "role":   "client",
        "exp":    expires,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def _decode_portal_token(token: str) -> dict:
    """Return payload dict or raise 401."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        if payload.get("role") != "client":
            raise HTTPException(status_code=403, detail="Not a portal token.")
        if not payload.get("sub"):
            raise HTTPException(status_code=401, detail="Invalid token payload.")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token.")


async def get_portal_client(
    credentials: HTTPAuthorizationCredentials | None = Depends(_security),
) -> dict:
    """
    Dependency: validate portal Bearer token.
    Returns the full payload dict so routes can access client_id, slug, name.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _decode_portal_token(credentials.credentials)


# ---------------------------------------------------------------------------
# POST /portal/auth/login
# ---------------------------------------------------------------------------

class PortalLoginRequest(BaseModel):
    slug:     str
    password: str


class PortalTokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    client_name:  str
    slug:         str


@router.post("/auth/login", response_model=PortalTokenResponse)
async def portal_login(body: PortalLoginRequest) -> PortalTokenResponse:
    """
    Validate client portal credentials and return a signed JWT.

    Credentials are stored in the clients table:
        portal_password_hash = SHA-256(password + ':' + slug)

    To set a password for a client, update the clients table:
        UPDATE clients SET portal_password_hash = '<hash>' WHERE slug = '<slug>';

    Use the /portal/auth/hash-helper endpoint or compute the hash yourself.
    """
    db = get_db()

    try:
        result = (
            db.table("clients")
            .select("id, name, slug, portal_password_hash, is_active")
            .eq("slug", body.slug.strip().lower())
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.error(f"Portal login DB error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Login failed. Please try again.")

    if not result.data:
        logger.warning(f"Portal login: unknown slug '{body.slug}'")
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    client = result.data[0]

    if not client.get("is_active"):
        raise HTTPException(status_code=403, detail="This client account is not active.")

    stored_hash = client.get("portal_password_hash")
    if not stored_hash:
        raise HTTPException(
            status_code=403,
            detail="Portal access is not yet enabled for this account. Contact your agency.",
        )

    given_hash = _hash_password(body.password, client["slug"])
    if given_hash != stored_hash:
        logger.warning(f"Portal login: wrong password for slug '{body.slug}'")
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    token = _create_portal_token(
        client_id=client["id"],
        slug=client["slug"],
        name=client["name"],
    )
    logger.info(f"Portal login: {client['slug']} ({client['name']})")
    return PortalTokenResponse(access_token=token, client_name=client["name"], slug=client["slug"])


# ---------------------------------------------------------------------------
# GET /portal/auth/me
# ---------------------------------------------------------------------------

@router.get("/auth/me")
async def portal_me(payload: dict = Depends(get_portal_client)) -> dict:
    """Return the authenticated client's name and slug."""
    return {"client_id": payload["sub"], "slug": payload["slug"], "name": payload["name"]}


# ---------------------------------------------------------------------------
# GET /portal/stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def portal_stats(payload: dict = Depends(get_portal_client)) -> dict:
    """Headline metrics for this client's portal dashboard."""
    db     = get_db()
    cid    = payload["sub"]
    now    = _now_utc()
    today  = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month  = today.replace(day=1)

    try:
        conv_total  = db.table("conversations").select("id").eq("client_id", cid).execute()
        conv_today  = db.table("conversations").select("id").eq("client_id", cid).gte("started_at", today.isoformat()).execute()
        conv_active = db.table("conversations").select("id").eq("client_id", cid).eq("status", "active").execute()

        appt_pending   = db.table("appointments").select("id").eq("client_id", cid).eq("status", "pending").execute()
        appt_confirmed = db.table("appointments").select("id").eq("client_id", cid).eq("status", "confirmed").execute()
        appt_month     = db.table("appointments").select("id").eq("client_id", cid).gte("created_at", month.isoformat()).execute()

        escal_pending  = db.table("escalations").select("id").eq("client_id", cid).eq("status", "pending").execute()

        cost_month = db.table("token_usage").select("cost_zar").eq("client_id", cid).gte("created_at", month.isoformat()).execute()

        return {
            "conversations": {
                "total":      len(conv_total.data),
                "today":      len(conv_today.data),
                "active_now": len(conv_active.data),
            },
            "appointments": {
                "pending":        len(appt_pending.data),
                "confirmed":      len(appt_confirmed.data),
                "this_month":     len(appt_month.data),
            },
            "escalations": {
                "pending": len(escal_pending.data),
            },
            "cost_zar": {
                "this_month": round(sum(r["cost_zar"] for r in cost_month.data), 2),
            },
        }

    except Exception as e:
        logger.error(f"Portal stats error for {cid}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load stats.")


# ---------------------------------------------------------------------------
# GET /portal/conversations
# ---------------------------------------------------------------------------

@router.get("/conversations")
async def portal_conversations(
    limit:  int = Query(default=50, le=200),
    offset: int = Query(default=0,  ge=0),
    status: str = Query(default=""),
    payload: dict = Depends(get_portal_client),
) -> dict:
    """Paginated conversation list for this client."""
    db  = get_db()
    cid = payload["sub"]

    try:
        q = (
            db.table("conversations")
            .select("id, channel, status, started_at, ended_at, user_identifier, agents(name)")
            .eq("client_id", cid)
            .order("started_at", desc=True)
            .limit(limit)
            .offset(offset)
        )
        if status:
            q = q.eq("status", status)

        result = q.execute()
        data = result.data

        # Lead score annotation
        if data:
            conv_ids = [c["id"] for c in data]
            try:
                appt_r   = db.table("appointments").select("conversation_id").eq("client_id", cid).in_("conversation_id", conv_ids).execute()
                booked   = {r["conversation_id"] for r in appt_r.data}
            except Exception:
                booked = set()

            for c in data:
                if c["id"] in booked:
                    c["lead_score"] = "booked"
                elif c["status"] == "escalated":
                    c["lead_score"] = "urgent"
                elif c["status"] == "completed":
                    c["lead_score"] = "qualified"
                elif c["status"] == "active":
                    c["lead_score"] = "active"
                else:
                    c["lead_score"] = "cold"

        return {"conversations": data, "count": len(data)}

    except Exception as e:
        logger.error(f"Portal conversations error for {cid}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load conversations.")


# ---------------------------------------------------------------------------
# GET /portal/conversations/{conversation_id}/messages
# ---------------------------------------------------------------------------

@router.get("/conversations/{conversation_id}/messages")
async def portal_conversation_messages(
    conversation_id: str,
    payload: dict = Depends(get_portal_client),
) -> dict:
    """Full message thread for a specific conversation (client-scoped)."""
    db  = get_db()
    cid = payload["sub"]

    try:
        conv_r = (
            db.table("conversations")
            .select("id, channel, status, started_at, ended_at, user_identifier, agents(name)")
            .eq("id", conversation_id)
            .eq("client_id", cid)   # enforce client scoping
            .limit(1)
            .execute()
        )
        if not conv_r.data:
            raise HTTPException(status_code=404, detail="Conversation not found.")

        msgs_r = (
            db.table("messages")
            .select("role, content, created_at")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=False)
            .execute()
        )

        messages = [
            {"role": r["role"], "content": r["content"], "created_at": r["created_at"]}
            for r in msgs_r.data
            if r["role"] in ("user", "assistant")
        ]

        return {"conversation": conv_r.data[0], "messages": messages}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Portal conversation messages error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load conversation.")


# ---------------------------------------------------------------------------
# GET /portal/appointments
# ---------------------------------------------------------------------------

@router.get("/appointments")
async def portal_appointments(
    limit:  int = Query(default=50, le=200),
    offset: int = Query(default=0,  ge=0),
    status: str = Query(default=""),
    payload: dict = Depends(get_portal_client),
) -> dict:
    """Appointment requests for this client."""
    db  = get_db()
    cid = payload["sub"]

    try:
        q = (
            db.table("appointments")
            .select(
                "id, patient_name, contact_number, preferred_date, preferred_time, "
                "service_type, is_existing_patient, notes, status, created_at, conversation_id"
            )
            .eq("client_id", cid)
            .order("created_at", desc=True)
            .limit(limit)
            .offset(offset)
        )
        if status:
            q = q.eq("status", status)

        result = q.execute()
        return {"appointments": result.data, "count": len(result.data)}

    except Exception as e:
        logger.error(f"Portal appointments error for {cid}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load appointments.")


# ---------------------------------------------------------------------------
# PATCH /portal/appointments/{appointment_id}
# ---------------------------------------------------------------------------

class PortalAppointmentUpdate(BaseModel):
    status: str   # "confirmed" | "cancelled" | "completed"


@router.patch("/appointments/{appointment_id}")
async def portal_update_appointment(
    appointment_id: str,
    body: PortalAppointmentUpdate,
    payload: dict = Depends(get_portal_client),
) -> dict:
    """Client can confirm, cancel, or mark completed their own appointments."""
    valid = ("confirmed", "cancelled", "completed")
    if body.status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {valid}")

    db  = get_db()
    cid = payload["sub"]

    try:
        result = (
            db.table("appointments")
            .update({"status": body.status})
            .eq("id", appointment_id)
            .eq("client_id", cid)   # enforce ownership
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Appointment not found.")

        logger.info(f"Portal: appointment {appointment_id} → '{body.status}' by {payload['slug']}")
        return {"appointment": result.data[0]}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Portal appointment update error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update appointment.")


# ---------------------------------------------------------------------------
# GET /portal/escalations
# ---------------------------------------------------------------------------

@router.get("/escalations")
async def portal_escalations(
    status: str = Query(default=""),
    payload: dict = Depends(get_portal_client),
) -> dict:
    """Escalation queue for this client."""
    db  = get_db()
    cid = payload["sub"]

    try:
        q = (
            db.table("escalations")
            .select("id, reason, summary, status, flagged_at, reviewed_at, notes, conversations(channel, user_identifier)")
            .eq("client_id", cid)
            .order("flagged_at", desc=True)
        )
        if status:
            q = q.eq("status", status)

        result = q.execute()
        return {"escalations": result.data}

    except Exception as e:
        logger.error(f"Portal escalations error for {cid}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load escalations.")


# ---------------------------------------------------------------------------
# GET /portal/agents
# ---------------------------------------------------------------------------

@router.get("/agents")
async def portal_agents(payload: dict = Depends(get_portal_client)) -> dict:
    """Return this client's agents with status."""
    db  = get_db()
    cid = payload["sub"]

    try:
        result = (
            db.table("agents")
            .select("id, name, channel, model, is_active, created_at")
            .eq("client_id", cid)
            .order("created_at", desc=False)
            .execute()
        )
        return {"agents": result.data}

    except Exception as e:
        logger.error(f"Portal agents error for {cid}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load agents.")


# ---------------------------------------------------------------------------
# PATCH /portal/agents/{agent_id}/toggle
# ---------------------------------------------------------------------------

@router.patch("/agents/{agent_id}/toggle")
async def portal_toggle_agent(
    agent_id: str,
    payload: dict = Depends(get_portal_client),
) -> dict:
    """Client can turn their own agent on or off."""
    db  = get_db()
    cid = payload["sub"]

    try:
        current = (
            db.table("agents")
            .select("id, is_active, client_id")
            .eq("id", agent_id)
            .eq("client_id", cid)   # enforce ownership
            .limit(1)
            .execute()
        )
        if not current.data:
            raise HTTPException(status_code=404, detail="Agent not found.")

        new_state = not current.data[0]["is_active"]
        result = (
            db.table("agents")
            .update({"is_active": new_state})
            .eq("id", agent_id)
            .execute()
        )
        logger.info(f"Portal: agent {agent_id} toggled to is_active={new_state} by {payload['slug']}")
        return {"agent": result.data[0]}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Portal agent toggle error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to toggle agent.")


# ---------------------------------------------------------------------------
# GET /portal/auth/hash-helper  (admin utility — helps set portal passwords)
# ---------------------------------------------------------------------------

@router.get("/auth/hash-helper")
async def hash_helper(password: str = Query(...), slug: str = Query(...)) -> dict:
    """
    Admin utility: compute the hash to store in clients.portal_password_hash.

    Usage:
        GET /portal/auth/hash-helper?password=MySecret&slug=smilecare

    Copy the returned hash into the clients table via Supabase dashboard.
    This endpoint is unauthenticated but only computes a hash — no DB write.
    """
    return {
        "slug":   slug,
        "hash":   _hash_password(password, slug),
        "instruction": f"UPDATE clients SET portal_password_hash = '{_hash_password(password, slug)}' WHERE slug = '{slug}';",
    }
