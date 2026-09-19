# Task 18: v0.8.0 Opt-In Command Telemetry

Spec: [v080-command-telemetry.md](../specs/v080-command-telemetry.md).
Scope and configurable collector approach approved in the 2026-09-15 session.
Package follows the released 0.7.1 baseline after the 2026-09-19 rebase.
The owner subsequently authorized v0.8.0 commit, push and publication after checks,
plus collector enablement for consenting clients. Interactive setup consent was
chosen instead of automatic default-on collection.

## Ordered Tasks

### 18a: Consent and Sender

- [x] Add strict configuration, event allowlists, effective status, and bounded HTTPS sending.
- [x] Prove no network by default, opt-out precedence, payload safety, failure isolation,
      deadline cancellation and request bounds with mocked fetch.
- Files: `src/telemetry/telemetry.ts`, `tests/telemetry/telemetry.test.ts`.
- Verify: `npm test -- tests/telemetry/telemetry.test.ts`, then `npm test`.
- Dependencies: none.

### 18b: MCP Tool Outcomes

- [x] Inject an optional recorder into the pure server factory; record only names/outcomes.
- [x] Cover success, handler errors, malformed output and aggregate privacy suppression.
- Files: `src/server.ts`, `tests/server-release.test.ts`.
- Verify: `npm test -- tests/server-release.test.ts`, then `npm test`.
- Dependencies: 18a. Checkpoint: tool responses are unchanged with delivery failure.

### 18c: CLI Option and Local Status

- [x] Wire environment settings, server startup/setup events and `telemetry status`.
- [x] Preserve local-only doctor/status, CLI exit codes and MCP stdout.
- Files: `src/index.ts`, `tests/index.test.ts`.
- Verify: `npm test -- tests/index.test.ts`, then `npm test`.
- Dependencies: 18a and 18b.

### 18d: Documentation and Release Checks

- [x] Document opt-in/out, payload, endpoint contract and operational privacy caveats.
- [x] Update unreleased changelog; run tests, lint, typecheck, build, format and package checks.
- Files: `README.md`, `CHANGELOG.md`, this plan, feature spec.
- Dependencies: 18a-18c. No commit, push, version bump or publication in this task.

## Hosted Collection Release Blockers

Continuation: [Task 19](task-19-telemetry-collector.md) records the approved
Cloudflare Free-plan deployment and aggregate-only storage design. No raw events
will be stored by that collector; local implementation is tested and cloud resources
are deployed. HTTPS, live ingestion and missing-storage failure checks passed.
Collection will be enabled for explicitly consenting clients at release.

- [x] Provision and verify collector; approve endpoint provision through setup consent only.
- [x] Verify deployed aggregate-only storage with no raw event rows (supersedes raw-event retention).
- [x] Review source-IP/access-log retention, consent disclosures, access control and abuse limits.
- [x] Validate deployed ingestion using synthetic events before advertising collection.

## Verification Record

Initial client-only verification (2026-09-15):

- 826 tests pass across 44 files (29 added); tests use mocked collector/WHOOP calls.
- Typecheck, lint, build, full source/test format check and `git diff --check` pass.
- npm dry-run inventory includes `dist/telemetry/telemetry.js` and the CLI entry point;
    source and test directories are excluded. Metadata remains 0.7.0.
- Compiled CLI status smoke passes without WHOOP credentials for default-off,
    configured opt-in, and `DO_NOT_TRACK=1`. No live collector ingestion tested.
- Reviewed correctness, readability, architecture, security and performance:
    strict event allowlists, factory injection, privacy suppression, bounded delivery,
    and unchanged tool results covered. No new runtime dependencies or token changes.
- Existing edits to task-14, task-15 and the master implementation plan were preserved.
- No commit, push, version bump, service deployment or npm publication performed.

Continuation (2026-09-19): rebased onto `origin/main` at `6d53f21`, preserving
all local telemetry and roadmap work. The combined application suite passes
841 tests across 44 files; the isolated collector passes 54 tests across four
files. Metadata is 0.7.1 from upstream, not a v0.8.0 release bump. The named
pre-rebase stash is retained as a backup. No v0.8.0 commit or npm publication
performed. Task 19 records the separately approved, disabled collector deployment.

## Risks and Rollback

Sensitive data leakage: strict allowlists and exact-key tests; no raw arguments/errors.
Collector outage: bounded, nonblocking sends and no retries or disk queue.
Privacy regression: default off, explicit endpoint, global opt-out, aggregate suppression,
and diagnostic commands excluded. Roll back collection by removing opt-in or setting
`DO_NOT_TRACK=1` and restarting; client-config choices can be updated with
`setup --telemetry=off`. No token storage changes are involved.

## Release Candidate

- One-time Desktop setup consent plus flags for all supported client targets.
- Real readline tests prove Yes enables and blank/No decline; dispatcher tests
    prove inherited opt-in cannot override an explicit setup opt-out.
- 870 application tests across 47 files; 77 collector/dashboard tests across five files.
- Live missing-DB-binding fault check returned an empty no-store 503 and preserved
    all six actual Desktop events. Original binding and disabled state were restored.
- Collector/dashboard Node 22 CI added; root Node 20/22 matrix retained.
- Older verification records above describe intermediate checkpoints, not the final release.