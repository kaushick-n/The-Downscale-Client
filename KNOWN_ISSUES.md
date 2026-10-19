# Employee station known issues and limitations

The employee station consumes the shared lifecycle API. It does not itself implement the AWS Edge Proxy, queue, CRIU/EBS operations, isolation, or billing. Backend AWS code paths are opt-in and have not been verified against a live AWS account. See the main project's [known issues](../The-Downscale-Demon/KNOWN_ISSUES.md) and [AWS readiness checklist](../The-Downscale-Demon/PROJECT_STATUS.md#checklist-switch-to-live-aws-100-credit-tier).

| Area | Current limitation | Follow-up |
| --- | --- | --- |
| Remote workspace access | The session panel displays API/SSM inspection results; it is not an interactive shell, terminal transport, or remote desktop | Add a separately secured interactive transport if required |
| Local checkpointing | Local mode creates simulated metadata only; it cannot preserve process memory, sockets, or tmux state | Validate the opt-in CRIU/EBS path on supported EC2/OS/kernel combinations |
| Live process/telemetry | SSM process/tmux inspection and CloudWatch Agent memory require AWS configuration; missing readings are shown as unavailable | Validate agent installation, metric dimensions, SSM permissions, and returned data in a staging account |
| Authentication persistence | Tokens are held only in memory; refresh requires sign-in | Decide whether a secure refresh/session strategy is required |
| Sign-out semantics | Workspace logout hibernates the workspace but does not revoke the account bearer token | Add server-side token revocation if required |
| Production transport | Local defaults use HTTP and derive WS; production TLS/WSS and allowed origins are deployment responsibilities | Configure HTTPS/WSS, secure origins, and deployment headers |
| FinOps | Portal shows configured-rate estimates rather than billed usage or awarded credits | Reconcile with AWS Cost and Usage data and label any actual credit balance separately |
| Test scope | Playwright mocks REST and WebSocket responses | Verify real account scoping, CORS, scheduler events, connection recovery, and AWS service behavior |
| Accessibility | Dialog flows and responsive states are implemented, but focus trapping, Escape-to-close, and focus restoration have not been fully audited | Complete keyboard/screen-reader testing and remediate findings |

## Data presentation

Workspace names, state, CPU, memory, shift, announcements, requests, and cost estimates are supplied by the backend. Missing measurements and simulated checkpoint metadata are displayed as unavailable/not recorded rather than filled with sample values. Client-derived countdown and ping age are presentations of server-provided shift/connection data, not alternate authorization decisions.

## Demo and checkpoint behavior

Demo settings require backend `DEMO_MODE=1`, an owned workspace, and the server's `demo_available` capability. CPU/activity settings do not wake a hibernated workspace. The normal scheduler may apply shift cutoffs on its polling interval; **Apply & evaluate now** requests immediate evaluation.

Legacy snapshot timestamps cannot be recovered if only a filename date was retained. Selecting an old snapshot changes displayed metadata, not which image the backend restores. Checkpoint sizes, RAM footprints, and tmux panes remain unknown unless captured by a real lifecycle implementation.
