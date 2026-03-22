"""
Bridge module for importing Hermes Agent modules.

Adds the hermes-agent source directory to sys.path so we can reuse
SessionDB, gateway status helpers, cron jobs, and config utilities
without duplicating code.

Falls back to direct SQLite access if hermes-agent is not installed.
"""

import json
import os
import sqlite3
import sys
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

HERMES_AGENT_PATH = Path(
    os.getenv("HERMES_AGENT_PATH", Path.home() / ".hermes" / "hermes-agent")
)
HERMES_HOME = Path(os.getenv("HERMES_HOME", Path.home() / ".hermes"))

_hermes_available = False
_init_done = False


def init_hermes_path() -> bool:
    """Add hermes-agent to sys.path for importing its modules.

    Returns True if hermes-agent was found and added successfully.
    """
    global _hermes_available, _init_done

    if _init_done:
        return _hermes_available

    _init_done = True

    if not HERMES_AGENT_PATH.exists():
        return False

    agent_path_str = str(HERMES_AGENT_PATH)
    if agent_path_str not in sys.path:
        sys.path.insert(0, agent_path_str)

    try:
        import hermes_state  # noqa: F401
        _hermes_available = True
    except ImportError:
        _hermes_available = False
        if agent_path_str in sys.path:
            sys.path.remove(agent_path_str)

    return _hermes_available


def is_hermes_available() -> bool:
    """Check if Hermes Agent modules are importable."""
    if not _init_done:
        init_hermes_path()
    return _hermes_available


def get_state_db_path() -> Path:
    """Return the path to Hermes state.db."""
    return HERMES_HOME / "state.db"


def get_config_yaml_path() -> Path:
    """Return the path to Hermes config.yaml."""
    return HERMES_HOME / "config.yaml"


def get_env_path() -> Path:
    """Return the path to Hermes .env file."""
    return HERMES_HOME / ".env"


def get_gateway_state_path() -> Path:
    """Return the path to gateway_state.json."""
    return HERMES_HOME / "gateway_state.json"


def get_skills_dir() -> Path:
    """Return the path to the built-in skills directory."""
    return HERMES_AGENT_PATH / "skills"


def get_custom_skills_dir() -> Path:
    """Return the path to user custom skills directory."""
    return HERMES_HOME / "skills"


def get_cron_dir() -> Path:
    """Return the path to cron directory."""
    return HERMES_HOME / "cron"


