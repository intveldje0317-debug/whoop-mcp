import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { readFileSync } from "node:fs";
import { verifyOwner } from "../src/dashboard-auth.js";
import { dashboardResponse } from "../src/dashboard.js";

const settings = {
  ACCESS_TEAM_DOMAIN: "https://owner.cloudflareaccess.com",
  ACCESS_AUD: "dashboard-audience",
  OWNER_EMAIL: "owner@example.com",
};

describe("dashboard authorization", () => {
  it.each([
    "valid",
    "missing",
    "forged",
    "expired",
    "audience",
    "issuer",
    "other-owner",
    "missing-config",
  ])("validates %s access without trusting header email", async (scenario) => {
    const keys = await generateKeyPair("RS256");
    const jwk = await exportJWK(keys.publicKey);
    const resolve = createLocalJWKSet({ keys: [{ ...jwk, kid: "test", alg: "RS256" }] });
    const token = await new SignJWT({
      email: scenario === "other-owner" ? "attacker@example.com" : settings.OWNER_EMAIL,
    })
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuer(
        scenario === "issuer" ? "https://other.cloudflareaccess.com" : settings.ACCESS_TEAM_DOMAIN
      )
      .setAudience(scenario === "audience" ? "another-app" : settings.ACCESS_AUD)
      .setIssuedAt()
      .setExpirationTime(scenario === "expired" ? "-1h" : "1h")
      .sign(keys.privateKey);
    const request = new Request("https://dashboard.example/", {
      headers: {
        "Cf-Access-Jwt-Assertion":
          scenario === "missing" ? "" : scenario === "forged" ? "forged-token" : token,
        "Cf-Access-Authenticated-User-Email": settings.OWNER_EMAIL,
      },
    });
    expect(await verifyOwner(request, scenario === "missing-config" ? {} : settings, resolve)).toBe(
      scenario === "valid"
    );
  });
});

describe("dashboard reads", () => {
  let runtime: Miniflare | undefined;
  afterEach(async () => {
    await runtime?.dispose();
    runtime = undefined;
  });

  it("rejects unauthenticated reads and assets before accessing D1", async () => {
    const prepare = vi.fn();
    for (const path of ["/", "/api/metrics", "/app.js"]) {
      const response = await dashboardResponse(
        new Request(`https://dashboard.example${path}`),
        { DB: { prepare } },
        {}
      );
      expect(response.status).toBe(403);
    }
    expect(prepare).not.toHaveBeenCalled();
  });

  it.each([
    "days=365",
    "days=-1",
    "days=oops",
    "kind=people",
    "version=" + "x".repeat(65),
    "unknown=1",
  ])("rejects unsupported filters %s without D1 access", async (query) => {
    const prepare = vi.fn();
    const response = await dashboardResponse(
      new Request(`https://dashboard.example/api/metrics?${query}`),
      { DB: { prepare } },
      {},
      async () => true
    );
    expect(response.status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("reads only bounded aggregates and never counts people", async () => {
    runtime = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        script: "export default {fetch(){return new Response(null)}}",
        d1Databases: ["DB"],
        compatibilityDate: "2026-09-15",
        cf: false,
        telemetry: { enabled: false },
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
    const day = new Date().toISOString().slice(0, 10);
    await database
      .prepare("INSERT INTO daily_counts VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(day, "0.8.0", "tool", "get_today", "error", "network", 3)
      .run();
    await database
      .prepare("INSERT INTO daily_counts VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind("2020-01-01", "0.7.0", "command", "serve", "success", "none", 5)
      .run();
    const response = await dashboardResponse(
      new Request("https://dashboard.example/api/metrics?days=7&kind=tool"),
      { DB: database },
      {},
      async () => true
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const data = await response.json();
    expect(data.rows).toEqual([
      {
        day,
        package_version: "0.8.0",
        kind: "tool",
        name: "get_today",
        outcome: "error",
        error_category: "network",
        count: 3,
      },
    ]);
    expect(data.users).toBeNull();
    expect(data.truncated).toBe(false);
    expect((await database.prepare("SELECT * FROM daily_counts").all()).results).toHaveLength(2);
  });

  it("serves only known assets with restrictive security headers", async () => {
    const env = { DB: { prepare: vi.fn() } };
    const assets = { "/": { body: "<h1>WHOOP metrics</h1>", type: "text/html; charset=utf-8" } };
    const response = await dashboardResponse(
      new Request("https://dashboard.example/"),
      env,
      assets,
      async () => true
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(
      (
        await dashboardResponse(
          new Request("https://dashboard.example/private"),
          env,
          assets,
          async () => true
        )
      ).status
    ).toBe(404);
    expect(
      (
        await dashboardResponse(
          new Request("https://dashboard.example/api/metrics", { method: "POST" }),
          env,
          assets,
          async () => true
        )
      ).status
    ).toBe(405);
  });
});
