"""
api/routers/agent_config.py

Read and write per-client YAML configuration files.

The YAML files in /config/clients/ are the source of truth for each agent's
knowledge: business hours, services, escalation triggers, contact info.
Editing them through this API takes effect when the agent process restarts
(or call the reload endpoint if hot-reload is needed in future).

Routes:
    GET  /config                   — list all client config files
    GET  /config/{client_slug}     — return parsed YAML as JSON
    PUT  /config/{client_slug}     — write updated config back to YAML
"""

import logging
from pathlib import Path

import yaml
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/config", tags=["config"])

# Absolute path to the config/clients/ directory
_CONFIG_DIR = Path(__file__).resolve().parent.parent.parent / "config" / "clients"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _config_path(client_slug: str) -> Path:
    # Prevent path traversal
    if "/" in client_slug or "\\" in client_slug or ".." in client_slug:
        raise HTTPException(status_code=400, detail="Invalid client slug.")
    return _CONFIG_DIR / f"{client_slug}.yaml"


def _read_config(path: Path) -> dict:
    try:
        with open(path, encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"No config found for '{path.stem}'.")
    except yaml.YAMLError as e:
        raise HTTPException(status_code=500, detail=f"Config file is malformed: {e}")


def _write_config(path: Path, data: dict) -> None:
    try:
        with open(path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save config: {e}")


# ---------------------------------------------------------------------------
# GET /config
# ---------------------------------------------------------------------------

@router.get("")
async def list_configs(_: str = Depends(get_current_user)) -> dict:
    """List all available client config slugs."""
    if not _CONFIG_DIR.exists():
        return {"clients": []}

    slugs = [p.stem for p in sorted(_CONFIG_DIR.glob("*.yaml"))]
    return {"clients": slugs}


# ---------------------------------------------------------------------------
# GET /config/{client_slug}
# ---------------------------------------------------------------------------

@router.get("/{client_slug}")
async def get_config(
    client_slug: str,
    _: str = Depends(get_current_user),
) -> dict:
    """Return the parsed YAML config for a client as JSON."""
    path   = _config_path(client_slug)
    config = _read_config(path)
    return {"client_slug": client_slug, "config": config}


# ---------------------------------------------------------------------------
# PUT /config/{client_slug}
# ---------------------------------------------------------------------------

class ConfigUpdateRequest(BaseModel):
    config: dict


@router.put("/{client_slug}")
async def update_config(
    client_slug: str,
    body: ConfigUpdateRequest,
    _: str = Depends(get_current_user),
) -> dict:
    """
    Overwrite the client's YAML config with the provided data.

    The new config is validated (must be a non-empty dict) then written
    to disk. The agent will use the new config on its next restart.
    """
    if not body.config:
        raise HTTPException(status_code=400, detail="Config cannot be empty.")

    path = _config_path(client_slug)

    # Confirm the file exists before overwriting
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"No config found for '{client_slug}'.")

    _write_config(path, body.config)
    logger.info(f"Config updated for client: {client_slug}")
    return {"status": "saved", "client_slug": client_slug}
