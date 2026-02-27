"""
api/dependencies.py

Shared FastAPI dependencies.

get_current_user  — validates a Bearer JWT, returns the email "sub".
                    Add as a parameter to any route that needs auth:

                        async def my_route(_: str = Depends(get_current_user)):
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import jwt

from config.settings import get_settings

_security = HTTPBearer(auto_error=False)


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

    settings = get_settings()

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=["HS256"],
        )
        sub: str | None = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="Invalid token payload.")
        return sub

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
