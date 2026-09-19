<h1 align="center">WHOOP MCP</h1>

<p align="center">
	<strong>Your WHOOP data. A conversation away.</strong><br>
	Recovery, sleep, HRV and training trends in the AI assistant you already use.
</p>

<p align="center">
	<a href="https://www.npmjs.com/package/whoop-ai-mcp"><img src="https://img.shields.io/npm/v/whoop-ai-mcp?color=16803c" alt="Latest npm version"></a>
	<a href="https://www.npmjs.com/package/whoop-ai-mcp"><img src="https://img.shields.io/npm/dm/whoop-ai-mcp?color=087e8b" alt="Monthly npm downloads"></a>
	<a href="https://github.com/shashankswe2020-ux/whoop-mcp/stargazers"><img src="https://img.shields.io/github/stars/shashankswe2020-ux/whoop-mcp?style=flat&color=d49b16" alt="GitHub stars"></a>
	<a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-555" alt="MIT license"></a>
</p>

<p align="center">
	<a href="#quickstart"><strong>Try it now</strong></a> ·
	<a href="https://youtu.be/2vwxEjctcWs">Watch the walkthrough</a> ·
	<a href="#documentation">Explore the docs</a> ·
	<a href="https://github.com/shashankswe2020-ux/whoop-mcp/releases/latest">Latest release</a>
</p>

**whoop-ai-mcp** is a read-only [WHOOP](https://www.whoop.com/)
[MCP server](https://modelcontextprotocol.io/) for Claude Desktop, Claude Code,
Codex and GitHub Copilot. Ask about your recovery, compare weeks of sleep, or
explore your personal baseline without exporting and assembling the data yourself.

<p align="center">
	<img src="images/Screenshot%202026-05-30%20at%201.36.39%E2%80%AFPM.png" width="880" alt="WHOOP MCP in Claude Desktop: a weekly health review with recovery, HRV, sleep and workout summaries alongside the MCP prompt">
	<br><sub>Earlier Claude Desktop demo. The assistant creates the presentation; this server supplies the data. Results and layout vary.</sub>
</p>

<p align="center"><strong>16 read-only tools · 4 resources · 5 prompt templates</strong><br><sub>Standard mode. Client support for resources, prompts and remote connections varies.</sub></p>

## Ask More of Your WHOOP Data

| Start with a question | Explore |
|-----------------------|---------|
| **"How am I doing today?"** | Recovery, primary sleep, strain and your latest workout, with missing-data flags. |
| **"Is my HRV unusual for me?"** | Personal baseline distributions, percentiles and sample counts. |
| **"How did my sleep change this month?"** | Trends, period comparisons, observed sleep deficits and consistency. |
| **"Give me my weekly health review."** | Recovery, sleep and training summaries through one conversation. |

Statistics describe your recorded history, not medical diagnoses or predictions.

## Quickstart

You need Node.js 20+, an active WHOOP membership, and a
[WHOOP Developer App](https://developer.whoop.com) with the redirect URL
`http://localhost:3000/callback`.

```bash
npx -y whoop-ai-mcp@latest setup --client=claude-desktop
```

**Set up. Authorize. Ask.** Enter your app credentials, then fully quit and reopen
Claude Desktop. Authorize WHOOP in your browser on first server start and ask:

> **"Summarize my sleep and recovery this week."**

Optional telemetry defaults to **No**. No global npm installation is needed.

For Claude Code, Codex or Copilot, use `--client=claude-code`, `--client=codex` or
`--client=copilot`, then run the registration command setup prints.
[Full setup and configuration](references/installation.md).

## Your Data, Your Choice

**Read-only WHOOP access. Local by default. No hosted relay required.**

Health results reach the assistant provider you configure. Aggregate mode limits
disclosure to five summary tools; it is not anonymization. Usage telemetry is
off by default and requires consent; it never includes health data or chat text.
See [data handling](references/privacy.md) and [telemetry controls](references/telemetry.md).

<a id="configuration"></a>

## Documentation

[Setup guide](references/installation.md) · [Tool reference](references/tools.md)
· [Troubleshooting](references/troubleshooting.md)

<details>
<summary><strong>All reference guides</strong></summary>

| Guide | Contents |
|-------|----------|
| [Installation](references/installation.md) | Clients, manual configuration, environment variables and WHOOP authorization |
| [Tool reference](references/tools.md) | All tools, parameters, date expressions, resources, prompts and caching |
| [Privacy](references/privacy.md) | Structured results, aggregate mode and assistant-provider disclosure |
| [Telemetry](references/telemetry.md) | Consent, opt-out, event contract, retention and maintainer dashboard |
| [Troubleshooting](references/troubleshooting.md) | Local diagnostics, common errors and MCP Inspector |
| [Deployment](references/deployment.md) | Docker, cloud hosting and remote connector OAuth |
| [Development](references/development.md) | Tests, project structure and release workflow |
| [Background](references/background.md) | Ecosystem research and video walkthrough |

</details>

## Build With Us

Found a useful question, a missing workflow or an integration worth sharing?
[Open an issue](https://github.com/shashankswe2020-ux/whoop-mcp/issues) or
[contribute](CONTRIBUTING.md). A GitHub star helps others discover the project.

[Contributing](CONTRIBUTING.md) · [Report a bug](https://github.com/shashankswe2020-ux/whoop-mcp/issues)
· [Security policy](SECURITY.md) · [Code of Conduct](CODE_OF_CONDUCT.md)
· [Changelog](CHANGELOG.md)

Never include credentials or health records in public reports.

## License

[MIT](LICENSE). Unofficial project, not affiliated with WHOOP. Membership and API
access are separate from this package.
