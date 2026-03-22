"""Tests for gateway status router."""


def test_gateway_status(client):
    """Gateway status returns platform and service info."""
    response = client.get("/api/gateway/status")
    assert response.status_code == 200
    data = response.json()
    assert "running" in data
    assert "platforms" in data

    # Should include gateway platforms + detected services
    assert len(data["platforms"]) >= 2

    # Gateway platforms from gateway_state.json
    telegram = next((p for p in data["platforms"] if p["name"] == "telegram"), None)
    assert telegram is not None
    assert telegram["connected"] is True

    discord = next((p for p in data["platforms"] if p["name"] == "discord"), None)
    assert discord is not None
    assert discord["connected"] is False

    # Services detected from config.yaml
    names = [p["name"] for p in data["platforms"]]
    assert any("honcho" in n for n in names)
    assert any("tts" in n for n in names)
    assert any("stt" in n for n in names)
