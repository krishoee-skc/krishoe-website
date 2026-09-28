import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The cost page prices a shoe from one number: the material in a pair.
 *
 * The recipe route needs every raw material bought and priced before a cost
 * can be approved, and none of this shop's shoes had one — so no cost was
 * ever approved, and the Operations page read "Needs cost / Rs. 0" for all of
 * them. The owner knows what the material in a pair costs; the table takes
 * that, adds the wages on file, and works out wholesale and retail as it is
 * typed (sample approved 2026-09-28).
 */
const PAGE = "app/admin/operations/production-accounts/lots/page.tsx";
const TABLE = "app/admin/operations/production-accounts/lots/CostTable.tsx";
const LIB = "lib/production-accounting.ts";
const ACTIONS = "app/admin/operations/production-accounts/actions.ts";

describe("the cost table", () => {
  it("leads the page, with the recipe route kept under Detailed", async () => {
    const page = await readFile(PAGE, "utf8");
    expect(page.indexOf("<CostTable rows={costRows} />")).toBeGreaterThan(0);
    expect(page.indexOf("<CostTable")).toBeLessThan(page.indexOf("<details"));
    expect(page.indexOf("<details")).toBeLessThan(page.indexOf("action={saveItemMaterialAction}"));
    expect(page).toContain("/admin/factory/add-work");
  });

  it("works out the rates as the numbers are typed", async () => {
    const table = await readFile(TABLE, "utf8");
    expect(table).toContain("const cost = round2(materialValue + row.wage);");
    expect(table).toContain("const wholesale = round2(cost * (1 + (Number(profit) || 0) / 100));");
    expect(table).toContain("const retail = round2(wholesale + (Number(extra) || 0));");
    expect(table).toContain("action={approveSimpleCostAction}");
    // Cannot approve a shoe with no wage on file, or with no material.
    expect(table).toContain("const ready = materialValue > 0 && row.stages.length > 0;");
  });
});

describe("approving from it", () => {
  it("uses the typed material instead of a recipe, and needs a wage", async () => {
    const lib = await readFile(LIB, "utf8");
    const approve = lib.slice(lib.indexOf("export async function approveProductionCostCard"), lib.indexOf("export async function setProductionStageRate"));
    expect(approve).toContain("const typedMaterial = numeric(input.materialCostPerPair ?? 0);");
    expect(approve).toMatch(/if \(typedMaterial > 0\) \{[\s\S]*?stage_count[\s\S]*?<= 0/);
    // The recipe route keeps every one of its rules.
    expect(approve).toContain("Add at least one material recipe before approving cost.");
    expect(approve).toContain("Set all four production stage wage rates before approving cost.");
  });

  it("writes the same material onto the factory item the reports read", async () => {
    const lib = await readFile(LIB, "utf8");
    expect(lib).toContain("UPDATE factory_items SET material_cost_per_pair = $2, updated_at = now()");
    const costing = await readFile("lib/costing.ts", "utf8");
    expect(costing).toContain("SELECT name, material_cost_per_pair FROM factory_items");
  });

  it("is an owner action, dated today in Nepal", async () => {
    const actions = await readFile(ACTIONS, "utf8");
    const action = actions.slice(actions.indexOf("export async function approveSimpleCostAction"));
    expect(action.slice(0, 400)).toContain("await ownerContext()");
    expect(action.slice(0, 1200)).toContain('timeZone: "Asia/Kathmandu"');
  });
});
