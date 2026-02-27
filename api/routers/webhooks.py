"""
api/routers/webhooks.py

Twilio WhatsApp webhook handler.

Routes:
    POST /webhooks/whatsapp/{client_slug}

How it works:
    1. Twilio sends an HTTP POST when a WhatsApp message arrives
    2. We validate the Twilio signature (production only) to prevent spoofing
    3. We look up the agent for this client slug on the 'whatsapp' channel
    4. We find or create a conversation for this user's phone number
    5. We run the agent and get a reply
    6. We return TwiML XML — Twilio reads it and sends the reply to the user

Twilio configuration (do once per client in the Twilio console):
    WhatsApp Sandbox → "When a message comes in" →
    set to: POST https://your-api.railway.app/webhooks/whatsapp/smilecare

Conversation continuity:
    WhatsApp conversations are multi-turn across multiple HTTP requests.
    We use the sender's phone number as user_identifier and look up any
    existing active conversation. If none exists, we start a new one.

Signature validation:
    Enabled only when ENVIRONMENT=production AND Twilio credentials are set.
    In development, requests are accepted without validation so you can test
    from Postman or the Twilio sandbox without ngrok setup.
"""

import logging
from xml.sax.saxutils import escape as xml_escape

from fastapi import APIRouter, Form, HTTPException, Request, Response

from api.registry import registry
from config.settings import get_settings
from core.memory import get_active_conversation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/whatsapp/{client_slug}")
async def whatsapp_webhook(
    client_slug: str,
    request:     Request,
    From:        str = Form(...),   # Twilio field: sender e.g. "whatsapp:+27821234567"
    To:          str = Form(...),   # Twilio field: our number e.g. "whatsapp:+14155238886"
    Body:        str = Form(...),   # Twilio field: message text
    MessageSid:  str = Form(...),   # Twilio field: unique message ID
) -> Response:
    """
    Receive a WhatsApp message from Twilio and reply via TwiML.

    Args:
        client_slug: Identifies which agent should handle this message.
        From:        Sender's WhatsApp number (with "whatsapp:" prefix).
        To:          Our Twilio number (with "whatsapp:" prefix).
        Body:        The message text.
        MessageSid:  Unique identifier for this Twilio message.

    Returns:
        TwiML XML response that Twilio uses to send the reply.
    """
    settings = get_settings()

    # ── Step 1: Validate Twilio signature in production ──────────────────
    if settings.is_production and settings.has_twilio:
        if not await _validate_twilio_signature(request, settings.twilio_auth_token):
            logger.warning(
                f"Invalid Twilio signature on webhook for {client_slug}. "
                f"MessageSid: {MessageSid}"
            )
            raise HTTPException(status_code=403, detail="Invalid Twilio signature.")

    logger.info(
        f"WhatsApp message received | client: {client_slug} | "
        f"from: {From} | sid: {MessageSid} | "
        f"body: {Body[:80]}{'...' if len(Body) > 80 else ''}"
    )

    # ── Step 2: Resolve the agent ─────────────────────────────────────────
    agent = registry.get(client_slug, "whatsapp")

    if agent is None:
        logger.error(
            f"No WhatsApp agent found for '{client_slug}'. "
            f"Loaded agents: {registry.list_agents()}"
        )
        # Return a polite TwiML response — don't expose the internal error to Twilio
        return _twiml_reply(
            "Sorry, this service is temporarily unavailable. Please call us directly."
        )

    # ── Step 3: Find or create a conversation for this phone number ───────
    # Strip the "whatsapp:" prefix for storage — store just the phone number
    phone_number = From.replace("whatsapp:", "").strip()

    conversation_id = get_active_conversation(
        agent_id=agent.agent_id,
        user_identifier=phone_number,
    )

    if conversation_id is None:
        conversation_id = await agent.start_conversation(
            channel="whatsapp",
            user_identifier=phone_number,
            metadata={
                "twilio_from": From,
                "twilio_to":   To,
                "first_sid":   MessageSid,
            },
        )
        logger.info(
            f"New WhatsApp conversation: {conversation_id} | phone: {phone_number}"
        )
    else:
        logger.info(
            f"Resuming WhatsApp conversation: {conversation_id} | phone: {phone_number}"
        )

    # ── Step 4: Run the agent ─────────────────────────────────────────────
    try:
        result = await agent.chat(
            user_message=Body,
            conversation_id=conversation_id,
        )
    except Exception as e:
        logger.error(
            f"Agent inference failed | conversation: {conversation_id} | error: {e}",
            exc_info=True,
        )
        return _twiml_reply(
            "I'm sorry, I encountered a technical issue. "
            "Please try again or call us on +27 11 234 5678."
        )

    # ── Step 5: Return TwiML reply ────────────────────────────────────────
    if result.was_escalated:
        logger.warning(
            f"Escalation on WhatsApp | conversation: {conversation_id} | "
            f"phone: {phone_number}"
        )

    return _twiml_reply(result.message)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _twiml_reply(message: str) -> Response:
    """
    Wrap a message in TwiML XML and return a FastAPI Response.

    The message text is XML-escaped to prevent injection via special characters
    like <, >, &. Twilio sends this response as a WhatsApp message to the user.

    Args:
        message: The reply text to send.

    Returns:
        A FastAPI Response with content-type application/xml.
    """
    safe_message = xml_escape(message)
    twiml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<Response>"
        f"<Message>{safe_message}</Message>"
        "</Response>"
    )
    return Response(content=twiml, media_type="application/xml")


async def _validate_twilio_signature(request: Request, auth_token: str) -> bool:
    """
    Validate the X-Twilio-Signature header to confirm the request came from Twilio.

    Twilio signs every webhook request using HMAC-SHA1 with your auth token.
    See: https://www.twilio.com/docs/usage/webhooks/webhooks-security

    Args:
        request:    The incoming FastAPI request.
        auth_token: Twilio auth token from settings.

    Returns:
        True if the signature is valid, False otherwise.
    """
    try:
        from twilio.request_validator import RequestValidator

        signature = request.headers.get("X-Twilio-Signature", "")
        url        = str(request.url)
        form_data  = dict(await request.form())

        validator = RequestValidator(auth_token)
        return validator.validate(url, form_data, signature)

    except Exception as e:
        logger.error(f"Twilio signature validation error: {e}")
        return False
