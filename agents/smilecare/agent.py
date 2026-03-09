"""
agents/smilecare/agent.py

SmileCare Dental agent — the first production client implementation.

SmileCareAgent inherits from BaseAgent and implements:
    - system_prompt  — built dynamically from smilecare.yaml so updates to clinic
                       info (hours, prices, services) only require editing the YAML
    - tools          — the three SmileCare tools defined in tools.py
    - execute_tool() — routes tool calls to their handlers

This file is the template for all future client agents. To create a new client:
    1. Copy this file to agents/<client_slug>/agent.py
    2. Create agents/<client_slug>/tools.py with client-specific tools
    3. Create config/clients/<client_slug>.yaml with client data
    4. Update the system prompt builder for that client's industry

Instantiation:
    agent = SmileCareAgent(
        client_id="<uuid-from-clients-table>",
        agent_id="<uuid-from-agents-table>",
        channel="web",     # or "whatsapp"
    )

    conversation_id = await agent.start_conversation(channel="web", user_identifier="session_abc123")
    response = await agent.chat("What are your opening hours?", conversation_id)
    print(response.message)
"""

import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yaml

_SAST = timezone(timedelta(hours=2))

from agents.smilecare.tools import (
    SMILECARE_TOOLS,
    check_business_hours,
    save_appointment,
)
from core.agent_base import BaseAgent

logger = logging.getLogger(__name__)

# Path to the YAML config — relative to this file's location
_CONFIG_PATH = Path(__file__).parent.parent.parent / "config" / "clients" / "smilecare.yaml"


# ---------------------------------------------------------------------------
# Agent class
# ---------------------------------------------------------------------------

class SmileCareAgent(BaseAgent):
    """
    Virtual receptionist for SmileCare Dental, Sandton.

    All clinic-specific knowledge (hours, services, pricing, address) is loaded
    from smilecare.yaml at instantiation time and compiled into the system prompt.
    Updating the YAML is sufficient to change what the agent knows — no code change
    required.

    Args:
        client_id: UUID from the clients table for SmileCare.
        agent_id:  UUID from the agents table for this specific channel.
        channel:   'web' | 'whatsapp' — logged with the conversation but does not
                   change agent behaviour (same logic, different UI wrapper).
    """

    def __init__(
        self,
        client_id: str,
        agent_id: str,
        channel: str = "web",
    ) -> None:
        super().__init__(
            client_id=client_id,
            agent_id=agent_id,
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
        )

        self.channel = channel

        # Load the YAML config once — stored as instance attribute
        try:
            with open(_CONFIG_PATH, encoding="utf-8") as f:
                self._config: dict = yaml.safe_load(f)
        except FileNotFoundError:
            raise FileNotFoundError(
                f"SmileCare config not found at {_CONFIG_PATH}. "
                f"Ensure config/clients/smilecare.yaml exists."
            )

        # Build the system prompt once and cache it — no need to rebuild every turn
        self._system_prompt_text: str = _build_system_prompt(self._config)

        logger.info(
            f"SmileCareAgent initialised | client: {client_id} | "
            f"agent: {agent_id} | channel: {channel}"
        )

    # -----------------------------------------------------------------------
    # BaseAgent interface implementation
    # -----------------------------------------------------------------------

    @property
    def system_prompt(self) -> str:
        """Return the system prompt with today's date and time prepended."""
        now = datetime.now(_SAST)
        date_line = (
            f"Current date and time (SAST): "
            f"{now.strftime('%A, %d %B %Y — %H:%M')}\n\n"
        )
        return date_line + self._system_prompt_text

    @property
    def tools(self) -> list[dict]:
        """Return the three SmileCare tools."""
        return SMILECARE_TOOLS

    async def execute_tool(
        self,
        tool_name: str,
        tool_input: dict,
        conversation_id: str,
    ) -> str:
        """
        Route a tool call from Claude to the correct handler.

        Args:
            tool_name:       Name of the tool Claude chose to call.
            tool_input:      Arguments Claude passed to the tool.
            conversation_id: Current conversation UUID.

        Returns:
            Result string sent back to Claude as the tool result.
        """
        if tool_name == "check_business_hours":
            # Synchronous — just computes current SAST time, no I/O
            return check_business_hours()

        if tool_name == "book_appointment":
            # Async — writes to the appointments table
            return await save_appointment(
                tool_input=tool_input,
                conversation_id=conversation_id,
                client_id=self.client_id,
            )

        if tool_name == "escalate_to_human":
            # Calls BaseAgent.escalate() which writes to escalations table
            # and sets _escalated_this_turn = True
            escalation_id = await self.escalate(
                conversation_id=conversation_id,
                reason=tool_input["reason"],
                summary=tool_input["summary"],
            )
            short_ref = escalation_id.replace("-", "")[:8].upper()
            logger.warning(
                f"Escalation triggered | ref: {short_ref} | "
                f"reason: {tool_input['reason']} | "
                f"summary: {tool_input['summary']}"
            )
            return f"Escalation created successfully. Reference: {short_ref}."

        # Unknown tool — log and return an informative error to Claude
        logger.error(
            f"Unknown tool '{tool_name}' called by SmileCareAgent. "
            f"Input: {tool_input}"
        )
        return (
            f"Error: Tool '{tool_name}' is not implemented. "
            f"Available tools: check_business_hours, book_appointment, escalate_to_human."
        )


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

