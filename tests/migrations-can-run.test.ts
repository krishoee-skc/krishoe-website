import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Two migrations carried their own BEGIN/COMMIT.
 *
 * apply-postgres-schema.mjs runs every pending migration inside one transaction
 * and refuses a file that opens a second — correctly, because a nested COMMIT
 * would end the runner's transaction half way through the batch. But it refuses
 * by throwing on the FIRST such file, before running anything, so two files
 * written in August stopped every migration after them. Nobody was told,
 * because nothing runs the migrations except a person who decides to.
 *
 * The bill for that arrived weeks later: a CHECK constraint that had been
 * dropped in a migration was still live in the shop's database, and every
 * piece-rate work entry was refused with a message that named none of this.
 *
 * These read every migration the way the runner does, so the mistake is caught
 * by CI at the moment it is written rather than by an owner who cannot save a
 * day's work.
 */

const MIGRATIONS = path.join(process.cwd(), "scripts", "migrations");

function migrationFiles() {
  return readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

function read(name: string) {
  return readFileSync(path.join(MIGRATIONS, name), "utf8");
}

/**
 * Applied before this rule existed, and now untouchable.
 *
 * A migration that has run is fingerprinted in schema_migrations. Adding so
 * much as a comment changes the fingerprint, and the runner refuses the whole
 * batch — so the explanation this one deserves can never be written into it.
 * Adding one cost exactly that, and had to be reverted.
 *
 * The list is closed. Anything written from now on explains itself.
 */
const ALREADY_APPLIED_UNEXPLAINED = ["20260809_worker_portal_role.sql"];

describe("every migration can actually be run", () => {
  it("has migrations to check", () => {
    // A guard that silently checks nothing is worse than no guard.
    expect(migrationFiles().length).toBeGreaterThan(20);
  });

  it("leaves the transaction to the runner", () => {
    // The exact test apply-postgres-schema.mjs applies, run here so the answer
    // arrives in CI instead of the next time somebody migrates by hand.
    const managesOwn = migrationFiles().filter((name) =>
      /^\s*(BEGIN|COMMIT|ROLLBACK)\s*;/im.test(read(name)),
    );

    expect(
      managesOwn,
      `These open their own transaction, and the runner refuses the whole batch at the first one:\n${managesOwn.join("\n")}\n` +
        "Remove the BEGIN/COMMIT — apply-postgres-schema.mjs already wraps each migration in one.",
    ).toEqual([]);
  });

  it("can be run twice without failing the second time", () => {
    // A migration is applied by hand, and a hand repeats itself. Anything that
    // creates or drops has to say IF EXISTS / IF NOT EXISTS, or the second run
    // fails and takes every later migration with it.
    const unsafe: string[] = [];

    for (const name of migrationFiles()) {
      const sql = read(name)
        .replace(/--[^\n]*/g, "")
        .replace(/\s+/g, " ");

      const creates = sql.match(/CREATE (TABLE|INDEX|UNIQUE INDEX)\s+(?!IF NOT EXISTS)/gi) ?? [];
      const drops = sql.match(/DROP (TABLE|INDEX|CONSTRAINT)\s+(?!IF EXISTS)/gi) ?? [];
      const adds = sql.match(/ADD COLUMN\s+(?!IF NOT EXISTS)/gi) ?? [];

      if (creates.length || drops.length || adds.length) {
        unsafe.push(`${name}: ${[...creates, ...drops, ...adds].join(", ").trim()}`);
      }
    }

    expect(
      unsafe,
      `These cannot be run a second time:\n${unsafe.join("\n")}\n` +
        "Add IF EXISTS / IF NOT EXISTS.",
    ).toEqual([]);
  });

  it("says what it is for, before it says what it does", () => {
    // A migration is read months later by somebody deciding whether it is safe
    // to run. One that opens with ALTER TABLE tells them nothing.
    const silent = migrationFiles()
      .filter((name) => !ALREADY_APPLIED_UNEXPLAINED.includes(name))
      .filter((name) => !read(name).trimStart().startsWith("--"));

    expect(silent, `These start with no explanation:\n${silent.join("\n")}`).toEqual([]);
  });
});

describe("the runner's own rule", () => {
  it("is the one this file tests", async () => {
    const runner = readFileSync(
      path.join(process.cwd(), "scripts", "apply-postgres-schema.mjs"),
      "utf8",
    );

    // If the runner's check ever changes shape, this test is checking the wrong
    // thing and would keep passing while migrations stopped running again.
    expect(runner).toContain("must not manage its own transaction");
    expect(runner).toMatch(/\/\^\\s\*\(BEGIN\|COMMIT\|ROLLBACK\)\\s\*;\/im/);
  });
});

/**
 * Nobody was told that migrations were pending.
 *
 * The two blocked files sat unapplied for weeks in silence, because the only
 * thing that runs migrations is a person who decides to. And when the runner
 * was finally asked, it nearly refused again — over line endings, on a file
 * nobody had edited.
 */
describe("the shop can be asked whether its database is up to date", () => {
  it("hashes a migration the way the runner does", async () => {
    const runner = readFileSync(
      path.join(process.cwd(), "scripts", "apply-postgres-schema.mjs"),
      "utf8",
    );
    const checker = readFileSync(path.join(process.cwd(), "lib", "pending-migrations.ts"), "utf8");

    // git rewrites line endings on a Windows checkout. Hashing raw bytes made
    // one untouched migration read as edited — 27 of 28 matched as-is and one
    // matched only with LF, and none of them had been changed at all. Two
    // recipes that disagree would put the warning back, or worse, hide it.
    const CR = String.fromCharCode(92) + "r" + String.fromCharCode(92) + "n";
    const stripsCarriageReturns = `sql.replace(/${CR}/g, "\\n")`;
    expect(runner).toContain(stripsCarriageReturns);
    expect(checker).toContain(stripsCarriageReturns);
  });

  it("re-stamps an old fingerprint instead of refusing the batch", async () => {
    const runner = readFileSync(
      path.join(process.cwd(), "scripts", "apply-postgres-schema.mjs"),
      "utf8",
    );

    // Every checksum stored before the change was computed the old way. Left
    // alone, the first run after it would refuse every one of them.
    expect(runner).toContain("legacyMigrationChecksum");
    expect(runner).toContain("UPDATE schema_migrations SET checksum");
  });

  it("still refuses a migration that was genuinely edited", async () => {
    const runner = readFileSync(
      path.join(process.cwd(), "scripts", "apply-postgres-schema.mjs"),
      "utf8",
    );

    // The rule this protects is real: an applied migration that changes means
    // two databases that ran different SQL under one name.
    expect(runner).toContain("Never edit an applied migration");
  });

  it("is reported where somebody looks", async () => {
    const route = readFileSync(
      path.join(process.cwd(), "app", "api", "admin", "monitoring", "route.ts"),
      "utf8",
    );

    expect(route).toContain("getMigrationState");
    expect(route).toContain("migrations:");
  });

  it("says it does not know rather than saying all is well", async () => {
    const checker = readFileSync(path.join(process.cwd(), "lib", "pending-migrations.ts"), "utf8");

    // No database, no answer. Reporting "none pending" from a failed read would
    // be the same silence this exists to end.
    expect(checker).toContain("unknown: true");
  });
});
