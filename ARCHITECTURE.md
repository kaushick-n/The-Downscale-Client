# Employee station architecture

The employee portal is a React client of the shared FastAPI service. It presents the employee-facing controls and data for the five-step cloud lifecycle; it does not independently operate AWS resources. The AWS proxy, SQS buffering, CRIU/EBS lifecycle, anomaly isolation, and FinOps projection are backend-owned and the AWS path remains opt-in. See the main project's [five-step architecture](../The-Downscale-Demon/ARCHITECTURE.md).

## Client structure

- `src/main.jsx` mounts `AppProvider` around the application.
- `src/context/AppContext.jsx` owns in-memory authentication, bearer-authenticated REST calls, fleet refresh, WebSocket connection/reconnect, telemetry, ping latency, and inbox refresh signals.
- `src/App.jsx` renders authentication, navigation, workspace actions, shift state, session details, communications, and the support-request flow.
- `src/components/DemoControls.jsx` submits server-gated demo settings.
- `src/components/SnapshotVault.jsx` groups and searches the server's checkpoint records.
- `src/App.css` and component styles provide the dark, responsive employee station.

The application uses React hooks and native `fetch`/`WebSocket`; it has no client-side database, sample fleet, or separately persisted session token.

## Authentication and authorization

`VITE_API_BASE_URL` defaults to `http://localhost:8000`. The request helper sends bearer authentication and renders structured FastAPI validation details as readable errors. Public account operations use `/api/auth/login`, `/api/auth/signup`, and `/api/auth/signup/chief-architect`; the client then loads `/api/me`. Roles, teams, workspace assignments, shift policy, and permission decisions are server-authoritative.

Tokens remain in memory. An HTTP 401 or WebSocket close code 4401 clears client authentication and fleet state. The portal does not treat clearing its local state as server-side token revocation.

## Fleet and lifecycle actions

`GET /api/instances` provides the authorized fleet, owner workspace data, timezone, demo capability, analytics, and checkpoint records. The workspace selector shows server-assigned workspaces only. Wake/restore submits `POST /api/instance/state` with `target_state: running`; the active session view is opened only after the server accepts the request. Pause submits `/api/logout`; saving session state uses the hibernation lifecycle and produces checkpoint metadata. These actions may be simulated locally; actual CRIU/EBS operations require the opt-in AWS lifecycle configuration.

Workspace changes and refreshed fleet data reconcile the active session against the server's current instance state. A workspace that is no longer running/idle closes in the UI. Off-hours and role denials are shown as API errors rather than overridden client-side.

## Session inspection and telemetry

`GET /api/instance/session-state/{instance_id}` provides current session-inspection availability, process output, tmux session names, and the latest checkpoint's RAM-history metadata. Live process inspection is available through SSM only when AWS lifecycle is enabled. Local mode returns an explicit unavailable status; the UI does not synthesize process, RAM, or tmux values. Checkpoint size, RAM footprint, and saved-pane counts are also shown as unrecorded when the backend cannot measure them.

The employee app connects to `/ws/fleet` and sends `{token: access_token}` as the first frame. It sends a `PING` every 15 seconds and measures round-trip latency from the matching `PONG`. Scoped telemetry frames update CPU/memory values and observation timestamps; unavailable CloudWatch Agent memory values remain unavailable. Fleet and session events trigger REST reconciliation. Support and announcement events update the inbox, while `FINOPS_UPDATED` updates the server-provided cost projection.

Reconnect delay grows from one second to a 15-second maximum and resets after a successful connection. Reconnect and window focus trigger a fleet refresh. Stale refresh errors are surfaced in the workspace rather than replaced by fabricated values.

## Inbox and helpdesk

- `GET /api/employee/inbox` returns announcements visible to the employee, eligible shift notices, and completed responses to that employee's requests.
- `POST /api/support/requests` creates a persisted overtime, storage, or issue request associated with the signed-in employee and an authorized workspace when selected.
- `POST /api/support/requests/{request_id}/decision` is for Team Leads/Chief Architects and applies backend team scoping.
- `POST /api/announcements` is for Team Leads/Chief Architects; Team Leads can announce only to their assigned team.

The client reloads inbox data after relevant WebSocket events and after submitting a request. The API's team/owner checks remain the security boundary.

## FinOps and state provenance

Cost figures come from the fleet API/WebSocket and are configured AWS On-Demand rate projections against the 24x7 baseline; they are not billed usage, actual credits, or AWS Cost Explorer results. Demo changes are server-backed simulation controls, not live instance telemetry. Timers and ping age are derived client-side from server shift/connection data; workspace identity and resource values are not seeded in the UI.

## Validation boundaries

`tests/portal.spec.js` and `tests/demo.spec.js` run Playwright against mocked REST and WebSocket traffic. They validate client flows and responsive behavior, not live CORS, a production WebSocket deployment, CloudWatch Agent metrics, SSM session inspection, AWS billing, or EC2/EBS/CRIU compatibility.
