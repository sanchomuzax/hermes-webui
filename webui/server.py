"""FastAPI application factory for Hermes WebUI."""

import json
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from webui.auth import validate_ws_token
from webui.config import get_webui_config
from webui.hermes_bridge import init_hermes_path
from webui.routers import config_editor, cron, gateway_status, health, search, sessions, skills
from webui.websocket.hook_bridge import bridge
from webui.websocket.hub import hub

logger = logging.getLogger(__name__)

FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown."""
    # Initialize hermes-agent path on startup
    available = init_hermes_path()
    logger.info("Hermes Agent modules: %s", "available" if available else "fallback mode")

    # Start the polling bridge for WebSocket events
    await bridge.start()

    yield

    # Cleanup
    await bridge.stop()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    config = get_webui_config()

    app = FastAPI(
        title="Hermes WebUI",
        description="Process monitoring and configuration UI for Hermes Agent",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register API routers
    app.include_router(health.router)
    app.include_router(sessions.router)
    app.include_router(search.router)
    app.include_router(gateway_status.router)
    app.include_router(config_editor.router)
    app.include_router(skills.router)
    app.include_router(cron.router)

    # WebSocket endpoint
    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        """WebSocket endpoint for real-time events.

        Client must send auth token as first message:
        {"type": "auth", "token": "..."}
        """
        await hub.connect(websocket)

        try:
            # Wait for auth message
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.close(code=4001, reason="Invalid JSON")
                return

            if msg.get("type") != "auth" or not msg.get("token"):
                await websocket.close(code=4001, reason="Auth required")
                return

            is_valid = await validate_ws_token(websocket, msg["token"])
            if not is_valid:
                await websocket.close(code=4003, reason="Invalid token")
                return

            # Auth successful — send confirmation
            await websocket.send_json({
                "type": "auth:ok",
                "data": {"client_count": hub.client_count},
                "timestamp": time.time(),
            })

            # Keep connection alive, handle incoming messages
            while True:
                data = await websocket.receive_text()
                # Client can send ping to keep alive
                try:
                    msg = json.loads(data)
                    if msg.get("type") == "ping":
                        await websocket.send_json({
                            "type": "pong",
                            "timestamp": time.time(),
                        })
                except json.JSONDecodeError:
                    pass

        except WebSocketDisconnect:
            pass
        finally:
            await hub.disconnect(websocket)

    # Serve frontend static files (if built)
    if FRONTEND_DIST.exists():
        # Mount static assets (JS, CSS, images)
        app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

        # SPA catch-all: serve index.html for any non-API, non-asset path
        @app.get("/{path:path}")
        async def spa_fallback(request: Request, path: str):
            # Serve actual files if they exist (favicon, etc.)
            file_path = FRONTEND_DIST / path
            if path and file_path.exists() and file_path.is_file():
                return FileResponse(str(file_path))
            # Otherwise serve index.html for SPA routing
            return FileResponse(str(FRONTEND_DIST / "index.html"))

    return app
