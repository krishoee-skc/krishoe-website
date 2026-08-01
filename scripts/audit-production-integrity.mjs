import pg from "pg";
import { postgresConnectionOptions } from "./postgres-connection-options.mjs";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("POSTGRES_URL or DATABASE_URL is required.");
}

const client = new pg.Client(postgresConnectionOptions(connectionString));

try {
  await client.connect();
  const result = await client.query(`
    SELECT
      (SELECT count(*) FROM production_work_entries entries
       LEFT JOIN hr_employees employees ON employees.id = entries.employee_id
       WHERE employees.id IS NULL) AS orphan_work_entries,
      (SELECT count(*) FROM production_work_orders orders
       WHERE orders.status = 'Completed'
         AND NOT EXISTS (
           SELECT 1 FROM production_qc_postings qc
           WHERE qc.work_order_id = orders.id AND qc.reversed_at IS NULL
         )) AS completed_without_qc,
      (SELECT count(*) FROM production_qc_postings qc
       LEFT JOIN stock_movements movements ON movements.id = qc.stock_movement_id
       WHERE qc.reversed_at IS NULL AND movements.id IS NULL) AS broken_qc_stock_links,
      (SELECT count(*) FROM (
         SELECT source_submission_key FROM production_work_entries
         WHERE source_submission_key IS NOT NULL
         GROUP BY source_submission_key HAVING count(*) > 1
       ) duplicates) AS duplicate_submission_keys
  `);
  const counts = Object.fromEntries(
    Object.entries(result.rows[0]).map(([key, value]) => [key, Number(value)]),
  );
  const ok = Object.values(counts).every((value) => value === 0);
  console.log(JSON.stringify({ ok, counts }, null, 2));
  if (!ok) process.exitCode = 1;
} finally {
  await client.end();
}
