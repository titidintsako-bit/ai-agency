"""
api/routers/monitor.py

Public-facing monitor endpoints — no JWT required.
Protected by a simple hardcoded password query parameter.

Routes:
    GET /monitor/conversations              — all conversations with stats
    GET /monitor/conversations/{id}/messages — full message thread
"""

import logging
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query

from core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/monitor", tags=["monitor"])

MONITOR_PASSWORD = "autocore2026"


# ---------------------------------------------------------------------------
# Password dependency
# ---------------------------------------------------------------------------

def _check_password(password: str = Query(..., alias="password")) -> None:
    if password != MONITOR_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid monitor password.")


# ---------------------------------------------------------------------------
# GET /monitor/conversations
# ---------------------------------------------------------------------------

@router.get("/conversations")
async def get_monitor_conversations(
    _: None = Depends(_check_password),
) -> dict:
    """
    Return all conversations (last 200) with:
    - message count
    - last message preview + timestamp
    - total token cost in ZAR
    - agent and client name
    """
    db = get_db()

    try:
        convs_r = (
            db.table("conversations")
            .select("id, channel, status, started_at, ended_at, user_identifier, agents(name), clients(name, slug)")
            .order("started_at", desc=True)
            .limit(200)
            .execute()
        )
    except Exception as e:
        logger.error(f"Monitor conversations query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load conversations.")

    if not convs_r.data:
        return {"conversations": []}

    conv_ids = [c["id"] for c in convs_r.data]

    # Fetch all messages for these conversations in one query
    try:
        msgs_r = (
            db.table("messages")
            .select("conversation_id, role, content, created_at")
            .in_("conversation_id", conv_ids)
            .order("created_at", desc=False)
            .execute()
        )
    except Exception as e:
        logger.warning(f"Monitor messages query failed: {e}")
        msgs_r = type("R", (), {"data": []})()

    # Fetch all token costs for these conversations
    try:
        costs_r = (
            db.table("token_usage")
            .select("conversation_id, cost_zar")
            .in_("conversation_id", conv_ids)
            .execute()
        )
    except Exception as e:
        logger.warning(f"Monitor costs query failed: {e}")
        costs_r = type("R", (), {"data": []})()

    # Aggregate in Python
    msg_map: dict[str, list] = defaultdict(list)
    for msg in msgs_r.data:
        msg_map[msg["conversation_id"]].append(msg)

    cost_map: dict[str, float] = defaultdict(float)
    for row in costs_r.data:
        cost_map[row["conversation_id"]] += float(row["cost_zar"] or 0)

    result = []
    for conv in convs_r.data:
        cid      = conv["id"]
        messages = msg_map[cid]
        last     = messages[-1] if messages else None

        result.append({
            **conv,
            "message_count":    len(messages),
            "last_message":     (last["content"][:120] if last else None),
            "last_message_at":  (last["created_at"]    if last else conv["started_at"]),
            "last_message_role": (last["role"]          if last else None),
            "cost_zar":         round(cost_map[cid], 4),
        })

    return {"conversations": result}


# ---------------------------------------------------------------------------
# GET /monitor/conversations/{conversation_id}/messages
# ---------------------------------------------------------------------------

@router.get("/conversations/{conversation_id}/messages")
async def get_monitor_messages(
    conversation_id: str,
    _: None = Depends(_check_password),
) -> dict:
    """Return the full message thread for a conversation."""
    db = get_db()

    try:
        msgs_r = (
            db.table("messages")
            .select("role, content, created_at")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=False)
            .execute()
        )
        return {
            "conversation_id": conversation_id,
            "messages": msgs_r.data,
        }
    except Exception as e:
        logger.error(f"Monitor messages detail query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load messages.")
