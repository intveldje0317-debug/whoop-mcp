import { readFileSync } from "node:fs";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { incrementAggregate } from "../src/storage.js";
import { worker } from "../src/worker.js";
import type { Aggregate } from "../src/collector.js";

const aggregate: Aggregate = {
  day: "2026-09-19",
  package_version: "0.8.0",
  kind: "tool",
  name: "get_today",
  outcome: "success",
  error_category: "none",
};

async function applyMigration(
  database: Awaited<ReturnType<Miniflare["getD1Database"]>>,
  name: string
): Promise<void> {
  const sql = readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8");
  await database.batch(
    sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => database.prepare(statement))
  );
}

describe("local D1 aggregate storage", () => {
  let runtime: Miniflare;
  let database: Awaited<ReturnType<Miniflare["getD1Database"]>>;

  beforeEach(async () => {
    runtime = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        script: "export default { fetch() { return new Response(null); } };",
        d1Databases: ["DB", "MIGRATION_DB"],
        compatibilityDate: "2026-09-15",
        cf: false,
        telemetry: { enabled: false },
      })
    );
    database = await runtime.getD1Database("DB");
    const schema = readFileSync(
      new URL("../migrations/0001-aggregates.sql", import.meta.url),
      "utf8"
    );
    await database.prepare(schema).run();
    await applyMigration(database, "0002-prompts.sql");
    await applyMigration(database, "0003-error-categories.sql");
  });

  afterEach(async () => {
    await runtime?.dispose();
  });

  it("atomically increments concurrent events without raw rows", async () => {
    await Promise.all(Array.from({ length: 40 }, () => incrementAggregate(database, aggregate)));
    const rows = await database.prepare("SELECT * FROM daily_counts").all();
    expect(rows.results).toEqual([{ ...aggregate, count: 40 }]);
    const columns = await database
      .prepare("PRAGMA table_info(daily_counts)")
      .all<{ name: string }>();
    expect(columns.results.map((column) => column.name)).toEqual([
      "day",
      "package_version",
      "kind",
      "name",
      "outcome",
      "error_category",
      "count",
    ]);
  });

  it("preserves existing counts and marks historical errors unknown", async () => {
    const migrationDatabase = await runtime.getD1Database("MIGRATION_DB");
    await applyMigration(migrationDatabase, "0001-aggregates.sql");
    await migrationDatabase
      .prepare("INSERT INTO daily_counts VALUES (?, ?, ?, ?, ?, ?)")
      .bind("2026-09-19", "0.8.0", "tool", "get_today", "error", 3)
      .run();
    await applyMigration(migrationDatabase, "0002-prompts.sql");
    await applyMigration(migrationDatabase, "0003-error-categories.sql");

    expect((await migrationDatabase.prepare("SELECT * FROM daily_counts").all()).results).toEqual([
      {
        day: "2026-09-19",
        package_version: "0.8.0",
        kind: "tool",
        name: "get_today",
        outcome: "error",
        error_category: "unknown",
        count: 3,
      },
    ]);
  });

  it("keeps daily, version, command and outcome dimensions separate", async () => {
    const aggregates: Aggregate[] = [
      aggregate,
      { ...aggregate, day: "2026-09-20" },
      { ...aggregate, package_version: "0.8.1" },
      { ...aggregate, kind: "command", name: "serve" },
      { ...aggregate, outcome: "error", error_category: "unknown" },
      { ...aggregate, outcome: "error", error_category: "api_rate_limit" },
    ];
    await Promise.all(aggregates.map((row) => incrementAggregate(database, row)));
    const rows = await database.prepare("SELECT * FROM daily_counts").all();
    expect(rows.results).toHaveLength(6);
    expect(rows.results).toEqual(
      expect.arrayContaining(aggregates.map((row) => ({ ...row, count: 1 })))
    );
  });

  it("wires ingestion without using IP or user-agent identifiers", async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    const response = await worker.fetch(
      new Request("https://collector.example/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.0.2.1",
          "User-Agent": "sensitive-agent",
        },
        body: JSON.stringify({
          schema_version: 1,
          package_version: "0.8.0",
          kind: "command",
          name: "serve",
          outcome: "success",
        }),
      }),
      { DB: database, RATE_LIMITER: { limit }, COLLECTION_ENABLED: "1" }
    );
    expect(response.status).toBe(204);
    expect(limit.mock.calls).toEqual([[{ key: "events" }]]);
    const row = await database.prepare("SELECT * FROM daily_counts").first();
    expect(row).toEqual({
      day: new Date().toISOString().slice(0, 10),
      package_version: "0.8.0",
      kind: "command",
      name: "serve",
      outcome: "success",
      error_category: "none",
      count: 1,
    });
  });

  it("is disabled unless explicitly enabled", async () => {
    const response = await worker.fetch(
      new Request("https://collector.example/events", {
        method: "POST",
      }),
      { DB: database, RATE_LIMITER: { limit: vi.fn() } }
    );
    expect(response.status).toBe(503);
    expect((await database.prepare("SELECT * FROM daily_counts").all()).results).toEqual([]);
  });
});
