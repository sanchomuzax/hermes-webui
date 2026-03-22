"""WebUI configuration management."""

import json
import os
import secrets
from pathlib import Path
from typing import Optional

from pydantic import BaseModel

from webui.hermes_bridge import HERMES_HOME


AUTH_FILE = HERMES_HOME / "auth.json"
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 8643


class WebUIConfig(BaseModel):
    """Configuration for the WebUI server."""

    host: str = DEFAULT_HOST
    port: int = DEFAULT_PORT
    cors_origins: list[str] = ["*"]

    def get_or_create_token(self) -> str:
        """Get existing webui_token from auth.json, or create one."""
        auth_data = _read_auth_file()
        token = auth_data.get("webui_token")
        if token:
            return token

        token = secrets.token_hex(32)
        auth_data["webui_token"] = token
        _write_auth_file(auth_data)
        return token


def _read_auth_file() -> dict:
    """Read ~/.hermes/auth.json."""
    if not AUTH_FILE.exists():
        return {}
    try:
        return json.loads(AUTH_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _write_auth_file(data: dict) -> None:
    """Write to ~/.hermes/auth.json."""
    AUTH_FILE.parent.mkdir(parents=True, exist_ok=True)
    AUTH_FILE.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def get_webui_config() -> WebUIConfig:
    """Load WebUI config from environment variables."""
    return WebUIConfig(
        host=os.getenv("HERMES_WEBUI_HOST", DEFAULT_HOST),
        port=int(os.getenv("HERMES_WEBUI_PORT", str(DEFAULT_PORT))),
    )
