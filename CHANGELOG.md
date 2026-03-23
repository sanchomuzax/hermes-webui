# Changelog

All notable changes to Hermes WebUI are documented here.

## [1.3.0] - 2026-03-23

### Added
- **Cron page**: sort by enabled/disabled, then by soonest next run
- **Cron page**: schedule type badges — `recurring`, `interval`, `one-time`
- **Cron page**: human-readable schedule descriptions (like crontab.guru)
- **Sessions page**: `cron` source filter tab
- **Sessions page**: standardized source colors (Telegram blue, Cron purple, CLI indigo, etc.)
- **Sessions page**: newest/oldest sort toggle with localStorage persistence
- **Skills page**: recursive sub-skill scanning (categories like social-media/, productivity/)
- **Skills page**: usage badges — shows invocation count (last 7 days / all time)
- **Skills page**: click-through to sub-skill detail pages
- Shared `sourceColors.ts` utility for consistent platform colors across all pages

### Fixed
- Skill detail 404 for sub-skills (category path resolution)
- Cron jobs missing `next_run_at` / `last_run_at` fields from jobs.json
- Disabled cron jobs now visually dimmed (opacity)

## [1.2.0] - 2026-03-23

### Added
- Screenshots for all pages in README
- Activity Feed and Sessions by Model side-by-side layout

### Fixed
- HTML title set to "Hermes WebUI"
- Responsive layout — mobile scrolls normally, desktop fills viewport
- Dashboard panels fit within viewport height

## [1.1.0] - 2026-03-23

### Added
- Comprehensive README with install guide, systemd service, troubleshooting
- Dashboard screenshot in docs
- Sidebar footer with author name, version, GitHub link

### Fixed
- Config page made read-only to prevent YAML corruption

## [1.0.0] - 2026-03-22

### Added
- Initial release
- Real-time dashboard with session stats, gateway status, platform health
- Session browser with FTS5 full-text search
- Session detail view with message history and token usage
- Config viewer (read-only YAML + environment variables)
- Cron job management (list, create, enable/disable, delete)
- Skills browser with source code inspection
- Dark/light theme toggle
- Auth token authentication
- WebSocket live updates
- Responsive sidebar navigation
