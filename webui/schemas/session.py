"""Pydantic models for session and message data."""

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict


class SessionSummary(BaseModel):
    """Session list item."""

    id: str
    source: str
    model: Optional[str] = None
    title: Optional[str] = None
    started_at: float
    ended_at: Optional[float] = None
    end_reason: Optional[str] = None
    message_count: int = 0
    tool_call_count: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0
    reasoning_tokens: int = 0
    estimated_cost_usd: Optional[float] = None
    actual_cost_usd: Optional[float] = None
    billing_provider: Optional[str] = None
    preview: str = ""
    last_active: Optional[float] = None


class SessionDetail(SessionSummary):
    """Full session detail including config."""

    user_id: Optional[str] = None
    model_config_data: Optional[dict] = None
    system_prompt: Optional[str] = None
    parent_session_id: Optional[str] = None
    cost_status: Optional[str] = None
    cost_source: Optional[str] = None
    pricing_version: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class Message(BaseModel):
    """Single message in a session."""

    id: int
    session_id: str
    role: str
    content: Optional[str] = None
    tool_call_id: Optional[str] = None
    tool_calls: Optional[Any] = None
    tool_name: Optional[str] = None
    timestamp: float
    token_count: Optional[int] = None
    finish_reason: Optional[str] = None


class SessionListResponse(BaseModel):
    """Paginated session list response."""

    sessions: list[SessionSummary]
    total: int
    limit: int
    offset: int


class SessionStatsResponse(BaseModel):
    """Aggregate session statistics."""

    total_sessions: int
    total_messages: int
    total_estimated_cost_usd: float
    sessions_by_source: dict[str, int]
    sessions_by_model: dict[str, int]


class SearchResult(BaseModel):
    """FTS5 search result."""

    id: int
    session_id: str
    role: str
    snippet: str
    timestamp: float
    tool_name: Optional[str] = None
    source: str
    model: Optional[str] = None
    session_started: float
    context: list[dict] = []


class SetTitleRequest(BaseModel):
    """Request to set session title."""

    title: str
