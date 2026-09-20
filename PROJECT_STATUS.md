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

The admin build, Docker deployment, mocked desktop/mobile browser smoke checks, and live database cleanup assertions passed in the main project. Those checks do not establish portal test results. The portal build and Playwright suite were not rerun for the earlier documentation-only refresh; see the latest update below.

## Remaining work

See [known issues](KNOWN_ISSUES.md) for timezone labeling, session-view scope, production transport, and live integration coverage. No percentage-complete estimate is assigned.

## Latest portal snapshot/demo update

Portal source now includes the demo toggle for owned workspaces, date/time and CPU/activity inputs, presets, and immediate shift evaluation. Both apps render the new searchable snapshot vault with timestamp distinctions and unique references. The active-session timezone is server-provided and the portal has a mobile viewport declaration.

The production build passed. All 9 pre-existing Playwright cases passed with the vault selector updated for the new UI, and the new `tests/demo.spec.js` case passed. That test covers settings requests, CPU preset, immediate session termination, legacy/new snapshot times, search, no overflow at desktop/mobile widths, and disabling demo. Backend tests separately cover authorization, server gating, scheduler parity, clock reset, timestamp accuracy, and legacy behavior.

No live user workspace was toggled or hibernated for validation. Both retained workspaces and four old snapshots were preserved through the backed-up schema migration.

## Grouped snapshot history

The vault now shows one card per instance in both apps. A snapshot-history dropdown lists retained captures newest first by actual creation time (legacy records use the known filename date), with the latest selected initially. Selecting an older capture updates the details without creating duplicate workspace cards. Main vault text is 16px, secondary labels are 14px, and workspace headings are 22px. Search matches workspace names, IDs, and filenames while retaining the full history dropdown. No snapshot records are deleted by grouping.
