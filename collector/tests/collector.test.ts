import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { handleEvent, type CollectorDependencies } from "../src/collector.js";

const event = {
  schema_version: 1,
  package_version: "0.8.0",
  kind: "tool",
  name: "get_today",
  outcome: "success",
};

function request(body: unknown): Request {
  return new Request("https://collector.example/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function dependencies(enabled = true): CollectorDependencies & {
  allowRequest: Mock<CollectorDependencies["allowRequest"]>;
  increment: Mock<CollectorDependencies["increment"]>;
} {
  return {
    enabled,
    allowRequest: vi.fn<CollectorDependencies["allowRequest"]>().mockResolvedValue(true),
    increment: vi.fn<CollectorDependencies["increment"]>().mockResolvedValue(undefined),
    now: () => new Date("2026-09-19T23:59:59.999Z"),
  };
}

describe("collector ingestion", () => {
  afterEach(() => vi.useRealTimers());

  it("stores only UTC day and aggregate dimensions for a valid event", async () => {
    const deps = dependencies();
    const response = await handleEvent(request(event), deps);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(deps.increment.mock.calls).toEqual([
      [
        {
          day: "2026-09-19",
          package_version: "0.8.0",
          kind: "tool",
          name: "get_today",
          outcome: "success",
          error_category: "none",
        },
      ],
    ]);
  });

  it("stores an allowlisted tool error category", async () => {
    const deps = dependencies();
    const response = await handleEvent(
      request({ ...event, outcome: "error", error_category: "api_rate_limit" }),
      deps
    );

    expect(response.status).toBe(204);
    expect(deps.increment).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "error", error_category: "api_rate_limit" })
    );
  });

  it("normalizes legacy tool errors to unknown", async () => {
    const deps = dependencies();
    expect((await handleEvent(request({ ...event, outcome: "error" }), deps)).status).toBe(204);
    expect(deps.increment).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "error", error_category: "unknown" })
    );
  });

  it.each([
    { ...event, user_id: "sensitive" },
    { ...event, arguments: { date: "sensitive" } },
    { ...event, schema_version: 2 },
    { ...event, name: "unknown_tool" },
    { ...event, kind: "command", name: "doctor" },
    { ...event, kind: "command", name: "get_today" },
    { ...event, package_version: "not-a-version" },
    { ...event, outcome: "sensitive-error-text" },
    { ...event, outcome: "error", error_category: "sensitive-error-text" },
    { ...event, error_category: "unexpected" },
    { ...event, kind: "command", name: "serve", outcome: "error", error_category: "unexpected" },
    null,
    [event],
  ])("rejects unsupported payloads without storage", async (body) => {
    const deps = dependencies();
    const response = await handleEvent(request(body), deps);

    expect(response.status).toBe(400);
    expect(deps.increment).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("sensitive");
  });

  it("does not ingest when the kill switch is off", async () => {
    const deps = dependencies(false);
    expect((await handleEvent(request(event), deps)).status).toBe(503);
    expect(deps.allowRequest).not.toHaveBeenCalled();
    expect(deps.increment).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", "/events", 405],
    ["OPTIONS", "/events", 405],
    ["POST", "/analytics", 404],
    ["POST", "/events?user_id=secret", 404],
  ] as const)("rejects %s %s", async (method, path, status) => {
    const deps = dependencies();
    const response = await handleEvent(
      new Request(`https://collector.example${path}`, { method }),
      deps
    );
    expect(response.status).toBe(status);
    expect(deps.increment).not.toHaveBeenCalled();
  });

  it.each([
    [{ "Content-Type": "text/plain" }, 415],
    [{ "Content-Type": "application/json", "Content-Encoding": "gzip" }, 415],
    [{ "Content-Type": "application/json", "Content-Length": "1025" }, 413],
    [{ "Content-Type": "application/json", "Content-Length": "bad" }, 400],
  ])("rejects invalid body headers", async (headers, status) => {
    const deps = dependencies();
    const response = await handleEvent(
      new Request("https://collector.example/events", {
        method: "POST",
        headers: headers as HeadersInit,
        body: JSON.stringify(event),
      }),
      deps
    );
    expect(response.status).toBe(status);
    expect(deps.increment).not.toHaveBeenCalled();
  });

  it.each([undefined, "1"])(
    "enforces the streaming byte limit despite length %s",
    async (length) => {
      const deps = dependencies();
      const cancel = vi.fn();
      const headers = new Headers({ "Content-Type": "application/json" });
      if (length) headers.set("Content-Length", length);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(" ".repeat(1024)));
          controller.enqueue(new TextEncoder().encode(JSON.stringify(event)));
        },
        cancel,
      });
      const incoming = new Request("https://collector.example/events", {
        method: "POST",
        headers,
        body: stream,
        duplex: "half",
      } as RequestInit);

      expect((await handleEvent(incoming, deps)).status).toBe(413);
      expect(cancel).toHaveBeenCalledOnce();
      expect(deps.increment).not.toHaveBeenCalled();
    }
  );

  it("bounds stalled body reads and cancels the stream", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const deps = dependencies();
    const incoming = new Request("https://collector.example/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: new ReadableStream({ cancel }),
      duplex: "half",
    } as RequestInit);
    const pending = handleEvent(incoming, deps);
    await vi.advanceTimersByTimeAsync(1000);
    expect((await pending).status).toBe(408);
    expect(cancel).toHaveBeenCalledOnce();
    expect(deps.increment).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without echoing request data", async () => {
    const deps = dependencies();
    const incoming = new Request("https://collector.example/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "sensitive",
    });
    const response = await handleEvent(incoming, deps);
    expect(response.status).toBe(400);
    expect(await response.text()).toBe("");
    expect(deps.increment).not.toHaveBeenCalled();
  });

  it("throttles before reading the payload or storing anything", async () => {
    const deps = dependencies();
    deps.allowRequest.mockResolvedValue(false);
    const incoming = request(event);
    const response = await handleEvent(incoming, deps);
    expect(response.status).toBe(429);
    expect(incoming.bodyUsed).toBe(false);
    expect(deps.increment).not.toHaveBeenCalled();
  });

  it.each(["allowRequest", "increment"] as const)("hides %s failures", async (operation) => {
    const deps = dependencies();
    deps[operation].mockRejectedValue(new Error("sensitive database details"));
    const response = await handleEvent(request(event), deps);
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
