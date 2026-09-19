import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createWhoopServer } from "../../src/server.js";

describe("prompt telemetry", () => {
  it.each(["standard", "aggregate", "delivery_failure"])(
    "records only safe template retrievals in %s mode",
    async (mode) => {
      const record = vi.fn(() => {
        if (mode === "delivery_failure") throw new Error("unavailable collector");
      });
      const get = vi.fn();
      const { server } = createWhoopServer(
        { get },
        {
          privacyMode: mode === "aggregate" ? "aggregate" : "standard",
          telemetry: { record },
        }
      );
      const client = new Client({ name: "prompt-telemetry-test", version: "1" });
      const [local, remote] = InMemoryTransport.createLinkedPair();
      await Promise.all([server.connect(remote), client.connect(local)]);
      try {
        if (mode === "aggregate") {
          await expect(client.listPrompts()).rejects.toThrow();
          expect(record).not.toHaveBeenCalled();
          return;
        }
        const listed = await client.listPrompts();
        expect(record).not.toHaveBeenCalled();
        await expect(client.getPrompt({ name: "unknown_prompt" })).rejects.toThrow();
        expect(record).not.toHaveBeenCalled();
        for (const prompt of listed.prompts) {
          const result = await client.getPrompt({ name: prompt.name, arguments: {} });
          expect(result.messages.length).toBeGreaterThan(0);
        }
        await Promise.resolve();
        expect(record.mock.calls).toEqual(
          listed.prompts.map((prompt) => [
            {
              kind: "prompt",
              name: prompt.name,
              outcome: "success",
            },
          ])
        );
        expect(get).not.toHaveBeenCalled();
      } finally {
        await client.close();
        await server.close();
      }
    }
  );
});
