"""Health check endpoint."""

from fastapi import APIRouter

from webui import __version__
from webui.hermes_bridge import get_state_db_path, get_gateway_state_path, is_hermes_available

router = APIRouter(tags=["health"])


@router.get("/api/health")
async def health():
    """Server health check with DB and gateway status."""
    db_exists = get_state_db_path().exists()
    gateway_state_exists = get_gateway_state_path().exists()

    return {
        "status": "ok",
        "version": __version__,
        "hermes_agent_available": is_hermes_available(),
        "state_db_exists": db_exists,
        "gateway_state_exists": gateway_state_exists,
    }
