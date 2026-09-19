import { z } from "zod";
import type { D1Database } from "@cloudflare/workers-types";
import { verifyOwner, type AccessSettings } from "./dashboard-auth.js";

export interface DashboardEnvironment extends AccessSettings {
  DB: Pick<D1Database, "prepare">;
}

export type DashboardAssets = Record<string, { body: string; type: string }>;

const filterSchema = z.strictObject({
  days: z.enum(["7", "30", "90"]).default("30"),
  kind: z.enum(["all", "command", "tool", "prompt"]).default("all"),
  version: z
    .string()
    .max(64)
    .regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)
    .optional(),
});
const rowSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  package_version: z.string().max(64),
  kind: z.enum(["command", "tool", "prompt"]),
  name: z.string().max(64),
  outcome: z.enum(["success", "error"]),
  count: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};

export async function dashboardResponse(
  request: Request,
  env: DashboardEnvironment,
  assets: DashboardAssets,
  authenticate: (request: Request, settings: AccessSettings) => Promise<boolean> = verifyOwner
): Promise<Response> {
  if (!(await authenticate(request, env))) return new Response(null, { status: 403, headers });
  if (request.method !== "GET") return new Response(null, { status: 405, headers });
  const url = new URL(request.url);
  if (url.pathname !== "/api/metrics") {
    const asset = Object.hasOwn(assets, url.pathname) ? assets[url.pathname] : undefined;
    return asset
      ? new Response(asset.body, { headers: { ...headers, "Content-Type": asset.type } })
      : new Response(null, { status: 404, headers });
  }
  const filters = filterSchema.safeParse(Object.fromEntries(url.searchParams));
  if (
    !filters.success ||
    [...url.searchParams.keys()].some((key) => url.searchParams.getAll(key).length !== 1)
  ) {
    return new Response(null, { status: 400, headers });
  }
  const { days, kind, version } = filters.data;
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - Number(days) + 1);
  const startDay = start.toISOString().slice(0, 10);
  const endDay = end.toISOString().slice(0, 10);
  try {
    const result = await env.DB.prepare(
      `SELECT day, package_version, kind, name, outcome, count FROM daily_counts
       WHERE day >= ?1 AND day <= ?2 AND (?3 = 'all' OR kind = ?3)
       AND (?4 = '' OR package_version = ?4)
       ORDER BY day DESC, package_version, kind, name, outcome LIMIT 5001`
    )
      .bind(startDay, endDay, kind, version ?? "")
      .all();
    if (!result.success) throw new Error("Read unavailable");
    const rows = z.array(rowSchema).parse(result.results);
    return Response.json(
      {
        start: startDay,
        end: endDay,
        days: Number(days),
        kind,
        users: null,
        truncated: rows.length > 5000,
        rows: rows.slice(0, 5000),
        generatedAt: new Date().toISOString(),
      },
      { headers }
    );
  } catch {
    return new Response(null, { status: 503, headers });
  }
}
