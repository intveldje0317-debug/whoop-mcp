# v0.8.0 Release Readiness

Date: 2026-09-19

## Approved Policy

The owner chose one-time consent during interactive setup, not default-on startup.
Consent is recorded in the MCP client's environment configuration; no global
consent file, installation ID or user tracking is introduced. Setup defaults to
No, scripted setup supports `--telemetry=on|off`, and explicit opt-outs plus
aggregate privacy suppress collection. The maintainer endpoint is supplied by
setup after consent. Failed setup never sends an event.

The owner authorized commit, push and npm publication after verification, and
collector activation for consenting clients at release. Existing Desktop settings
are not changed by release preparation. Three pre-existing roadmap edits remain
outside the release commits.

## Verification

- 870 client tests across 47 files; line coverage 96.30% overall, API 98.85%,
  auth 98.29%. Real readline Yes/No/blank and real setup dispatcher paths covered.
- 77 collector/dashboard tests across five files, including real local Worker/D1,
  row-preserving migration and Access JWT failure cases.
- Root and collector lint, types, formatting and builds pass. Root runtime audit
  and full collector audit are clean; three known moderate dev-only Vitest
  advisory entries remain. No forced major dependency upgrade.
- npm pack and publish dry-runs: 187 files, approximately 155 KB packed. Required
  executable/types/telemetry/setup assets present. Collector, dashboard, production
  configurations and token files excluded; client runtime dependencies unchanged.
- Live synthetic sender deliveries, manual Desktop events and owner dashboard
  login verified earlier. Synthetic counts removed at the owner's request; six
  real Desktop events preserved. No new successful synthetic ingestion for release.
- Live missing-DB-binding check returned empty no-store 503; restored the original
  collector binding and disabled state in finally. Before/after D1 rows identical.
- Responsive dashboard verified at 1440/390/320 pixels with filtering, empty/error
  states and nonblank chart pixels. Public requests redirect to Access login.

## Review

Independent reviews identified and corrected setup sending before effective
consent, invalid optional endpoints blocking setup, and failure to persist shell
opt-outs over saved Desktop opt-in. Regression tests passed for every fix.
Final scoped follow-up verdict: APPROVE. No outstanding introduced-code blocker.

## Release and Rollback

GitHub CI must pass client Node 20/22 and collector/dashboard Node 22 checks
before merge/tag. Publish only the reviewed release commit. Enable the collector
using the approved production configuration after those gates pass; verify
readiness with rejected requests so real metrics remain uncontaminated.

Roll back ingestion by setting COLLECTION_ENABLED=0 and redeploying; preserve
the database. Clients can set WHOOP_MCP_TELEMETRY=0 or DO_NOT_TRACK=1 and restart.
No WHOOP token migration or authentication-flow change is part of this release.
The earlier workout-call errors remain a separate investigation: the authorized
read-only diagnostic returned 401, without enough evidence to attribute the
original failures to authentication or response validation.