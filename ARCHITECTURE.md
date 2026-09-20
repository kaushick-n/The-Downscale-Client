# Architecture

Source review: 2026-09-20.

## Application structure

`src/main.jsx` mounts the React app. `src/App.jsx` contains authentication forms, workspace picker/session view, authorized fleet list, billing summary, snapshot list, and HTTP/WebSocket lifecycle. Styles are provided by local CSS and build-time Tailwind. The current app uses React `useState`, `useRef`, and `useEffect`; it has no React Router or React Query dependency and no separate LoginPage/FleetMonitor component hierarchy.

## Authentication and requests

`VITE_API_BASE_URL` defaults to `http://localhost:8000`. The request helper uses native fetch, adds bearer authentication, and converts FastAPI validation arrays into readable messages. Public authentication modes use `/api/auth/login`, `/api/auth/signup`, or `/api/auth/signup/chief-architect`. The client then calls `/api/me`. Tokens remain in memory, not localStorage.

The server assigns roles and teams. First-admin signup is available only before any administrator exists. Invitations assign ordinary accounts and initially hibernated workspaces. HTTP 401 or WebSocket 4401 clears authentication and active workspace state.

## Workspace lifecycle

The client fetches `/api/instances` and offers owned instances in the picker. `POST /api/instance/state` with `target_state: running` must succeed before opening the local session view. Off-hours denial remains in the picker. `POST /api/logout` hibernates the active instance before returning to the picker; it does not revoke the account token.

The session screen is a UI representation, not a real remote desktop or shell transport. Shift authority, permissions, anomaly flags, and analytics come from the backend.

## Live updates

The fleet socket sends `{token: access_token}` as its first frame. `FLEET_UPDATED` triggers a refetch. Matching `SESSION_TERMINATED` closes the active workspace and shows a notice. Refetched state also closes sessions that are no longer running/idle. Reconnect delay doubles from one second up to 15 seconds and resets on open; reconnect and window focus refetch the fleet. Refs/version checks guard stale refresh responses.

## Shared data and testing

The portal owns no database. It consumes the same API as the main repository's command center. Removing demo records from the live backend changes both clients' authorized results without introducing a client-side filter for employee `001`.

`tests/portal.spec.js` uses Playwright with mocked REST and WebSocket traffic. `playwright.config.js` starts Vite on port 5187. Live API/CORS, scheduler behavior, and production deployment need separate verification.
