"""
integrations/anthropic_client.py

Async Anthropic Claude API client singleton.

This module provides a single cached AsyncAnthropic instance shared across
the entire application. All agents call get_anthropic_client() to get the
client — they never instantiate their own.

Using AsyncAnthropic (not the sync Anthropic client) because our FastAPI
backend is fully async and we want non-blocking Claude API calls.

Usage:
    from integrations.anthropic_client import get_anthropic_client

    client = get_anthropic_client()
    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        system="You are a helpful assistant.",
        messages=[{"role": "user", "content": "Hello"}],
        max_tokens=512,
    )
    print(response.content[0].text)
"""

import logging
from functools import lru_cache

import anthropic

from config.settings import get_settings

logger = logging.getLogger(__name__)


@lru_cache()
def get_anthropic_client() -> anthropic.AsyncAnthropic:
    """
    Return the cached async Anthropic client.

    The client is created once per process. It reads the API key from
    settings (which reads it from the ANTHROPIC_API_KEY environment variable).

    The @lru_cache decorator ensures only one client instance exists in
    the process — no connection pool issues or key re-reads on every call.

    Raises:
        ValueError: If ANTHROPIC_API_KEY is not configured.
    """
    settings = get_settings()

    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY is not set in environment variables.")

    logger.info("Initialising Anthropic async client")

    return anthropic.AsyncAnthropic(
        api_key=settings.anthropic_api_key,
        # max_retries=2 is the SDK default — good enough for production
        # timeout is 10 minutes by default — appropriate for long responses
    )
