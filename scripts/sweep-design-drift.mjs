/**
 * The catalog sweep the owner asked for, after "bag open" and "T bag open"
 * turned out to be one shoe kept in two piles — a split that cost a sale,
 * because the shop apologised for a pair it actually had.
 *
 * Reads every design name on record, in the catalog and in ready stock, and
 * prints the pairs close enough to be worth a second look. It changes nothing.
 * Whether two names are one shoe is the owner's call, and the rule for acting
 * on the answer is unchanged: audit the movements, bills and orders first, then
 * merge onto the name being kept — never blind-delete.
 *
 * The same check runs live on /admin/stock. This is for looking at the whole
 * catalog at once.
 *
 *   node --env-file=.env.local scripts/sweep-design-drift.mjs
 */
import pg from "pg";
import { postgresConnectionOptions } from "./postgres-connection-options.mjs";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("POSTGRES_URL or DATABASE_URL is required.");
}

// Mirrors lib/design-name.ts — deliberately not clever: case and runs of
// spaces only, so two genuinely different spellings stay different designs.
const designKey = (value) => (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
const words = (value) => designKey(value).split(" ").filter(Boolean);
const lettersOnly = (value) => designKey(value).replace(/[^a-z0-9ऀ-ॿ]/g, "");

function containsAsWords(outer, inner) {
  if (inner.length === 0 || inner.length >= outer.length) return false;
  for (let start = 0; start + inner.length <= outer.length; start += 1) {
    if (inner.every((word, index) => outer[start + index] === word)) return true;
  }
  return false;
}

function sameWordsReordered(left, right) {
  if (left.length !== right.length || left.length < 2) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((word, index) => word === b[index]);
}

function driftReason(left, right) {
  const l = words(left);
  const r = words(right);
  if (designKey(left) === designKey(right)) return null;
  if (l.length === 0 || r.length === 0) return null;
  if (containsAsWords(l, r) || containsAsWords(r, l)) return "one name contains the other";
  if (sameWordsReordered(l, r)) return "same words, different order";
  const letters = lettersOnly(left);
  if (letters.length >= 4 && letters === lettersOnly(right)) return "same letters, spaced differently";
  return null;
}

const client = new pg.Client(postgresConnectionOptions(connectionString));

try {
  await client.connect();

  const { rows: catalog } = await client.query(
    `SELECT name, COALESCE(stock, 0) AS pairs FROM products WHERE status = 'Active'`,
  );
  const { rows: pools } = await client.query(
    `SELECT design AS name, COALESCE(SUM(stock_pairs), 0) AS pairs
       FROM finished_stock GROUP BY design`,
  );

  const byKey = new Map();
  for (const [rows, where] of [
    [catalog, "catalog"],
    [pools, "ready stock"],
  ]) {
    for (const row of rows) {
      const key = designKey(row.name);
      if (!key) continue;
      const current = byKey.get(key) ?? { name: String(row.name).trim(), where, pairs: 0 };
      current.pairs += Math.max(0, Number(row.pairs) || 0);
      byKey.set(key, current);
    }
  }

  const entries = [...byKey.values()];
  console.log(`${catalog.length} active products, ${pools.length} ready-stock designs, ${entries.length} distinct names.\n`);

  const found = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const reason = driftReason(entries[i].name, entries[j].name);
      if (reason) {
        found.push({
          left: entries[i],
          right: entries[j],
          reason,
          pairs: entries[i].pairs + entries[j].pairs,
        });
      }
    }
  }
  found.sort((a, b) => b.pairs - a.pairs);

  if (found.length === 0) {
    console.log("No two names look like one shoe. The books read as one set.");
  } else {
    console.log(`${found.length} pair(s) worth a second look, most pairs first:\n`);
    for (const row of found) {
      console.log(`  "${row.left.name}" (${row.left.pairs} pairs, ${row.left.where})`);
      console.log(`  "${row.right.name}" (${row.right.pairs} pairs, ${row.right.where})`);
      console.log(`     ${row.reason} — ${row.pairs} pairs at stake\n`);
    }
    console.log("Nothing was changed. Decide each one, then merge onto the name you keep.");
  }

  console.log("\nEvery distinct design name on record:");
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`  ${entry.name.padEnd(32)} ${String(entry.pairs).padStart(5)} pairs  (${entry.where})`);
  }
} finally {
  await client.end();
}
