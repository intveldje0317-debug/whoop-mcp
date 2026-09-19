# Spec: v0.8.0 Opt-In Command Telemetry

## Objective and Approval

Prepare optional npm CLI and MCP tool usage measurement for the next minor release.
The user approved implementation targeting 0.8.0 and configurable HTTPS sending
until a maintainer collector exists. Task 19's approved aggregate-only ingestion
design supersedes the original 30-day raw-event retention proposal: the maintainer
collector stores no raw event rows. The owner subsequently authorized the v0.8.0
version bump, commit, push and publication after release gates pass, and enabling
the collector for consenting clients at release.

On 2026-09-19 the owner additionally approved named prompt-template counts and
an owner-only Cloudflare dashboard. Aggregate-only tracking was explicitly chosen
over unique installations. See [dashboard scope](telemetry-dashboard.md).

## Contract

- Off by default. Sending requires both `WHOOP_MCP_TELEMETRY=1` and
  `WHOOP_MCP_TELEMETRY_ENDPOINT` containing an HTTPS URL without credentials,
  query, or fragment. Invalid configuration disables telemetry without breaking MCP.
- Interactive setup asks for telemetry consent with a No default and persists the
  decision in the target client environment. Desktop reuses its saved decision;
  command-printing targets require running the generated command. Scripted setup
  supports `--telemetry=on|off`; unattended setup without explicit opt-in stays off.
  Setup supplies the maintainer HTTPS endpoint only after consent; server startup
  never assumes consent or prompts. Invalid optional endpoints fail closed.
- `DO_NOT_TRACK=1`, explicit environment opt-out and aggregate privacy override
  consent. No global consent file, installation ID, install hook, or new client
  runtime dependency. Saved custom endpoints and privacy settings survive setup.
- `whoop-ai-mcp telemetry status` reports effective status locally without OAuth
  or network access. Settings are process environment settings; restart to apply.
- CLI events cover `serve` startup with success/error and successful `setup`
  completion after effective consent. Setup failures never send events.
  `doctor` and telemetry status remain strictly local and are never measured.
- MCP events cover the 16 registered tool handlers after input validation, including
  handler errors and output-contract failures. Unknown tools and SDK-rejected input
  are not recorded. Resources, HTTP routes and WHOOP requests are excluded.
- Prompt events cover successful retrieval of the five registered templates only.
  No prompt arguments, text or generated content are recorded. Listing and rejected
  requests are excluded. Aggregate privacy disables both prompts and telemetry.
- JSON POST body: `schema_version: 1`, `package_version`, `kind` (`command`,
  `tool`, or `prompt`), allowlisted `name`, and `outcome` (`success` or `error`). Strict Zod
  schemas reject unknown fields and names. No arguments, results, health data,
  tokens, user/device/session IDs, paths, hostnames, raw errors, or timestamps.
- Best effort: at most 8 pending requests per process; excess events are dropped.
  Each request has a 500 ms deadline, no retry, no redirects, no cookies, and no
  response-body processing. Tool responses do not await delivery. Short-lived CLI
  commands drain pending sends within their existing request deadlines.
- No telemetry output on MCP stdout or stderr and no disk queue. Failure to send
  must not alter tool responses, CLI exit codes, or authentication behavior.

## Collector Release Gate

The collector is implemented and tested locally in `collector/` and staged on
Cloudflare with collection disabled. It is not configured in the client. HTTPS,
synthetic delivery, manual Desktop telemetry and live missing-storage failure
verification passed. Consent-based enablement at release is approved. Before enabling a maintainer destination in release
instructions, verify endpoint ownership, schema acceptance, abuse limits and
aggregate-only storage with no raw event rows. Document aggregate retention,
access controls and infrastructure/proxy access-log retention;
the receiving infrastructure necessarily sees source IP addresses and arrival times.
Do not describe this as anonymous or claim client code enforces server retention.
Hosted operators must obtain appropriate consent from affected users; process-level
opt-in is not a substitute for individual consent on shared deployments.

## Structure and Style

- `src/telemetry/telemetry.ts`: configuration, strict event contract, bounded sender.
- `src/index.ts`: CLI dispatch and dependency injection into the server factory.
- `src/server.ts`: post-validation tool outcome hook.
- `tests/telemetry/`, `tests/index.test.ts`, `tests/server-release.test.ts`: tests.
- TypeScript strict, named exports, explicit exported return types, no `any`.
  Example call: `telemetry.record({ kind: "command", name: "setup", outcome: "success" })`.

## Verification

Use Vitest with mocked fetch, never real WHOOP or collector requests. Prove defaults,
opt-out precedence, invalid URLs and payload rejection, timeout/failure isolation,
bounded concurrency, exact payload contents, tool outcomes, and local-only CLI paths.

```bash
npm test -- tests/telemetry/telemetry.test.ts
npm test -- tests/index.test.ts tests/server-release.test.ts
npm test
npm run typecheck
npm run lint
npm run build
npm run format:check
npm pack --dry-run
node dist/index.js telemetry status
```

## Boundaries

Always validate telemetry at its boundary and preserve MCP stdout. Ask before adding
a provider, authentication mechanism, runtime dependency, new event fields, or a
default endpoint outside the approved setup flow. Never collect sensitive payloads,
publish without release approval, change token storage,
or modify the existing OAuth flow as part of this feature.

## Runtime References

- Node 20 deadline cancellation: https://nodejs.org/docs/latest-v20.x/api/globals.html#static-method-abortsignaltimeoutdelay
- Fetch request options (`redirect: "error"`, `credentials: "omit"`): https://developer.mozilla.org/en-US/docs/Web/API/RequestInit