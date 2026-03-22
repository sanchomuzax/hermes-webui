"""Gateway status endpoints."""

import os
import time
from pathlib import Path

from fastapi import APIRouter, Depends

from webui.auth import require_auth
from webui.hermes_bridge import HERMES_HOME, get_env_path, read_config_yaml, read_gateway_state
from webui.schemas.gateway import GatewayStatusResponse, PlatformStatus

router = APIRouter(prefix="/api/gateway", tags=["gateway"], dependencies=[Depends(require_auth)])


def _is_process_running(pid: int) -> bool:
    """Check if a process with given PID is running."""
    try:
        os.kill(pid, 0)
        return True
    except (OSError, ProcessLookupError):
        return False


@router.get("/status", response_model=GatewayStatusResponse)
async def gateway_status():
    """Get gateway runtime status."""
    state = read_gateway_state()

    if not state:
        return GatewayStatusResponse(running=False)

    pid = state.get("pid")
    running = _is_process_running(pid) if pid else False

    # Calculate uptime
    uptime = None
    if running:
        # Try updated_at (ISO format) first, then start_time (monotonic/epoch)
        updated_at = state.get("updated_at")
        start_time = state.get("start_time")
        if updated_at:
            try:
                from datetime import datetime, timezone
                start_dt = datetime.fromisoformat(updated_at)
                uptime = (datetime.now(timezone.utc) - start_dt).total_seconds()
            except (ValueError, TypeError):
                pass
        elif start_time and isinstance(start_time, (int, float)):
            uptime = time.monotonic() - start_time if start_time < time.monotonic() else None

    # Extract platform statuses
    platforms = []
    platform_data = state.get("platforms", {})
    if isinstance(platform_data, dict):
        for name, info in platform_data.items():
            if isinstance(info, dict):
                # Support both formats: {"connected": true} and {"state": "connected"}
                is_connected = (
                    info.get("connected", False)
                    or info.get("state") == "connected"
                )
                platforms.append(PlatformStatus(
                    name=name,
                    connected=is_connected,
                    details=info,
                ))
            else:
                platforms.append(PlatformStatus(name=name, connected=bool(info)))

    # Add services from config.yaml (Honcho, TTS, STT, etc.)
    services = _detect_services()
    platforms.extend(services)

    return GatewayStatusResponse(
        running=running,
        pid=pid,
        uptime_seconds=uptime,
        platforms=platforms,
        raw=state,
    )


def _detect_services() -> list[PlatformStatus]:
    """Detect configured services from config.yaml and .env."""
    config = read_config_yaml()
    env_vars = _read_env_keys()
    services = []

    # Honcho — check ~/.honcho/config.json (its own config) or memory config
    honcho_active = False
    honcho_detail = "AI memory & user modeling"
    honcho_cfg_path = Path.home() / ".honcho" / "config.json"
    if honcho_cfg_path.exists():
        import json as _json
        try:
            honcho_data = _json.loads(honcho_cfg_path.read_text(encoding="utf-8"))
            # Any configured host means honcho is active
            hosts = honcho_data.get("hosts", {})
            honcho_active = len(hosts) > 0
            if honcho_active:
                host_names = list(hosts.keys())
                honcho_detail = f"Active hosts: {', '.join(host_names)}"
        except Exception:
            pass
    # Fallback: check env key
    if not honcho_active and env_vars.get("HONCHO_API_KEY", ""):
        honcho_active = True
    services.append(PlatformStatus(
        name="honcho",
        connected=honcho_active,
        details={"type": "service", "description": honcho_detail},
    ))

    # TTS
    tts_config = config.get("tts", {})
    tts_provider = tts_config.get("provider", "")
    tts_active = bool(tts_provider)
    services.append(PlatformStatus(
        name=f"tts ({tts_provider})" if tts_provider else "tts",
        connected=tts_active,
        details={"type": "service", "provider": tts_provider, "description": "Text-to-Speech"},
    ))

    # STT
    stt_config = config.get("stt", {})
    stt_enabled = stt_config.get("enabled", False)
    stt_provider = stt_config.get("provider", "")
    services.append(PlatformStatus(
        name=f"stt ({stt_provider})" if stt_provider else "stt",
        connected=bool(stt_enabled),
        details={"type": "service", "provider": stt_provider, "description": "Speech-to-Text"},
    ))

    # Voice
    voice_config = config.get("voice", {})
    voice_active = bool(voice_config.get("record_key"))
    if voice_active:
        services.append(PlatformStatus(
            name="voice",
            connected=voice_active,
            details={"type": "service", "description": "Voice input/output"},
        ))

    # MCP servers
    mcp_servers = config.get("mcp_servers", {})
    if mcp_servers:
        services.append(PlatformStatus(
            name=f"mcp ({len(mcp_servers)} servers)",
            connected=True,
            details={"type": "service", "servers": list(mcp_servers.keys())},
        ))

    # Cron
    cron_file = HERMES_HOME / "cron" / "jobs.json"
    if cron_file.exists():
        import json as _json2
        try:
            raw = _json2.loads(cron_file.read_text(encoding="utf-8"))
            # Handle both {"jobs": [...]} and plain list
            jobs = raw.get("jobs", raw) if isinstance(raw, dict) else raw
            if isinstance(jobs, list):
                enabled_count = sum(
                    1 for j in jobs
                    if isinstance(j, dict) and j.get("enabled", True)
                )
                services.append(PlatformStatus(
                    name=f"cron ({enabled_count} jobs)",
                    connected=enabled_count > 0,
                    details={"type": "service", "total_jobs": len(jobs), "enabled": enabled_count},
                ))
        except Exception:
            pass

    return services


def _read_env_keys() -> dict[str, str]:
    """Read .env file keys (values not exposed, just check if set)."""
    env_path = get_env_path()
    if not env_path.exists():
        return {}
    result = {}
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        result[key.strip()] = val.strip().strip("\"'")
    return result
