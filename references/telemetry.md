# Optional Telemetry

[Back to README](../README.md)

## Optional command telemetry

The server supports optional CLI, MCP tool and named prompt-template usage telemetry.
Interactive `setup` asks for consent, defaulting to No, and saves that choice in
the target client's environment configuration. There is no global consent file,
installation ID or install hook. Existing clients are not silently opted in.

```bash
npx -y whoop-ai-mcp@latest setup --telemetry=on
npx -y whoop-ai-mcp@latest setup --telemetry=off
```

When consent is granted, setup supplies the maintainer endpoint below unless an
explicit custom endpoint is configured. No events are sent before setup succeeds;
its completion event uses the effective consent. Setup failures are not measured.
For clients whose registration commands are printed, run the generated command
to persist the choice. Only Desktop's saved configuration can be inspected on a
subsequent setup run; other targets may prompt again unless given an explicit flag.

For manual configuration, set both variables in the environment of the MCP server process
(for desktop clients, use the server's `env` configuration):

```bash
export WHOOP_MCP_TELEMETRY=1
export WHOOP_MCP_TELEMETRY_ENDPOINT="https://whoop-mcp-telemetry.whoop-ai-mcp.workers.dev/events"
```

The URL above is the maintainer collector. Use only a collector you
trust. HTTPS is required; embedded credentials, query strings, and fragments
are rejected. Invalid or incomplete settings disable telemetry without
preventing normal use. Normal server startup has no fallback endpoint; the setup
wizard supplies the maintainer endpoint only after consent.

Check effective configuration locally from a build of this checkout:

```bash
node dist/index.js telemetry status
```

The installed command is `whoop-ai-mcp telemetry status`.
It returns JSON such as `{"enabled":false,"reason":"not_opted_in"}` without
OAuth or network access. `enabled` means configured, not verified delivery.
Reasons also include `enabled`, `do_not_track`, `privacy_mode`, and
`invalid_endpoint`. The `doctor` and `telemetry status` commands never send events.

Disable telemetry by removing `WHOOP_MCP_TELEMETRY`, setting it to `0`, or setting
`DO_NOT_TRACK=1`. Aggregate privacy mode also disables telemetry, even with opt-in.
Restart the process after changing settings. There are no persistent
`telemetry enable`/`disable` commands.

Each JSON POST contains these fields. Tool errors also include one allowlisted
`error_category`. `1.2.3` below is illustrative; the actual `package_version` is
the installed package's numeric version, not `latest`:

```json
{
  "schema_version": 1,
  "package_version": "1.2.3",
  "kind": "tool",
  "name": "get_baselines",
  "outcome": "success"
}
```

`kind` is `command`, `tool`, or `prompt`. Command names are `serve` (startup only) and
`setup` (successful completion after consent); tool names are the 16 registered tools. Outcomes are
`success` or `error`, including output-validation failures. Unknown tools and
SDK-rejected inputs are not recorded. Tool error categories are `api_auth`,
`api_rate_limit`, `api_client`, `api_server`, `network`, `invalid_data`,
`output_contract`, or `unexpected`. They contain no status body or message. No
arguments, results, health data, credentials, user/device/session IDs, filesystem
paths, raw errors, or timestamps are included. Prompt events count successful
retrievals of the five named MCP
templates: `weekly_health_review`, `sleep_analysis`, `recovery_trend`,
`workout_recap`, and `health_check`. They never include prompt arguments, template
content or chat text. Listing templates and SDK-rejected requests are not counted;
requesting a template is not proof that its conversation ran. Resources and WHOOP
API calls are not instrumented.

Sending is best effort: tool responses do not wait for telemetry; at most eight
requests are pending per process, with excess events dropped. Each request has
a 500 ms deadline, no retries or redirects, and no disk queue. Short-lived CLI
commands wait for pending sends within those deadlines. Counts can be incomplete
and are not unique-user metrics. Telemetry failures produce no console output
and do not change tool results or command exit codes.

**Collector and retention:** the maintainer collector is enabled for consenting
clients. The [Cloudflare implementation](../collector/README.md) stores
daily counts by UTC day, package version, kind, name, outcome and error category,
never raw event rows or user identifiers. Older tool errors are categorized as
`unknown`. Aggregates currently have no automatic expiry; D1 Free
Time Travel retains recoverable database history for seven days. Application
logging, invocation logging and tracing are disabled. The provider's network/security
infrastructure can still observe source IPs and arrival times; a fixed retention
bound for that metadata has not been verified. This is not an anonymity guarantee.

Payload validation, bounded requests and an approximate shared per-location rate
limit protect ingestion; it is not a strict global quota. Counts can be dropped
or spoofed and are not billing or unique-user metrics. A custom collector must
accept the documented contract, return promptly, and disclose its own policies.
Client code cannot enforce server-side deletion. Shared-host operators must obtain
appropriate consent from affected users; a process flag is not individual consent.

See the [telemetry spec](../docs/specs/v080-command-telemetry.md) and
[release plan](../docs/plans/task-18-v080-command-telemetry.md).

## Maintainer Usage Dashboard

[Open the private dashboard](https://whoop-mcp-dashboard.whoop-ai-mcp.workers.dev).
Cloudflare Access and Worker-side JWT verification restrict it to the configured
owner email. It reads daily aggregate counts only, with 7/30/90-day filters,
command/tool/prompt rankings, success/error outcomes, error-category breakdowns
and package-version filters.
No unique users or installations are measured. Owner sign-in is used only for
dashboard authorization, not usage analytics.

The dashboard measures recorded events, not people, installations or conversations.
Its read-only queries are bounded; sparse data and delivery failures limit conclusions.
Deploying it does not opt any client in. See [operator notes](../collector/README.md#private-dashboard)
for configuration, query limits and rollback.
