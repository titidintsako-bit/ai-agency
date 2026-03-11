"""
main.py

FastAPI application entry point for the AI Agency backend.

What this file does:
    - Defines the FastAPI app with lifespan (startup/shutdown)
    - Mounts all route routers
    - Configures CORS for the dashboard frontend
    - Provides a /health endpoint for Railway health checks
    - Configures logging

Running locally:
    uvicorn main:app --reload --port 8000

Running in production (Railway picks this up from railway.toml):
    uvicorn main:app --host 0.0.0.0 --port $PORT
"""

import logging
import logging.config
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.registry import registry
from api.routers import agent_config, analytics, auth, chat, dashboard, events, monitor, portal, webhooks
from api.schemas import HealthResponse
from config.settings import get_settings
from core.database import check_connection

# ---------------------------------------------------------------------------
# Logging setup
# Configure this before anything else so all modules log correctly from startup.
# ---------------------------------------------------------------------------

def _configure_logging(log_level: str) -> None:
    """Set up structured logging for the application."""
    logging.config.dictConfig({
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
            },
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "default",
            },
        },
        "root": {
            "level": log_level.upper(),
            "handlers": ["console"],
        },
    })


# ---------------------------------------------------------------------------
# Lifespan — startup and shutdown logic
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager.

    Startup:
        1. Configure logging
        2. Verify the Supabase connection
        3. Load all active agents into the registry

    Shutdown:
        Nothing to clean up (connections are stateless).
    """
    settings = get_settings()

    # 1. Logging
    _configure_logging(settings.log_level)
    logger = logging.getLogger(__name__)

    logger.info("=" * 60)
    logger.info("AI Agency Backend starting up")
    logger.info(f"Environment: {settings.environment}")
    logger.info("=" * 60)

    # 2. Database connection check
    logger.info("Checking Supabase connection...")
    if not check_connection():
        logger.critical(
            "Cannot connect to Supabase. "
            "Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file."
        )
        # Raise so Railway/Docker knows startup failed and restarts the container
        raise RuntimeError("Supabase connection failed at startup.")
    logger.info("Supabase connection: OK")

    # 3. Load agent registry
    logger.info("Loading agent registry...")
    try:
        registry.load()
        logger.info(f"Agents loaded: {registry.list_agents()}")
    except Exception as e:
        logger.critical(f"Failed to load agent registry: {e}")
        raise RuntimeError(f"Agent registry failed to load: {e}") from e

    logger.info("Startup complete. Ready to serve requests.")

    yield  # Application runs here

    # Shutdown
    logger.info("AI Agency Backend shutting down.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

settings = get_settings()

app = FastAPI(
    title="AI Agency Platform",
    description="Backend API for AI Agency — conversational agents for South African SMBs.",
    version="0.1.0",
    # Hide docs in production — the dashboard is internal, not a public API
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# CORS
# Allows the Vercel dashboard to call this API from the browser.
# Add your Vercel domain and localhost for development.
# ---------------------------------------------------------------------------

_ALLOWED_ORIGINS = [
    "http://localhost:5173",     # Vite dev server
    "http://localhost:3000",     # Alternative dev port
]

# Add production dashboard origin from env if set
if settings.dashboard_origin:
    _ALLOWED_ORIGINS.append(settings.dashboard_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(dashboard.router)
app.include_router(analytics.router)
app.include_router(agent_config.router)
app.include_router(events.router)
app.include_router(monitor.router)
app.include_router(portal.router)
app.include_router(webhooks.router)


# ---------------------------------------------------------------------------
# Health check
# Railway calls this to confirm the container is alive.
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health_check() -> HealthResponse:
    """
    Lightweight health check endpoint for Railway.

    Returns the DB connection status so you can tell at a glance whether
    the backend is fully operational or just partially up.
    """
    db_ok = check_connection()

    return HealthResponse(
        status="ok" if db_ok else "degraded",
        environment=settings.environment,
        db_connected=db_ok,
    )


@app.get("/", tags=["system"])
async def root() -> dict:
    """Root endpoint — confirms the API is running."""
    return {
        "service": "AI Agency Platform",
        "status": "running",
        "agents": registry.list_agents(),
    }
