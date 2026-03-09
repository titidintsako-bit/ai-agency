"""
core/memory.py

All database operations for conversations, messages, and escalations.

This module is the single point of contact between the agent framework and
Supabase for anything conversation-related. It is intentionally synchronous —
the Supabase PostgREST client is fast enough that blocking is not a concern
at our traffic volumes. If concurrency becomes an issue, each function can be
wrapped with asyncio.to_thread() at the call site.

Functions:
    create_conversation()      — start a new session, returns conversation_id
    end_conversation()         — mark a session completed / escalated / abandoned
    get_active_conversation()  — find an existing active session by user + agent
    save_message()             — persist a single message turn
    get_message_history()      — load history in Anthropic API format
    create_escalation()        — flag a conversation for human review
"""

import asyncio
import logging
from datetime import datetime, timezone

from core.database import get_db

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------

def create_conversation(
    agent_id: str,
    client_id: str,
    channel: str,
    user_identifier: str | None = None,
    metadata: dict | None = None,
) -> str:
    """
    Insert a new row into the conversations table.

    Args:
        agent_id:        UUID of the agent handling this session.
        client_id:       UUID of the client this agent belongs to.
        channel:         'web' | 'whatsapp' | 'email'
        user_identifier: Anonymised user reference (phone, session token, email).
        metadata:        Optional dict for channel-specific extras (Twilio SID, etc.)

    Returns:
        The new conversation's UUID as a string.

    Raises:
        RuntimeError: If the insert fails.
    """
    db = get_db()

    try:
        result = db.table("conversations").insert({
            "agent_id": agent_id,
            "client_id": client_id,
            "channel": channel,
            "user_identifier": user_identifier,
            "metadata": metadata or {},
            "status": "active",
        }).execute()

        conversation_id: str = result.data[0]["id"]
        logger.info(f"Created conversation {conversation_id} for agent {agent_id}")
        return conversation_id

    except Exception as e:
        logger.error(f"Failed to create conversation: {e}")
        raise RuntimeError(f"Could not create conversation record: {e}") from e


def get_active_conversation(agent_id: str, user_identifier: str) -> str | None:
    """
    Find an existing active conversation for this user + agent combination.

    Used by the WhatsApp webhook to resume an ongoing thread instead of
    starting a new conversation on every message.

    Args:
        agent_id:        UUID of the agent.
        user_identifier: The user's phone number, session token, or email.

    Returns:
        The conversation UUID if an active session exists, otherwise None.
    """
    db = get_db()

    try:
        result = (
            db.table("conversations")
            .select("id")
            .eq("agent_id", agent_id)
            .eq("user_identifier", user_identifier)
            .eq("status", "active")
            .order("started_at", desc=True)
            .limit(1)
            .execute()
        )
        return result.data[0]["id"] if result.data else None

    except Exception as e:
        logger.error(f"Failed to look up active conversation for {user_identifier}: {e}")
        return None


def end_conversation(conversation_id: str, status: str = "completed") -> None:
    """
    Mark a conversation as no longer active.

    Args:
        conversation_id: UUID of the conversation to close.
        status:          'completed' | 'escalated' | 'abandoned'

    Note:
        'escalated' is set automatically when create_escalation() is called.
        Calling this with 'completed' is safe even if the conversation was
        already escalated — the status check is the agent's responsibility.
    """
    valid_statuses = ("completed", "escalated", "abandoned")
    if status not in valid_statuses:
        raise ValueError(f"Invalid status '{status}'. Must be one of: {valid_statuses}")

    db = get_db()

    try:
        db.table("conversations").update({
            "status": status,
            "ended_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", conversation_id).execute()

        logger.info(f"Conversation {conversation_id} marked as '{status}'")

    except Exception as e:
        logger.error(f"Failed to end conversation {conversation_id}: {e}")
        raise RuntimeError(f"Could not update conversation status: {e}") from e


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

def save_message(conversation_id: str, role: str, content: str) -> None:
    """
    Persist a single message to the messages table.

    We only store 'user' and 'assistant' roles here. 'system' messages are
    part of the agent's system_prompt and do not need to be logged per-turn.

    Tool use intermediate turns (tool_use, tool_result) are NOT persisted —
    they exist only in the in-memory working_messages list during inference.
    The final assistant text response is what gets stored.

    Args:
        conversation_id: UUID of the parent conversation.
        role:            'user' | 'assistant'
        content:         The message text.
    """
    if role not in ("user", "assistant", "system"):
        raise ValueError(f"Invalid role '{role}'. Must be 'user', 'assistant', or 'system'.")

    db = get_db()

    try:
        db.table("messages").insert({
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
        }).execute()

    except Exception as e:
        logger.error(f"Failed to save message to conversation {conversation_id}: {e}")
        raise RuntimeError(f"Could not save message: {e}") from e


def get_message_history(conversation_id: str) -> list[dict]:
    """
    Load all messages for a conversation in chronological order.

    Returns messages in Anthropic API format — a list of dicts with
    'role' and 'content' keys. System messages are filtered out because
    they are passed separately via the system_prompt parameter.

    Example return value:
        [
            {"role": "user",      "content": "What are your opening hours?"},
            {"role": "assistant", "content": "We are open Monday to Friday..."},
            {"role": "user",      "content": "Do you do teeth whitening?"},
        ]

    Args:
        conversation_id: UUID of the conversation.

    Returns:
        List of message dicts ready to pass directly to the Anthropic API.
    """
    db = get_db()

    try:
        result = (
            db.table("messages")
            .select("role, content")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=False)
            .execute()
        )

        return [
            {"role": row["role"], "content": row["content"]}
            for row in result.data
            if row["role"] in ("user", "assistant")
        ]

    except Exception as e:
        logger.error(f"Failed to load message history for conversation {conversation_id}: {e}")
        raise RuntimeError(f"Could not load message history: {e}") from e


