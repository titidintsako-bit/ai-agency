"""
agents/smilecare/tools.py

Tool definitions and handler functions for the SmileCare Dental agent.

Three tools:
    1. check_business_hours  — Returns current SAST time and open/closed status.
                               Claude calls this before answering "are you open?" questions.

    2. book_appointment      — Saves a patient's appointment request to the database.
                               Claude calls this only after collecting all required fields.

    3. escalate_to_human     — Flags the conversation for urgent staff review.
                               Claude calls this for complaints, emergencies, and explicit
                               requests to speak to a person.

The tool DEFINITIONS (Anthropic JSON schema format) are constants at the top.
The tool HANDLERS (Python async functions) are below.
The SmileCareAgent.execute_tool() method routes between them.

Usage:
    from agents.smilecare.tools import SMILECARE_TOOLS, check_business_hours, save_appointment
"""

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from core.database import get_db

logger = logging.getLogger(__name__)

# South Africa Standard Time — UTC+2, no daylight saving
_SAST = ZoneInfo("Africa/Johannesburg")


def _parse_hours_config(hours_config: dict) -> dict[str, tuple[str, str] | None]:
    """
    Parse the YAML hours dict into a {DayName: (open, close) | None} map.

    YAML format:  monday: "07:00 - 18:00"  or  sunday: "Closed"
    Returns:      {"Monday": ("07:00", "18:00"), "Sunday": None, ...}
    """
    result: dict[str, tuple[str, str] | None] = {}
    for key, value in hours_config.items():
        if key == "public_holidays":
            continue
        day = key.capitalize()
        if isinstance(value, str) and " - " in value:
            open_t, close_t = value.split(" - ", 1)
            result[day] = (open_t.strip(), close_t.strip())
        else:
            result[day] = None  # "Closed" or any non-range value
    return result


# ---------------------------------------------------------------------------
# Tool definitions — Anthropic JSON schema format
# These are passed directly to the Claude API in the `tools` parameter.
# ---------------------------------------------------------------------------

CHECK_HOURS_TOOL: dict = {
    "name": "check_business_hours",
    "description": (
        "Check whether SmileCare Dental is currently open or closed. "
        "Returns the current time in Johannesburg (SAST) and today's operating hours. "
        "Call this before answering any question about whether the clinic is open, "
        "or when the patient is asking about after-hours support."
    ),
    "input_schema": {
        "type": "object",
        "properties": {},
        "required": [],
    },
}

BOOK_APPOINTMENT_TOOL: dict = {
    "name": "book_appointment",
    "description": (
        "Save a patient's appointment request to the system. "
        "IMPORTANT: Only call this tool after you have collected ALL five required fields "
        "from the patient in natural conversation: full name, contact number, preferred date, "
        "preferred time, and service type. Do not call this tool until you have all five."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "patient_name": {
                "type": "string",
                "description": "Patient's full name.",
            },
            "contact_number": {
                "type": "string",
                "description": "Patient's phone number (with country code if provided).",
            },
            "preferred_date": {
                "type": "string",
                "description": "Preferred appointment date, exactly as the patient stated it.",
            },
            "preferred_time": {
                "type": "string",
                "description": "Preferred appointment time, exactly as the patient stated it.",
            },
            "service_type": {
                "type": "string",
                "description": "The dental service the patient is booking for.",
            },
            "is_existing_patient": {
                "type": "boolean",
                "description": "True if the patient has visited SmileCare before, False if new.",
            },
            "notes": {
                "type": "string",
                "description": "Any additional information the patient mentioned (allergies, concerns, etc.).",
            },
        },
        "required": [
            "patient_name",
            "contact_number",
            "preferred_date",
            "preferred_time",
            "service_type",
        ],
    },
}

ESCALATE_TOOL: dict = {
    "name": "escalate_to_human",
    "description": (
        "Flag this conversation for urgent human review by the SmileCare team. "
        "Use this when: "
        "(1) the patient makes a complaint or expresses serious dissatisfaction, "
        "(2) the patient describes a dental emergency (severe pain, knocked-out tooth, trauma, swelling), "
        "(3) the patient explicitly asks to speak to a dentist or staff member, "
        "(4) the patient mentions legal action or a billing dispute, "
        "(5) the request is completely outside your capabilities. "
        "After calling this tool, tell the patient their message has been flagged and the team will contact them."
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
                    "1–2 sentences describing why this conversation needs human attention. "
                    "Be specific — the staff member reading this has no other context."
                ),
            },
        },
        "required": ["reason", "summary"],
    },
}

