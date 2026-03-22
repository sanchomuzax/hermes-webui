"""Tests for authentication."""


def test_auth_required_for_sessions(unauthed_client):
    """Sessions endpoint requires authentication."""
    response = unauthed_client.get("/api/sessions")
    assert response.status_code == 401


def test_auth_required_for_config(unauthed_client):
    """Config endpoint requires authentication."""
    response = unauthed_client.get("/api/config")
    assert response.status_code == 401


def test_auth_invalid_token(unauthed_client):
    """Invalid token is rejected."""
    response = unauthed_client.get(
        "/api/sessions",
        headers={"X-Hermes-Token": "wrong-token"},
    )
    assert response.status_code == 401


def test_auth_valid_token(client):
    """Valid token grants access."""
    response = client.get("/api/sessions")
    assert response.status_code == 200
