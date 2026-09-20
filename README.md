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

Playwright runs `tests/portal.spec.js` against a Vite server on port 5187 with API/WebSocket mocks. It covers authentication, invitations, workspace lifecycle, reconciliation, and first-admin signup. The suite was not rerun during the latest command-center UI/data change during that earlier fleet change.

See [architecture](ARCHITECTURE.md), [status](PROJECT_STATUS.md), and [known issues](KNOWN_ISSUES.md).

## Demo controls and snapshot vault

With backend/worker `DEMO_MODE=1` (enabled in the main project's Compose), log in and select an owned workspace under **Demo controls**. Enable the toggle, set a date/time in the displayed server timezone, and apply. Use **Use shift start** to prepare an in-shift time before Start / Restore. On a running workspace, adjust CPU/activity, or use **Use shift end** and **Apply & evaluate now** to hibernate immediately and create a snapshot.

CPU/activity changes apply to powered-on instances. Idle remains powered/billable; the current scheduler uses shifts, not an idle-CPU timeout. Demo CPU >= 90 outside shift flags an anomaly. Settings remain active per workspace until disabled; turning off demo restores the real clock and may hibernate a workspace outside its actual shift.

Snapshot cards show actual creation time plus any simulated time, storage size, panes, reference, and expandable filename. Existing date-only records explicitly show that the time was not recorded. This remains a simulated workspace/CRIU app.

Validation for this update: production build passed; all 9 existing Playwright tests and the new demo-flow test passed (mocked API/WebSocket responses). Desktop/mobile layouts were checked. Updated source is served by the local Vite app on port 5173.

## Grouped snapshot history

The vault now shows one card per instance in both apps. A snapshot-history dropdown lists retained captures newest first by actual creation time (legacy records use the known filename date), with the latest selected initially. Selecting an older capture updates the details without creating duplicate workspace cards. Main vault text is 16px, secondary labels are 14px, and workspace headings are 22px. Search matches workspace names, IDs, and filenames while retaining the full history dropdown. No snapshot records are deleted by grouping.
