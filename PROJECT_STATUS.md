# Project status

Updated 2026-09-20 from source inspection.

## Implemented

- Invitation signup, login, first Chief Architect signup, and readable API validation errors.
- In-memory bearer authentication with REST/socket expiry handling.
- Owned-workspace selection and server-authorized start/restore.
- Workspace hibernation/logout and targeted termination handling.
- Exponential WebSocket reconnect, reconnect/focus reconciliation, and stale-refresh guards.
- Authorized fleet, backend billing estimates, and retained snapshot metadata.
- Playwright coverage with API/WebSocket mocks in `tests/portal.spec.js`.

## Latest shared-backend changes

The main project removed six legacy demo instances, seven related snapshots, and 17 related events on 2026-09-20. Employee `001`, its `hail mary` and `hail santa` workspaces, and the existing administrator were preserved. This portal reads that cleaned backend data according to role; no hardcoded whitelist was added.

Responsive fleet cards were implemented in the main project's admin frontend only. This portal still uses its existing fleet list and workspace picker. No portal source changes were made in that UI/data task.

## Validation status

The admin build, Docker deployment, mocked desktop/mobile browser smoke checks, and live database cleanup assertions passed in the main project. Those checks do not establish portal test results. The portal build and Playwright suite were not rerun for this documentation refresh.

## Remaining work

See [known issues](KNOWN_ISSUES.md) for timezone labeling, session-view scope, production transport, and live integration coverage. No percentage-complete estimate is assigned.
