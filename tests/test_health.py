"""Tests for health endpoint."""


def test_health_returns_ok(client):
    """Health endpoint returns status ok."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "state_db_exists" in data


def test_health_no_auth_required(unauthed_client):
    """Health endpoint is accessible without auth."""
    response = unauthed_client.get("/api/health")
    assert response.status_code == 200
