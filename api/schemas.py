"""
api/schemas.py

Pydantic models for all API request and response bodies.

Keeping schemas in one file makes it easy to see the full API contract at a glance
and to update validation rules without hunting across multiple router files.
"""

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Chat endpoint — POST /chat/{client_slug}
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    """
    Body sent by the web widget or any direct API caller.

    Fields:
        message:         The user's message text. Required, non-empty.
        conversation_id: UUID of an existing session. If None, a new conversation
                         is started automatically.
        channel:         Which channel this message came from. Defaults to 'web'.
        user_identifier: Anonymised user reference (session token, email, etc.).
                         Optional — used for logging and WhatsApp thread resumption.
    """
    message:         str            = Field(..., min_length=1, max_length=4096)
    conversation_id: str | None     = Field(default=None)
    channel:         str            = Field(default="web")
    user_identifier: str | None     = Field(default=None)


class TokenMetadata(BaseModel):
    """Token usage and cost for a single agent turn."""
    input_tokens:  int
    output_tokens: int
    cost_zar:      float


class ChatResponse(BaseModel):
    """
    Response returned to the web widget or API caller after each message.

    Fields:
        message:         The agent's reply to display to the user.
        conversation_id: UUID of the session (new or existing). The client must
                         store this and send it back on every subsequent message
                         in the same conversation.
        was_escalated:   True if this turn triggered a human escalation. The UI
                         should surface this to the user (e.g. show a banner saying
                         "A team member will contact you shortly.").
        tokens:          Token usage and ZAR cost for this turn. Useful for the
                         dashboard but can be ignored by the chat widget.
    """
    message:         str
    conversation_id: str
    was_escalated:   bool
    tokens:          TokenMetadata


# ---------------------------------------------------------------------------
# Health check — GET /health
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    """Returned by the Railway health check endpoint."""
    status:      str   # "ok" | "degraded"
    environment: str
    db_connected: bool
