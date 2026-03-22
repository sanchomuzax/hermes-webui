"""Entry point for `python -m webui`."""

import argparse
import uvicorn

from webui.config import get_webui_config


def main():
    parser = argparse.ArgumentParser(description="Hermes WebUI Server")
    parser.add_argument("--host", default=None, help="Bind host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=None, help="Bind port (default: 8643)")
    parser.add_argument("--localhost", action="store_true", help="Bind to 127.0.0.1 only (no LAN access)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload for development")
    args = parser.parse_args()

    config = get_webui_config()
    if args.localhost:
        host = "127.0.0.1"
    else:
        host = args.host or config.host
    port = args.port or config.port

    print(f"Starting Hermes WebUI at http://{host}:{port}")
    print(f"Auth token: {config.get_or_create_token()}")

    uvicorn.run(
        "webui.server:create_app",
        factory=True,
        host=host,
        port=port,
        reload=args.reload,
    )


if __name__ == "__main__":
    main()
