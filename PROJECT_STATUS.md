# Employee station project status

Status is based on the implemented portal and backend API contract. The employee station is a client of the main project's five-step lifecycle; its AWS execution path remains disabled by default and has no live-account acceptance evidence.

## Implemented employee experience

- Responsive dark enterprise layout with Overview, Workspaces, Inbox & requests, and Session history navigation.
- Server-provided workspace switcher, status badges, shift state/countdown, lifecycle actions, and runtime display.
- Bearer-authenticated REST integration and a reconnecting Fleet WebSocket in `AppContext`.
- Ping/pong latency, backend telemetry readings, connection state, and explicit unavailable states for missing CloudWatch/SSM data.
- Session inspection through the session-state API when SSM is enabled; local mode is clearly reported as unavailable.
- Backend announcements, shift-ending notices where applicable, persisted employee requests, and Team Lead request decisions.
- Searchable checkpoint history, grouped by workspace and ordered by recorded timestamps; unknown size/RAM/pane metadata is not fabricated.
- Backend-provided FinOps projections and demo-control capability gating.

## Shared backend/API integration

The portal consumes the shared identity, team, shift, fleet, lifecycle, checkpoint, helpdesk, announcement, and telemetry APIs. Employee and Team Lead authorization is enforced by the backend. The API additions and WebSocket message contracts are detailed in the main project's [integration report](../The-Downscale-Demon/INTEGRATION_REPORT.md).

## Current boundaries

- The session panel is a status/inspection view, not an interactive remote terminal or desktop.
- Local checkpoint actions persist simulated records; they do not produce CRIU memory images or preserve actual process memory, sockets, or tmux state.
- SSM process inspection, CloudWatch Agent memory readings, Edge Proxy/SQS buffering, EC2/EBS lifecycle actions, and anomaly isolation require AWS configuration and have not been validated against a live account.
- WebSocket FinOps values are configured-rate estimates, not AWS-issued credits or actual invoice savings.
- Browser tests mock API and socket traffic; deployment CORS/TLS/WSS and live backend behavior remain separate acceptance work.

## Recorded verification

The current portal build and Playwright tests are verified by the latest implementation run. The suite exercises authentication, invitation and Chief Architect signup, session lifecycle, inbox/helpdesk submission, demo controls, and responsive overflow. Backend verification is run separately for `test_integration.py`, `test_demo.py`, and `test_chief_signup.py`, because their test modules configure isolated database environments. See the main project's [roadmap status](../The-Downscale-Demon/PROJECT_STATUS.md) for the latest backend test counts and AWS readiness gates.

## Remaining work

See [known issues](KNOWN_ISSUES.md) for transport, auth revocation, remote workspace access, live service acceptance, and accessibility limitations. The main project's [live AWS readiness checklist](../The-Downscale-Demon/PROJECT_STATUS.md#checklist-switch-to-live-aws-100-credit-tier) remains the deployment gate.
