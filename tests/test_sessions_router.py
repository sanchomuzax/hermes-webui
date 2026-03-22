"""Tests for sessions router."""


def test_list_sessions(client):
    """List sessions returns paginated results."""
    response = client.get("/api/sessions")
    assert response.status_code == 200
    data = response.json()
    assert "sessions" in data
    assert "total" in data
    assert data["total"] == 2
    assert len(data["sessions"]) == 2


def test_list_sessions_with_source_filter(client):
    """Filter sessions by source."""
    response = client.get("/api/sessions?source=cli")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["sessions"][0]["source"] == "cli"


def test_list_sessions_pagination(client):
    """Pagination works correctly."""
    response = client.get("/api/sessions?limit=1&offset=0")
    assert response.status_code == 200
    data = response.json()
    assert len(data["sessions"]) == 1
    assert data["total"] == 2


def test_get_session(client):
    """Get a single session by ID."""
    response = client.get("/api/sessions/test-session-1")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "test-session-1"
    assert data["source"] == "cli"
    assert data["title"] == "Test Session"


def test_get_session_not_found(client):
    """Non-existent session returns 404."""
    response = client.get("/api/sessions/nonexistent")
    assert response.status_code == 404


def test_get_session_messages(client):
    """Get messages for a session."""
    response = client.get("/api/sessions/test-session-1/messages")
    assert response.status_code == 200
    messages = response.json()
    assert len(messages) == 3
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "Hello, how are you?"
    assert messages[1]["role"] == "assistant"


def test_get_session_messages_with_tool_calls(client):
    """Tool calls are properly deserialized."""
    response = client.get("/api/sessions/test-session-1/messages")
    messages = response.json()
    tool_msg = messages[2]
    assert tool_msg["tool_name"] == "web_search"
    assert isinstance(tool_msg["tool_calls"], list)


def test_session_stats(client):
    """Session stats aggregation."""
    response = client.get("/api/sessions/stats")
    assert response.status_code == 200
    stats = response.json()
    assert stats["total_sessions"] == 2
    assert stats["total_estimated_cost_usd"] > 0
    assert "cli" in stats["sessions_by_source"]
    assert "telegram" in stats["sessions_by_source"]


def test_export_session(client):
    """Export a session with messages."""
    response = client.get("/api/sessions/test-session-1/export")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "test-session-1"
    assert "messages" in data
    assert len(data["messages"]) == 3
