# Architecture

Source review: 2026-09-20.

## Application structure

`src/main.jsx` mounts the React app. `src/App.jsx` contains authentication forms, workspace picker/session view, authorized fleet list, billing summary, HTTP/WebSocket lifecycle, and integration of the demo and snapshot components described below. Styles are provided by local CSS and build-time Tailwind. The current app uses React `useState`, `useRef`, and `useEffect`; it has no React Router or React Query dependency and no separate LoginPage/FleetMonitor component hierarchy.

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

`tests/portal.spec.js` and `tests/demo.spec.js` use Playwright with mocked REST and WebSocket traffic. `playwright.config.js` starts Vite on port 5187. Live API/CORS, scheduler behavior, and production deployment need separate verification.

## Demo and vault components

`src/components/DemoControls.jsx` holds local form drafts for one owned workspace and submits `/api/instance/demo` through `App.jsx`. Only a successful server update changes the displayed demo toggle. `applyDemo()` reconciles the response, closes a terminated active session, and refetches fleet. Backend authorization and the `demo_available` capability govern access.

`SnapshotVault.jsx` / `SnapshotVault.css` render searchable responsive cards using actual timestamps, optional demo timestamps, and a legacy date fallback. The active-session timezone label now comes from `fleet.timezone`. The clock override lives in the shared backend database, not browser storage; API and Celery use it consistently. Expiry remains based on real time.

## Grouping, styling, and development server

The vault renders one card per instance. Its dropdown contains every retained snapshot for that instance, ordered newest first by actual creation time, with a filename-derived date fallback for legacy records. The newest snapshot is selected initially; selecting an older record updates its details. Equal or unknown timestamps use a stable snapshot-ID tie-breaker, not an invented capture order. Search matches names, instance IDs, and filenames while preserving each matching workspace's full dropdown history. Grouping does not delete records. Restore wakes the workspace rather than loading the selected historical memory image.

The server returns a flat list; `SnapshotVault` groups by `instance_id` and keeps selection state per group. The portal does not supply `onRestore`; starting a workspace remains in the owned-workspace picker. The admin version receives a workspace-wake callback, not a snapshot-ID restore operation.

The portal uses its dark Tailwind theme plus component CSS. The admin's `command.css` overrides are not shared with this project. `vite.config.js` sets port 5173 and strict-port behavior. `App.jsx` shows an unavailable-demo message if the backend lacks the capability, while `DemoControls` requires at least one owned instance.

For full context on shared snapshot behavior and backend integration, see the main project's [Architecture](ARCHITECTURE.md#snapshot-timestamps-and-demo-clock) and [Project Status](PROJECT_STATUS.md).
