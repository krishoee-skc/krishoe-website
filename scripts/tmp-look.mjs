import pg from "pg";
import { postgresConnectionOptions } from "./postgres-connection-options.mjs";
const pool = new pg.Pool(postgresConnectionOptions(process.env.DATABASE_URL));
const q = async (s)=> (await pool.query(s)).rows;
console.log("today's new work — what was actually saved:");
console.table(await q(`SELECT d.date::date, i.name AS item, d.stage, d.pairs_count AS pairs,
    d.color, d.size, d.rate_applied AS rate, d.amount_earned AS wage
  FROM factory_daily_work d LEFT JOIN factory_items i ON i.id=d.item_id
  WHERE d.date >= '2026-09-09' ORDER BY d.created_at`));
console.log("\nledger row — does it carry the item/colour/size?");
console.table(await q(`SELECT date::date, entry_type, work_pairs, amount_earned,
    source_work_id IS NOT NULL AS has_work_link, notes
  FROM factory_worker_ledger WHERE date >= '2026-09-09' ORDER BY created_at LIMIT 3`));
console.log("\nledger columns:");
console.log((await q(`SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) c
  FROM information_schema.columns WHERE table_name='factory_worker_ledger'`))[0].c);
await pool.end();
