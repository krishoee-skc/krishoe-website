import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { isDuplicateNameViolation } from "@/lib/duplicate-name-error";

/**
 * The owner's rule: a name is a name. "ankus", "Ankus" and "ankus " are one
 * worker, not three. Two rows that read the same cannot be told apart in a
 * dropdown, and the wages then split silently across both — which is exactly
 * what happened to "aarif"/"aarif " and to "Panja"/"panja".
 */
describe("duplicate name rule", () => {
  it("compares case- and space-insensitively in both entry checks", async () => {
    for (const [file, table] of [
      ["app/api/factory/workers/route.ts", "factory_workers"],
      ["app/api/factory/items/route.ts", "factory_items"],
    ]) {
      const source = await readFile(file, "utf8");
      expect(source, file).toContain(`FROM ${table} WHERE lower(btrim(name)) = lower($1)`);
    }
  });

  it("is backed by an index that applies the same comparison", async () => {
    const migration = await readFile(
      "scripts/migrations/20260815_factory_name_uniqueness.sql",
      "utf8",
    );
    // Matching the check exactly. An index on plain `name` would let "Ankus"
    // through while the check refused it, which is worse than neither.
    expect(migration).toContain("ON factory_workers (lower(btrim(name)))");
    expect(migration).toContain("ON factory_items (lower(btrim(name)))");
  });

  it("answers a double-tapped Save the same way as the pre-check", async () => {
    for (const [file, index] of [
      ["app/api/factory/workers/route.ts", "factory_workers_name_unique_idx"],
      ["app/api/factory/items/route.ts", "factory_items_name_unique_idx"],
    ]) {
      const source = await readFile(file, "utf8");
      expect(source, file).toContain(`isDuplicateNameViolation(error, "${index}")`);
      expect(source, file).toContain("{ status: 409 }");
    }
  });
});

describe("isDuplicateNameViolation", () => {
  const INDEX = "factory_workers_name_unique_idx";

  it("recognises the violation by constraint name", () => {
    expect(isDuplicateNameViolation({ code: "23505", constraint: INDEX }, INDEX)).toBe(true);
  });

  it("recognises it from the message when the driver omits the constraint", () => {
    const error = { code: "23505", message: `duplicate key value violates unique constraint "${INDEX}"` };
    expect(isDuplicateNameViolation(error, INDEX)).toBe(true);
  });

  it("leaves every other failure to be reported as a failure", () => {
    // A different unique index, a foreign key, a dropped connection and a plain
    // crash must not be dressed up as "this name is taken".
    expect(isDuplicateNameViolation({ code: "23505", constraint: "some_other_idx" }, INDEX)).toBe(false);
    expect(isDuplicateNameViolation({ code: "23503", constraint: INDEX }, INDEX)).toBe(false);
    expect(isDuplicateNameViolation(new Error("connection lost"), INDEX)).toBe(false);
    expect(isDuplicateNameViolation(null, INDEX)).toBe(false);
    expect(isDuplicateNameViolation("boom", INDEX)).toBe(false);
  });
});