class FallbackSessionDB:
    """Minimal read-only SQLite session reader when hermes_state is unavailable.

    Provides the same interface as SessionDB for the methods we need,
    reading directly from state.db via raw SQL.
    """

    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or get_state_db_path()
        if not self.db_path.exists():
            raise FileNotFoundError(f"State database not found: {self.db_path}")

        self._lock = threading.Lock()
        uri = f"file:{self.db_path}?mode=ro"
        self._conn = sqlite3.connect(
            uri, uri=True, check_same_thread=False, timeout=10.0
        )
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            cursor = self._conn.execute(
                "SELECT * FROM sessions WHERE id = ?", (session_id,)
            )
            row = cursor.fetchone()
        return dict(row) if row else None

    def list_sessions_rich(
        self,
        source: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        source_clause = "WHERE s.source = ?" if source else ""
        query = f"""
            SELECT s.*,
                COALESCE(
                    (SELECT SUBSTR(REPLACE(REPLACE(m.content, X'0A', ' '), X'0D', ' '), 1, 63)
                     FROM messages m
                     WHERE m.session_id = s.id AND m.role = 'user' AND m.content IS NOT NULL
                     ORDER BY m.timestamp, m.id LIMIT 1),
                    ''
                ) AS _preview_raw,
                COALESCE(
                    (SELECT MAX(m2.timestamp) FROM messages m2 WHERE m2.session_id = s.id),
                    s.started_at
                ) AS last_active
            FROM sessions s
            {source_clause}
            ORDER BY s.started_at DESC
            LIMIT ? OFFSET ?
        """
        params = (source, limit, offset) if source else (limit, offset)
        with self._lock:
            cursor = self._conn.execute(query, params)
            rows = cursor.fetchall()

        sessions = []
        for row in rows:
            s = dict(row)
            raw = s.pop("_preview_raw", "").strip()
            if raw:
                text = raw[:60]
                s["preview"] = text + ("..." if len(raw) > 60 else "")
            else:
                s["preview"] = ""
            sessions.append(s)
        return sessions

    def get_messages(self, session_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            cursor = self._conn.execute(
                "SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp, id",
                (session_id,),
            )
            rows = cursor.fetchall()

        result = []
        for row in rows:
            msg = dict(row)
            if msg.get("tool_calls"):
                try:
                    msg["tool_calls"] = json.loads(msg["tool_calls"])
                except (json.JSONDecodeError, TypeError):
                    pass
            result.append(msg)
        return result

    def search_messages(
        self,
        query: str,
        source_filter: Optional[List[str]] = None,
        role_filter: Optional[List[str]] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        if not query or not query.strip():
            return []

        where_clauses = ["messages_fts MATCH ?"]
        params: list = [query]

        if source_filter:
            placeholders = ",".join("?" for _ in source_filter)
            where_clauses.append(f"s.source IN ({placeholders})")
            params.extend(source_filter)

        if role_filter:
            placeholders = ",".join("?" for _ in role_filter)
            where_clauses.append(f"m.role IN ({placeholders})")
            params.extend(role_filter)

        where_sql = " AND ".join(where_clauses)
        params.extend([limit, offset])

        sql = f"""
            SELECT
                m.id,
                m.session_id,
                m.role,
                snippet(messages_fts, 0, '>>>', '<<<', '...', 40) AS snippet,
                m.timestamp,
                m.tool_name,
                s.source,
                s.model,
                s.started_at AS session_started
            FROM messages_fts
            JOIN messages m ON m.id = messages_fts.rowid
            JOIN sessions s ON s.id = m.session_id
            WHERE {where_sql}
            ORDER BY rank
            LIMIT ? OFFSET ?
        """
        with self._lock:
            try:
                cursor = self._conn.execute(sql, params)
            except sqlite3.OperationalError:
                return []
            return [dict(row) for row in cursor.fetchall()]

    def export_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        session = self.get_session(session_id)
        if not session:
            return None
        messages = self.get_messages(session_id)
        return {**session, "messages": messages}

    def session_count(self, source: Optional[str] = None) -> int:
        if source:
            cursor = self._conn.execute(
                "SELECT COUNT(*) FROM sessions WHERE source = ?", (source,)
            )
        else:
            cursor = self._conn.execute("SELECT COUNT(*) FROM sessions")
        return cursor.fetchone()[0]

    def close(self):
        self._conn.close()


def get_session_db(readonly: bool = True):
    """Get a SessionDB instance, with fallback to FallbackSessionDB.

    When hermes-agent is available, uses the real SessionDB.
    Otherwise, uses our minimal read-only fallback.
    """
    if is_hermes_available():
        from hermes_state import SessionDB
        return SessionDB(get_state_db_path())

    return FallbackSessionDB(get_state_db_path())


def read_gateway_state() -> Optional[Dict[str, Any]]:
    """Read gateway_state.json and return its contents."""
    path = get_gateway_state_path()
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def read_config_yaml() -> Dict[str, Any]:
    """Read ~/.hermes/config.yaml and return as dict."""
    import yaml

    path = get_config_yaml_path()
    if not path.exists():
        return {}
    try:
        with open(path, encoding="utf-8") as f:
            data = yaml.safe_load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def write_config_yaml_value(dotted_path: str, value: Any) -> None:
    """Update a single value in config.yaml without rewriting the entire file.

    Uses ruamel.yaml if available (preserves comments and formatting),
    otherwise falls back to a targeted line-level replacement.
    Always creates a .bak backup first.
    """
    import shutil

    path = get_config_yaml_path()
    if not path.exists():
        return

    # Always backup before writing
    backup = path.with_suffix(".yaml.bak")
    shutil.copy2(path, backup)

    # Try ruamel.yaml first (comment-preserving)
    try:
        from ruamel.yaml import YAML
        ryaml = YAML()
        ryaml.preserve_quotes = True
        with open(path, encoding="utf-8") as f:
            data = ryaml.load(f)

        # Navigate to the target key
        keys = dotted_path.split(".")
        target = data
        for key in keys[:-1]:
            if key not in target:
                target[key] = {}
            target = target[key]
        target[keys[-1]] = value

        with open(path, "w", encoding="utf-8") as f:
            ryaml.dump(data, f)
        return
    except ImportError:
        pass

    # Fallback: line-level replacement for simple top.sub paths
    keys = dotted_path.split(".")
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)

    if len(keys) == 1:
        # Top-level key: find "key: value" and replace
        _replace_top_level(lines, keys[0], value, path)
    elif len(keys) == 2:
        # Nested key: find parent section, then child
        _replace_nested(lines, keys[0], keys[1], value, path)
    else:
        # Deep nesting: fall back to yaml.dump but with backup available
        import yaml
        config = read_config_yaml()
        target = config
        for key in keys[:-1]:
            if key not in target:
                target[key] = {}
            target = target[key]
        target[keys[-1]] = value
        with open(path, "w", encoding="utf-8") as f:
            yaml.dump(config, f, default_flow_style=False, allow_unicode=True)


def _replace_top_level(lines: list, key: str, value: Any, path: "Path") -> None:
    """Replace a top-level YAML key value."""
    import re
    new_lines = []
    found = False
    for line in lines:
        if re.match(rf"^{re.escape(key)}\s*:", line):
            new_lines.append(f"{key}: {_yaml_scalar(value)}\n")
            found = True
        else:
            new_lines.append(line)
    if not found:
        new_lines.append(f"{key}: {_yaml_scalar(value)}\n")
    path.write_text("".join(new_lines), encoding="utf-8")


def _replace_nested(lines: list, parent: str, child: str, value: Any, path: "Path") -> None:
    """Replace a nested YAML key (one level deep)."""
    import re
    new_lines = []
    in_section = False
    found = False
    for line in lines:
        # Detect parent section start
        if re.match(rf"^{re.escape(parent)}\s*:", line):
            in_section = True
            new_lines.append(line)
            continue
        # Detect next top-level key (end of section)
        if in_section and line and not line[0].isspace() and not line.startswith("#"):
            in_section = False
        # Replace child within section
        if in_section and re.match(rf"^\s+{re.escape(child)}\s*:", line):
            indent = re.match(r"^(\s+)", line)
            spaces = indent.group(1) if indent else "  "
            new_lines.append(f"{spaces}{child}: {_yaml_scalar(value)}\n")
            found = True
            continue
        new_lines.append(line)
    if not found:
        # Append to section (find it and add after)
        for i, line in enumerate(new_lines):
            if re.match(rf"^{re.escape(parent)}\s*:", line):
                new_lines.insert(i + 1, f"  {child}: {_yaml_scalar(value)}\n")
                break
    path.write_text("".join(new_lines), encoding="utf-8")


def _yaml_scalar(value: Any) -> str:
    """Format a Python value as a YAML scalar string."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        # Quote if contains special chars
        if any(c in value for c in ":#{}[]|>&*!?,") or value in ("true", "false", "null", "yes", "no"):
            return f'"{value}"'
        return value
    # Complex values: use inline YAML
    import yaml
    return yaml.dump(value, default_flow_style=True).strip()
