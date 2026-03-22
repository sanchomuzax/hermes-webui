"""Session management endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from webui.auth import require_auth
from webui.hermes_bridge import get_session_db
from webui.schemas.session import (
    Message,
    SessionDetail,
    SessionListResponse,
    SessionStatsResponse,
    SessionSummary,
    SetTitleRequest,
)

router = APIRouter(prefix="/api/sessions", tags=["sessions"], dependencies=[Depends(require_auth)])


def _get_db():
    return get_session_db(readonly=True)


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    source: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
):
    """List sessions with pagination and optional source filter."""
    db = _get_db()
    try:
        sessions = db.list_sessions_rich(source=source, limit=limit, offset=offset)
        total = db.session_count(source=source)
    finally:
        if hasattr(db, "close"):
            db.close()

    return SessionListResponse(
        sessions=[SessionSummary(**s) for s in sessions],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/stats", response_model=SessionStatsResponse)
async def session_stats():
    """Aggregate session statistics."""
    db = _get_db()
    try:
        total_sessions = db.session_count()

        # Get message count
        total_messages = 0
        if hasattr(db, "message_count"):
            total_messages = db.message_count()

        # Aggregate stats from all sessions
        sessions = db.list_sessions_rich(limit=10000, offset=0)

        total_cost = 0.0
        by_source: dict[str, int] = {}
        by_model: dict[str, int] = {}

        for s in sessions:
            cost = s.get("estimated_cost_usd") or s.get("actual_cost_usd") or 0
            # Skip unrealistic cost values (negative or > $100 per session)
            if isinstance(cost, (int, float)) and 0 < cost < 100:
                total_cost += cost

            src = s.get("source", "unknown")
            by_source[src] = by_source.get(src, 0) + 1

            model = s.get("model") or "unknown"
            by_model[model] = by_model.get(model, 0) + 1
    finally:
        if hasattr(db, "close"):
            db.close()

    return SessionStatsResponse(
        total_sessions=total_sessions,
        total_messages=total_messages,
        total_estimated_cost_usd=round(total_cost, 6),
        sessions_by_source=by_source,
        sessions_by_model=by_model,
    )


@router.get("/{session_id}")
async def get_session(session_id: str):
    """Get a single session's details."""
    db = _get_db()
    try:
        session = db.get_session(session_id)
    finally:
        if hasattr(db, "close"):
            db.close()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Rename model_config to avoid Pydantic conflict
    if "model_config" in session:
        session["model_config_data"] = session.pop("model_config")

    return session


@router.get("/{session_id}/messages", response_model=list[Message])
async def get_messages(session_id: str):
    """Get all messages for a session."""
    db = _get_db()
    try:
        session = db.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        messages = db.get_messages(session_id)
    finally:
        if hasattr(db, "close"):
            db.close()

    return [Message(**m) for m in messages]


@router.get("/{session_id}/export")
async def export_session(session_id: str):
    """Export a complete session with all messages."""
    db = _get_db()
    try:
        result = db.export_session(session_id)
    finally:
        if hasattr(db, "close"):
            db.close()

    if not result:
        raise HTTPException(status_code=404, detail="Session not found")

    return result


@router.post("/{session_id}/title")
async def set_title(session_id: str, req: SetTitleRequest):
    """Set a session's title."""
    db = get_session_db(readonly=False)
    try:
        session = db.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        if hasattr(db, "set_session_title"):
            db.set_session_title(session_id, req.title)
        else:
            raise HTTPException(status_code=501, detail="Title setting not available in fallback mode")
    finally:
        if hasattr(db, "close"):
            db.close()

    return {"success": True, "title": req.title}
