import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const directory = fileURLToPath(new URL("..", import.meta.url));
const event = {
  schema_version: 1,
  package_version: "0.8.0",
  kind: "tool",
  name: "get_today",
  outcome: "success",
};

describe("built Worker", () => {
  let runtime: Miniflare | undefined;

  beforeAll(() => {
    execFileSync("node_modules/.bin/wrangler", ["deploy", "--dry-run", "--outdir", "build"], {
      cwd: directory,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      stdio: "pipe",
    });
  }, 30_000);

  afterEach(async () => {
    await runtime?.dispose();
    runtime = undefined;
  });

  async function start(
    enabled: string = "1"
  ): Promise<Awaited<ReturnType<Miniflare["getD1Database"]>>> {
    runtime = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        scriptPath: fileURLToPath(new URL("../build/index.js", import.meta.url)),
        compatibilityDate: "2026-09-15",
        cf: false,
        bindings: { COLLECTION_ENABLED: enabled },
        d1Databases: ["DB"],
        ratelimits: { RATE_LIMITER: { namespace_id: "1001", simple: { limit: 2, period: 60 } } },
        telemetry: { enabled: false },
        logRequests: false,
      })
    );
    const database = await runtime.getD1Database("DB");
    await database
      .prepare(readFileSync(new URL("../migrations/0001-aggregates.sql", import.meta.url), "utf8"))
      .run();
    for (const migrationName of ["0002-prompts.sql", "0003-error-categories.sql"]) {
      const migration = readFileSync(
        new URL(`../migrations/${migrationName}`, import.meta.url),
        "utf8"
      );
      await database.batch(
        migration
          .split(";")
          .map((statement) => statement.trim())
          .filter(Boolean)
          .map((statement) => database.prepare(statement))
      );
    }
    return database;
  }

  function send(body: unknown = event): ReturnType<Miniflare["dispatchFetch"]> {
    return runtime!.dispatchFetch("https://collector.example/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("ingests through the built entrypoint and throttles excess requests", async () => {
    const database = await start();
    expect((await send()).status).toBe(204);
    expect((await send()).status).toBe(204);
    expect((await send()).status).toBe(429);
    expect(await database.prepare("SELECT count FROM daily_counts").first("count")).toBe(2);
  });

  it("rejects invalid and oversized payloads without writes", async () => {
    const database = await start();
    expect((await send({ ...event, token: "private" })).status).toBe(400);
    expect((await send({ ...event, token: "x".repeat(1024) })).status).toBe(413);
    expect((await database.prepare("SELECT * FROM daily_counts").all()).results).toEqual([]);
  });

  it("returns only a generic failure when D1 fails", async () => {
    const database = await start();
    await database.prepare("DROP TABLE daily_counts").run();
    const response = await send();
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
  });

  it("does not write with the operational kill switch disabled", async () => {
    const database = await start("0");
    expect((await send()).status).toBe(503);
    expect((await database.prepare("SELECT * FROM daily_counts").all()).results).toEqual([]);
  });

  it("ships with collection, public routes, and observability disabled", () => {
    const config: unknown = JSON.parse(
      readFileSync(new URL("../wrangler.json", import.meta.url), "utf8")
    );
    expect(config).toMatchObject({
      workers_dev: false,
      preview_urls: false,
      send_metrics: false,
      logpush: false,
      vars: { COLLECTION_ENABLED: "0" },
      observability: {
        enabled: false,
        logs: { enabled: false, invocation_logs: false },
        traces: { enabled: false },
      },
    });
  });
});
