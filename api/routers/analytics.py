"""
api/routers/analytics.py

Aggregated analytics for the dashboard Analytics page.

All endpoints are protected — require a valid dashboard Bearer token.

Routes:
    GET /analytics/usage      — token usage (input/output) over time, grouped by period
    GET /analytics/costs      — cost_zar per client over time
    GET /analytics/resolution — conversation outcome breakdown (ended/escalated/active)
    GET /analytics/questions  — sample of recent first-user-messages per conversation
"""

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_current_user
from core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/analytics", tags=["analytics"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_iso(s: str) -> datetime:
    """Parse a Supabase TIMESTAMPTZ string into an aware datetime."""
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def _bucket_key(dt: datetime, period: str) -> str:
    """Return the grouping key for a given datetime and period."""
    if period == "daily":
        return dt.date().isoformat()                              # "2026-02-27"
    if period == "weekly":
        monday = dt - timedelta(days=dt.weekday())
        return monday.date().isoformat()                          # "2026-02-23" (Monday)
    # monthly
    return dt.strftime("%Y-%m")                                   # "2026-02"


def _lookback(period: str) -> datetime:
    now = datetime.now(timezone.utc)
    if period == "daily":
        return now - timedelta(days=30)
    if period == "weekly":
        return now - timedelta(weeks=12)
    return now - timedelta(days=365)


def _fill_zeros(data: dict, period: str) -> list[dict]:
    """
    Ensure every bucket in the period range has an entry (zero-fill gaps).
    Returns a sorted list of {date, ...} dicts.
    """
    return sorted(data.values(), key=lambda x: x["date"])


# ---------------------------------------------------------------------------
# GET /analytics/usage
# ---------------------------------------------------------------------------

@router.get("/usage")
async def get_usage(
    period: str = Query(default="daily", pattern="^(daily|weekly|monthly)$"),
    _: str = Depends(get_current_user),
) -> dict:
    """
    Aggregate token input/output and ZAR cost grouped by period.

    Returns a recharts-ready array sorted oldest → newest:
        [{"date": "2026-02-01", "input_tokens": 5000, "output_tokens": 2000, "cost_zar": 45.2}, ...]
    """
    db  = get_db()
    since = _lookback(period)

    try:
        result = (
            db.table("token_usage")
            .select("created_at, input_tokens, output_tokens, cost_zar")
            .gte("created_at", since.isoformat())
            .execute()
        )
    except Exception as e:
        logger.error(f"Usage query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load usage data.")

    buckets: dict[str, dict] = defaultdict(
        lambda: {"date": "", "input_tokens": 0, "output_tokens": 0, "cost_zar": 0.0}
    )

    for row in result.data:
        dt  = _parse_iso(row["created_at"])
        key = _bucket_key(dt, period)
        b   = buckets[key]
        b["date"]          = key
        b["input_tokens"]  += row["input_tokens"]  or 0
        b["output_tokens"] += row["output_tokens"] or 0
        b["cost_zar"]      += float(row["cost_zar"] or 0)

    # Round costs
    for b in buckets.values():
        b["cost_zar"] = round(b["cost_zar"], 2)

    return {"period": period, "data": _fill_zeros(buckets, period)}


# ---------------------------------------------------------------------------
# GET /analytics/costs
# ---------------------------------------------------------------------------

@router.get("/costs")
async def get_costs(
    period: str = Query(default="daily", pattern="^(daily|weekly|monthly)$"),
    _: str = Depends(get_current_user),
) -> dict:
    """
    Aggregate ZAR cost per client grouped by period.

    Returns recharts LineChart-ready data:
        [{"date": "2026-02-01", "SmileCare": 45.2, "total": 45.2}, ...]

    Each unique client name becomes a key in each data point.
    """
    db    = get_db()
    since = _lookback(period)

    try:
        # token_usage has client_id directly (denormalized) — join to clients for the name
        result = (
            db.table("token_usage")
            .select("created_at, cost_zar, clients(name)")
            .gte("created_at", since.isoformat())
            .execute()
        )
    except Exception as e:
        logger.error(f"Costs query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load cost data.")

    # {bucket_key: {client_name: cost, "total": cost, "date": key}}
    buckets: dict[str, dict] = defaultdict(lambda: {"date": "", "total": 0.0})
    client_names: set[str] = set()

    for row in result.data:
        dt          = _parse_iso(row["created_at"])
        key         = _bucket_key(dt, period)
        client_name = (row.get("clients") or {}).get("name") or "Unknown"
        cost        = float(row["cost_zar"] or 0)

        b = buckets[key]
        b["date"]  = key
        b[client_name] = round(b.get(client_name, 0.0) + cost, 2)
        b["total"]     = round(b["total"] + cost, 2)
        client_names.add(client_name)

    return {
        "period":  period,
        "clients": sorted(client_names),
        "data":    _fill_zeros(buckets, period),
    }


