import { z } from "zod";

const fields = {
  schema_version: z.literal(1),
  package_version: z
    .string()
    .max(64)
    .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/),
  outcome: z.enum(["success", "error"]),
};

const eventSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...fields,
    kind: z.literal("prompt"),
    name: z.enum([
      "weekly_health_review",
      "sleep_analysis",
      "recovery_trend",
      "workout_recap",
      "health_check",
    ]),
  }),
  z.strictObject({
    ...fields,
    kind: z.literal("command"),
    name: z.enum(["serve", "setup"]),
  }),
  z.strictObject({
    ...fields,
    kind: z.literal("tool"),
    name: z.enum([
      "get_profile",
      "get_body_measurement",
      "get_recovery_collection",
      "get_sleep_collection",
      "get_workout_collection",
      "get_cycle_collection",
      "get_sleep_by_id",
      "get_workout_by_id",
      "get_cycle_by_id",
      "get_weekly_summary",
      "compare_periods",
      "get_trend",
      "get_today",
      "get_calendar",
      "get_baselines",
      "get_sleep_debt",
    ]),
  }),
]);

type Event = z.infer<typeof eventSchema>;

export interface Aggregate {
  day: string;
  package_version: string;
  kind: Event["kind"];
  name: Event["name"];
  outcome: Event["outcome"];
}

export interface CollectorDependencies {
  enabled: boolean;
  allowRequest: () => Promise<boolean>;
  increment: (aggregate: Aggregate) => Promise<void>;
  now: () => Date;
}

const MAX_BODY_BYTES = 1024;

class RequestError extends Error {
  constructor(readonly status: number) {
    super("Invalid request");
  }
}

async function readEvent(request: Request): Promise<Event> {
  if (!request.body) throw new RequestError(400);
  const reader = request.body.getReader();
  const bytes = new Uint8Array(MAX_BODY_BYTES);
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new RequestError(408)), 1000);
  });

  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), deadline]);
      if (chunk.done) break;
      if (size + chunk.value.byteLength > MAX_BODY_BYTES) throw new RequestError(413);
      bytes.set(chunk.value, size);
      size += chunk.value.byteLength;
    }
    const body = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, size));
    return eventSchema.parse(JSON.parse(body));
  } finally {
    clearTimeout(timer);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function respond(status: number): Response {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function handleEvent(
  request: Request,
  dependencies: CollectorDependencies
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== "/events" || url.search) return respond(404);
  if (request.method !== "POST") return respond(405);
  if (!dependencies.enabled) return respond(503);
  const contentType = request.headers.get("Content-Type") ?? "";
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) return respond(415);
  if (request.headers.has("Content-Encoding")) return respond(415);
  const length = request.headers.get("Content-Length");
  if (length !== null) {
    if (!/^\d+$/.test(length)) return respond(400);
    if (Number(length) > MAX_BODY_BYTES) return respond(413);
  }

  try {
    if (!(await dependencies.allowRequest())) return respond(429);
  } catch {
    return respond(503);
  }

  let event: Event;
  try {
    event = await readEvent(request);
  } catch (error) {
    return respond(error instanceof RequestError ? error.status : 400);
  }

  try {
    await dependencies.increment({
      day: dependencies.now().toISOString().slice(0, 10),
      package_version: event.package_version,
      kind: event.kind,
      name: event.name,
      outcome: event.outcome,
    });
    return respond(204);
  } catch {
    return respond(503);
  }
}
