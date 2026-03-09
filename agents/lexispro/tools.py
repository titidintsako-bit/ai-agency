"""
agents/lexispro/tools.py

Tool definitions and handler functions for the LexisPro Attorneys agent.

Three tools:
    1. check_business_hours   — Returns current SAST time and open/closed status.
    2. book_consultation      — Saves a client's consultation request to the DB.
    3. escalate_to_human      — Flags the conversation for urgent attorney review.

Usage:
    from agents.lexispro.tools import LEXISPRO_TOOLS, check_business_hours, save_consultation
"""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from core.database import get_db

logger = logging.getLogger(__name__)

_SAST = ZoneInfo("Africa/Johannesburg")


# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------

CHECK_HOURS_TOOL: dict = {
    "name": "check_business_hours",
    "description": (
        "Check whether LexisPro Attorneys is currently open or closed. "
        "Returns the current time in Cape Town (SAST) and today's office hours. "
        "Call this before answering any question about whether the firm is open "
        "or when a client asks about after-hours support."
    ),
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}

BOOK_CONSULTATION_TOOL: dict = {
    "name": "book_consultation",
    "description": (
        "Save a client's legal consultation request to the system. "
        "IMPORTANT: Only call this tool after you have collected ALL five required fields "
        "from the client in natural conversation: full name, contact number, preferred date, "
        "preferred time, and the nature of their legal matter. "
        "Do not call this tool until you have all five fields."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "client_name": {
                "type": "string",
                "description": "Client's full name.",
            },
            "contact_number": {
                "type": "string",
                "description": "Client's phone number.",
            },
            "preferred_date": {
                "type": "string",
                "description": "Preferred consultation date, exactly as the client stated it.",
            },
            "preferred_time": {
                "type": "string",
                "description": "Preferred consultation time, exactly as the client stated it.",
            },
            "legal_matter": {
                "type": "string",
                "description": (
                    "Brief description of the legal matter "
                    "(e.g. 'divorce', 'employment dispute', 'property transfer', 'will drafting')."
                ),
            },
            "is_existing_client": {
                "type": "boolean",
                "description": "True if this person has used LexisPro before.",
            },
            "notes": {
                "type": "string",
                "description": "Any additional context the client shared.",
            },
        },
        "required": [
            "client_name",
            "contact_number",
            "preferred_date",
            "preferred_time",
            "legal_matter",
        ],
    },
}

ESCALATE_TOOL: dict = {
    "name": "escalate_to_human",
    "description": (
        "Flag this conversation for urgent review by an LexisPro attorney. "
        "Use this when: "
        "(1) the client mentions an imminent court deadline or legal emergency, "
        "(2) the client is facing a restraining order or criminal matter, "
        "(3) the client explicitly asks to speak to an attorney, "
        "(4) the client makes a complaint or threat against the firm, "
        "(5) the matter is completely outside your capabilities. "
        "After calling this tool, tell the client their message has been flagged and "
        "an attorney will contact them urgently."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "reason": {
                "type": "string",
                "enum": [
                    "complaint",
                    "appointment_failed",
                    "out_of_scope",
                    "explicit_request",
                    "other",
                ],
                "description": "The category of escalation.",
            },
            "summary": {
                "type": "string",
                "description": (
                    "1–2 sentences describing why this conversation needs attorney attention. "
                    "Be specific — the attorney reading this has no other context."
                ),
            },
        },
        "required": ["reason", "summary"],
    },
}

LEXISPRO_TOOLS: list[dict] = [
    CHECK_HOURS_TOOL,
    BOOK_CONSULTATION_TOOL,
    ESCALATE_TOOL,
]


# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------

def check_business_hours() -> str:
    """Return the current SAST time and whether the firm is open."""
    now = datetime.now(_SAST)
    day_name         = now.strftime("%A")
    current_time_str = now.strftime("%H:%M")

    _HOURS: dict[str, tuple[str, str] | None] = {
        "Monday":    ("08:00", "17:00"),
        "Tuesday":   ("08:00", "17:00"),
        "Wednesday": ("08:00", "17:00"),
        "Thursday":  ("08:00", "17:00"),
        "Friday":    ("08:00", "16:00"),
        "Saturday":  None,
        "Sunday":    None,
    }

    today = _HOURS.get(day_name)

    if today is None:
        return (
            f"Current time: {current_time_str} SAST | "
            f"Today ({day_name}): Closed | "
            f"Status: CLOSED"
        )

    open_time, close_time = today
    is_open = open_time <= current_time_str <= close_time
    status  = "OPEN" if is_open else "CLOSED"

    return (
        f"Current time: {current_time_str} SAST | "
        f"Today ({day_name}): {open_time} – {close_time} | "
        f"Status: {status}"
    )


async def save_consultation(
    tool_input: dict,
    conversation_id: str,
    client_id: str,
) -> str:
    """
    Write a consultation request to the appointments table.

    Reuses the shared appointments table — service_type maps to legal_matter.
    """
    db = get_db()

    try:
        result = db.table("appointments").insert({
            "client_id":           client_id,
            "conversation_id":     conversation_id,
            "patient_name":        tool_input["client_name"],
            "contact_number":      tool_input["contact_number"],
            "preferred_date":      tool_input["preferred_date"],
            "preferred_time":      tool_input["preferred_time"],
            "service_type":        tool_input["legal_matter"],
            "is_existing_patient": tool_input.get("is_existing_client"),
            "notes":               tool_input.get("notes"),
            "status":              "pending",
        }).execute()

        appointment_id: str = result.data[0]["id"]
        reference = appointment_id.replace("-", "")[:8].upper()

        logger.info(
            f"Consultation saved | ref: {reference} | "
            f"client: {tool_input['client_name']} | "
            f"matter: {tool_input['legal_matter']} | "
            f"date: {tool_input['preferred_date']} {tool_input['preferred_time']}"
        )

        return (
            f"Consultation request saved successfully. "
            f"Reference: {reference}. "
            f"Client: {tool_input['client_name']}. "
            f"Matter: {tool_input['legal_matter']}. "
            f"Requested: {tool_input['preferred_date']} at {tool_input['preferred_time']}."
        )

    except Exception as e:
        logger.error(f"Failed to save consultation for conversation {conversation_id}: {e}")
        return (
            "ERROR: Could not save the consultation request due to a system error. "
            "Please inform the client to call 021 555 1234 directly to book."
        )
