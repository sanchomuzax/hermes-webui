"""Configuration editor endpoints."""

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from webui.auth import require_auth
from webui.hermes_bridge import get_env_path, read_config_yaml, write_config_yaml_value
from webui.schemas.config import (
    ConfigPatchRequest,
    ConfigPatchResponse,
    ConfigResponse,
    EnvListResponse,
    EnvPatchRequest,
    EnvVariable,
)

router = APIRouter(prefix="/api/config", tags=["config"], dependencies=[Depends(require_auth)])

# Keys that require a restart when changed
RESTART_REQUIRED_KEYS = {
    "model.provider",
    "terminal.backend",
    "terminal.timeout",
    "terminal.lifetime",
}

# Patterns for sensitive environment variable names
SENSITIVE_PATTERNS = re.compile(
    r"(API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|PRIVATE_KEY)", re.IGNORECASE
)


def _mask_value(value: str) -> str:
    """Mask a sensitive value, showing first 4 and last 4 chars."""
    if len(value) <= 12:
        return "***masked***"
    return f"{value[:4]}...{value[-4:]}"


def _mask_secrets(config: dict, parent_key: str = "") -> dict:
    """Recursively mask sensitive values in config dict."""
    result = {}
    for key, value in config.items():
        full_key = f"{parent_key}.{key}" if parent_key else key
        if isinstance(value, dict):
            result[key] = _mask_secrets(value, full_key)
        elif isinstance(value, str) and SENSITIVE_PATTERNS.search(key):
            result[key] = _mask_value(value)
        else:
            result[key] = value
    return result


def _set_nested_value(config: dict, path: str, value: Any) -> dict:
    """Set a value at a dot-separated path in a nested dict, immutably."""
    keys = path.split(".")
    result = {**config}
    current = result

    for i, key in enumerate(keys[:-1]):
        if key not in current or not isinstance(current[key], dict):
            current[key] = {}
        current[key] = {**current[key]}
        current = current[key]

    current[keys[-1]] = value
    return result


@router.get("", response_model=ConfigResponse)
async def get_config():
    """Read config.yaml with secrets masked."""
    config = read_config_yaml()
    masked = _mask_secrets(config)
    return ConfigResponse(config=masked)


@router.patch("", response_model=ConfigPatchResponse)
async def patch_config(req: ConfigPatchRequest):
    """Update a single config value by dot-separated path.

    Uses targeted line replacement to preserve comments and formatting.
    A .bak backup is created before every write.
    """
    write_config_yaml_value(req.path, req.value)

    requires_restart = req.path in RESTART_REQUIRED_KEYS

    return ConfigPatchResponse(
        success=True,
        path=req.path,
        requires_restart=requires_restart,
    )


@router.get("/env", response_model=EnvListResponse)
async def get_env_variables():
    """List environment variables from .env file (values masked for sensitive keys)."""
    env_path = get_env_path()
    if not env_path.exists():
        return EnvListResponse(variables=[])

    variables = []
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue

        key, _, raw_value = line.partition("=")
        key = key.strip()
        raw_value = raw_value.strip().strip('"').strip("'")

        is_sensitive = bool(SENSITIVE_PATTERNS.search(key))
        display_value = _mask_value(raw_value) if (is_sensitive and raw_value) else raw_value

        variables.append(EnvVariable(
            key=key,
            value=display_value,
            is_sensitive=is_sensitive,
        ))

    return EnvListResponse(variables=variables)


@router.patch("/env")
async def patch_env_variable(req: EnvPatchRequest):
    """Update a single environment variable in .env file."""
    env_path = get_env_path()
    if not env_path.exists():
        raise HTTPException(status_code=404, detail=".env file not found")

    from dotenv import set_key
    success, key, value = set_key(str(env_path), req.key, req.value)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to update .env")

    return {"success": True, "key": req.key}
