import { describe, expect, it } from "vitest";
import { findDesignDrift, type DesignRecord } from "@/lib/design-drift";

/**
 * The sweep the owner asked for after "bag open" and "T bag open" turned out to
 * be one shoe kept in two piles.
 *
 * Two things matter here, and the second matters more. It has to find the split
 * — and it has to stay quiet about shoes that are genuinely different, because
 * a panel that cries wolf is one the owner stops reading, and then the real
 * split goes unnoticed too.
 */
function record(name: string, where: DesignRecord["where"] = "catalog", pairs = 10): DesignRecord {
  return { name, where, pairs };
}

describe("finding two names for one shoe", () => {
  it("catches the split that started this: bag open and T bag open", () => {
    const found = findDesignDrift([
      record("bag open", "ready stock", 58),
      record("T bag open", "catalog", 12),
    ]);

    expect(found).toHaveLength(1);
    expect(found[0].reason).toBe("one name contains the other");
    expect(found[0].pairsAtStake).toBe(70);
  });

  it("catches the same words written in a different order", () => {
    const found = findDesignDrift([record("open bag"), record("bag open")]);

    expect(found).toHaveLength(1);
    expect(found[0].reason).toBe("same words, different order");
  });

  it("catches a name run together without its space", () => {
    const found = findDesignDrift([record("bag open"), record("bagopen")]);

    expect(found).toHaveLength(1);
    expect(found[0].reason).toBe("same letters, spaced differently");
  });

  it("puts the pairs most at stake first", () => {
    const found = findDesignDrift([
      record("kids slipper", "catalog", 2),
      record("T kids slipper", "ready stock", 3),
      record("bag open", "catalog", 40),
      record("T bag open", "ready stock", 30),
    ]);

    expect(found[0].pairsAtStake).toBe(70);
    expect(found[1].pairsAtStake).toBe(5);
  });
});

describe("staying quiet about shoes that really are different", () => {
  it("says nothing about a name matching itself across the catalog and the pool", () => {
    // A product and its own ready-stock pool share a name. That is the system
    // working, not a find — and reporting it would bury the real ones.
    const found = findDesignDrift([
      record("bag open", "catalog", 12),
      record("bag open", "ready stock", 58),
    ]);

    expect(found).toEqual([]);
  });

  it("folds the pairs of one name together rather than double-counting", () => {
    const found = findDesignDrift([
      record("bag open", "catalog", 12),
      record("bag open", "ready stock", 58),
      record("T bag open", "catalog", 30),
    ]);

    expect(found).toHaveLength(1);
    // 12 + 58 on one side, 30 on the other.
    expect(found[0].pairsAtStake).toBe(100);
  });

  it("does not read a word inside a word as a shared name", () => {
    // "pen" sits inside "open", and a plain substring test would report these
    // two as one shoe. They are not.
    const found = findDesignDrift([record("open shoe"), record("pen holder")]);

    expect(found).toEqual([]);
  });

  it("leaves genuinely different designs alone", () => {
    const found = findDesignDrift([
      record("kids slipper"),
      record("ladies sandal"),
      record("casual shoe"),
      record("jeans shoe"),
    ]);

    expect(found).toEqual([]);
  });

  it("does not call two short codes the same on letters alone", () => {
    // Short names collide by accident. The letters-only rule needs something
    // long enough to mean anything.
    const found = findDesignDrift([record("a b"), record("ab")]);

    expect(found).toEqual([]);
  });

  it("ignores a blank name rather than pairing it with everything", () => {
    const found = findDesignDrift([record(""), record("   "), record("bag open")]);

    expect(found).toEqual([]);
  });

  it("reports a pair once, not once from each side", () => {
    const found = findDesignDrift([record("bag open"), record("T bag open")]);

    expect(found).toHaveLength(1);
  });
});

describe("what the owner is shown", () => {
  it("names both sides and where each one lives", () => {
    const [drift] = findDesignDrift([
      record("bag open", "ready stock", 58),
      record("T bag open", "catalog", 12),
    ]);

    expect([drift.left.name, drift.right.name].sort()).toEqual(["T bag open", "bag open"]);
    expect([drift.left.where, drift.right.where].sort()).toEqual(["catalog", "ready stock"]);
  });

  it("keeps the spelling as it is written, so it can be found and fixed", () => {
    const [drift] = findDesignDrift([record("Bag Open", "catalog", 5), record("T Bag Open", "catalog", 5)]);

    expect([drift.left.name, drift.right.name]).toContain("Bag Open");
  });
});
