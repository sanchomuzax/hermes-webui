"""Pydantic models for gateway status."""

from typing import Any, Optional

from pydantic import BaseModel


class PlatformStatus(BaseModel):
    """Status of a single messaging platform."""

    name: str
    connected: bool = False
    details: Optional[dict[str, Any]] = None


class GatewayStatusResponse(BaseModel):
    """Gateway runtime status."""

    running: bool
    pid: Optional[int] = None
    uptime_seconds: Optional[float] = None
    platforms: list[PlatformStatus] = []
    raw: Optional[dict[str, Any]] = None
