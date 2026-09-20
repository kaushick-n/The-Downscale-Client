# Project status

Reviewed 2026-09-20 against current source and recorded implementation checks.

## Implemented

- Login, invitation signup, first Chief Architect signup, and readable field errors.
- In-memory bearer auth, HTTP/socket expiry handling, owned-workspace picker, and server-authorized start/restore.
- Hibernation/logout, targeted session termination, exponential reconnect, and reconnect/focus reconciliation.
- Server-provided fleet, billing estimates, timezone, and simulated snapshot metadata.
- Per-workspace demo toggle, fixed date/time, CPU and running/idle controls, presets, and immediate evaluation.
- Visible unavailable-demo feedback when the connected backend does not advertise simulation.
- Grouped snapshot history: one card per instance, newest-first dropdown, selection of older captures, search, actual/demo timestamp distinction, and legacy date-only fallback.
- Larger snapshot text, mobile viewport metadata, and strict development port 5173.

## UI scope

This portal retains its dark theme and existing fleet list. The main project's command center has the separate larger sans-serif, neutral/green design, structured shift rows, and savings-first analytics. Snapshot grouping works in both apps; the admin redesign does not replace the portal theme.

## Recorded validation

The portal production build passed. All 10 Playwright tests passed together after grouped snapshot history was implemented. The demo test checks newest-first dropdown values, switching to legacy metadata, simulation requests, session cutoff, search, disabling demo, and desktop/mobile overflow. Existing cases cover authentication, invitations, expiry, and reconciliation. Browser traffic is mocked; these results are not a full live-account integration test.

Separate backend work recorded 5 demo tests, 7 integration tests, and 1 first-admin test passing. A mobile-device viewport check also passed. These are prior implementation results; this documentation-only update checks Markdown rather than rerunning application suites.

## Shared data history

The September 20 cleanup preserved employee `001`, both `hail` workspaces, and the administrator while removing six legacy demo instances and related records. The later migration preserved the four snapshots present at that time. Those are historical counts, not a current inventory or provisioning restriction. Snapshot grouping does not delete stored snapshots.

## Remaining work

See [known issues](KNOWN_ISSUES.md) for real workspace transport, exact legacy timestamp limitations, sign-out semantics, production HTTPS/WSS, and live backend validation.
Also see the main project's [KNOWN_ISSUES.md](../The-Downscale-Demon/KNOWN_ISSUES.md) for backend-shift, scheduler, and CRIU simulation limitations that affect both applications.
