"""
core/database.py

Supabase client singleton for the entire platform.

All database access goes through get_db(). The client uses the service_role key
which bypasses Row Level Security — giving full read/write access to all tables.

IMPORTANT: This module must only ever be imported by server-side code.
           Never pass the client or its credentials to the frontend.

Usage:
    from core.database import get_db

    db = get_db()
    result = db.table("clients").select("*").eq("is_active", True).execute()
    clients = result.data
"""

from functools import lru_cache
from supabase import create_client, Client
from config.settings import get_settings


@lru_cache()
def get_db() -> Client:
    """
    Return the cached Supabase client instance.

    The client is created once per process and reused on every call.
    It connects using the service_role key (full database access, RLS bypassed).

    Raises:
        ValueError: If SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are not set.
    """
    settings = get_settings()

    if not settings.supabase_url:
        raise ValueError("SUPABASE_URL is not set in environment variables.")
    if not settings.supabase_service_role_key:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY is not set in environment variables.")

    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )


def check_connection() -> bool:
    """
    Perform a lightweight query to verify the Supabase connection is live.

    Returns:
        True if connection succeeds, False otherwise.

    Usage:
        if not check_connection():
            raise RuntimeError("Cannot connect to Supabase — check your env vars.")
    """
    try:
        db = get_db()
        # Query a single row from clients — just enough to confirm connectivity.
        db.table("clients").select("id").limit(1).execute()
        return True
    except Exception:
        return False
