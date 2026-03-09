"""
scripts/seed_lexispro.py

Seeds the Supabase database with the LexisPro Attorneys client and agent records.

Run this once after deploying the LexisPro agent to create the rows that the
AgentRegistry needs to load the agent at startup.

Safe to re-run — checks for existing records before inserting.

Usage:
    cd c:\\Users\\user\\ai-agency
    python -m scripts.seed_lexispro

Requirements:
    .env must be configured with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.lexispro.agent import LexisProAgent
from core.database import get_db


def seed() -> None:
    db = get_db()

    print("\n" + "=" * 60)
    print("LexisPro Attorneys — Database Seed")
    print("=" * 60)

    # -----------------------------------------------------------------------
    # 1. Client record
    # -----------------------------------------------------------------------
    print("\n[1/3] Checking client record...")

    existing_client = (
        db.table("clients")
        .select("id, name, slug")
        .eq("slug", "lexispro")
        .execute()
    )

    if existing_client.data:
        client = existing_client.data[0]
        client_id = client["id"]
        print(f"  ✓ Client already exists: {client['name']} (id: {client_id})")
    else:
        result = db.table("clients").insert({
            "name":                 "LexisPro Attorneys",
            "slug":                 "lexispro",
            "industry":             "legal",
            "contact_email":        "admin@lexispro.co.za",
            "tier":                 "professional",
            "monthly_retainer_zar": 6500.00,
            "is_active":            True,
        }).execute()

        client_id = result.data[0]["id"]
        print(f"  ✓ Client created: LexisPro Attorneys (id: {client_id})")

    # -----------------------------------------------------------------------
    # 2. Build system prompt from config
    # -----------------------------------------------------------------------
    print("\n[2/3] Building system prompt from lexispro.yaml...")

    temp_agent = LexisProAgent(
        client_id="00000000-0000-0000-0000-000000000000",
        agent_id="00000000-0000-0000-0000-000000000000",
        channel="web",
    )
    system_prompt = temp_agent.system_prompt
    print(f"  ✓ System prompt built ({len(system_prompt)} characters)")

    # -----------------------------------------------------------------------
    # 3. Agent record (web channel only for now)
    # -----------------------------------------------------------------------
    print("\n[3/3] Checking agent records...")

    channels = [
        ("web", "LexisPro Web Chat", "claude-haiku-4-5-20251001"),
    ]

    agent_ids: dict[str, str] = {}

    for channel, name, model in channels:
        existing_agent = (
            db.table("agents")
            .select("id, name, channel")
            .eq("client_id", client_id)
            .eq("channel", channel)
            .execute()
        )

        if existing_agent.data:
            agent = existing_agent.data[0]
            agent_ids[channel] = agent["id"]
            print(f"  ✓ Agent already exists: {agent['name']} (id: {agent['id']})")
        else:
            result = db.table("agents").insert({
                "client_id":     client_id,
                "name":          name,
                "channel":       channel,
                "model":         model,
                "system_prompt": system_prompt,
                "config":        {},
                "is_active":     True,
            }).execute()

            agent_id = result.data[0]["id"]
            agent_ids[channel] = agent_id
            print(f"  ✓ Agent created: {name} (id: {agent_id})")

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("Seed complete. Copy these values into your notes:")
    print("=" * 60)
    print(f"\n  Client ID (lexispro):          {client_id}")
    for channel, agent_id in agent_ids.items():
        print(f"  Agent ID  ({channel:<12}):     {agent_id}")
    print(
        "\nThe AgentRegistry loads these automatically from the DB at startup.\n"
        "You do NOT need to hardcode them anywhere.\n"
    )


if __name__ == "__main__":
    seed()
