"""Tests for hermes_bridge module."""

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from webui.hermes_bridge import (
    FallbackSessionDB,
    read_config_yaml,
    read_gateway_state,
    write_config_yaml_value,
)


def test_fallback_session_db_list_sessions(temp_hermes_home):
    """FallbackSessionDB can list sessions."""
    db = FallbackSessionDB(temp_hermes_home / "state.db")
    try:
        sessions = db.list_sessions_rich(limit=10)
        assert len(sessions) == 2
        assert sessions[0]["source"] in ("cli", "telegram")
    finally:
        db.close()


def test_fallback_session_db_get_session(temp_hermes_home):
    """FallbackSessionDB can get a single session."""
    db = FallbackSessionDB(temp_hermes_home / "state.db")
    try:
        session = db.get_session("test-session-1")
        assert session is not None
        assert session["id"] == "test-session-1"
        assert session["model"] == "nous/hermes-3"
    finally:
        db.close()


def test_fallback_session_db_get_messages(temp_hermes_home):
    """FallbackSessionDB can retrieve messages."""
    db = FallbackSessionDB(temp_hermes_home / "state.db")
    try:
        messages = db.get_messages("test-session-1")
        assert len(messages) == 3
        assert messages[0]["role"] == "user"
    finally:
        db.close()


def test_fallback_session_db_search_messages(temp_hermes_home):
    """FallbackSessionDB can search messages via FTS5."""
    db = FallbackSessionDB(temp_hermes_home / "state.db")
    try:
        results = db.search_messages("Hello")
        assert len(results) >= 1
    finally:
        db.close()


def test_fallback_session_db_session_count(temp_hermes_home):
    """FallbackSessionDB counts sessions."""
    db = FallbackSessionDB(temp_hermes_home / "state.db")
    try:
        assert db.session_count() == 2
        assert db.session_count(source="cli") == 1
    finally:
        db.close()


def test_fallback_session_db_not_found(tmp_path):
    """FallbackSessionDB raises if DB doesn't exist."""
    with pytest.raises(FileNotFoundError):
        FallbackSessionDB(tmp_path / "nonexistent.db")


def test_read_config_yaml(temp_hermes_home):
    """Read config.yaml returns correct data."""
    with patch("webui.hermes_bridge.HERMES_HOME", temp_hermes_home):
        config = read_config_yaml()
        assert config["model"]["default"] == "nous/hermes-3"
        assert config["timezone"] == "Europe/Budapest"


def test_write_config_yaml_value(temp_hermes_home):
    """Targeted config write persists changes and creates backup."""
    with patch("webui.hermes_bridge.HERMES_HOME", temp_hermes_home):
        write_config_yaml_value("model.default", "test-model")

        reloaded = read_config_yaml()
        assert reloaded["model"]["default"] == "test-model"

        # Backup should exist
        backup = temp_hermes_home / "config.yaml.bak"
        assert backup.exists()


def test_read_gateway_state(temp_hermes_home):
    """Read gateway_state.json returns correct data."""
    with patch("webui.hermes_bridge.HERMES_HOME", temp_hermes_home):
        state = read_gateway_state()
        assert state is not None
        assert state["pid"] == 99999
        assert "telegram" in state["platforms"]


def test_read_gateway_state_missing(tmp_path):
    """Missing gateway_state.json returns None."""
    with patch("webui.hermes_bridge.HERMES_HOME", tmp_path):
        assert read_gateway_state() is None
