"""Pydantic models for configuration endpoints."""

from typing import Any, Optional

from pydantic import BaseModel


class ConfigResponse(BaseModel):
    """Full config.yaml contents (secrets masked)."""

    config: dict[str, Any]


class ConfigPatchRequest(BaseModel):
    """Request to update a config value."""

    path: str  # dot-separated path, e.g. "model.default"
    value: Any


class ConfigPatchResponse(BaseModel):
    """Response after config update."""

    success: bool
    path: str
    requires_restart: bool = False


class EnvVariable(BaseModel):
    """Single environment variable (value masked if sensitive)."""

    key: str
    value: str  # masked for sensitive keys
    is_sensitive: bool = False


class EnvListResponse(BaseModel):
    """List of environment variables."""

    variables: list[EnvVariable]


class EnvPatchRequest(BaseModel):
    """Request to update an environment variable."""

    key: str
    value: str
