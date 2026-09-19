import type { D1Database } from "@cloudflare/workers-types";
import type { Aggregate } from "./collector.js";

export async function incrementAggregate(
  database: Pick<D1Database, "prepare">,
  aggregate: Aggregate
): Promise<void> {
  const result = await database
    .prepare(
      `INSERT INTO daily_counts (day, package_version, kind, name, outcome, count)
       VALUES (?1, ?2, ?3, ?4, ?5, 1)
       ON CONFLICT (day, package_version, kind, name, outcome)
       DO UPDATE SET count = count + 1`
    )
    .bind(
      aggregate.day,
      aggregate.package_version,
      aggregate.kind,
      aggregate.name,
      aggregate.outcome
    )
    .run();
  if (!result.success) throw new Error("Aggregate write failed");
}
