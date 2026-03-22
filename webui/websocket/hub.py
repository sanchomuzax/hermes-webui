"""WebSocket connection manager and broadcast hub."""

import asyncio
import json
import logging
import time
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

from webui.websocket.events import WSEvent

logger = logging.getLogger(__name__)


class WebSocketHub:
    """Manages WebSocket connections and broadcasts events to all clients."""

    def __init__(self):
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and register a WebSocket connection."""
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)
        logger.info("WebSocket client connected (%d total)", len(self._connections))

    async def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection."""
        async with self._lock:
            self._connections.discard(websocket)
        logger.info("WebSocket client disconnected (%d total)", len(self._connections))

    async def broadcast(self, event: WSEvent) -> None:
        """Send an event to all connected clients."""
        if not self._connections:
            return

        if event.timestamp is None:
            event = WSEvent(
                type=event.type,
                data=event.data,
                timestamp=time.time(),
            )

        payload = event.model_dump_json()

        async with self._lock:
            dead: list[WebSocket] = []
            for ws in self._connections:
                try:
                    await ws.send_text(payload)
                except Exception:
                    dead.append(ws)

            for ws in dead:
                self._connections.discard(ws)

    @property
    def client_count(self) -> int:
        return len(self._connections)


# Global hub instance
hub = WebSocketHub()
