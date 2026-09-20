# Employee Workspace Portal

React employee app for The Downscale Demon API. Documentation reviewed against source on 2026-09-20.

## Setup

Start the backend from `../The-Downscale-Demon/` with Docker Compose, then run here:

```powershell
npm install
npm run dev
```

The API defaults to `http://localhost:8000`. Set `VITE_API_BASE_URL` before starting/building to override it; the WebSocket URL is derived from the same value. Vite uses port 5173 with `strictPort: true`; a port conflict fails instead of selecting another port. The backend allows localhost/127.0.0.1 origins on ports 5173 and 3000.

## Features

- Sign in, invitation signup, and first Chief Architect signup without an invitation.
- Server-scoped fleet, owned-workspace picker, and start/restore after server authorization.
- Workspace logout/hibernation and targeted session-termination handling.
- WebSocket reconnect backoff, refetch on reconnect/focus, and expired-session handling.
- Server-provided cost estimates and retained simulated snapshot metadata.

Authentication is stored in React memory; refreshing requires sign-in. First Chief Architect signup only succeeds when no administrator exists. Ordinary signup uses a manager/admin invitation. There are no default credentials.

## Relationship to the command center

This is separate from `../The-Downscale-Demon/frontend/`, the admin command center served at http://localhost:3000. Provisioning and invitation management belong there. The admin now has a larger sans-serif neutral/green design. This portal retains its dark theme and compact fleet list, while both apps share grouped snapshot-history behavior.

Both apps use the same backend. On 2026-09-20 the local Docker database was cleaned of six demo instances and related snapshots/events. Employee `001` retained `hail mary` and `hail santa`; the administrator was preserved. These are existing local records, not defaults to recreate. An employee sees only authorized data. See the main project's README for the backup record.

## Build and test

```powershell
npm run build
npx playwright install chromium
npm test
```

Playwright runs `tests/portal.spec.js` and `tests/demo.spec.js` against a Vite server on port 5187 with mocked API/WebSocket traffic. All 10 tests passed after the grouped-history change; both builds also passed during implementation. See [project status](PROJECT_STATUS.md) for scope and limitations. Application tests are not rerun for a documentation-only update.

See [architecture](ARCHITECTURE.md), [status](PROJECT_STATUS.md), and [known issues](KNOWN_ISSUES.md).
Also see the main project documentation at ../The-Downscale-Demon/README.md for complete context.

## Demo controls and snapshot vault

With backend/worker `DEMO_MODE=1` (enabled in the main project's Compose), log in and select an owned workspace under **Demo controls**. Enable the toggle, set a date/time in the displayed server timezone, and apply. Use **Use shift start** to prepare an in-shift time before Start / Restore. On a running workspace, adjust CPU/activity, or use **Use shift end** and **Apply & evaluate now** to hibernate immediately and create a snapshot.

CPU/activity changes apply to powered-on instances. Idle remains powered/billable; the current scheduler uses shifts, not an idle-CPU timeout. Demo CPU >= 90 outside shift flags an anomaly. Settings remain active per workspace until disabled; turning off demo restores the real clock and may hibernate a workspace outside its actual shift.

Snapshot cards show actual creation time plus any simulated time, storage size, panes, reference, and expandable filename. Existing date-only records explicitly show that the time was not recorded. This remains a simulated workspace/CRIU app.

Validation for this update: production build passed; all 9 existing Playwright tests and the new demo-flow test passed (mocked API/WebSocket responses). Desktop/mobile layouts were checked. Updated source is served by the local Vite app on port 5173.

## Grouped snapshot history

The vault renders one card per instance. Its dropdown contains every retained snapshot for that instance, ordered newest first by actual creation time, with a filename-derived date fallback for legacy records. The newest snapshot is selected initially; selecting an older record updates its details. Equal or unknown timestamps use a stable snapshot-ID tie-breaker, not an invented capture order. Search matches names, instance IDs, and filenames while preserving each matching workspace's full dropdown history. Grouping does not delete records. Restore wakes the workspace rather than loading the selected historical memory image.

The portal vault uses 16px main text, 14px secondary labels, and 22px workspace headings.

## Missing demo controls or stale UI

Open http://localhost:5173 for the employee portal; port 3000 is the admin command center. Use Ctrl + Shift + R if the old snapshot list or older interface remains visible, then sign in again because tokens are held in memory. The portal dev server uses port 5173 with `strictPort: true`, so a port conflict fails instead of silently choosing another port.

Demo controls require an owned workspace and a backend response with `demo_available: true`. The portal shows **Demo controls unavailable** when the connected backend does not advertise this capability. Verify `VITE_API_BASE_URL`, and run the updated backend and worker with `DEMO_MODE=1` (already configured in the main Compose file). Recreate those services after environment/image changes; restarting only the browser cannot enable backend simulation.
