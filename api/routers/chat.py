"""
api/routers/chat.py

Chat endpoint — handles messages from the web widget and any direct API callers.

Routes:
    POST /chat/{client_slug}
        Accept a user message, run it through the agent, return the reply.
        If no conversation_id is provided, a new conversation is started.

    GET /chat/{client_slug}/history/{conversation_id}
        Return the full message history for a conversation (for dashboard replay).

Security note:
    These endpoints are currently open. Before exposing them publicly, add
    bearer token authentication (DASHBOARD_API_KEY in .env). The chat widget
    should be served from your own domain and accessed via Vercel rewrites,
    which limits exposure. Proper auth will be added with the dashboard phase.
"""

import logging

from fastapi import APIRouter, HTTPException, Request

from api.registry import registry
from api.schemas import ChatRequest, ChatResponse, TokenMetadata
from core.memory import get_message_history

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/{client_slug}", response_model=ChatResponse)
async def chat(
    client_slug: str,
    body: ChatRequest,
    request: Request,
) -> ChatResponse:
    """
    Send a message to an agent and receive its reply.

    If `conversation_id` is omitted or null, a new conversation session is
    created automatically and the ID is returned. The client must pass this
    ID back on every subsequent message to maintain context.

    Args:
        client_slug: URL segment identifying the client e.g. "smilecare".
        body:        JSON request body — see ChatRequest schema.

    Returns:
        ChatResponse with the agent's reply and session metadata.

    Raises:
        404 if the client slug is not found or the agent is not loaded.
        400 if the message is empty (enforced by Pydantic).
        500 on unexpected inference errors.
    """
    # Resolve the agent from the registry
    # Channel defaults to 'web' for the chat endpoint
    channel = body.channel or "web"
    agent = registry.get(client_slug, channel)

    if agent is None:
        logger.warning(
            f"Chat request for unknown agent: slug='{client_slug}', channel='{channel}'. "
            f"Loaded agents: {registry.list_agents()}"
        )
        raise HTTPException(
            status_code=404,
            detail=f"No active agent found for '{client_slug}' on channel '{channel}'.",
        )

    # Start a new conversation if no ID provided
    if body.conversation_id is None:
        conversation_id = await agent.start_conversation(
            channel=channel,
            user_identifier=body.user_identifier,
        )
        logger.info(
            f"New conversation started: {conversation_id} | "
            f"agent: {client_slug}_{channel}"
        )
    else:
        conversation_id = body.conversation_id

    # Run the agent
    try:
        result = await agent.chat(
            user_message=body.message,
            conversation_id=conversation_id,
        )
    except Exception as e:
        logger.error(
            f"Inference failed | conversation: {conversation_id} | "
            f"agent: {client_slug}_{channel} | error: {e}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=500,
            detail="The agent encountered an error. Please try again.",
        )

    return ChatResponse(
        message=result.message,
        conversation_id=result.conversation_id,
        was_escalated=result.was_escalated,
        tokens=TokenMetadata(
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            cost_zar=result.cost_zar,
        ),
    )


@router.get("/{client_slug}/history/{conversation_id}")
async def get_history(
    client_slug: str,
    conversation_id: str,
) -> dict:
    """
    Return the full message history for a conversation.

    Used by the admin dashboard to replay a conversation log.
    Messages are returned in chronological order (oldest first).

    Args:
        client_slug:     Used to verify the conversation belongs to this client
                         (future: add ownership check).
        conversation_id: UUID of the conversation.

    Returns:
        {"conversation_id": "...", "messages": [{"role": "...", "content": "..."}]}
    """
    try:
        messages = get_message_history(conversation_id)
    except Exception as e:
        logger.error(f"Failed to load history for {conversation_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not load conversation history.")

    return {
        "conversation_id": conversation_id,
        "messages": messages,
    }
