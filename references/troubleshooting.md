# Diagnostics and Troubleshooting

[Back to README](../README.md)

## Local Diagnostics

For a local build:

```sh
npm ci --ignore-scripts
npm run build
node dist/index.js doctor --json
```

For the published release:

```bash
npx -y whoop-ai-mcp@latest doctor --json
npx -y whoop-ai-mcp@latest telemetry status
```

Checks runtime, configuration presence, privacy/transport settings and token-file
metadata without reading token contents, calling WHOOP, launching OAuth or writing
files. Exit codes: 0 = locally ready, 1 = remediation needed, 2 = invalid arguments.
Token validity and granted scopes remain unknown; `setup --verify` is the explicit
live check. POSIX private permissions are checked; Windows ACL privacy is not verified.
`telemetry status` reports configuration only, not delivery or collector health.

---

## Troubleshooting

### "Missing required environment variable: WHOOP_CLIENT_ID"

Your WHOOP credentials aren't set. Add them to your Claude Desktop config or set them as environment variables. See [Configuration](installation.md#configuration).

### "Network error: Unable to reach the WHOOP API"

Check your internet connection. The WHOOP API must be reachable at `https://api.prod.whoop.com`.

### "WHOOP API returned 429"

WHOOP rate-limited the request. The client allows three retries after the initial
request (up to four attempts), honoring usable `Retry-After` headers or applying
exponential backoff. Reduce request frequency or the queried date range.

### "WHOOP API returned 401"

WHOOP rejected the access token, which may be expired or revoked. The server
attempts one refresh and retry. Check credentials/scopes and run setup verification
with the same configuration. If a fresh browser grant is needed, stop the server
and move its token file to a private backup before restarting; never share it:

```bash
mv ~/.whoop-mcp/tokens.json ~/.whoop-mcp/tokens.json.backup
```

### Browser doesn't open during authentication

If the browser doesn't open automatically, check the terminal output for the authorization URL and open it manually.

`WHOOP_REDIRECT_URI` is optional and defaults to `http://localhost:3000/callback`.
When set, it must be an HTTP loopback URL using `localhost`, `127.0.0.1`, or
`[::1]`, without credentials, a query string, or a fragment. Register the exact
URL with your WHOOP Developer App.

### Output contract error

A provider payload failed the tool's output schema. This differs from a 401 or
an empty collection. Report the tool name, package version and sanitized error;
do not post health records or raw responses. A telemetry error outcome does not
identify the underlying cause.

### Missing tools, resources or prompts

Fully quit and reopen your assistant after configuration changes. Confirm Node/npm
are available to its process; an absolute executable path may be needed. Aggregate
mode intentionally hides raw tools, resources and prompts. Resource/template
support also varies by client. Check an actual tool-use card, not just chat text.

### Telemetry is off or no event appears

Run `telemetry status` in the same environment as the server. Explicit opt-out,
`DO_NOT_TRACK=1`, aggregate privacy or invalid/missing settings disable sending.
Restart after saving consent. Delivery has a 500 ms deadline and no retries;
a missing event does not mean a WHOOP request failed. The hosted dashboard is
maintainer-only, not a public per-user portal.

## Testing with MCP Inspector

Use [MCP Inspector](https://github.com/modelcontextprotocol/inspector) for an
explicit live integration check. Export credentials privately first, then run:

```bash
npx @modelcontextprotocol/inspector npx -y whoop-ai-mcp@latest
```

Open the authenticated URL printed by Inspector (usually on port 6274); do not
share its session token. For a local build, replace `npx -y whoop-ai-mcp@latest`
with `node dist/index.js`. Tool calls contact WHOOP and display real health data.
The screenshots below show historical integration evidence, not current results.

**OAuth grant access screen (first-run authorization):**

![WHOOP OAuth grant access](../images/Screenshot%202026-04-12%20at%202.40.55%E2%80%AFAM.png)

**Testing `get_profile` tool in MCP Inspector:**

![MCP Inspector — get_profile tool result](../images/Screenshot%202026-04-12%20at%202.43.02%E2%80%AFAM.png)
