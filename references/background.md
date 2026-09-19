# Background and Walkthrough

[Back to README](../README.md)

## Ecosystem and Scope

The server provides 16 tools, four resources and five named templates in
standard mode. The MCP client needs only the SDK and Zod at runtime; no database
or hosted relay is required to read WHOOP data. The optional Cloudflare collector
and private dashboard are separate maintainer infrastructure, not npm client dependencies.

The [September feature scan](../docs/ideas/sota-feature-scan-2026-09-10.md) records
historical ecosystem research, not a current ranking or third-party security audit.
For current npm package listings, query the registry rather than relying on old
version comparisons:

```bash
curl -s 'https://registry.npmjs.org/-/v1/search?text=whoop%20mcp&size=20'
```

## 🎥 Video Walkthrough

This earlier walkthrough shows WHOOP app creation, Desktop configuration and
authorization. Use the [installation guide](installation.md) for current commands
and the [telemetry guide](telemetry.md) for consent details:

[![Watch the video](https://img.youtube.com/vi/2vwxEjctcWs/maxresdefault.jpg)](https://youtu.be/2vwxEjctcWs?si=ncIr0fmXT0MUarYL)

> The recording predates setup consent and the private usage dashboard.