def _build_system_prompt(config: dict) -> str:
    """
    Construct the full system prompt from the smilecare.yaml config.

    Building the prompt from config (rather than hardcoding it) means that
    updating clinic hours, services, or pricing only requires editing the YAML.
    No code changes, no redeployment of agent logic.

    The prompt uses Unicode box-drawing separators to help Claude Haiku parse
    distinct sections reliably — important for a smaller model.

    Args:
        config: Parsed YAML dict from smilecare.yaml.

    Returns:
        The complete system prompt string.
    """
    agent_name = config.get("agent_name", "Lerato")
    info       = config["clinic_info"]
    hours      = info["hours"]
    services   = config["services"]

    # ── Format services list ──────────────────────────────────────────────
    services_block = "\n".join(
        f"  • {svc['name']:<38} {svc.get('price_display', 'R' + str(svc['price_zar']))}  ({svc['duration_minutes']} min)"
        for svc in services
    )

    # ── Format hours table ────────────────────────────────────────────────
    hours_block = "\n".join(
        f"  {day:<16} {time}"
        for day, time in hours.items()
    )

    # ── Medical aids ──────────────────────────────────────────────────────
    medical_aids = config.get("medical_aids", [])
    aids_list = ", ".join(medical_aids) if medical_aids else "available — ask our team"

    # ── Dentists ──────────────────────────────────────────────────────────
    dentists = config.get("dentists", [])
    dentists_block = "\n".join(
        f"  • {d['name']} — {d.get('role', '')}"
        for d in dentists
    )

    # ── Escalation triggers ───────────────────────────────────────────────
    escalation_triggers = config.get("escalation", {}).get("triggers", [])
    triggers_list = "\n".join(f"  • {t}" for t in escalation_triggers)

    prompt = f"""You are {agent_name}, the friendly and professional virtual receptionist for SmileCare Dental in Sandton, Johannesburg. You are warm, caring, and efficient — exactly what patients need when they contact a dental practice.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR IDENTITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Your name is {agent_name}. You are SmileCare's virtual receptionist — available 24/7.
  If anyone asks whether you are a bot, AI, or robot, respond with:
    "I'm SmileCare's virtual receptionist, here to help 24/7. How can I assist you today?"
  Never describe yourself as an AI, chatbot, or language model.
  Never break character under any circumstances.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT YOU DO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • Answer questions about the clinic (location, hours, services, pricing)
  • Introduce patients to our team of dentists
  • Clarify medical aid options
  • Collect information to book appointment requests
  • Handle after-hours inquiries with care
  • Escalate urgent matters to the SmileCare team

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLINIC DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Main branch:  {info['address']}
  Satellite:    {info.get('branch_rosebank', 'Rosebank (satellite branch)')}
  Phone:        {info['phone']}
  WhatsApp:     {info['whatsapp']}
  Email:        {info['email']}
  Website:      {info['website']}
  Emergency:    {info['emergency_contact']}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUSINESS HOURS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{hours_block}
  Public Holidays: Closed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUR DENTISTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{dentists_block}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MEDICAL AIDS ACCEPTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {aids_list}
  For medical aid billing queries, please call us directly on {info['phone']}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SERVICES & PRICING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{services_block}

  Prices include VAT. Some treatments have variable pricing — final quote provided at consultation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BOOKING AN APPOINTMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To book an appointment you need to collect ALL FIVE of these from the patient:
  1. Full name
  2. Contact phone number
  3. Preferred date
  4. Preferred time
  5. Which service they need

IMPORTANT: Collect these naturally, one at a time, in conversation. Do NOT ask
for all five fields at once — that feels like filling out a form, not talking to a person.

Once you have all five, call the book_appointment tool.
After a successful booking, tell the patient:
  "Your request has been logged. Our team will call you within 2 hours during
   business hours to confirm your exact appointment time."

If the patient contacts us outside business hours, still collect their details
and explain that the team will follow up when the clinic opens.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHECKING OPENING HOURS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If a patient asks whether the clinic is currently open, or if you are unsure,
call check_business_hours before responding. Never guess.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESCALATION — WHEN TO CALL escalate_to_human
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Escalate immediately when:
{triggers_list}

After calling escalate_to_human, tell the patient:
  "I understand this requires immediate attention. I've flagged your message for
   one of our team members who will contact you as soon as possible.
   For urgent matters, please call {info['emergency_contact']} directly."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TONE & COMMUNICATION STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • Warm but professional — friendly like a good receptionist, not chatty
  • South African context: use "ja" sparingly for warmth, "eish" only if the patient uses it first
  • Acknowledge when something sounds painful or worrying ("That sounds uncomfortable — let's get you seen quickly")
  • Keep responses concise — patients are often on mobile devices
  • Never use corporate jargon or overly formal language

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • NEVER diagnose or recommend specific treatments. Always say "our dentists
    will assess you properly when you come in."
  • NEVER confirm an appointment yourself — only the SmileCare team can confirm slots.
  • Use "R" for prices (e.g. R850, not ZAR 850 or 850 rand).
  • If a patient writes in Afrikaans or Zulu, respond in the same language if you can.
  • If asked something you don't know, say so honestly and offer to escalate.
  • Never make up information — if unsure, direct the patient to call {info['phone']}.
"""

    return prompt.strip()
