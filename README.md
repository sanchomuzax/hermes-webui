# Hermes WebUI

Process monitoring and configuration dashboard for [Hermes Agent](https://github.com/NousResearch/hermes-agent).

## Features

- **Dashboard** — Real-time overview with session activity feed, gateway status, platform health, and cost tracking
- **Sessions** — Browse, search (FTS5), and inspect conversation histories with message-level detail
- **Config** — Edit `config.yaml` and environment variables through the browser (with backup on every write)
- **Cron** — View and manage scheduled agent jobs
- **Skills** — Browse built-in and custom skills with full source inspection
- **Responsive** — Mobile-friendly with hamburger menu navigation
- **Dark/Light theme** — Toggle between themes

## Architecture

```
┌─────────────────────────────────────────┐
│  React Frontend (Vite + TailwindCSS)    │
│  SPA with TanStack Query + WebSocket    │
└────────────────┬────────────────────────┘
                 │ HTTP + WS
┌────────────────┴────────────────────────┐
│  FastAPI Backend (Python)               │
│  ├─ REST API (sessions, config, cron)   │
│  ├─ WebSocket hub (live events)         │
│  └─ Polling bridge (state.db + files)   │
└────────────────┬────────────────────────┘
                 │ SQLite (read-only) + YAML
┌────────────────┴────────────────────────┐
│  Hermes Agent (unmodified)              │
│  state.db, config.yaml, gateway_state   │
└─────────────────────────────────────────┘
```

Hermes WebUI reads from the agent's data files without modifying the agent's core code.

## Requirements

- Python 3.11+
- Node.js 18+ (for frontend build)
- A running [Hermes Agent](https://github.com/NousResearch/hermes-agent) installation

## Quick Start

```bash
# Clone
git clone https://github.com/sanchomuzax/hermes-webui.git
cd hermes-webui

# Install Python dependencies
python3 -m venv venv
source venv/bin/activate
pip install -e .

# Build frontend
cd frontend
npm install
npx vite build
cd ..

# Run
hermes-webui
# or: python -m webui
```

The server starts at `http://0.0.0.0:8643` and prints an auth token to the console.

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `HERMES_HOME` | `~/.hermes` | Hermes agent installation directory |
| `HERMES_WEBUI_HOST` | `0.0.0.0` | Bind address |
| `HERMES_WEBUI_PORT` | `8643` | Port |

Use `--localhost` flag to bind to `127.0.0.1` only.

## Tech Stack

- **Backend**: FastAPI, Uvicorn, Pydantic, PyYAML
- **Frontend**: React 19, TypeScript, Vite, TailwindCSS 4, TanStack Query
- **Data**: SQLite (read-only from Hermes Agent's `state.db`)

## Related

- [Hermes Agent](https://github.com/NousResearch/hermes-agent) — The AI agent this UI monitors
- [OpenClaw Web UI](https://docs.openclaw.ai/web) — Inspiration for the dashboard design

## License

MIT
