# Privacy and Data Handling

[Back to README](../README.md)

## Structured Results And Privacy

All tools advertise `outputSchema` and return validated `structuredContent` alongside
equivalent JSON text for older clients. Provider bodies and internal error details
are not returned in tool or resource errors.

Set `WHOOP_MCP_PRIVACY_MODE=aggregate` in the server process environment to expose
only `get_weekly_summary`, `compare_periods`, `get_trend`, `get_baselines`, and
`get_sleep_debt`. Per-record arrays, latest observations, standing debt, identity
fields and exact activity timestamps are omitted. Period bounds are date-only.
Raw resources and all five existing prompts are unavailable in this mode because
their workflows require raw tools/resources. Tool arguments cannot override the policy.

The default is `standard`, retaining all 16 tools, four resources and five prompts.
The standard-mode [resource and prompt lists](tools.md#resources) do not apply
to aggregate mode. To enable aggregation in a client configuration, add
`"WHOOP_MCP_PRIVACY_MODE": "aggregate"` to the server's existing `env` object.
Restart and reconnect after changing the process policy. Aggregate mode minimizes
disclosure; it is not anonymization, does not erase previously shared data, and
still sends health aggregates to the assistant provider.

`get_today`, `get_baselines`, and `get_sleep_debt` use recorded offsets for local-day
attribution. Existing calendar and weekly-summary grouping remains UTC for compatibility.
An offset is not a timezone database and cannot reconstruct within-sleep DST changes.

## Privacy notes for analytical tools

The analytical tools — `get_weekly_summary`, `get_trend`, `compare_periods`,
`get_baselines`, and `get_sleep_debt` — return statistical summaries derived from
your underlying recovery / sleep / cycle / workout records. No new health
data is exposed beyond what the per-record collection tools already return
(`get_recovery_collection`, `get_sleep_collection`, etc.), but the
aggregated form is more concentrated and easier to scan over time. In
particular, the `anomalies` array returned by `get_trend` flags days that
deviate from your personal baseline — such days may correlate with
illness, injury, travel, or lifestyle changes.

If you connect this MCP server to a remote AI assistant (rather than a
local one), be aware that those summaries will be sent to that assistant
in the same way any other tool result is. Health data flows between WHOOP,
your local or hosted MCP process, and the assistant provider you configure.
That provider's retention and usage terms apply independently. Telemetry is off
by default; [optional telemetry](telemetry.md) sends only explicitly opted-in usage metadata, never tool
arguments, results, or health data.
