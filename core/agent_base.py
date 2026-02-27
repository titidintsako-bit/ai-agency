"""
core/agent_base.py

Abstract BaseAgent class — the foundation every client agent inherits from.

This class handles all the infrastructure work so that each client agent only
needs to define three things:
    1. system_prompt  — the agent's persona, instructions, and client knowledge
    2. tools          — tool definitions in Anthropic format (optional)
    3. execute_tool() — what to do when Claude calls one of those tools

Everything else — saving messages, loading history, calling Claude, managing
the tool use loop, recording token costs, triggering escalations — is handled
here and works identically for every agent.

Conversation flow per turn:
    1. save_message(user)          → persist user input
    2. get_message_history()       → load full context from DB
    3. _run_inference()            → Claude API call(s) with tool use loop
    4. save_message(assistant)     → persist final response text
    5. record_usage()              → write token costs to DB
    6. return ChatResponse

Tool use loop (inside _run_inference):
    - Call Claude with current messages
    - If stop_reason == 'end_turn': extract text, exit loop
    - If stop_reason == 'tool_use': execute all tool calls, append results, repeat
    - Safety cap: MAX_TOOL_ITERATIONS iterations before forced exit

Usage example (in a client agent):

    from core.agent_base import BaseAgent, ChatResponse

    class SmileCareAgent(BaseAgent):

        @property
        def system_prompt(self) -> str:
            return "You are a receptionist for SmileCare Dental..."

        @property
        def tools(self) -> list[dict]:
            return [BOOK_APPOINTMENT_TOOL, ESCALATE_TOOL]

        async def execute_tool(self, tool_name, tool_input, conversation_id) -> str:
            if tool_name == "book_appointment":
                return await book_appointment(tool_input)
            if tool_name == "escalate_to_human":
                await self.escalate(conversation_id, ...)
                return "Escalated to human."
            return "Unknown tool."
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass

from core.cost_tracker import record_usage
from core.memory import (
    create_conversation,
    create_escalation,
    end_conversation,
    get_message_history,
    save_message,
)
from integrations.anthropic_client import get_anthropic_client

logger = logging.getLogger(__name__)

# Maximum number of tool call iterations in a single turn.
# Prevents infinite loops if a tool keeps triggering another tool call.
MAX_TOOL_ITERATIONS = 10


# ---------------------------------------------------------------------------
# Response type
# ---------------------------------------------------------------------------

@dataclass
class ChatResponse:
    """
    The return value from BaseAgent.chat().

    Attributes:
        message:          The agent's final text response to send to the user.
        conversation_id:  UUID of the conversation session.
        was_escalated:    True if this turn triggered an escalation to human review.
        input_tokens:     Total input tokens consumed across all API calls this turn.
        output_tokens:    Total output tokens generated this turn.
        cost_zar:         Total cost in South African Rand for this turn.
    """
    message: str
    conversation_id: str
    was_escalated: bool
    input_tokens: int
    output_tokens: int
    cost_zar: float


# ---------------------------------------------------------------------------
# Base agent
# ---------------------------------------------------------------------------

class BaseAgent(ABC):
    """
    Abstract base class for all AI Agency client agents.

    Subclasses must implement:
        - system_prompt (property) → str
        - execute_tool() → str         (can raise NotImplementedError if agent has no tools)

    Subclasses may override:
        - tools (property) → list[dict]    (defaults to [] — no tool use)
        - max_tokens                       (defaults to 1024)

    Constructor args:
        client_id:  UUID of the client this agent serves (from the clients table).
        agent_id:   UUID of this specific agent instance (from the agents table).
        model:      Claude model string. Defaults to Haiku for cost efficiency.
        max_tokens: Maximum tokens in each Claude response. Default 1024.
    """

    def __init__(
        self,
        client_id: str,
        agent_id: str,
        model: str = "claude-haiku-4-5-20251001",
        max_tokens: int = 1024,
    ) -> None:
        self.client_id = client_id
        self.agent_id = agent_id
        self.model = model
        self.max_tokens = max_tokens

        # Tracks whether escalate() was called during the current chat() turn.
        # Reset to False at the start of every chat() call.
        self._escalated_this_turn: bool = False

    # -----------------------------------------------------------------------
    # Abstract interface — subclasses must implement these
    # -----------------------------------------------------------------------

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """
        The full system prompt sent to Claude at the start of every API call.

        This defines the agent's persona, knowledge, instructions, and
        constraints. It should include everything the agent needs to know
        about the client's business.
        """
        ...

    @abstractmethod
    async def execute_tool(
        self,
        tool_name: str,
        tool_input: dict,
        conversation_id: str,
    ) -> str:
        """
        Execute a tool call and return the result as a plain string.

        Called by the base class during the tool use loop whenever Claude
        decides to use a tool. The returned string is sent back to Claude
        as the tool result.

        Args:
            tool_name:       The name of the tool Claude called.
            tool_input:      The input dict Claude passed to the tool.
            conversation_id: The current conversation UUID. Needed if the tool
                             should trigger an escalation or DB write.

        Returns:
            A string describing the result. For structured data, return a
            JSON string — Claude will parse it correctly.

        Raises:
            NotImplementedError: If the agent defines no tools (default).
        """
        raise NotImplementedError(
            f"Agent received tool call '{tool_name}' but execute_tool() is not implemented. "
            f"Override execute_tool() in your agent subclass if you define tools."
        )

    # -----------------------------------------------------------------------
    # Overridable defaults
    # -----------------------------------------------------------------------

    @property
    def tools(self) -> list[dict]:
        """
        Tool definitions in Anthropic format.

        Return an empty list (default) if the agent does not use tools.
        Override in subclass to add tools — the base class will automatically
        include them in every API call and route tool_use responses to execute_tool().

        Example:
            return [
                {
                    "name": "book_appointment",
                    "description": "Book a dental appointment for a patient.",
                    "input_schema": {
                        "type": "object",
                        "properties": {
                            "patient_name": {"type": "string"},
                            "date": {"type": "string"},
                        },
                        "required": ["patient_name", "date"],
                    },
                }
            ]
        """
        return []

    # -----------------------------------------------------------------------
    # Conversation lifecycle
    # -----------------------------------------------------------------------

    async def start_conversation(
        self,
        channel: str,
        user_identifier: str | None = None,
        metadata: dict | None = None,
    ) -> str:
        """
        Create a new conversation record in the database.

        Call this once at the start of each new session (new browser session,
        new WhatsApp thread, etc.). Returns the conversation_id to pass into
        subsequent chat() calls.

        Args:
            channel:         'web' | 'whatsapp' | 'email'
            user_identifier: Anonymised user reference (phone number, session token).
            metadata:        Channel-specific extras (Twilio message SID, browser UA).

        Returns:
            New conversation UUID as a string.
        """
        return create_conversation(
            agent_id=self.agent_id,
            client_id=self.client_id,
            channel=channel,
            user_identifier=user_identifier,
            metadata=metadata,
        )

    async def end_conversation(
        self,
        conversation_id: str,
        status: str = "completed",
    ) -> None:
        """
        Mark a conversation as finished.

        Args:
            conversation_id: UUID of the conversation to close.
            status:          'completed' | 'escalated' | 'abandoned'

        Note:
            You do not need to call this after escalate() — that method
            already updates the conversation status to 'escalated'.
        """
        end_conversation(conversation_id, status)

    async def escalate(
        self,
        conversation_id: str,
        reason: str,
        summary: str,
    ) -> str:
        """
        Flag this conversation for human review.

        Creates an escalation record in the database, sets the conversation
        status to 'escalated', and marks _escalated_this_turn = True so
        that chat() can include this in the ChatResponse.

        This is typically called from inside execute_tool() when the agent
        handles an 'escalate_to_human' tool call.

        Args:
            conversation_id: UUID of the conversation to escalate.
            reason:          'complaint' | 'appointment_failed' | 'out_of_scope' |
                             'explicit_request' | 'other'
            summary:         1–2 sentence explanation of why this is being escalated.

        Returns:
            The new escalation UUID.
        """
        self._escalated_this_turn = True
        return create_escalation(
            conversation_id=conversation_id,
            client_id=self.client_id,
            reason=reason,
            summary=summary,
        )

    # -----------------------------------------------------------------------
    # Main entry point
    # -----------------------------------------------------------------------

    async def chat(
        self,
        user_message: str,
        conversation_id: str,
    ) -> ChatResponse:
        """
        Send a user message to the agent and get a response.

        This is the primary method called by the API layer for every incoming
        message. It orchestrates the full pipeline: persist → infer → persist
        → track costs → return.

        Args:
            user_message:    The text the user sent.
            conversation_id: UUID of the existing conversation session.
                             Create one first with start_conversation() if needed.

        Returns:
            ChatResponse with the assistant's reply and metadata.

        Raises:
            RuntimeError: If a critical operation (message save, API call) fails.
        """
        # Reset escalation flag for this turn
        self._escalated_this_turn = False

        # 1. Persist the user message
        save_message(conversation_id, "user", user_message)

        # 2. Load full conversation history (includes the message we just saved)
        history = get_message_history(conversation_id)

        # 3. Run Claude inference (with tool use loop)
        response_text, total_input, total_output = await self._run_inference(
            messages=history,
            conversation_id=conversation_id,
        )

        # 4. Persist the assistant response
        save_message(conversation_id, "assistant", response_text)

        # 5. Record token usage and cost
        _, cost_zar = record_usage(
            conversation_id=conversation_id,
            agent_id=self.agent_id,
            client_id=self.client_id,
            model=self.model,
            input_tokens=total_input,
            output_tokens=total_output,
        )

        logger.info(
            f"Turn complete | conversation: {conversation_id} | "
            f"tokens: {total_input}+{total_output} | "
            f"cost: R{cost_zar:.4f} | escalated: {self._escalated_this_turn}"
        )

        return ChatResponse(
            message=response_text,
            conversation_id=conversation_id,
            was_escalated=self._escalated_this_turn,
            input_tokens=total_input,
            output_tokens=total_output,
            cost_zar=round(cost_zar, 4),
        )

    # -----------------------------------------------------------------------
    # Internal inference engine
    # -----------------------------------------------------------------------

    async def _run_inference(
        self,
        messages: list[dict],
        conversation_id: str,
    ) -> tuple[str, int, int]:
        """
        Core Claude API call with automatic tool use loop.

        Handles:
            - Single-turn responses (no tools, or tools not used this turn)
            - Multi-step tool use (Claude calls tools, we execute, Claude continues)
            - Safety cap on maximum tool iterations

        Args:
            messages:        Full conversation history in Anthropic format.
            conversation_id: Passed through to execute_tool() so tools can write to DB.

        Returns:
            (final_response_text, total_input_tokens, total_output_tokens)

        Note on message persistence:
            Tool use intermediate turns (tool_use blocks, tool_result blocks) are
            NOT saved to the messages table. Only the final assistant text response
            is saved by chat() after this method returns. This keeps the DB log
            clean and human-readable, while the in-memory working_messages list
            carries the full technical context needed by Claude.
        """
        client = get_anthropic_client()

        # Work on a copy — we append tool use turns during the loop
        working_messages = list(messages)

        total_input: int = 0
        total_output: int = 0

        for iteration in range(MAX_TOOL_ITERATIONS):

            # Build the API call kwargs conditionally
            # (passing tools=[] to the API is harmless but slightly wasteful)
            kwargs: dict = {
                "model":      self.model,
                "system":     self.system_prompt,
                "messages":   working_messages,
                "max_tokens": self.max_tokens,
            }
            if self.tools:
                kwargs["tools"] = self.tools

            # Call the Anthropic API
            try:
                response = await client.messages.create(**kwargs)
            except Exception as e:
                logger.error(f"Anthropic API call failed (iteration {iteration}): {e}")
                raise

            total_input  += response.usage.input_tokens
            total_output += response.usage.output_tokens

            # ── Case 1: Normal end — extract and return the text ──────────
            if response.stop_reason == "end_turn":
                final_text = _extract_text(response.content)
                return final_text, total_input, total_output

            # ── Case 2: Tool use — execute tools and continue ─────────────
            if response.stop_reason == "tool_use":
                # Append the assistant's full response (text + tool_use blocks)
                working_messages.append({
                    "role":    "assistant",
                    "content": response.content,
                })

                # Execute every tool Claude called in this response
                tool_results = []
                for block in response.content:
                    if block.type != "tool_use":
                        continue

                    logger.info(
                        f"Tool call: {block.name} | "
                        f"input: {block.input} | "
                        f"conversation: {conversation_id}"
                    )

                    try:
                        result = await self.execute_tool(
                            tool_name=block.name,
                            tool_input=block.input,
                            conversation_id=conversation_id,
                        )
                    except Exception as e:
                        logger.error(
                            f"Tool '{block.name}' raised an exception: {e}. "
                            f"Returning error string to Claude."
                        )
                        result = f"Error executing tool '{block.name}': {str(e)}"

                    tool_results.append({
                        "type":        "tool_result",
                        "tool_use_id": block.id,
                        "content":     result,
                    })

                # Append all tool results as a user turn
                working_messages.append({
                    "role":    "user",
                    "content": tool_results,
                })

                # Loop continues — Claude will read the tool results and respond

            else:
                # ── Case 3: Unexpected stop reason (max_tokens, stop_sequence) ──
                logger.warning(
                    f"Unexpected stop_reason '{response.stop_reason}' on iteration {iteration}"
                )
                final_text = _extract_text(response.content)
                return final_text or "[Response was cut short]", total_input, total_output

        # ── Safety exit: too many tool iterations ─────────────────────────
        logger.error(
            f"Tool use loop hit the {MAX_TOOL_ITERATIONS}-iteration safety cap "
            f"for conversation {conversation_id}. Returning fallback message."
        )
        return (
            "I'm sorry, I ran into a technical issue while processing your request. "
            "Please try again or contact us directly.",
            total_input,
            total_output,
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_text(content_blocks: list) -> str:
    """
    Extract and concatenate all text blocks from a Claude response.

    Claude responses can contain a mix of TextBlock and ToolUseBlock objects.
    This function picks out only the text and joins it into a single string.

    Args:
        content_blocks: The list of content blocks from response.content.

    Returns:
        A single trimmed string. Empty string if there are no text blocks.
    """
    parts = [
        block.text
        for block in content_blocks
        if hasattr(block, "text") and block.text
    ]
    return " ".join(parts).strip()
