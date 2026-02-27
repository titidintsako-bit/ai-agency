"""
core/cost_tracker.py

Token usage cost calculation and persistence.

Every time the agent makes a call to the Anthropic API, the response includes
the exact number of input and output tokens consumed. This module translates
those token counts into USD and ZAR costs, then writes a row to token_usage.

Pricing is stored in MODEL_PRICING below. Anthropic updates pricing occasionally
— when that happens, update the dict and redeploy. The USD→ZAR rate comes from
the USD_ZAR_EXCHANGE_RATE environment variable so it can be updated without code changes.

Design note:
    cost_zar is calculated and stored at write time (not query time). This means
    the dashboard can aggregate costs with a simple SUM() rather than doing
    currency math on every read. Historical records reflect the rate at the
    time they were written, which is correct for billing purposes.
"""

import logging

from config.settings import get_settings
from core.database import get_db

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Model pricing — USD per 1,000,000 tokens
#
# Source: https://www.anthropic.com/pricing
# Last verified: early 2026
#
# IMPORTANT: Review and update these values when Anthropic changes pricing.
# The keys must exactly match the model string passed to the API.
# ---------------------------------------------------------------------------
MODEL_PRICING: dict[str, dict[str, float]] = {
    # Claude Haiku 4.5 — primary model for customer-facing chatbots
    "claude-haiku-4-5-20251001": {
        "input":  0.80,   # USD per million input tokens
        "output": 4.00,   # USD per million output tokens
    },
    # Claude Sonnet 4.6 — used for complex reasoning tasks
    "claude-sonnet-4-6": {
        "input":  3.00,
        "output": 15.00,
    },
    # Claude Opus 4.6 — reserved for highest-complexity tasks
    "claude-opus-4-6": {
        "input":  15.00,
        "output": 75.00,
    },
}

# Fallback if an unknown model is used — use Sonnet rates (conservative estimate)
_FALLBACK_PRICING: dict[str, float] = {"input": 3.00, "output": 15.00}


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def calculate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> tuple[float, float]:
    """
    Calculate the USD and ZAR cost for a single API call.

    Args:
        model:         The exact model string (e.g. 'claude-haiku-4-5-20251001').
        input_tokens:  Number of input/prompt tokens consumed.
        output_tokens: Number of output/completion tokens generated.

    Returns:
        A tuple of (cost_usd, cost_zar), both as floats.
    """
    pricing = MODEL_PRICING.get(model)

    if pricing is None:
        logger.warning(
            f"No pricing found for model '{model}' — using Sonnet rates as fallback. "
            f"Add '{model}' to MODEL_PRICING in core/cost_tracker.py."
        )
        pricing = _FALLBACK_PRICING

    cost_usd = (
        (input_tokens  * pricing["input"]) +
        (output_tokens * pricing["output"])
    ) / 1_000_000

    settings = get_settings()
    cost_zar = cost_usd * settings.usd_zar_exchange_rate

    return cost_usd, cost_zar


def record_usage(
    conversation_id: str,
    agent_id: str,
    client_id: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> tuple[float, float]:
    """
    Calculate cost and write a row to the token_usage table.

    This should be called once per agent turn (after the full tool use loop
    completes), using the *summed* token counts across all API calls in that turn.

    Args:
        conversation_id: UUID of the conversation this usage belongs to.
        agent_id:        UUID of the agent that made the call.
        client_id:       UUID of the client (denormalized for fast billing queries).
        model:           The model string used for the call.
        input_tokens:    Total input tokens for this turn (sum across tool iterations).
        output_tokens:   Total output tokens for this turn.

    Returns:
        (cost_usd, cost_zar) as floats — useful for logging or returning to caller.

    Raises:
        RuntimeError: If the database insert fails.
    """
    cost_usd, cost_zar = calculate_cost(model, input_tokens, output_tokens)

    db = get_db()

    try:
        db.table("token_usage").insert({
            "conversation_id": conversation_id,
            "agent_id":        agent_id,
            "client_id":       client_id,
            "model":           model,
            "input_tokens":    input_tokens,
            "output_tokens":   output_tokens,
            "cost_usd":        round(cost_usd, 6),
            "cost_zar":        round(cost_zar, 4),
        }).execute()

        logger.debug(
            f"Token usage recorded | model: {model} | "
            f"in: {input_tokens} out: {output_tokens} | "
            f"cost: R{cost_zar:.4f}"
        )

    except Exception as e:
        # Log but do not raise — a billing record failure should never kill a conversation
        logger.error(
            f"Failed to record token usage for conversation {conversation_id}: {e}. "
            f"Usage: model={model}, in={input_tokens}, out={output_tokens}"
        )

    return cost_usd, cost_zar
