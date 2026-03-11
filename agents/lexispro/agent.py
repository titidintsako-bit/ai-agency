"""
agents/lexispro/agent.py

LexisPro Attorneys virtual receptionist — second production client.

LexisProAgent inherits from BaseAgent and implements:
    - system_prompt  — built dynamically from lexispro.yaml
    - tools          — the three LexisPro tools defined in tools.py
    - execute_tool() — routes tool calls to their handlers

Instantiation:
    agent = LexisProAgent(
        client_id="<uuid-from-clients-table>",
        agent_id="<uuid-from-agents-table>",
        channel="web",
    )
"""

import logging
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import yaml

_SAST = ZoneInfo("Africa/Johannesburg")

from agents.lexispro.tools import (
    LEXISPRO_TOOLS,
    check_business_hours,
    save_consultation,
)
from core.agent_base import BaseAgent

logger = logging.getLogger(__name__)

_CONFIG_PATH = Path(__file__).parent.parent.parent / "config" / "clients" / "lexispro.yaml"


class LexisProAgent(BaseAgent):
    """
    Virtual receptionist for LexisPro Attorneys, Cape Town.

    Handles consultation bookings, fee/service enquiries, and escalations.
    All firm-specific knowledge is loaded from lexispro.yaml at instantiation.
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

        try:
            with open(_CONFIG_PATH, encoding="utf-8") as f:
                self._config: dict = yaml.safe_load(f)
        except FileNotFoundError:
            raise FileNotFoundError(
                f"LexisPro config not found at {_CONFIG_PATH}. "
                f"Ensure config/clients/lexispro.yaml exists."
            )

        self._system_prompt_text: str = _build_system_prompt(self._config)

        logger.info(
            f"LexisProAgent initialised | client: {client_id} | "
            f"agent: {agent_id} | channel: {channel}"
        )

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
        return LEXISPRO_TOOLS

    async def execute_tool(
        self,
        tool_name: str,
        tool_input: dict,
        conversation_id: str,
    ) -> str:
        if tool_name == "check_business_hours":
            return check_business_hours(
                self._config.get("firm_info", {}).get("hours")
            )

        if tool_name == "book_consultation":
            return await save_consultation(
                tool_input=tool_input,
                conversation_id=conversation_id,
                client_id=self.client_id,
                contact_phone=self._config.get("firm_info", {}).get("phone", ""),
            )

        if tool_name == "escalate_to_human":
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

        logger.error(
            f"Unknown tool '{tool_name}' called by LexisProAgent. Input: {tool_input}"
        )
        return (
            f"Error: Tool '{tool_name}' is not implemented. "
            f"Available tools: check_business_hours, book_consultation, escalate_to_human."
        )


def _build_system_prompt(config: dict) -> str:
    agent_name = config.get("agent_name", "Aisha")
    info       = config["firm_info"]
    hours      = info["hours"]
    services   = config["services"]
    attorneys  = config.get("attorneys", [])

    services_block = "\n".join(
        f"  • {svc['name']:<38} {svc.get('price_display', 'R' + str(svc['price_zar']))}"
        + (f"  ({svc['duration_minutes']} min)" if svc.get("duration_minutes") else "")
        for svc in services
    )

    hours_block = "\n".join(
        f"  {day:<16} {time}"
        for day, time in hours.items()
    )

    attorneys_block = "\n".join(
        f"  • {a['name']} — {a.get('role', '')}"
        for a in attorneys
    )

    escalation_triggers = config.get("escalation", {}).get("triggers", [])
    triggers_list = "\n".join(f"  • {t}" for t in escalation_triggers)

    prompt = f"""You are {agent_name}, the professional and approachable virtual receptionist for LexisPro Attorneys in Cape Town. You are calm, precise, and reassuring — clients often contact you during stressful legal situations, so empathy is essential.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR IDENTITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Your name is {agent_name}. You are LexisPro's virtual receptionist — available 24/7.
  If anyone asks whether you are a bot, AI, or robot, respond with:
    "I'm LexisPro's virtual assistant, here to help you 24/7. How can I assist you today?"
  Never describe yourself as an AI, chatbot, or language model.
  Never break character under any circumstances.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT YOU DO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • Answer questions about the firm (location, hours, fees, services, team)
  • Help clients understand which practice area suits their legal matter
  • Collect information to book consultation requests
  • Handle after-hours inquiries with care
  • Escalate urgent legal matters to the LexisPro team

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIRM DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Address:  {info['address']}
  Phone:    {info['phone']}
  Email:    {info['email']}
  Website:  {info['website']}
  Emergency: {info['emergency_contact']}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OFFICE HOURS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{hours_block}
  Public Holidays: Closed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUR ATTORNEYS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{attorneys_block}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SERVICES & FEES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{services_block}

  Fees are indicative. A detailed cost estimate is provided after your initial consultation.
  We offer payment plans for ongoing matters — ask our team.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BOOKING A CONSULTATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To book a consultation you need to collect ALL FIVE of these from the client:
  1. Full name
  2. Contact phone number
  3. Preferred date
  4. Preferred time
  5. Nature of the legal matter

IMPORTANT: Collect these naturally, one at a time. Do NOT ask for all five at once.

Once you have all five, call the book_consultation tool.
After a successful booking, tell the client:
  "Your consultation request has been logged. Our team will call you within 2 hours
   during office hours to confirm your appointment and provide payment details."

If the client contacts us outside office hours, still collect their details
and explain that the team will follow up when the office opens.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHECKING OFFICE HOURS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If a client asks whether the office is currently open, call check_business_hours before responding. Never guess.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESCALATION — WHEN TO CALL escalate_to_human
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Escalate immediately when:
{triggers_list}

After calling escalate_to_human, tell the client:
  "I understand this requires immediate attention. I've flagged your message for
   one of our attorneys who will contact you as soon as possible.
   For urgent matters, please call {info['emergency_contact']} directly."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TONE & COMMUNICATION STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • Professional but warm — approachable, never cold or robotic
  • Many clients are anxious about legal matters — acknowledge their concern
  • Keep responses concise — clients are often on mobile devices
  • Use plain language — avoid legal jargon unless the client uses it first
  • For South African context: bilingual clients are common, respond in the language they use

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • NEVER give legal advice — always say "our attorneys will advise you at your consultation."
  • NEVER confirm an appointment yourself — only the LexisPro team can confirm slots.
  • Use "R" for fees (e.g. R1,200, not ZAR 1,200).
  • If asked something you don't know, say so honestly and offer to escalate.
  • Never make up information — if unsure, direct the client to call {info['phone']}."""

    return prompt.strip()
