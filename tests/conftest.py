"""Shared test fixtures for Hermes WebUI tests."""

import json
import os
import sqlite3
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def temp_hermes_home(tmp_path):
    """Create a temporary HERMES_HOME with a test state.db."""
    hermes_home = tmp_path / ".hermes"
    hermes_home.mkdir()

    # Create state.db with schema
    db_path = hermes_home / "state.db"
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);
        INSERT INTO schema_version (version) VALUES (5);

        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            user_id TEXT,
            model TEXT,
            model_config TEXT,
            system_prompt TEXT,
            parent_session_id TEXT,
            started_at REAL NOT NULL,
            ended_at REAL,
            end_reason TEXT,
            message_count INTEGER DEFAULT 0,
            tool_call_count INTEGER DEFAULT 0,
            input_tokens INTEGER DEFAULT 0,
            output_tokens INTEGER DEFAULT 0,
            cache_read_tokens INTEGER DEFAULT 0,
            cache_write_tokens INTEGER DEFAULT 0,
            reasoning_tokens INTEGER DEFAULT 0,
            billing_provider TEXT,
            billing_base_url TEXT,
            billing_mode TEXT,
            estimated_cost_usd REAL,
            actual_cost_usd REAL,
            cost_status TEXT,
            cost_source TEXT,
            pricing_version TEXT,
            title TEXT
        );

        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL REFERENCES sessions(id),
            role TEXT NOT NULL,
            content TEXT,
            tool_call_id TEXT,
            tool_calls TEXT,
            tool_name TEXT,
            timestamp REAL NOT NULL,
            token_count INTEGER,
            finish_reason TEXT
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
            content,
            content=messages,
            content_rowid=id
        );

        CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
            INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
        END;
    """)

    # Insert test data
    conn.execute("""
        INSERT INTO sessions (id, source, model, started_at, message_count, tool_call_count,
                              input_tokens, output_tokens, estimated_cost_usd, title)
        VALUES ('test-session-1', 'cli', 'nous/hermes-3', 1710000000.0, 5, 2,
                1000, 500, 0.003, 'Test Session')
    """)
    conn.execute("""
        INSERT INTO sessions (id, source, model, started_at, ended_at, message_count,
                              input_tokens, output_tokens, estimated_cost_usd)
        VALUES ('test-session-2', 'telegram', 'openai/gpt-4', 1709900000.0, 1709900100.0, 3,
                2000, 1000, 0.05)
    """)
    conn.execute("""
        INSERT INTO messages (session_id, role, content, timestamp)
        VALUES ('test-session-1', 'user', 'Hello, how are you?', 1710000001.0)
    """)
    conn.execute("""
        INSERT INTO messages (session_id, role, content, timestamp)
        VALUES ('test-session-1', 'assistant', 'I am doing well!', 1710000002.0)
    """)
    conn.execute("""
        INSERT INTO messages (session_id, role, content, timestamp, tool_name, tool_calls)
        VALUES ('test-session-1', 'assistant', NULL, 1710000003.0, 'web_search',
                '[{"name": "web_search", "arguments": {"query": "test"}}]')
    """)
    conn.commit()
    conn.close()

    # Create config.yaml
    import yaml
    config = {
        "model": {"default": "nous/hermes-3", "provider": "openrouter"},
        "terminal": {"backend": "local", "timeout": 60},
        "timezone": "Europe/Budapest",
    }
    (hermes_home / "config.yaml").write_text(yaml.dump(config))

    # Create .env
    (hermes_home / ".env").write_text(
        'OPENROUTER_API_KEY="sk-test-1234567890abcdef"\n'
        'PARALLEL_API_KEY="pk-test-abc"\n'
        'TERMINAL_ENV="local"\n'
    )

    # Create gateway_state.json
    gateway_state = {
        "pid": 99999,
        "started_at": "2026-03-22T10:00:00+00:00",
        "platforms": {
            "telegram": {"connected": True, "username": "hermes_bot"},
            "discord": {"connected": False},
        },
    }
    (hermes_home / "gateway_state.json").write_text(json.dumps(gateway_state))

    # Create cron dir with jobs
    cron_dir = hermes_home / "cron"
    cron_dir.mkdir()
    jobs = [
        {"id": "job-1", "name": "Daily Summary", "schedule": "0 9 * * *",
         "prompt": "Summarize yesterday's activity", "enabled": True},
    ]
    (cron_dir / "jobs.json").write_text(json.dumps(jobs))

    return hermes_home


@pytest.fixture
def test_token():
    """Return a fixed test token."""
    return "test-token-1234"


@pytest.fixture
def app(temp_hermes_home, test_token):
    """Create a test FastAPI app with mocked paths."""
    with patch("webui.hermes_bridge.HERMES_HOME", temp_hermes_home), \
         patch("webui.hermes_bridge.HERMES_AGENT_PATH", temp_hermes_home / "hermes-agent"), \
         patch("webui.config.HERMES_HOME", temp_hermes_home), \
         patch("webui.config.AUTH_FILE", temp_hermes_home / "auth.json"):

        # Write auth file with test token
        auth_data = {"webui_token": test_token}
        (temp_hermes_home / "auth.json").write_text(json.dumps(auth_data))

        from webui.server import create_app
        application = create_app()
        yield application


@pytest.fixture
def client(app, test_token):
    """Create a test client with auth header."""
    with TestClient(app) as c:
        c.headers["X-Hermes-Token"] = test_token
        yield c


@pytest.fixture
def unauthed_client(app):
    """Create a test client without auth."""
    with TestClient(app) as c:
        yield c
