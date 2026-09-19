# Task 19: Maintainer Telemetry Collector

## Approved Scope

Approved in the 2026-09-15 continuation of Task 18:

- Prepare and deploy a Cloudflare Worker with D1 on the Free plan only.
- Worker name: `whoop-mcp-telemetry`; database name: `whoop-mcp-telemetry`.
- Discover the logged-in account, then confirm the account before provisioning.
- Store daily aggregate counts at ingestion, with no raw event rows. This replaces
  the proposed raw-event retention window with stricter data minimization.
- No paid upgrade, npm publication, package version bump, or default collector URL
  in the npm client is authorized by this task.

Package-side work: [Task 18](task-18-v080-command-telemetry.md).
Wire contract: [telemetry spec](../specs/v080-command-telemetry.md).

## Hosting Recommendation

Cloudflare Workers + D1 fits a small, best-effort collector without a maintained VM.
An existing VPS is an alternative when operational control is more important than
patching, backups, TLS and access-log management. A managed analytics provider would
need a separate ingestion adapter and verification of its retention settings.

Published Cloudflare Free allowances checked during this session:

- Workers: 100,000 requests/day, 10 ms CPU per invocation.
- D1: 5 million rows read/day, 100,000 rows written/day, 5 GB total storage.
- D1 index updates also count as writes; events do not map one-to-one to billed rows.
- Free quotas are shared with other account workloads. At limits, collection may
  fail; do not upgrade automatically. This is acceptable for best-effort usage counts.
- Workers Paid starts at USD 5/month plus usage; it is not approved here.

Sources:

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/workers/observability/logs/workers-logs/

## Implementation Sequence

### 19a: Account Gate

- [x] Check existing Wrangler authentication using read-only `whoami`.
- [x] User completes Cloudflare login directly, without sending secrets through chat.
- [x] Confirm account ending `918d78`; user verified Workers Free in the dashboard.
- [x] Verify names are available: account initially had no Workers or D1 databases.

Wrangler login completed on 2026-09-19. The user confirmed the account and Free
plan before provisioning. Billing API access returned 403, so Free-plan status
is user-confirmed, not independently read from billing. No paid upgrade was made.
Disable Wrangler's own telemetry with `WRANGLER_SEND_METRICS=false`.

```bash
WRANGLER_SEND_METRICS=false npx --yes wrangler@4.131.2 login
WRANGLER_SEND_METRICS=false npx --yes wrangler@4.131.2 whoami
```

### 19b: Collector Contract and Tests

- [x] Prepare an isolated collector directory, excluded from the npm package artifact.
- [x] Specify and test `POST /events` with the exact existing version-1 payload.
- [x] Enforce a small streaming body limit, JSON content type, strict field/name
      validation, and parameterized SQL. Reject unexpected fields, including IDs.
- [x] Use server-derived UTC day plus version, kind, name and outcome as the aggregate
      dimensions; atomically increment a count. Store no exact arrival timestamps.
- [x] Store no body, raw event, IP, user agent, URL, identifier, or error message.
- [x] Verify invalid requests perform no database writes and failures return generic
      responses. Test concurrent increments against a local D1-compatible runtime.
- [x] Add request throttling and an operational collection kill switch. Document that
      public-client events are forgeable; embedded API keys cannot authenticate users.
- [x] Expose no public analytics API; deployed operator access remains a verification gate.
- [x] Five synthetic real-sender deliveries completed in 78-331 ms, within the
      unchanged 500 ms deadline. This is a small single-location sample, not an SLA.

Dependencies: account choice must be confirmed before platform-specific provisioning.
Verify tests, collector typecheck, local Worker build, and root package regression gates.

### 19c: Privacy and Deployment

- [x] Disable observability, invocation logs, traces and Logpush in the local template;
      verify actual deployed settings before ingestion. No request data is logged.
- [x] Review provider security/access logs and D1 backup handling; see operator notes.
      Cloudflare infrastructure retention has no verified fixed duration here.
