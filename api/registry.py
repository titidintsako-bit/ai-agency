"""
api/registry.py

AgentRegistry — loads, caches, and serves agent instances.

At application startup (FastAPI lifespan), registry.load() queries the agents
table, instantiates the correct agent class for each row, and stores them
keyed by "{client_slug}_{channel}".

Every incoming request calls registry.get(slug, channel) to retrieve the
pre-built agent instance — no DB query or object creation on the hot path.

To onboard a new client:
    1. Add their agent class to AGENT_CLASSES below
    2. Seed their client + agent rows into the DB (see scripts/seed_smilecare.py)
    3. The registry picks them up automatically on next startup

Usage:
    # In main.py lifespan:
    registry.load()

    # In a route handler:
    agent = registry.get("smilecare", "web")
"""

import logging

from agents.lexispro.agent import LexisProAgent
from agents.smilecare.agent import SmileCareAgent
from core.agent_base import BaseAgent
from core.database import get_db

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Agent class map — add new clients here
# key   = client slug (must match clients.slug in the DB)
# value = the agent class to instantiate for that client
# ---------------------------------------------------------------------------
AGENT_CLASSES: dict[str, type[BaseAgent]] = {
    "smilecare": SmileCareAgent,
    "lexispro":  LexisProAgent,
}


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class AgentRegistry:
    """
    A simple in-memory registry of instantiated agent objects.

    Agents are keyed as "{client_slug}_{channel}" e.g.:
        "smilecare_web"
        "smilecare_whatsapp"
    """

    def __init__(self) -> None:
        self._agents: dict[str, BaseAgent] = {}

    def load(self) -> None:
        """
        Query the database and instantiate all active agents.

        Called once during FastAPI startup. Any agent rows without a matching
        entry in AGENT_CLASSES are logged and skipped — they won't cause startup
        to fail.

        Raises:
            RuntimeError: If the DB query itself fails (e.g. bad credentials).
        """
        db = get_db()

        # Fetch all active agents with their client slug via a PostgREST join
        result = (
            db.table("agents")
            .select("id, client_id, channel, clients(slug)")
            .eq("is_active", True)
            .execute()
        )

        loaded = 0
        skipped = 0

        for row in result.data:
            client_slug: str = row["clients"]["slug"]
            channel:     str = row["channel"]
            agent_id:    str = row["id"]
            client_id:   str = row["client_id"]

            agent_class = AGENT_CLASSES.get(client_slug)

            if agent_class is None:
                logger.warning(
                    f"No agent class registered for client slug '{client_slug}'. "
                    f"Add it to AGENT_CLASSES in api/registry.py. Skipping."
                )
                skipped += 1
                continue

            key = f"{client_slug}_{channel}"

            try:
                self._agents[key] = agent_class(
                    client_id=client_id,
                    agent_id=agent_id,
                    channel=channel,
                )
                logger.info(f"Loaded agent: {key} (id: {agent_id})")
                loaded += 1

            except Exception as e:
                logger.error(f"Failed to instantiate agent '{key}': {e}")
                skipped += 1

        logger.info(
            f"AgentRegistry loaded {loaded} agent(s), skipped {skipped}."
        )

    def get(self, client_slug: str, channel: str = "web") -> BaseAgent | None:
        """
        Return the agent instance for a given client slug and channel.

        Args:
            client_slug: The client's URL-safe identifier e.g. "smilecare".
            channel:     "web" | "whatsapp" | "email"

        Returns:
            The agent instance, or None if not found.
        """
        return self._agents.get(f"{client_slug}_{channel}")

    def list_agents(self) -> list[str]:
        """Return all loaded agent keys — useful for debugging."""
        return list(self._agents.keys())


# Single registry instance shared across the application
registry = AgentRegistry()