# ---------------------------------------------------------------------------
# GET /analytics/resolution
# ---------------------------------------------------------------------------

@router.get("/resolution")
async def get_resolution(_: str = Depends(get_current_user)) -> dict:
    """
    Conversation outcome breakdown for the last 30 days.

    Returns counts and a resolution_rate percentage:
        {"completed": 45, "escalated": 5, "active": 3, "abandoned": 2,
         "total": 55, "resolution_rate": 81.8}
    """
    db    = get_db()
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    try:
        result = (
            db.table("conversations")
            .select("status")
            .gte("started_at", since)
            .execute()
        )
    except Exception as e:
        logger.error(f"Resolution query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load resolution data.")

    counts: dict[str, int] = defaultdict(int)
    for row in result.data:
        counts[row["status"]] += 1

    total      = sum(counts.values())
    completed  = counts.get("completed", 0)
    rate       = round((completed / total * 100), 1) if total else 0.0

    return {
        "completed":       completed,
        "escalated":       counts.get("escalated", 0),
        "active":          counts.get("active", 0),
        "abandoned":       counts.get("abandoned", 0),
        "total":           total,
        "resolution_rate": rate,
    }


# ---------------------------------------------------------------------------
# GET /analytics/questions
# ---------------------------------------------------------------------------

@router.get("/funnel")
async def get_funnel(_: str = Depends(get_current_user)) -> dict:
    """
    Conversation funnel for the last 30 days.

    Returns stage counts showing how conversations progress through the platform:
        Started → Engaged → Booked → Escalated / Completed

    Frontend renders this as a horizontal bar funnel chart.
    """
    db    = get_db()
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    try:
        # Stage 1 — All conversations started
        all_conv  = db.table("conversations").select("id, status").gte("started_at", since).execute()
        total     = len(all_conv.data)

        # Stage 2 — Conversations that were not immediately abandoned (had some engagement)
        engaged   = sum(1 for r in all_conv.data if r["status"] != "abandoned")

        # Stage 3 — Appointment requests logged
        appt_r    = db.table("appointments").select("id").gte("created_at", since).execute()
        booked    = len(appt_r.data)

        # Stage 4 — Completed without escalation
        completed = sum(1 for r in all_conv.data if r["status"] == "completed")

        # Stage 5 — Escalated to human
        escalated = sum(1 for r in all_conv.data if r["status"] == "escalated")

    except Exception as e:
        logger.error(f"Funnel query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load funnel data.")

    return {
        "period": "last 30 days",
        "funnel": [
            {"stage": "Conversations Started", "count": total,     "color": "#6366f1"},
            {"stage": "Engaged",               "count": engaged,   "color": "#58a6ff"},
            {"stage": "Appointments Booked",   "count": booked,    "color": "#3fb950"},
            {"stage": "Completed",             "count": completed, "color": "#8b949e"},
            {"stage": "Escalated",             "count": escalated, "color": "#f85149"},
        ],
    }


@router.get("/questions")
async def get_top_questions(_: str = Depends(get_current_user)) -> dict:
    """
    Return the first user message from the last 50 conversations.

    These are the actual opening questions customers ask — useful for
    spotting gaps in your agent's knowledge base.
    """
    db = get_db()

    try:
        # Get recent conversation IDs
        conv_r = (
            db.table("conversations")
            .select("id")
            .order("started_at", desc=True)
            .limit(50)
            .execute()
        )
        conv_ids = [r["id"] for r in conv_r.data]

        if not conv_ids:
            return {"questions": []}

        # For each conversation, get its first user message
        # We can't do a proper per-group LIMIT in PostgREST, so fetch all user messages
        # for those conversations ordered by created_at and de-dup in Python
        msg_r = (
            db.table("messages")
            .select("conversation_id, content, created_at")
            .eq("role", "user")
            .in_("conversation_id", conv_ids)
            .order("created_at", desc=False)
            .execute()
        )

        # Keep only the first user message per conversation
        seen: set[str] = set()
        questions: list[str] = []
        for row in msg_r.data:
            cid = row["conversation_id"]
            if cid not in seen:
                seen.add(cid)
                questions.append(row["content"])

        return {"questions": questions[:50]}

    except Exception as e:
        logger.error(f"Questions query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load question data.")
