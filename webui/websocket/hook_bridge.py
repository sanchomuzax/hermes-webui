"""Bridge that polls state.db, gateway_state.json, and cron output for changes.

Broadcasts rich events to connected WebSocket clients by diffing snapshots.
No hermes-agent code modification needed — reads only from files and SQLite.
"""

import asyncio
import json
import logging
import os
import sqlite3
import time
from pathlib import Path
from typing import Any, Optional

from webui.hermes_bridge import (
    HERMES_HOME,
    get_gateway_state_path,
    get_state_db_path,
    read_gateway_state,
)
from webui.websocket.events import WSEvent
from webui.websocket.hub import hub

logger = logging.getLogger(__name__)

POLL_INTERVAL_SECONDS = 3


class StatePollBridge:
    """Polls external files for changes and emits WebSocket events."""

    def __init__(self):
        self._running = False
        self._task: Optional[asyncio.Task] = None

        # State snapshots for diffing
        self._last_gateway_mtime: float = 0
        self._last_gateway_platforms: dict[str, str] = {}  # name -> state
        self._last_db_mtime: float = 0
        self._last_session_count: int = 0
        self._last_session_ids: set[str] = set()
        self._last_active_sessions: dict[str, int] = {}  # id -> message_count
        self._last_total_cost: float = 0
        self._last_cron_mtime: float = 0
        self._initialized = False

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("State poll bridge started (interval: %ds)", POLL_INTERVAL_SECONDS)

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _poll_loop(self) -> None:
        # First pass: initialize snapshots silently (no events)
        await self._snapshot_init()
        self._initialized = True

        while self._running:
            try:
                await self._check_gateway_state()
                await self._check_db_state()
                await self._check_cron_output()
            except Exception:
                logger.exception("Error in poll loop")
            await asyncio.sleep(POLL_INTERVAL_SECONDS)

    # ------------------------------------------------------------------
    # Initial snapshot (no events emitted)
    # ------------------------------------------------------------------

    async def _snapshot_init(self) -> None:
        """Take initial snapshots so we only emit diffs from now on."""
        # Gateway
        path = get_gateway_state_path()
        if path.exists():
            try:
                self._last_gateway_mtime = path.stat().st_mtime
            except OSError:
                pass
            state = read_gateway_state()
            if state:
                for name, info in state.get("platforms", {}).items():
                    self._last_gateway_platforms[name] = (
                        info.get("state", "") if isinstance(info, dict) else str(info)
                    )

        # DB (check both main file and WAL)
        db_path = get_state_db_path()
        if db_path.exists():
            try:
                mtime = db_path.stat().st_mtime
                wal_path = db_path.with_suffix(".db-wal")
                if wal_path.exists():
                    mtime = max(mtime, wal_path.stat().st_mtime)
                self._last_db_mtime = mtime
            except OSError:
                pass
            rows = self._query_sessions()
            if rows is not None:
                self._last_session_count = len(rows)
                self._last_session_ids = {r["id"] for r in rows}
                self._last_active_sessions = {
                    r["id"]: r["message_count"]
                    for r in rows
                    if r["ended_at"] is None
                }
                self._last_total_cost = sum(
                    r["estimated_cost_usd"] or 0
                    for r in rows
                    if isinstance(r.get("estimated_cost_usd"), (int, float))
                    and 0 < (r["estimated_cost_usd"] or 0) < 100
                )

        # Cron
        cron_output_dir = HERMES_HOME / "cron" / "output"
        if cron_output_dir.exists():
            try:
                self._last_cron_mtime = cron_output_dir.stat().st_mtime
            except OSError:
                pass

    # ------------------------------------------------------------------
    # Gateway state polling
    # ------------------------------------------------------------------

    async def _check_gateway_state(self) -> None:
        path = get_gateway_state_path()
        if not path.exists():
            return

        try:
            mtime = path.stat().st_mtime
        except OSError:
            return

        if mtime <= self._last_gateway_mtime:
            return
        self._last_gateway_mtime = mtime

        state = read_gateway_state()
        if not state:
            return

        # Diff platform states
        current_platforms: dict[str, str] = {}
        for name, info in state.get("platforms", {}).items():
            current_platforms[name] = (
                info.get("state", "") if isinstance(info, dict) else str(info)
            )

        for name, new_state in current_platforms.items():
            old_state = self._last_gateway_platforms.get(name)
            if old_state != new_state:
                await hub.broadcast(WSEvent(
                    type="platform:status",
                    data={
                        "platform": name,
                        "state": new_state,
                        "previous": old_state or "unknown",
                    },
                ))

        self._last_gateway_platforms = current_platforms

    # ------------------------------------------------------------------
    # Database polling — sessions, messages, cost
    # ------------------------------------------------------------------

    async def _check_db_state(self) -> None:
        db_path = get_state_db_path()
        if not db_path.exists():
            return

        # In WAL mode, changes go to the .db-wal file first.
        # The main .db mtime only updates on checkpoint.
        # We must check both to detect new activity.
        try:
            mtime = db_path.stat().st_mtime
            wal_path = db_path.with_suffix(".db-wal")
            if wal_path.exists():
                wal_mtime = wal_path.stat().st_mtime
                mtime = max(mtime, wal_mtime)
        except OSError:
            return

        if mtime <= self._last_db_mtime:
            return
        self._last_db_mtime = mtime

        rows = self._query_sessions()
        if rows is None:
            return

        current_ids = {r["id"] for r in rows}

        # New sessions
        new_ids = current_ids - self._last_session_ids
        for row in rows:
            if row["id"] in new_ids:
                await hub.broadcast(WSEvent(
                    type="session:created",
                    data={
                        "session_id": row["id"],
                        "source": row["source"],
                        "model": row["model"] or "unknown",
                        "title": row["title"] or "",
                    },
                ))

        # Ended sessions (had no ended_at, now has one)
        for row in rows:
            if row["id"] in self._last_active_sessions and row["ended_at"] is not None:
                await hub.broadcast(WSEvent(
                    type="session:ended",
                    data={
                        "session_id": row["id"],
                        "source": row["source"],
                        "messages": row["message_count"],
                        "end_reason": row["end_reason"] or "",
                    },
                ))

        # Active session progress (message count changed)
        for row in rows:
            if row["ended_at"] is None:
                old_count = self._last_active_sessions.get(row["id"], 0)
                new_count = row["message_count"] or 0
                if new_count > old_count and row["id"] not in new_ids:
                    await hub.broadcast(WSEvent(
                        type="session:activity",
                        data={
                            "session_id": row["id"],
                            "source": row["source"],
                            "model": row["model"] or "unknown",
                            "messages": new_count,
                            "new_messages": new_count - old_count,
                            "title": row["title"] or "",
                        },
                    ))

        # Cost change
        total_cost = sum(
            r["estimated_cost_usd"] or 0
            for r in rows
            if isinstance(r.get("estimated_cost_usd"), (int, float))
            and 0 < (r["estimated_cost_usd"] or 0) < 100
        )
        cost_diff = total_cost - self._last_total_cost
        if abs(cost_diff) > 0.0001:
            await hub.broadcast(WSEvent(
                type="cost:update",
                data={
                    "total_cost": round(total_cost, 4),
                    "delta": round(cost_diff, 4),
                },
            ))

        # Update snapshots
        self._last_session_count = len(rows)
        self._last_session_ids = current_ids
        self._last_active_sessions = {
            r["id"]: r["message_count"] or 0
            for r in rows
            if r["ended_at"] is None
        }
        self._last_total_cost = total_cost

    # ------------------------------------------------------------------
    # Cron output polling
    # ------------------------------------------------------------------

    async def _check_cron_output(self) -> None:
        output_dir = HERMES_HOME / "cron" / "output"
        if not output_dir.exists():
            return

        try:
            mtime = output_dir.stat().st_mtime
        except OSError:
            return

        if mtime <= self._last_cron_mtime:
            return
        self._last_cron_mtime = mtime

        # Find the most recently modified job output dir
        latest_file = None
        latest_mtime = 0.0
        for job_dir in output_dir.iterdir():
            if not job_dir.is_dir():
                continue
            for f in job_dir.glob("*.json"):
                try:
                    fm = f.stat().st_mtime
                    if fm > latest_mtime:
                        latest_mtime = fm
                        latest_file = f
                except OSError:
                    continue

        if latest_file and latest_mtime > self._last_cron_mtime - POLL_INTERVAL_SECONDS:
            job_id = latest_file.parent.name
            try:
                data = json.loads(latest_file.read_text(encoding="utf-8"))
                status = data.get("status", "completed")
            except Exception:
                status = "unknown"

            await hub.broadcast(WSEvent(
                type="cron:completed",
                data={
                    "job_id": job_id,
                    "status": status,
                    "file": latest_file.name,
                },
            ))

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _query_sessions(self) -> Optional[list[dict]]:
        """Query recent sessions from state.db (read-only)."""
        db_path = get_state_db_path()
        try:
            uri = f"file:{db_path}?mode=ro"
            conn = sqlite3.connect(uri, uri=True, timeout=2.0)
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(
                """SELECT id, source, model, title, started_at, ended_at,
                          end_reason, message_count, tool_call_count,
                          estimated_cost_usd
                   FROM sessions ORDER BY started_at DESC LIMIT 500"""
            )
            rows = [dict(r) for r in cursor.fetchall()]
            conn.close()
            return rows
        except Exception:
            return None


# Global bridge instance
bridge = StatePollBridge()
