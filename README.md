# Employee workspace portal

Developer-facing React portal for the shared The-Downscale-Demon backend.

## Run

Run `npm ci`, then `npm run dev`. Start the backend separately on port 8000. Set `VITE_API_BASE_URL` to override `http://localhost:8000` (HTTP and WebSocket endpoints share this base). The backend must allow the portal origin through CORS; its default allows localhost:5173.

Sign up with your employee ID, name, a 12?128 character password, and the invitation code provided by your manager. Invitations assign the team, role, and workspaces; users cannot choose them. Signup opens the picker without waking a workspace. Existing users can sign in with their employee ID and password. Select an owned workspace to start or restore it. The backend enforces shift access, including overnight shifts; Compose uses Asia/Kolkata. Logout hibernates the active workspace. Portal sign-out clears in-memory authentication; the backend currently has no token revocation route.

Authentication uses `/api/auth/signup`, `/api/auth/login`, and `/api/me`. Scoped fleet data and projections come from `/api/instances`. Start/restore uses `/api/instance/state` with `target_state: "running"`; hibernate uses `/api/logout`. Tokens and passwords are never persisted to browser storage. Workspace actions use the bearer token without requesting the password again. HTTP 401 and socket close 4401 return to sign-in. Server shift errors and field validation errors are shown in the portal.

The `/ws/fleet` connection sends the token in its first frame, reconnects with capped backoff, and refreshes fleet data. A termination event clears only the matching active workspace. Fleet refresh also reconciles session state after missed events, on reconnect and on page focus.

Employee provisioning stays in the Admin Command Center. Chief Architect bootstrap from the backend project:

```sh
docker compose exec backend python bootstrap_admin.py ADMIN-001 "Chief Architect" platform
```

Enter the password interactively, then sign in to the Admin Command Center to provision users and workspaces.

FinOps values are server-provided USD current-state projections. Running and powered-on idle nodes incur compute; stopped and hibernated nodes incur zero compute. Retained snapshots remain billable after restore. CRIU remains simulated.

Run `npm run build` to validate the production bundle.

Browser regression checks: run `npx playwright install chromium`, then `npm test`. Tests intercept REST and WebSocket traffic with isolated fixtures; no sample fleet is included in the application. They cover invitation errors, signup without waking, credential failures, workspace selection, shift denial, bearer requests, targeted termination, reconnect/focus reconciliation, live provisioning, billing/snapshots, and token expiry. Full backend authorization and invitation consumption require integration checks against the backend.

## Chief Architect signup

Choose **Chief Architect Sign Up** to create the first administrator without an invitation. Supply a name, account ID, and password (12–128 characters). The dedicated `POST /api/auth/signup/chief-architect` endpoint assigns `admin` and the `platform` team on the server. It creates no workspace. Once an administrator exists, signup returns HTTP 409 and directs you to sign in. Use the same credentials in the Admin Command Center to invite team members.

This browser setup replaces the CLI bootstrap for a fresh installation. Complete initial setup before exposing the service publicly. Existing administrator accounts are never overwritten.
