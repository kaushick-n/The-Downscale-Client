# Known issues and limitations

Reviewed 2026-09-20. Replaces earlier placeholder issue entries.

| Area | Observed limitation | Follow-up |
| --- | --- | --- |
| Session view | Displays local session metadata, not an actual remote shell/desktop | Clarify scope if real workspace transport is added |
| Styling consistency | Portal retains its compact fleet list; new admin cards are in a different repository | Apply a separate portal design change if requested |
| Authentication persistence | Tokens are held only in memory; refresh signs the user out | Treat as current behavior when designing recovery |
| Sign-out semantics | Account sign-out is local; workspace logout hibernates but does not revoke the bearer token | Add server revocation if needed |
| Production transport | Default URL is HTTP and derives WS; Compose has no TLS | Configure HTTPS/WSS and allowed origins for deployment |
| Test scope | Playwright uses mocked API/socket responses | Verify real accounts, CORS, scheduler cutoffs, and reconnect against a live backend |
| Snapshot scope | Backend CRIU/snapshots are simulated, with no download endpoint | Do not imply downloadable process memory |

The backend already honors `SHIFT_TIMEZONE`, performs conditional single-use invitation redemption, and offers first-admin signup. Earlier statements about missing implementations should not be treated as confirmed defects.

Demo data was removed from the local shared Docker database on 2026-09-20. No portal-side demo filtering or employee-ID restriction is required. See the main project's README for the retained records and backup.

## Snapshot/demo behavior

Exact timestamps for old snapshots were never recorded; only their filename date can be shown. New snapshots have actual timestamps and optional demo timestamps. CPU/activity changes require a powered-on workspace, and do not wake it automatically. Shift-based cutoff remains the current behavior; memory/network metrics and CPU-based idle timeouts are not implemented.

Demo settings persist in the backend until disabled. The regular scheduler can hibernate an out-of-shift demo workspace within 30 seconds; **Apply & evaluate now** makes it immediate. Disabling demo restores the real clock and checks the real shift. Account expiry is unaffected.

Resolved in this update: hardcoded active-session timezone, compact snapshot-list layout, and missing mobile viewport metadata. The fleet list itself remains the existing portal design; snapshot cards now match the admin vault structure.
