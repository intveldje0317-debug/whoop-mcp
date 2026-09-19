# Private Telemetry Dashboard

## Approved Scope (2026-09-19)

The owner requested a Cloudflare-hosted dashboard and approved aggregate usage
only, named MCP prompt-template telemetry, and Cloudflare Access restricted to
the owner's account email on the Free plan. No installation or user identifiers,
chat text, prompt arguments, generated content or health data may be collected.
Unique people cannot be counted from these aggregates and will not be estimated.

## Contract and Plan

1. Add `kind: prompt` for the five registered MCP templates. Record successful
   handler retrieval only, not listing or unknown/invalid prompt requests. Preserve
   opt-out, aggregate privacy suppression and delivery failure isolation.
2. Extend the collector's strict schema and D1 kind constraint with an additive,
   row-preserving migration. Existing version-1 command/tool payloads remain valid.
3. Add a separate dashboard Worker reading the existing D1 database. All HTML,
   assets and JSON require validated owner authentication; missing configuration
   fails closed. No public read API, browser token storage or embedded API secrets.
4. Provide daily volume, success/error counts, command/tool/prompt rankings and
   package versions, with bounded date range and kind filters. Never label events
   as users. Explicitly identify retained smoke-test data and incomplete sampling.
5. Test authorization denial, date validation, aggregate SQL, prompt contracts and
   desktop/mobile browser rendering. Configure Access before enabling deployment.

## Structure and Verification

- Prompt hooks: `src/prompts/index.ts`, `src/server.ts`, `src/telemetry/telemetry.ts`.
- Collector validation/migration/tests: `collector/`.
- Read-only Worker, UI and authorization tests: isolated dashboard files in `collector/`.
- Test commands: `npm test`; `npm --prefix collector test`;
  `npm run typecheck`; `npm --prefix collector run typecheck`;
  `npm run lint`; `npm --prefix collector run lint`; local Wrangler dry-run builds.
- Use named TypeScript exports, strict types, Zod input validation and bound SQL.

## Boundaries

Ingestion stays disabled unless separately enabled by the owner. No npm publication
or version bump. Confirm any new runtime dependency before adding it. Cloudflare
Access setup may require owner interaction and additional API permissions; never
deploy an unprotected read endpoint as a fallback. Keep all client credentials
unchanged. Dashboard access identity is for authorization only, not usage analytics.