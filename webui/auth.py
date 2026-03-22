"""Authentication middleware for the WebUI API."""

from fastapi import Depends, HTTPException, Request, WebSocket, status
from fastapi.security import APIKeyHeader

from webui.config import get_webui_config

_api_key_header = APIKeyHeader(name="X-Hermes-Token", auto_error=False)


def _get_expected_token() -> str:
    """Get the expected auth token."""
    config = get_webui_config()
    return config.get_or_create_token()


async def require_auth(
    api_key: str = Depends(_api_key_header),
) -> str:
    """Dependency that validates the auth token for HTTP endpoints."""
    expected = _get_expected_token()
    if not api_key or api_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing authentication token",
        )
    return api_key


async def validate_ws_token(websocket: WebSocket, token: str) -> bool:
    """Validate a token received via WebSocket message."""
    expected = _get_expected_token()
    return token == expected
