"""
api/dependencies.py

Shared FastAPI dependencies.

get_current_user  — validates a Bearer JWT, returns the email "sub".
                    Add as a parameter to any route that needs auth:

                        async def my_route(_: str = Depends(get_current_user)):
"""

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import jwt

from config.settings import get_settings

_security = HTTPBearer(auto_error=False)


def _decode_jwt(token: str) -> str:
    """Shared JWT decode logic. Returns the 'sub' claim or raises 401."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        sub: str | None = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="Invalid token payload.")
        return sub
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_security),
) -> str:
    """
    Validate the Authorization: Bearer <token> header.

    Returns the email stored in the token's 'sub' claim.
    Raises 401 if the token is absent, expired, or invalid.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _decode_jwt(credentials.credentials)


async def get_current_user_from_query(
    token: str = Query(..., description="JWT passed as ?token= for SSE endpoints"),
) -> str:
    """
    Validate a JWT passed as a query parameter.

    Used by Server-Sent Events endpoints because the browser's EventSource API
    does not support custom request headers.
    """
    return _decode_jwt(token)
