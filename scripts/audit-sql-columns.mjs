/**
 * Every column named in a SELECT anywhere in the app, checked against the live
 * database.
 *
 * Written after dropping `admin_staff_accounts.employee_id`, which ten queries
 * in lib/admin-settings.ts still name — including the one the admin sign-in
 * reads. Nobody could log in. The table-level check added the same day would
 * not have caught it: the table was still there, only a column had gone.
 *
 *   node --env-file=.env.local scripts/audit-sql-columns.mjs
 *
 * Exits non-zero when a query names a column its table does not have.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { postgresConnectionOptions } from "./postgres-connection-options.mjs";

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", "backups"].includes(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx|mjs)$/.test(entry)) out.push(path.split("\\").join("/"));
  }
  return out;
}

/** Backtick strings that actually contain SQL. "FROM" is also an English word. */
function sqlStrings(source) {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  return [...withoutComments.matchAll(/`([^`]*)`/g)]
    .map((m) => m[1])
    .filter((text) => /\b(SELECT|INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM)\b/i.test(text));
}

const client = new Client(postgresConnectionOptions(process.env.DATABASE_URL));
await client.connect();

const { rows } = await client.query(
  `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
);
const columnsOf = new Map();
for (const row of rows) {
  if (!columnsOf.has(row.table_name)) columnsOf.set(row.table_name, new Set());
  columnsOf.get(row.table_name).add(row.column_name);
}
await client.end();

const files = ["app", "lib", "components", "scripts"]
  .flatMap((dir) => sourceFiles(dir))
  .filter((file) => !file.includes("migrations/") && !file.endsWith("audit-sql-columns.mjs"));

/**
 * Only the column LISTS are judged, and only in single-table statements.
 *
 * Scanning a whole query for snake_case words finds output aliases
 * (`SUM(x) AS total_earned`), enum literals (`'piece_rate'`) and SQL functions
 * (`array_agg`) and calls them missing columns. None of those are columns, and
 * a check that cries wolf is a check people learn to skip.
 *
 * So: the names between SELECT and FROM, and the names inside INSERT INTO
 * table (…). Anything containing a bracket, a quote, a star or an alias is
 * skipped rather than guessed at — a JOIN or a subquery is skipped entirely,
 * because knowing which table a column belongs to there needs a real parser.
 */
function columnList(sql) {
  const select = sql.match(/\bSELECT\s+([\s\S]*?)\s+FROM\b/i);
  const insert = sql.match(/\bINSERT\s+INTO\s+"?[a-z_][a-z0-9_]*"?\s*\(([\s\S]*?)\)/i);
  const list = insert?.[1] ?? select?.[1];
  if (!list) return [];

  return list
    .split(",")
    .map((part) => part.trim())
    .filter(
      (part) =>
        /^[a-z_][a-z0-9_]*$/i.test(part) && // a bare name, not an expression
        !/^\d/.test(part),
    )
    .map((part) => part.toLowerCase());
}

const problems = [];
for (const file of files) {
  for (const sql of sqlStrings(readFileSync(file, "utf8"))) {
    if (/\bJOIN\b|\bUNION\b|\bWITH\b|\bSELECT\b[\s\S]*\bSELECT\b/i.test(sql)) continue;

    const tables = [...sql.matchAll(/\b(?:FROM|INSERT\s+INTO|UPDATE)\s+"?([a-z_][a-z0-9_]*)"?/gi)]
      .map((m) => m[1].toLowerCase())
      .filter((t) => columnsOf.has(t));
    if (tables.length !== 1) continue;

    const known = columnsOf.get(tables[0]);
    for (const column of new Set(columnList(sql))) {
      if (known.has(column)) continue;
      problems.push(`${tables[0]}.${column}  — named in ${file}`);
    }
  }
}

const unique = [...new Set(problems)].sort();
if (unique.length === 0) {
  console.log("Every column named in a single-table query exists.");
} else {
  console.log("Named in a query, missing from the table:");
  for (const line of unique) console.log(`  ${line}`);
}
process.exit(unique.length === 0 ? 0 : 1);
