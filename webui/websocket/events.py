"""WebSocket event type definitions."""

from typing import Any, Optional

from pydantic import BaseModel


class WSEvent(BaseModel):
    """A WebSocket event sent to connected clients."""

    type: str  # e.g. "session:created", "agent:step", "platform:status"
    data: dict[str, Any] = {}
    timestamp: Optional[float] = None