# Assembled list passed to the agent
SMILECARE_TOOLS: list[dict] = [
    CHECK_HOURS_TOOL,
    BOOK_APPOINTMENT_TOOL,
    ESCALATE_TOOL,
]


# ---------------------------------------------------------------------------
# Tool handlers
# ---------------------------------------------------------------------------

def check_business_hours(hours_config: dict | None = None) -> str:
    """
    Return the current SAST time and whether the clinic is open.

    Args:
        hours_config: The `hours` dict from clinic_info in smilecare.yaml.
                      If provided, hours are read from config so they stay in
                      sync with the YAML. Falls back to hardcoded defaults if
                      not provided.

    Returns:
        A plain-English string Claude can relay directly to the patient.
        Example: "Current time: 09:32 SAST | Today (Saturday): 08:00 – 14:00 | Status: OPEN"
    """
    now = datetime.now(_SAST)
    day_name         = now.strftime("%A")
    current_time_str = now.strftime("%H:%M")

    if hours_config:
        hours_map = _parse_hours_config(hours_config)
    else:
        # Hardcoded fallback matching smilecare.yaml — used only if config not passed
        hours_map = {
            "Monday":    ("07:00", "18:00"),
            "Tuesday":   ("07:00", "18:00"),
            "Wednesday": ("07:00", "18:00"),
            "Thursday":  ("07:00", "18:00"),
            "Friday":    ("07:00", "18:00"),
            "Saturday":  ("08:00", "14:00"),
            "Sunday":    None,
        }

    today = hours_map.get(day_name)

    if today is None:
        return (
            f"Current time: {current_time_str} SAST | "
            f"Today ({day_name}): Closed | "
            f"Status: CLOSED"
        )

    open_time, close_time = today
    is_open = open_time <= current_time_str <= close_time
    status = "OPEN" if is_open else "CLOSED"

    return (
        f"Current time: {current_time_str} SAST | "
        f"Today ({day_name}): {open_time} – {close_time} | "
        f"Status: {status}"
    )


async def save_appointment(
    tool_input: dict,
    conversation_id: str,
    client_id: str,
    contact_phone: str = "",
) -> str:
    """
    Write an appointment request to the appointments table.

    Args:
        tool_input:      The input dict Claude passed to book_appointment.
        conversation_id: UUID of the current conversation (for linking).
        client_id:       UUID of the SmileCare client record.

    Returns:
        A confirmation string with a short reference code for the patient.

    Raises:
        RuntimeError: If the database insert fails (propagated to Claude as an error string).
    """
    # Guard against Claude sending an incomplete tool call
    required = ["patient_name", "contact_number", "preferred_date", "preferred_time", "service_type"]
    missing = [f for f in required if not tool_input.get(f)]
    if missing:
        logger.warning(f"book_appointment called with missing fields: {missing}")
        return f"ERROR: Missing required fields: {', '.join(missing)}. Please collect these before booking."

    db = get_db()

    try:
        result = db.table("appointments").insert({
            "client_id":           client_id,
            "conversation_id":     conversation_id,
            "patient_name":        tool_input["patient_name"],
            "contact_number":      tool_input["contact_number"],
            "preferred_date":      tool_input["preferred_date"],
            "preferred_time":      tool_input["preferred_time"],
            "service_type":        tool_input["service_type"],
            "is_existing_patient": tool_input.get("is_existing_patient"),
            "notes":               tool_input.get("notes"),
            "status":              "pending",
        }).execute()

        appointment_id: str = result.data[0]["id"]
        # Short reference: first 8 chars of UUID, uppercased
        reference = appointment_id.replace("-", "")[:8].upper()

        logger.info(
            f"Appointment saved | ref: {reference} | "
            f"patient: {tool_input['patient_name']} | "
            f"service: {tool_input['service_type']} | "
            f"date: {tool_input['preferred_date']} {tool_input['preferred_time']}"
        )

        return (
            f"Appointment request saved successfully. "
            f"Reference: {reference}. "
            f"Patient: {tool_input['patient_name']}. "
            f"Service: {tool_input['service_type']}. "
            f"Requested: {tool_input['preferred_date']} at {tool_input['preferred_time']}."
        )

    except Exception as e:
        logger.error(f"Failed to save appointment for conversation {conversation_id}: {e}")
        phone_hint = f" Please inform the patient to call {contact_phone} directly." if contact_phone else ""
        return f"ERROR: Could not save the appointment request due to a system error.{phone_hint}"
