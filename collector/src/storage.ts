import type { D1Database } from "@cloudflare/workers-types";
import type { Aggregate } from "./collector.js";

export async function incrementAggregate(
  database: Pick<D1Database, "prepare">,
  aggregate: Aggregate
): Promise<void> {
  const result = await database
    .prepare(
      `INSERT INTO daily_counts (day, package_version, kind, name, outcome, error_category, count)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)
       ON CONFLICT (day, package_version, kind, name, outcome, error_category)
       DO UPDATE SET count = count + 1`
    )
    .bind(
      aggregate.day,
      aggregate.package_version,
      aggregate.kind,
      aggregate.name,
      aggregate.outcome,
      aggregate.error_category
    )
    .run();
  if (!result.success) throw new Error("Aggregate write failed");
}