- [x] Document aggregate retention and account-authorized operator access; no raw-event
      table is created, so the previously proposed raw-event deletion job is unnecessary.
- [x] Audit collector tooling and dependencies; review schema, request bounds, rate
      limits, privacy controls and rollback behavior before production deployment.
- [x] Create confirmed Worker and D1 resources, apply schema, deploy with ingestion off.
- [x] Verify HTTPS, malformed/oversized rejection, throttling and synthetic ingestion.
- [x] Verify deployed missing-DB-binding failure: empty no-store 503; all real rows unchanged.
- [x] Confirm stored rows contain only daily aggregate dimensions and counts.
- [x] Update README with endpoint and disclosures; setup supplies it after explicit
      consent, while unattended MCP startup remains off without client opt-in.

Do not mark the hosted-collection release gate complete until these checks pass.
Rollback: disable ingestion first; do not delete the database without approval.

## Current Status

Release update: the owner approved v0.8.0 publication and enabling ingestion for
consenting clients after gates pass. A live temporary deployment without a D1
binding returned generic 503; its restoration and unchanged six-event dataset
were verified. No synthetic events were inserted. All technical hosted gates are
complete; release activation is pending. Historical staging records below are retained.

Hosting and aggregate-only storage are approved. The local collector is implemented
in `collector/` with 54 tests, including actual Worker bundle execution and local
D1 atomicity tests. Its default is disabled; checked-in account/database IDs are
placeholders and the build script is dry-run only. See the
[operator notes](../../collector/README.md) for setup, response contracts and limitations.

On 2026-09-19 the workspace was rebased onto `origin/main` at
`6d53f21` (v0.7.1), preserving the telemetry and roadmap changes. The combined
application suite passes 841 tests; all 54 collector tests also pass. The collector
declares Zod directly and its dependency audit is clean. Client dependencies and
the 500 ms sender deadline are unchanged. No v0.8.0 commit or publication performed.

## Staged Deployment (2026-09-19)

The initial staging observations below are historical. HTTPS and live ingestion
subsequently passed. See [the end-to-end test record](../reviews/v080-telemetry-e2e-2026-09-19.md).
Claude Desktop added a startup event, three successful tool events and two workout
error events. The requested profile call did not add a count and is not verified.
Original Desktop connector settings were restored, preserving preference changes.
Final Worker version `6e039d6e-e389-47ea-b418-00e11ececd26` has collection off;
the public endpoint returns 503. Eleven test-event counts across eight aggregate
rows are retained. Live database-failure injection and final rollout remain open.

- Approved Worker and database: `whoop-mcp-telemetry`; D1 was placed in APAC.
- Worker version: `a9524489-eeaf-4573-bd44-ec4d1ff1fa62`.
- Reserved URL: `https://whoop-mcp-telemetry.whoop-ai-mcp.workers.dev/events`.
      Do not configure clients yet: TLS handshakes fail from the deployment machine.
- The ignored `collector/wrangler.production.json` contains the confirmed IDs;
      checked-in template placeholders remain unchanged. `COLLECTION_ENABLED` is `0`.
- `0001-aggregates.sql` applied remotely. Read-only inspection confirms the six
      expected columns and zero aggregate rows. No telemetry events were ingested.
- Public Worker route is enabled; preview URLs are disabled. An explicit
      script-settings PATCH disabling observability/logs/invocation logs/traces,
      Logpush and tail consumers returned success. Cloudflare represents disabled
      observability and empty tail consumers as `null` in its readback.
- HTTPS checks failed with TLS handshake errors using both Node fetch and curl.
      Certificate propagation versus local network interference is not yet resolved.
      TLS verification was never bypassed. No client deadline or retry policy changed.
- Remaining: verified HTTPS, synthetic ingestion/rejections/throttling/storage
      failure, stored-row checks, production latency and final enablement. Collection
      stays disabled until these checks can run; the hosted release gate remains open.