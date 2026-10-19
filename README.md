# Downscale Demon Employee Workspace Station

The employee portal is a dark, responsive enterprise workspace for assigned development environments. It brings workspace lifecycle controls, shift status, operational telemetry, checkpoint history, team announcements, and helpdesk requests into one authenticated station. Workspace names, fleet state, telemetry, announcements, and requests are obtained from the shared backend; the client does not seed example workspaces or telemetry.

The portal is a client of the five-step lifecycle API, not an implementation of the cloud control plane. Edge buffering, CRIU/EBS operations, isolation, and AWS lifecycle actions remain disabled by default and have not been validated against a live AWS account. Cost figures are configured-rate projections, not billed usage or credits. See the main project's [README](../The-Downscale-Demon/README.md), [architecture](../The-Downscale-Demon/ARCHITECTURE.md), and [live AWS readiness checklist](../The-Downscale-Demon/PROJECT_STATUS.md).

## Employee station

- Side navigation for Overview, Workspaces, Inbox & requests, and Session history.
- Workspace switcher and server-authorized wake, pause/hibernate, and checkpoint actions.
- Server shift-window status and a live countdown while an assigned shift is active.
- Fleet-provided instance status, CPU, memory, connection latency, and session runtime.
- A session stream that distinguishes live SSM process/tmux inspection from saved checkpoint metadata; unavailable values are shown as unavailable.
- Backend announcements, shift notices, completed support-request responses, and Team Lead helpdesk requests.
- Searchable, grouped checkpoint history with actual and simulated timestamps clearly separated.
- Estimated FinOps summary supplied by the backend.

The portal's default REST base is `http://localhost:8000`. Set `VITE_API_BASE_URL` before starting or building to override it; the WebSocket URL is derived from the same value. The backend allows localhost/127.0.0.1 origins on ports 5173 and 3000.

## Setup

Start the backend from `../The-Downscale-Demon/` with Docker Compose, then run:

```sh
npm install
npm run dev
```

Vite listens on port 5173 with `strictPort: true`; a port conflict fails rather than silently selecting another port. Authentication tokens are held in React memory, so a page refresh requires sign-in. First Chief Architect signup only succeeds when no administrator exists. Employee signup requires a single-use invitation. There are no default credentials.

## Relationship to the command center

This application is separate from `../The-Downscale-Demon/frontend/`, the admin command center served at http://localhost:3000. Provisioning and invitation management belong there. Both applications use the same API and authorization rules, but the employee station has its own dark visual system and employee-focused navigation.

## Demo controls and checkpoint history

Demo controls require backend/worker `DEMO_MODE=1`, an owned workspace, and `demo_available: true` in the server response. Set a simulated date/time in the displayed server timezone, then apply it. On a running workspace, **Apply & evaluate now** can immediately evaluate the configured shift/CPU and create a simulated checkpoint. This local demo does not create a CRIU image. Its checkpoint size, RAM footprint, and process/pane metadata remain unreported unless the backend actually records them.

The history groups records by workspace but retains each snapshot. Actual capture time and optional simulated time are separate; legacy date-only records explicitly say that the time was not recorded. Selecting an older record changes the displayed metadata; it does not select an older memory image for restore.

## Build and test

```sh
npm run build
npx playwright install chromium
npm test
```

Playwright runs `tests/portal.spec.js` and `tests/demo.spec.js` against a Vite server on port 5187 with mocked REST/WebSocket traffic. See [architecture](ARCHITECTURE.md), [project status](PROJECT_STATUS.md), and [known issues](KNOWN_ISSUES.md) for API contracts, current verification, and production limitations. Backend API additions are described in the main project's [integration report](../The-Downscale-Demon/INTEGRATION_REPORT.md).

## Troubleshooting

Open http://localhost:5173 for the employee station; port 3000 is the admin command center. Hard-refresh if old assets remain visible, then sign in again because tokens are held in memory. If demo controls are unavailable, verify `VITE_API_BASE_URL` and that the API and worker both use `DEMO_MODE=1`.
