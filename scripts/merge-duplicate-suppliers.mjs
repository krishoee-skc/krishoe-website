// Merges supplier ledgers that are the same supplier typed twice.
//
// Nothing stopped two ledgers being created for one name, so a double-clicked
// "Add supplier" made two. Two rows split what the shop owes that supplier, and
// neither shows the real balance. A unique index now prevents it, but the index
// cannot be created while duplicates exist.
//
//   node scripts/merge-duplicate-suppliers.mjs            # dry run, changes nothing
//   node scripts/merge-duplicate-suppliers.mjs --confirm  # actually merges
//
// The oldest ledger of each name is kept. Any invoice or transaction pointing at
// a duplicate is repointed to it, the kept row's totals are recomputed from the
// transactions that now belong to it, and only then is the empty duplicate
// removed. Nothing is deleted that anything still refers to.
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const confirm = process.argv.includes("--confirm");

function databaseUrl() {
  const fromEnv = process.env.DATABASE_URL;

  if (fromEnv) {
    return fromEnv;
  }

  const env = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const match = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);

  if (!match) {
    throw new Error("DATABASE_URL not set and not found in .env.local");
  }

  return match[1];
}

// The same rule the app uses: case and runs of spaces are how one name gets
// typed twice, not how two suppliers differ.
const NAME_KEY = `lower(btrim(regexp_replace(supplier_name, '\\s+', ' ', 'g')))`;

const client = new pg.Client({ connectionString: databaseUrl() });
await client.connect();

console.log(confirm ? "MERGING\n" : "DRY RUN — nothing will be changed. Pass --confirm to merge.\n");

try {
  await client.query("BEGIN");

  const { rows: groups } = await client.query(`
    SELECT ${NAME_KEY} AS name_key,
           count(*)::int AS copies,
           min(created_at) AS first_seen
    FROM supplier_ledgers
    GROUP BY ${NAME_KEY}
    HAVING count(*) > 1
    ORDER BY 1
  `);

  if (groups.length === 0) {
    console.log("No duplicate suppliers. Nothing to do.");
    await client.query("ROLLBACK");
    await client.end();
    process.exit(0);
  }

  let removed = 0;

  for (const group of groups) {
    const { rows: ledgers } = await client.query(
      `
        SELECT id, supplier_name, phone, material_focus, balance_due, created_at
        FROM supplier_ledgers
        WHERE ${NAME_KEY} = $1
        ORDER BY created_at
      `,
      [group.name_key],
    );

    const keep = ledgers[0];
    const duplicates = ledgers.slice(1);

    console.log(`=== "${keep.supplier_name}": ${ledgers.length} ledgers ===`);
    console.table(
      ledgers.map((row) => ({
        id: row.id,
        keep: row.id === keep.id ? "KEEP (oldest)" : "merge into keep",
        balance_due: row.balance_due,
        created_at: row.created_at.toISOString(),
      })),
    );

    for (const duplicate of duplicates) {
      const { rows: invoices } = await client.query(
        `SELECT count(*)::int AS n FROM purchase_invoices WHERE supplier_ledger_id = $1`,
        [duplicate.id],
      );
      const { rows: transactions } = await client.query(
        `SELECT count(*)::int AS n FROM supplier_transactions WHERE supplier_ledger_id = $1`,
        [duplicate.id],
      );

      console.log(
        `  ${duplicate.id}: ${invoices[0].n} invoice(s), ${transactions[0].n} transaction(s) move to ${keep.id}`,
      );

      if (confirm) {
        await client.query(
          `UPDATE purchase_invoices SET supplier_ledger_id = $2, supplier_name = $3 WHERE supplier_ledger_id = $1`,
          [duplicate.id, keep.id, keep.supplier_name],
        );
        await client.query(
          `UPDATE supplier_transactions SET supplier_ledger_id = $2, supplier_name = $3 WHERE supplier_ledger_id = $1`,
          [duplicate.id, keep.id, keep.supplier_name],
        );
        // Keep a phone number or focus the duplicate had and the survivor did not.
        await client.query(
          `
            UPDATE supplier_ledgers
            SET phone = CASE WHEN btrim(phone) = '' THEN $2 ELSE phone END,
              material_focus = CASE WHEN btrim(material_focus) = '' THEN $3 ELSE material_focus END
            WHERE id = $1
          `,
          [keep.id, duplicate.phone, duplicate.material_focus],
        );
        await client.query(`DELETE FROM supplier_ledgers WHERE id = $1`, [duplicate.id]);
        removed += 1;
      }
    }

    if (confirm) {
      // Recompute from the transactions that now belong to the survivor rather
      // than adding the two rows' totals together, which would double anything
      // already counted.
      await client.query(
        `
          UPDATE supplier_ledgers l
          SET total_purchase = COALESCE(t.bills, 0),
            paid_amount = COALESCE(t.paid, 0),
            balance_due = GREATEST(0, COALESCE(t.bills, 0) - COALESCE(t.paid, 0)),
            last_transaction = COALESCE(t.last_at::date, l.last_transaction),
            updated_at = now()
          FROM (
            SELECT
              sum(amount) FILTER (WHERE type = 'Purchase Bill') AS bills,
              sum(amount) FILTER (WHERE type IN ('Cash Payment', 'Cheque Payment', 'Bank Payment')) AS paid,
              max(created_at) AS last_at
            FROM supplier_transactions
            WHERE supplier_ledger_id = $1
          ) t
          WHERE l.id = $1
        `,
        [keep.id],
      );
    }
  }

  if (confirm) {
    await client.query("COMMIT");
    console.log(`\nMerged and removed ${removed} duplicate ledger(s).`);
    console.log("Run npm run db:schema next to add the unique index that prevents this.");
  } else {
    await client.query("ROLLBACK");
    console.log(`\nWould merge ${groups.length} duplicated name(s). Re-run with --confirm to do it.`);
  }
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Rolled back, nothing changed:", error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
