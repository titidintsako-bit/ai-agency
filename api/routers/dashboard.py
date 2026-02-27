"""
api/routers/dashboard.py

Admin dashboard data endpoints. All endpoints are read-only except the
escalation PATCH which lets you mark escalations as reviewed/resolved.

Routes:
    GET  /dashboard/stats                        — overview metric cards
    GET  /dashboard/agents                       — all agent rows with client name
    GET  /dashboard/conversations                — paginated conversation list
    GET  /dashboard/escalations                  — escalation queue
    PATCH /dashboard/escalations/{escalation_id} — mark reviewed / resolved
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from api.dependencies import get_current_user
from core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)

def _day_start(dt: datetime) -> datetime:
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)


# ---------------------------------------------------------------------------
# GET /dashboard/stats
# ---------------------------------------------------------------------------

@router.get("/stats")
async def get_stats(_: str = Depends(get_current_user)) -> dict:
    """
    Return all headline metrics for the Overview page stat cards.

    Runs several lightweight Supabase queries and aggregates them in Python.
    Response is designed to map 1-to-1 with the four stat cards in the UI.
    """
    db = get_db()
    now = _now_utc()
    today     = _day_start(now)
    week_start  = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)

    try:
        # Agents
        agents_r = db.table("agents").select("id, is_active").execute()
        all_agents   = agents_r.data
        active_agents = [a for a in all_agents if a["is_active"]]

        # Conversations
        conv_today = db.table("conversations").select("id").gte("started_at", today.isoformat()).execute()
        conv_week  = db.table("conversations").select("id").gte("started_at", week_start.isoformat()).execute()
        conv_month = db.table("conversations").select("id").gte("started_at", month_start.isoformat()).execute()
        conv_active = db.table("conversations").select("id").eq("status", "active").execute()

        # Token costs
        cost_today = db.table("token_usage").select("cost_zar").gte("created_at", today.isoformat()).execute()
        cost_week  = db.table("token_usage").select("cost_zar").gte("created_at", week_start.isoformat()).execute()
        cost_month = db.table("token_usage").select("cost_zar").gte("created_at", month_start.isoformat()).execute()

        # Escalations
        escal_pending = db.table("escalations").select("id").eq("status", "pending").execute()

        return {
            "agents": {
                "total":  len(all_agents),
                "active": len(active_agents),
            },
            "conversations": {
                "today":      len(conv_today.data),
                "this_week":  len(conv_week.data),
                "this_month": len(conv_month.data),
                "active_now": len(conv_active.data),
            },
            "cost_zar": {
                "today":      round(sum(r["cost_zar"] for r in cost_today.data), 4),
                "this_week":  round(sum(r["cost_zar"] for r in cost_week.data),  4),
                "this_month": round(sum(r["cost_zar"] for r in cost_month.data), 4),
            },
            "escalations": {
                "pending": len(escal_pending.data),
            },
        }

    except Exception as e:
        logger.error(f"Stats query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load stats.")


# ---------------------------------------------------------------------------
# GET /dashboard/agents
# ---------------------------------------------------------------------------

@router.get("/agents")
async def get_agents(_: str = Depends(get_current_user)) -> dict:
    """
    Return all agent rows with their client name embedded.
    Used by the dashboard to show the agent status panel.
    """
    db = get_db()

    try:
        result = (
            db.table("agents")
            .select("id, name, channel, model, is_active, created_at, clients(name, slug)")
            .order("created_at", desc=False)
            .execute()
        )
        return {"agents": result.data}

    except Exception as e:
        logger.error(f"Agents query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load agents.")


# ---------------------------------------------------------------------------
# GET /dashboard/conversations
# ---------------------------------------------------------------------------

@router.get("/conversations")
async def get_conversations(
    limit:  int = Query(default=50, le=200),
    offset: int = Query(default=0,  ge=0),
    status: str = Query(default=""),
    client_slug: str = Query(default=""),
    _: str = Depends(get_current_user),
) -> dict:
    """
    Return a paginated list of conversations for the dashboard table.

    Each row includes client name, agent name, channel, status, and timestamps.
    Optional filters: status, client_slug.
    """
    db = get_db()

    try:
        q = (
            db.table("conversations")
            .select("id, channel, status, started_at, ended_at, user_identifier, clients(name, slug), agents(name)")
            .order("started_at", desc=True)
            .limit(limit)
            .offset(offset)
        )

        if status:
            q = q.eq("status", status)

        result = q.execute()

        # If filtering by client_slug, filter in Python (PostgREST embedded filter is verbose)
        data = result.data
        if client_slug:
            data = [r for r in data if r.get("clients", {}).get("slug") == client_slug]

        return {"conversations": data, "count": len(data)}

    except Exception as e:
        logger.error(f"Conversations query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load conversations.")


# ---------------------------------------------------------------------------
# GET /dashboard/escalations
# ---------------------------------------------------------------------------

@router.get("/escalations")
async def get_escalations(
    status: str = Query(default=""),
    _: str = Depends(get_current_user),
) -> dict:
    """
    Return escalations for the alert queue panel.

    Defaults to all statuses. Pass ?status=pending to show only the queue.
    Each row includes the client name and conversation channel.
    """
    db = get_db()

    try:
        q = (
            db.table("escalations")
            .select("id, reason, summary, status, flagged_at, reviewed_at, notes, clients(name, slug), conversations(channel, user_identifier)")
            .order("flagged_at", desc=True)
        )

        if status:
            q = q.eq("status", status)

        result = q.execute()
        return {"escalations": result.data}

    except Exception as e:
        logger.error(f"Escalations query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load escalations.")


# ---------------------------------------------------------------------------
# PATCH /dashboard/escalations/{escalation_id}
# ---------------------------------------------------------------------------

class EscalationUpdate(BaseModel):
    status: str        # "reviewed" | "resolved"
    notes:  str = ""

@router.patch("/escalations/{escalation_id}")
async def update_escalation(
    escalation_id: str,
    body: EscalationUpdate,
    _: str = Depends(get_current_user),
) -> dict:
    """
    Mark an escalation as reviewed or resolved from the dashboard.

    Sets reviewed_at to now when status changes from pending.
    Optionally saves internal notes.
    """
    valid = ("reviewed", "resolved")
    if body.status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {valid}")

    db = get_db()

    update: dict = {
        "status":      body.status,
        "reviewed_at": _now_utc().isoformat(),
    }
    if body.notes:
        update["notes"] = body.notes

    try:
        result = (
            db.table("escalations")
            .update(update)
            .eq("id", escalation_id)
            .execute()
        )

        if not result.data:
            raise HTTPException(status_code=404, detail="Escalation not found.")

        logger.info(f"Escalation {escalation_id} marked as '{body.status}'")
        return {"escalation": result.data[0]}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Escalation update failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update escalation.")


# ---------------------------------------------------------------------------
# GET /dashboard/conversations/{conversation_id}/messages
# ---------------------------------------------------------------------------

@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    _: str = Depends(get_current_user),
) -> dict:
    """
    Return conversation metadata + all messages for the detail view.

    Unlike the /chat history endpoint, this requires no client_slug,
    making it simple to call from the dashboard with just a conversation ID.
    Messages include created_at timestamps for time-display in the UI.
    """
    db = get_db()

    try:
        conv_r = (
            db.table("conversations")
            .select("id, channel, status, started_at, ended_at, user_identifier, clients(name, slug), agents(name)")
            .eq("id", conversation_id)
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
        logger.error(f"Conversation messages query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load conversation messages.")
