# Maintainer Telemetry Collector

Implementation for Task 19, staged on Cloudflare with ingestion disabled.
HTTPS, synthetic ingestion and manual Claude Desktop delivery are verified.
Collection was disabled again after testing. The npm client has no
built-in collector endpoint. This private directory is outside the client package's
`dist` artifact; its tooling does not change client dependencies.

## Local Checks

From the repository root, install the existing root dependencies first, then:

```bash
npm ci --prefix collector
npm --prefix collector test
npm --prefix collector run typecheck
npm --prefix collector run lint
npm --prefix collector run format:check
npm --prefix collector run build
npm --prefix collector run build:dashboard
```

The build is a Wrangler **dry run**, not a deployment. Tests use Miniflare's
local D1 runtime, mocked client delivery, and synthetic events only. No tests
call WHOOP or a live collector. The suite also builds and exercises the actual
Worker bundle. The tiny `src/index.mjs` adapter provides the default export
required by Cloudflare; application logic uses named TypeScript exports.

## Request Contract

The ingestion Worker supports only `POST /events`; no query string, analytics/read endpoint,
browser CORS permission, cookie, or client API key is provided.

- Require `application/json` (optional UTF-8 charset); reject content encodings.
- Bound the body to 1,024 bytes before JSON parsing, regardless of Content-Length.
- Cancel body reads after one second. This is a server resource bound, not a
  change to the client's 500 ms deadline.
- Validate the exact version-1 client payload with strict Zod allowlists.
  Version strings are bounded to 64 characters. Kinds are command, tool and prompt;
  prompt names are restricted to the five registered MCP templates.
- Use server-derived UTC day, package version, kind, name and outcome as the
  composite aggregate key. Increment count with one parameterized atomic upsert.
- Return empty, non-cacheable responses: 204 accepted; 400 invalid payload or
  length; 404 unknown path/query; 405 unsupported method; 408 body timeout;
  413 oversized body; 415 unsupported media/encoding; 429 throttled;
  503 disabled, unavailable limiter, or storage failure. No raw error is returned.

Malformed requests never write to D1. Rate limiting uses the constant `events`
key, never an IP or identifier. The proposed limit is 60 requests/minute **per
Cloudflare location**, shared by all clients. Cloudflare's limiter is permissive
and eventually consistent, not a hard global budget or per-user fairness control.
Abuse can exhaust free quotas or cause legitimate events to be dropped. There
are no paid fallbacks, retries, or automatic upgrades.

Public-client events are forgeable. Counts are best-effort usage signals, not
authenticated users or billing data. An embedded client key would not solve this.

## Storage and Privacy

`daily_counts` has exactly six columns: `day`, `package_version`, `kind`, `name`,
`outcome`, `count`. It has no raw-event rows, exact timestamps, IDs, request
bodies, health data, IPs, user agents, URLs, or error text. The approved design
supersedes the earlier 30-day raw-event retention proposal. Only daily aggregates
are retained; no automatic aggregate expiration is configured. Reads are private
through account-authorized D1 tools or the separate owner-only dashboard below,
with no unauthenticated read API.

Worker observability, invocation logs, traces and Logpush are explicitly off.
Wrangler and Miniflare telemetry are disabled in the documented test/build paths.
Do not enable request logging or attach tail consumers. Cloudflare still receives
network metadata: disabling application logs is not a promise of no infrastructure
retention. Cloudflare's privacy policy covers processing IPs, routing data and
other network metadata, with retention determined by service, security and legal
purposes rather than a fixed duration verified by this project. Do not interpret
disabled Worker logs as a guarantee about provider security or infrastructure logs.

D1 Time Travel is automatic, cannot be treated as instantaneous deletion, and
retains recoverable database states for seven days on Workers Free. It contains
the aggregate database, not request bodies. No additional exports or backups are
configured. Aggregate rows have no automatic expiration. Operator reads require
Cloudflare account authorization or owner-only Access authentication for the
dashboard; the public ingestion Worker provides no query endpoint.

