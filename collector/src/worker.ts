import type { D1Database, RateLimit } from "@cloudflare/workers-types";
import { handleEvent } from "./collector.js";
import { incrementAggregate } from "./storage.js";

export interface CollectorEnvironment {
  DB: Pick<D1Database, "prepare">;
  RATE_LIMITER: Pick<RateLimit, "limit">;
  COLLECTION_ENABLED?: string;
}

export const worker = {
  fetch(request: Request, env: CollectorEnvironment): Promise<Response> {
    return handleEvent(request, {
      enabled: env.COLLECTION_ENABLED === "1",
      allowRequest: async () => (await env.RATE_LIMITER.limit({ key: "events" })).success,
      increment: (aggregate) => incrementAggregate(env.DB, aggregate),
      now: () => new Date(),
    });
  },
};
