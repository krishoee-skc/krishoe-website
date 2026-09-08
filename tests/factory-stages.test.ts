import { describe, expect, it } from "vitest";
import {
  FACTORY_WORKER_CATEGORIES,
  factoryCategoryLabel,
} from "@/lib/factory-worker-options";
import { productionStageForFactoryCategory } from "@/lib/factory-stage";

/**
 * The stages this shop's shoes actually pass through.
 *
 * The dropdown once offered seven and the shop used three. Offering a stage
 * nobody works in is a line the entry clerk reads past fifty times a morning,
 * and a chance to file a day's wage under something that has no rate.
 */
describe("the stages a worker can be given", () => {
  it("offers only what the shop works in", () => {
    expect([...FACTORY_WORKER_CATEGORIES]).toEqual([
      "Upper",
      "Fibermen",
      "Fiber Silai",
      "Packing / QC",
      "Staff",
    ]);
  });

  it("keeps the spellings the database will accept", () => {
    // factory_workers_category_check names these exactly. A shorter, tidier
    // "QC" is rejected outright by the write — tested against production before
    // this list was narrowed.
    expect(FACTORY_WORKER_CATEGORIES).toContain("Packing / QC");
    expect(FACTORY_WORKER_CATEGORIES).not.toContain("QC");
  });

  it("keeps Fibermen, because that is how the workers are filed", () => {
    // Six of eleven workers sit under it. Renaming it to "Bottom men" would
    // mean touching their records for a word — and the screen can say both.
    expect(FACTORY_WORKER_CATEGORIES).toContain("Fibermen");
  });
});

describe("what each stage is called on screen", () => {
  it("says both names for the one job that has two", () => {
    // The fiber men are the bottom men. A dropdown offering one name leaves
    // half the workshop guessing.
    expect(factoryCategoryLabel("Fibermen", false)).toContain("bottom");
    expect(factoryCategoryLabel("Fibermen", true)).toContain("बटम");
  });

  it("has a name in both languages for every stage offered", () => {
    for (const category of FACTORY_WORKER_CATEGORIES) {
      const english = factoryCategoryLabel(category, false);
      const nepali = factoryCategoryLabel(category, true);

      expect(english, category).toBeTruthy();
      expect(nepali, category).toBeTruthy();
      // A label that is just the stored value means nobody wrote one.
      expect(nepali, `${category} has no Nepali label`).not.toBe(category);
    }
  });

  it("falls back to the stored value for a stage no longer offered", () => {
    // An old worker filed under a dropped stage still has to render as
    // something rather than as blank.
    expect(factoryCategoryLabel("Bottom Final", false)).toBe("Bottom Final");
  });
});

describe("finding the rate for a stage", () => {
  it("maps every stage a worker can be given", () => {
    for (const category of FACTORY_WORKER_CATEGORIES) {
      // Staff are salaried, not on piece rate, so they need no stage.
      if (category === "Staff") continue;

      expect(
        productionStageForFactoryCategory(category),
        `${category} has no stage, so its work would find no rate`,
      ).toBeTruthy();
    }
  });

  it("sends the fiber men to the stage the rates are filed under", () => {
    expect(productionStageForFactoryCategory("Fibermen")).toBe("Fiber Preparation");
    // The production ledger's own name for it arrives here too.
    expect(productionStageForFactoryCategory("Fiber Preparation")).toBe("Fiber Preparation");
  });

  it("gives the quality pass a stage of its own", () => {
    // It had none, so work entered against QC found no rate and the amount
    // came out blank.
    expect(productionStageForFactoryCategory("Packing / QC")).toBe("Packing / QC");
  });

  it("says nothing for a category that is not a stage", () => {
    expect(productionStageForFactoryCategory("Staff")).toBeNull();
    expect(productionStageForFactoryCategory("")).toBeNull();
  });
});
