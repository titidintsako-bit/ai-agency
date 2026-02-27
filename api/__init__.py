"""
api/

FastAPI route handlers and supporting infrastructure.

Modules:
    schemas.py      — Pydantic request/response models
    registry.py     — AgentRegistry: loads and caches agent instances from the DB
    routers/
        chat.py     — POST /chat/{client_slug}  (web widget + direct API)
        webhooks.py — POST /webhooks/whatsapp/{client_slug}  (Twilio)
"""
