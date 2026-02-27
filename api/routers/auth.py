"""
api/routers/auth.py

Authentication for the personal admin dashboard.

This is a single-user system — credentials are stored in .env, not a DB.
There's no registration flow; you set DASHBOARD_EMAIL and DASHBOARD_PASSWORD
once and that's it.

Routes:
    POST /auth/login   — validate email + password, return JWT
    GET  /auth/me      — return the current user's email (token check)
"""

import logging
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from api.dependencies import get_current_user
from config.settings import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    """
    Validate dashboard credentials and return a signed JWT.

    The token expires after jwt_expire_hours (default 24h).
    Store it in memory on the client — never in localStorage.
    """
    settings = get_settings()

    if (
        body.email.strip().lower() != settings.dashboard_email.strip().lower()
        or body.password != settings.dashboard_password
    ):
        # Log failed attempts (without the password!) for monitoring
        logger.warning(f"Failed login attempt for email: '{body.email}'")
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    expires = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expire_hours)
    payload = {"sub": body.email, "exp": expires}
    token = jwt.encode(payload, settings.jwt_secret, algorithm="HS256")

    logger.info(f"Dashboard login successful: {body.email}")
    return TokenResponse(access_token=token, email=body.email)


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------

@router.get("/me")
async def me(current_user: str = Depends(get_current_user)) -> dict:
    """Return the logged-in user's email. Used by the frontend to verify the token."""
    return {"email": current_user}
