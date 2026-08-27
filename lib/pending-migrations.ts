import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { queryPostgres } from "@/lib/postgres/client";

const STORE = "schema migrations";
const MIGRATIONS_DIR = path.join(process.cwd(), "scripts", "migrations");

export type MigrationState = {
  /** Written but never run against this database. */
  pending: string[];
  /** Run, then edited afterwards — the runner will refuse the whole batch. */
  edited: string[];
  applied: number;
  total: number;
  /** Could not be worked out, usually because there is no database here. */
  unknown: boolean;
};

/**
 * Which migrations this database has not run.
 *
 * Nothing told anybody that migrations were pending. Two files written in
 * August carried their own BEGIN/COMMIT, which makes the runner refuse the
 * whole batch at the first of them — so every migration after those two sat
 * unapplied for weeks, in silence, because the only thing that runs migrations
 * is a person who decides to.
 *
 * The bill arrived later and looked like something else entirely: a CHECK
 * constraint that a migration had dropped was still live, and every piece-rate
 * work entry was refused with a message that named none of it.
 *
 * So the shop can be asked. The runner already records what it ran in
 * schema_migrations, with a checksum; this reads the same two sources it does
 * and reports the difference.
 */
export async function getMigrationState(): Promise<MigrationState> {
  try {
    const files = (await readdir(MIGRATIONS_DIR))
      .filter((name) => name.endsWith(".sql"))
      .sort();

    const rows = await queryPostgres<{ name: string; checksum: string }>(
      STORE,
      "SELECT name, checksum FROM schema_migrations",
    );
    const applied = new Map(rows.map((row) => [row.name, row.checksum]));

    const pending: string[] = [];
    const edited: string[] = [];

    for (const name of files) {
      const recorded = applied.get(name);
      if (!recorded) {
        pending.push(name);
        continue;
      }

      // An applied migration that has since been edited is its own trap: the
      // runner refuses the batch on a checksum mismatch, which stops every
      // migration written after it, exactly as a stray BEGIN did.
      // Hashed the way the runner hashes: line endings stripped, because git
      // rewrites them on a Windows checkout and an untouched migration would
      // otherwise read as edited. One already did.
      const sql = await readFile(path.join(MIGRATIONS_DIR, name), "utf8");
      const checksum = createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
      const legacy = createHash("sha256").update(sql).digest("hex");
      if (recorded !== checksum && recorded !== legacy) edited.push(name);
    }

    return { pending, edited, applied: applied.size, total: files.length, unknown: false };
  } catch {
    // No database, no schema_migrations table, or no migrations folder. Saying
    // "unknown" is honest; saying "none pending" would be the silence this
    // exists to end.
    return { pending: [], edited: [], applied: 0, total: 0, unknown: true };
  }
}

/** One sentence for a readiness list or an alert. */
export function describeMigrationState(state: MigrationState) {
  if (state.unknown) return "Could not read which migrations have run.";
  if (state.edited.length > 0) {
    return `${state.edited.length} applied migration(s) have been edited since — the runner will refuse the batch: ${state.edited.join(", ")}`;
  }
  if (state.pending.length > 0) {
    return `${state.pending.length} migration(s) written but not run: ${state.pending.join(", ")}`;
  }
  return `All ${state.applied} migrations have run.`;
}
