"""Full-text search endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, Query

from webui.auth import require_auth
from webui.hermes_bridge import get_session_db
from webui.schemas.session import SearchResult

router = APIRouter(prefix="/api/search", tags=["search"], dependencies=[Depends(require_auth)])


@router.get("/messages", response_model=list[SearchResult])
async def search_messages(
    q: str = Query(..., min_length=1, description="Search query (FTS5 syntax)"),
    source: Optional[str] = None,
    role: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """Full-text search across session messages using FTS5."""
    db = get_session_db(readonly=True)
    try:
        source_filter = [source] if source else None
        role_filter = [role] if role else None

        results = db.search_messages(
            query=q,
            source_filter=source_filter,
            role_filter=role_filter,
            limit=limit,
            offset=offset,
        )
    finally:
        if hasattr(db, "close"):
            db.close()

    return [SearchResult(**r) for r in results]
