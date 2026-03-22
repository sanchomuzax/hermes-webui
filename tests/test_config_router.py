"""Tests for config editor router."""


def test_get_config(client):
    """Get config returns masked config."""
    response = client.get("/api/config")
    assert response.status_code == 200
    data = response.json()
    assert "config" in data
    assert data["config"]["model"]["default"] == "nous/hermes-3"


def test_patch_config(client):
    """Patch a config value."""
    response = client.patch(
        "/api/config",
        json={"path": "model.default", "value": "openai/gpt-4"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["path"] == "model.default"

    # Verify the change persisted
    response = client.get("/api/config")
    assert response.json()["config"]["model"]["default"] == "openai/gpt-4"


def test_patch_config_requires_restart(client):
    """Changing provider flags requires_restart."""
    response = client.patch(
        "/api/config",
        json={"path": "model.provider", "value": "anthropic"},
    )
    assert response.status_code == 200
    assert response.json()["requires_restart"] is True


def test_get_env_variables(client):
    """Get env variables with masking."""
    response = client.get("/api/config/env")
    assert response.status_code == 200
    data = response.json()
    variables = data["variables"]
    assert len(variables) >= 2

    # API keys should be masked
    api_key_var = next((v for v in variables if v["key"] == "OPENROUTER_API_KEY"), None)
    assert api_key_var is not None
    assert api_key_var["is_sensitive"] is True
    assert "***" in api_key_var["value"] or len(api_key_var["value"]) < 30

    # Non-sensitive vars should be visible
    terminal_var = next((v for v in variables if v["key"] == "TERMINAL_ENV"), None)
    assert terminal_var is not None
    assert terminal_var["value"] == "local"
    assert terminal_var["is_sensitive"] is False