Sources: [Cloudflare privacy policy](https://www.cloudflare.com/privacypolicy/),
[D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/), and
[Workers logging controls](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).

## Deployment Gate

The checked-in configuration has zero-valued account/database placeholders and
no public route. Do not deploy it or use temporary preview accounts. Before any
provisioning, the operator must authenticate directly, confirm the intended
account and Free-plan eligibility, and check Worker/database names and rate-limit
namespace `1001` for collisions. Login and account confirmation completed on
2026-09-19. The user confirmed Workers Free; billing API access was unavailable.

After confirmation, use a local ignored `wrangler.production.json` based on the
template with the approved account and resource IDs. Explicit IDs avoid Wrangler's
automatic resource provisioning. Create only approved resources, apply the SQL
migration, and deploy with `COLLECTION_ENABLED="0"` until ready for verification.
Configure public HTTPS routing only for the confirmed Worker.

Enabling collection requires the exact value `COLLECTION_ENABLED="1"`. All
other or missing values fail closed. Before enabling real clients, verify
synthetic ingestion, invalid/oversized rejection, throttling, storage failures,
stored columns and operator access. Measure live latency against the unchanged
500 ms sender deadline; local timings do not establish production suitability.
Free-plan quotas are shared with other workloads and must be reviewed.

Rollback: set collection to `0` in the active configuration and redeploy, or
remove its public route. Preserve the database unless deletion is separately
approved. Do not rely on dashboard variable edits surviving a later deployment.
No automatic production deployment or npm publication script is supplied here.

## Current Deployment

The confirmed Worker and APAC D1 database are named `whoop-mcp-telemetry`.
The migration is applied. On 2026-09-19, the owner requested removal of only the
five synthetic events. Six actual Desktop events remain across five aggregate
rows, including two real workout error outcomes. Production
configuration is kept in ignored `wrangler.production.json`; the checked-in
template remains safe for local use. Current Worker version:
`48d23302-4ee2-4cf0-89c2-d3e2505326dc` (prompt support, collection still disabled).

Reserved endpoint: `https://whoop-mcp-telemetry.whoop-ai-mcp.workers.dev/events`.
**Disabled after verification:** HTTPS works and the real sender delivered five
synthetic events in 78-331 ms. Manual Claude Desktop startup and tool telemetry
also reached D1. No TLS bypass or HTTP fallback was used. `COLLECTION_ENABLED`
was restored to `0`; the endpoint returns 503. Cloudflare accepted explicit
logging-disable settings; its API returns `observability: null` and no tail consumers.

Live malformed/oversized rejection, throttling and stored-column checks passed.
Live missing-storage verification also passed: a temporary deployment without
the DB binding returned an empty no-store 503. All six actual events remained
unchanged, and the original binding and disabled state were restored. The owner
approved enabling ingestion for consenting clients at v0.8.0 release. The
checked-in template remains disabled. See [the test record](../docs/reviews/v080-telemetry-e2e-2026-09-19.md).

## Private Dashboard

URL: https://whoop-mcp-dashboard.whoop-ai-mcp.workers.dev

The separate `whoop-mcp-dashboard` Worker provides read-only charts and aggregate
tables. It cannot enable collection. All HTML, assets and JSON require Access
authentication and Worker-side RS256 JWT verification of issuer, audience,
expiration and the configured owner email. Missing configuration fails closed.
No credentials or Access tokens are stored by the dashboard. Owner identity is
used for authorization, never inserted into usage aggregates.

- Date windows: 7, 30 or 90 UTC days, including today.
- Filters: command/tool/prompt kind, package version and event-name search.
- JSON queries use bound parameters and cap output at 5,000 rows. Truncated data
  is explicitly flagged; shorten the range to obtain complete counts.
- No unique-user or installation estimate. Prompt events count template retrievals,
  not arbitrary chat text, model responses or completed conversations.
- Five synthetic counts were removed at the owner's request; the six actual
  Desktop events from the verification session remain. The
  prompt view is empty until opted-in, updated clients send template events.

Local template: `wrangler.dashboard.json`. Ignored production configuration:
`wrangler.dashboard.production.json`. Use these environment values:

| Variable | Purpose |
| --- | --- |
| `ACCESS_TEAM_DOMAIN` | Exact HTTPS Cloudflare Access team origin |
| `ACCESS_AUD` | Application Audience tag, not the application UUID |
| `OWNER_EMAIL` | Only the verified owner email may read aggregates |

The owner configured Access application `21a5c0a8-c37f-4e07-bb02-b7b96de45419`
for the exact dashboard hostname, all paths, and confirmed an email-only Allow
policy without Everyone or Bypass. Wrangler's login cannot inspect Access policies;
policy ownership is user-confirmed. Live anonymous and forged-token checks of
`/`, `/api/metrics`, `/app.js` and `/style.css` all redirect to the Access team
login. The owner successfully signed in and confirmed 11 events on the live page.

Dashboard version: `68275e4a-3841-4b0b-a49d-893348201290`. Application logging,
invocation logs, traces and Logpush are disabled. Cloudflare Access itself may
retain owner authentication logs under its own provider policies.

Migration `0002-prompts.sql` is applied; all eight prior rows and eleven counts
were compared before/after and preserved. Collector version
`48d23302-4ee2-4cf0-89c2-d3e2505326dc` accepts the prompt allowlist when enabled,
but remains at `COLLECTION_ENABLED=0` with verified HTTP 503.

Verification: 844 application tests and 77 collector/dashboard tests pass, including
denial for expired, forged, wrong-owner, wrong-issuer and wrong-audience JWTs.
Desktop/mobile preview checks at 1440/390/320 pixels cover filters, empty/error
states, canvas rendering and overflow. The preview uses synthetic data only.

To roll back dashboard exposure, disable its `workers_dev` route and redeploy or
block access in its Access policy. Keep the ingestion Worker separate. Do not add
an Access bypass or remove JWT checks to troubleshoot login. Do not downgrade the
database kind constraint after prompt data exists without a reviewed migration.

## References

- [Approved plan](../docs/plans/task-19-telemetry-collector.md)
- [Client wire contract](../docs/specs/v080-command-telemetry.md)
- [D1 bound statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
- [Rate-limit locality and accuracy](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Wrangler configuration and observability](https://developers.cloudflare.com/workers/wrangler/configuration/)