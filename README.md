# Employee Workspace Portal

React employee app for The Downscale Demon API. Documentation reviewed against source on 2026-09-20.

## Setup

Start the backend from `../The-Downscale-Demon/` with Docker Compose, then run here:

```powershell
npm install
npm run dev
```

The API defaults to `http://localhost:8000`. Set `VITE_API_BASE_URL` before starting/building to override it; the WebSocket URL is derived from the same value. Default Vite development port is 5173. The backend allows localhost/127.0.0.1 origins on ports 5173 and 3000.

## Features

- Sign in, invitation signup, and first Chief Architect signup without an invitation.
- Server-scoped fleet, owned-workspace picker, and start/restore after server authorization.
- Workspace logout/hibernation and targeted session-termination handling.
- WebSocket reconnect backoff, refetch on reconnect/focus, and expired-session handling.
- Server-provided cost estimates and retained simulated snapshot metadata.

Authentication is stored in React memory; refreshing requires sign-in. First Chief Architect signup only succeeds when no administrator exists. Ordinary signup uses a manager/admin invitation. There are no default credentials.

## Relationship to the command center

This is separate from `../The-Downscale-Demon/frontend/`, the admin command center served at http://localhost:3000. Provisioning and invitation management belong there. The September 20 responsive-card redesign changed that command center, not this portal's fleet list.

Both apps use the same backend. On 2026-09-20 the local Docker database was cleaned of six demo instances and related snapshots/events. Employee `001` retained `hail mary` and `hail santa`; the administrator was preserved. These are existing local records, not defaults to recreate. An employee sees only authorized data. See the main project's README for the backup record.

## Build and test

```powershell
npm run build
npx playwright install chromium
npm test
```

Playwright runs `tests/portal.spec.js` against a Vite server on port 5187 with API/WebSocket mocks. It covers authentication, invitations, workspace lifecycle, reconciliation, and first-admin signup. The suite was not rerun during the latest command-center UI/data change or documentation refresh.

See [architecture](ARCHITECTURE.md), [status](PROJECT_STATUS.md), and [known issues](KNOWN_ISSUES.md).
