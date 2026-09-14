import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { FACTORY_WORKER_CATEGORIES } from "@/lib/factory-worker-options";

/**
 * The screen offered a stage the database refused.
 *
 * The owner tried to record sixty pairs of fiber work and got back: "The
 * database refused this: it breaks the rule production_work_entries_stage_check
 * on production_work_entries." They had done nothing wrong. The dropdown
 * offered Fibermen, because that is what this shop calls the job, and the
 * constraint still listed the four stages it was first written with — two of
 * which the shop has never used.
 *
 * Seven of the eleven factory workers are filed as Fibermen. Not one of their
 * entries had ever gone in, and the only way to discover that was for someone
 * to try to pay them.
 *
 * Where it came from: factory_workers and factory_rates were widened when
 * Fibermen was introduced; the seven production_* constraints were not. Two
 * lists of the same thing, one updated and one forgotten — which is exactly
 * what this test exists to catch, because the next stage this shop invents
 * will have the same two lists to keep in step.
 *
 * Nothing was removed. 'Fiber Preparation' and 'Bottom Final' stay allowed so
 * no stored row can be orphaned; the migration only widens.
 */
const SCHEMA = "docs/schema.sql";
const MIGRATION = "scripts/migrations/20260914_production_stage_fibermen.sql";

/** Every constraint that names a production stage, and the table it guards. */
const STAGE_CONSTRAINTS = [
  "production_stage_rates_stage_check",
  "production_worker_stage_rates_stage_check",
  "production_work_entries_stage_check",
  "production_work_orders_current_stage_check",
  "production_stage_handovers_from_stage_check",
  "production_stage_handovers_to_stage_check",
  "production_cctv_references_stage_check",
];

describe("the stages the screen offers", () => {
  it("are the five this shop actually works in", () => {
    expect([...FACTORY_WORKER_CATEGORIES]).toEqual([
      "Upper",
      "Fibermen",
      "Fiber Silai",
      "Packing / QC",
      "Staff",
    ]);
  });

  it("are every one of them accepted by the schema", async () => {
    const schema = await readFile(SCHEMA, "utf8");

    // The failure this guards is not hypothetical: it stopped the wages of the
    // largest group of workers in the shop from being recorded at all.
    for (const stage of FACTORY_WORKER_CATEGORIES) {
      expect(schema, `${stage} is offered on screen`).toContain(`'${stage}'`);
    }
  });

  it("leaves no stage list in the schema still on the old four", async () => {
    const schema = await readFile(SCHEMA, "utf8");

    // Any CHECK that mentions a stage at all must mention Fibermen. A list
    // that names the old stages without the new one is the exact shape of the
    // bug: correct-looking SQL that refuses a real day's work.
    const stale = (schema.match(/CHECK \([^)]*'Fiber Preparation'[^)]*\)/g) ?? []).filter(
      (clause) => !clause.includes("'Fibermen'"),
    );

    expect(stale.join("\n"), "a stage list was left behind").toBe("");
  });
});

describe("the migration that widened them", () => {
  it("covers all seven constraints that were missed", async () => {
    const migration = await readFile(MIGRATION, "utf8");

    for (const name of STAGE_CONSTRAINTS) {
      expect(migration, name).toContain(name);
    }
  });

  it("can be run twice without failing", async () => {
    const migration = await readFile(MIGRATION, "utf8");

    // DROP ... IF EXISTS before each ADD, so a re-run recreates rather than
    // collides. A migration that only works once is a migration nobody can
    // safely re-apply to a restored backup.
    const drops = migration.match(/DROP CONSTRAINT IF EXISTS/g) ?? [];
    const adds = migration.match(/ADD CONSTRAINT/g) ?? [];

    expect(drops.length).toBe(STAGE_CONSTRAINTS.length);
    expect(adds.length).toBe(STAGE_CONSTRAINTS.length);
  });

  it("takes nothing away, so no stored row is orphaned", async () => {
    const migration = await readFile(MIGRATION, "utf8");

    // Checked inside each CHECK clause, not anywhere in the file. The comment
    // explaining why the old stages are kept names them too, so a search of
    // the whole file passes even with them stripped from the SQL — verified by
    // stripping them.
    const clauses = migration.match(/CHECK \([^;]*\)/g) ?? [];
    expect(clauses.length, "no CHECK clauses found").toBe(STAGE_CONSTRAINTS.length);

    // Eight rate rows and seven work entries were already stored. Dropping the
    // stages they use would make existing, correct data invalid.
    for (const clause of clauses) {
      expect(clause, "'Fiber Preparation' was dropped").toContain("'Fiber Preparation'");
      expect(clause, "'Bottom Final' was dropped").toContain("'Bottom Final'");
    }
  });

  it("adds both names the screen offers, not just the one that failed", async () => {
    const migration = await readFile(MIGRATION, "utf8");

    // Packing / QC was missing from four of the seven as well. Fixing only the
    // constraint that happened to throw would have left the next one waiting.
    for (const clause of migration.match(/CHECK \([^;]*\)/g) ?? []) {
      expect(clause, "Fibermen").toContain("'Fibermen'");
      expect(clause, "Packing / QC").toContain("'Packing / QC'");
    }
  });
});