# ---------------------------------------------------------------------------
# Escalations
# ---------------------------------------------------------------------------

def create_escalation(
    conversation_id: str,
    client_id: str,
    reason: str,
    summary: str,
) -> str:
    """
    Create an escalation record and update the parent conversation to 'escalated'.

    This is the single function to call whenever a conversation needs human
    attention. It writes to both the escalations table and updates the
    conversations table in sequence.

    Args:
        conversation_id: UUID of the conversation being escalated.
        client_id:       UUID of the client (denormalized for fast dashboard queries).
        reason:          'complaint' | 'appointment_failed' | 'out_of_scope' |
                         'explicit_request' | 'other'
        summary:         1–2 sentence AI-generated explanation of why it was escalated.

    Returns:
        The new escalation's UUID as a string.
    """
    valid_reasons = (
        "complaint",
        "appointment_failed",
        "out_of_scope",
        "explicit_request",
        "other",
    )
    if reason not in valid_reasons:
        raise ValueError(f"Invalid escalation reason '{reason}'. Must be one of: {valid_reasons}")

    db = get_db()

    try:
        # Mark the conversation as escalated first
        end_conversation(conversation_id, "escalated")

        # Create the escalation record
        result = db.table("escalations").insert({
            "conversation_id": conversation_id,
            "client_id": client_id,
            "reason": reason,
            "summary": summary,
            "status": "pending",
        }).execute()

        escalation_id: str = result.data[0]["id"]
        logger.warning(
            f"ESCALATION created: {escalation_id} | conversation: {conversation_id} | reason: {reason}"
        )

        # Fire-and-forget email alert (non-blocking)
        _send_escalation_email_async(
            conversation_id=conversation_id,
            client_id=client_id,
            reason=reason,
            summary=summary,
            escalation_id=escalation_id,
        )

        return escalation_id

    except Exception as e:
        logger.error(f"Failed to create escalation for conversation {conversation_id}: {e}")
        raise RuntimeError(f"Could not create escalation: {e}") from e


def _send_escalation_email_async(
    conversation_id: str,
    client_id: str,
    reason: str,
    summary: str,
    escalation_id: str,
) -> None:
    """
    Attempt to send an escalation alert email without blocking the caller.

    Loads the conversation's client name, user_identifier, and recent transcript,
    then fires the email as a background coroutine. Silently ignored if the event
    loop is not running (e.g. during tests).
    """
    async def _send() -> None:
        try:
            from integrations.email import send_escalation_alert

            db = get_db()

            # Fetch client name
            client_r = db.table("clients").select("name").eq("id", client_id).limit(1).execute()
            client_name = (client_r.data[0]["name"] if client_r.data else "Unknown Client")

            # Fetch conversation user_identifier
            conv_r = (
                db.table("conversations")
                .select("user_identifier")
                .eq("id", conversation_id)
                .limit(1)
                .execute()
            )
            user_identifier = (conv_r.data[0]["user_identifier"] if conv_r.data else None)

            # Fetch last 20 messages for transcript
            msgs_r = (
                db.table("messages")
                .select("role, content")
                .eq("conversation_id", conversation_id)
                .order("created_at", desc=False)
                .limit(20)
                .execute()
            )
            transcript = [
                {"role": m["role"], "content": m["content"]}
                for m in msgs_r.data
                if m["role"] in ("user", "assistant")
            ]

            await send_escalation_alert(
                client_name=client_name,
                reason=reason,
                summary=summary,
                conversation_id=conversation_id,
                escalation_id=escalation_id,
                user_identifier=user_identifier,
                transcript=transcript,
            )
        except Exception as exc:
            logger.error(f"Background email send failed: {exc}")

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.ensure_future(_send())
        else:
            loop.run_until_complete(_send())
    except RuntimeError:
        pass  # No event loop available (e.g. CLI / test context)
