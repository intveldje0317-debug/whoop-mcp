import { afterEach, describe, expect, it, vi } from "vitest";
import { createTelemetry } from "../../src/telemetry/telemetry.js";

const enabledEnv = {
  WHOOP_MCP_TELEMETRY: "1",
  WHOOP_MCP_TELEMETRY_ENDPOINT: "https://collector.example/events",
};
const command = { kind: "command", name: "setup", outcome: "success" } as const;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("opt-in telemetry", () => {
  it.each([
    {},
    { WHOOP_MCP_TELEMETRY_ENDPOINT: enabledEnv.WHOOP_MCP_TELEMETRY_ENDPOINT },
    { WHOOP_MCP_TELEMETRY: "1" },
    { ...enabledEnv, WHOOP_MCP_TELEMETRY: "true" },
    { ...enabledEnv, DO_NOT_TRACK: "1" },
    { ...enabledEnv, WHOOP_MCP_PRIVACY_MODE: "aggregate" },
    { ...enabledEnv, WHOOP_MCP_PRIVACY_MODE: "invalid" },
  ])("does not send without effective consent: %j", async (env) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const telemetry = createTelemetry(env);
    telemetry.record(command);
    await telemetry.flush();
    expect(telemetry.status.enabled).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "not a url",
    "http://collector.example/events",
    "https://user:secret@collector.example/events",
    "https://collector.example/events?token=secret",
    "https://collector.example/events#secret",
  ])("disables invalid endpoint %s without throwing", async (endpoint) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const telemetry = createTelemetry({ ...enabledEnv, WHOOP_MCP_TELEMETRY_ENDPOINT: endpoint });
    expect(telemetry.status).toEqual({ enabled: false, reason: "invalid_endpoint" });
    telemetry.record(command);
    await telemetry.flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends only the versioned allowlisted payload without redirects or credentials", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue({ body: { cancel } });
    vi.stubGlobal("fetch", fetchMock);
    const telemetry = createTelemetry(enabledEnv);
    expect(telemetry.status).toEqual({ enabled: true, reason: "enabled" });
    telemetry.record(command);
    await telemetry.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe(enabledEnv.WHOOP_MCP_TELEMETRY_ENDPOINT);
    expect(options).toMatchObject({
      method: "POST",
      redirect: "error",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(options.body as string)).toEqual({
      schema_version: 1,
      package_version: expect.stringMatching(/^\d+\.\d+\.\d+/),
      ...command,
    });
    expect(cancel).toHaveBeenCalled();
  });

  it("sends an allowlisted category for tool errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ body: null });
    vi.stubGlobal("fetch", fetchMock);
    const telemetry = createTelemetry(enabledEnv);

    telemetry.record({
      kind: "tool",
      name: "get_workout_collection",
      outcome: "error",
      error_category: "output_contract",
    });
    await telemetry.flush();

    const [, options] = fetchMock.mock.calls[0]! as [string, RequestInit];
    expect(JSON.parse(options.body as string)).toMatchObject({
      kind: "tool",
      name: "get_workout_collection",
      outcome: "error",
      error_category: "output_contract",
    });
  });

  it("rejects unexpected fields, arbitrary names, and diagnostic events", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const telemetry = createTelemetry(enabledEnv);
    for (const event of [
      { ...command, arguments: { token: "secret" } },
      { ...command, name: "doctor" },
      { ...command, name: "telemetry" },
      { ...command, name: "private-command" },
      { kind: "tool", name: "private-tool", outcome: "success" },
      { ...command, outcome: "private-error" },
      { kind: "tool", name: "get_today", outcome: "error", error_category: "raw message" },
      { kind: "tool", name: "get_today", outcome: "success", error_category: "unexpected" },
      { ...command, error_category: "unexpected" },
    ])
      telemetry.record(event);
    await telemetry.flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("absorbs network errors and synchronous fetch failures", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("secret"))
      .mockImplementationOnce(() => {
        throw new Error("secret");
      });
    vi.stubGlobal("fetch", fetchMock);
    const telemetry = createTelemetry(enabledEnv);
    telemetry.record(command);
    await expect(telemetry.flush()).resolves.toBeUndefined();
    telemetry.record(command);
    await expect(telemetry.flush()).resolves.toBeUndefined();
  });

  it("bounds pending sends and aborts stalled requests", async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, options: RequestInit) => {
        const signal = options.signal as AbortSignal;
        signals.push(signal);
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        });
      })
    );
    const telemetry = createTelemetry(enabledEnv);
    for (let count = 0; count < 20; count++) telemetry.record(command);
    expect(signals).toHaveLength(8);
    await telemetry.flush();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    telemetry.record(command);
    expect(signals).toHaveLength(9);
    await telemetry.flush();
  });
});
