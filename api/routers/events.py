"""
api/routers/events.py

Server-Sent Events for real-time dashboard updates.

Routes:
    GET /events/stream — streams a JSON event every 5 seconds with the current
                         pending escalation count. The dashboard Sidebar subscribes
                         to keep its badge count live without full page refreshes.

Auth note:
    The browser's native EventSource API cannot set custom request headers, so
    the JWT is passed as a ?token= query parameter instead. This is validated
    with get_current_user_from_query() which uses the same JWT secret.
"""

import asyncio
import json
import logging
from typing import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from api.dependencies import get_current_user_from_query
from core.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/events", tags=["events"])

_STREAM_INTERVAL_SEC = 5


async def _escalation_stream() -> AsyncIterator[str]:
    """
    Yield a JSON event every 5 seconds containing the pending escalation count.

    Yields SSE-format strings: "data: {...}\\n\\n"
    """
    db = get_db()
    while True:
        try:
            result = (
                db.table("escalations")
                .select("id")
                .eq("status", "pending")
                .execute()
            )
            count = len(result.data)
            payload = json.dumps({"type": "escalation_count", "count": count})
            yield f"data: {payload}\n\n"
        except Exception as e:
            logger.error(f"SSE query failed: {e}")
            # Don't close the stream on error — client will keep listening
            yield f"data: {json.dumps({'type': 'error'})}\n\n"

        await asyncio.sleep(_STREAM_INTERVAL_SEC)


@router.get("/stream")
async def event_stream(
    _: str = Depends(get_current_user_from_query),
) -> StreamingResponse:
    """
    Subscribe to real-time dashboard events.

    Connect via EventSource with the JWT in the query string:
        new EventSource(`/api/events/stream?token=${jwt}`)

    Events emitted:
        {"type": "escalation_count", "count": <int>}  — every 5 seconds

    The stream runs indefinitely. The browser will auto-reconnect if the
    connection is dropped (standard SSE behaviour).
    """
    return StreamingResponse(
        _escalation_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":   "no-cache",
            "X-Accel-Buffering": "no",     # Disable Nginx buffering (Railway uses Nginx)
            "Connection":       "keep-alive",
        },
    )
