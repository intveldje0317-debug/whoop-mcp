import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../../src/index.js";

describe("real setup dispatcher consent", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(["off", "on", "default", "failure"])(
    "honors effective setup consent: %s",
    async (choice) => {
      vi.stubEnv("WHOOP_CLIENT_ID", "synthetic-id");
      vi.stubEnv("WHOOP_CLIENT_SECRET", "synthetic-secret");
      vi.stubEnv("WHOOP_MCP_TELEMETRY", choice === "off" || choice === "failure" ? "1" : undefined);
      vi.stubEnv("WHOOP_MCP_TELEMETRY_ENDPOINT", "https://collector.example/events");
      vi.stubEnv("DO_NOT_TRACK", undefined);
      vi.stubEnv("WHOOP_MCP_PRIVACY_MODE", undefined);
      const send = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      vi.stubGlobal("fetch", send);
      vi.spyOn(process.stdout, "write").mockReturnValue(true);
      vi.spyOn(console, "error").mockImplementation(() => {});
      const directory = await mkdtemp(join(tmpdir(), "whoop-setup-consent-"));
      try {
        const path = join(directory, "config.json");
        const args = ["setup", "--client=claude-desktop", `--config-path=${path}`];
        if (choice === "failure") args.push("--unknown");
        else if (choice !== "default") args.push(`--telemetry=${choice}`);
        expect(await runCli(args)).toBe(choice === "failure" ? 1 : 0);
        if (choice !== "failure") {
          const config = JSON.parse(await readFile(path, "utf8"));
          expect(config.mcpServers.whoop.env.WHOOP_MCP_TELEMETRY).toBe(choice === "on" ? "1" : "0");
        }
        expect(send).toHaveBeenCalledTimes(choice === "on" ? 1 : 0);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  );
});
