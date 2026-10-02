import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { counterItemDoubts, counterItemProblem, guessKind } from "@/lib/counter-item-rules";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The counter's new-item form, walked with Enter (owner, 2026-09-30): the
 * kind guessed from the name and shown as the one chosen, how it came the
 * same, an empty size ending the sizes, the bill's own price open and the rest
 * folded, and a slip like KR-210's 77,766-pair minimum asked about.
 */
describe("the kind a name reads as", () => {
  it("follows the shop's own words — a hill is a sandal here", () => {
    expect(guessKind("bantu hill")).toBe("ladies-sandals");
    expect(guessKind("lose hill panja")).toBe("ladies-sandals");
    expect(guessKind("putali patta flat")).toBe("ladies-sandals");
    expect(guessKind("ladies magic chappal")).toBe("ladies-slippers");
    expect(guessKind("eva fab slipers efm1o1")).toBe("ladies-slippers");
    // Men's and children's own shelves since 2026-10-02.
    expect(guessKind("gents chappal")).toBe("mens-slippers");
    expect(guessKind("nauty shoe #1001")).toBe("mens-shoes");
    expect(guessKind("close shoe chinies# 233")).toBe("mens-shoes");
    expect(guessKind("school shoe")).toBe("kids-shoes");
    expect(guessKind("bachha chappal")).toBe("kids-slippers");
    expect(guessKind("party heel")).toBe("party-heels");
    expect(guessKind("kitto 770")).toBeNull();
  });
});

describe("a figure that reads like a slip", () => {
  const base = {
    name: "close shoe chinies# 233",
    how: "pending_bill" as const,
    sizes: { "36": 11 },
    pilePairs: 44,
    retailPrice: 222,
    wholesalePrice: 222,
    channel: "Wholesale" as const,
    costPerPair: 1,
    lossConfirmed: false,
    minWholesaleQty: 77766,
  };

  it("names KR-210's minimum and cost", () => {
    const doubts = counterItemDoubts({ pairs: 55, minWholesaleQty: 77766, costPerPair: 1, retailPrice: 222, wholesalePrice: 222 });
    expect(doubts.map((doubt) => doubt.ne)).toEqual([
      "थोकको न्यूनतम 77766 जोडी, थपेको 55 जोडीभन्दा धेरै।",
      "एक जोडीको लागत रु. 1, मूल्य रु. 222।",
    ]);
  });

  it("holds the save until the figures are confirmed, and lets ordinary ones pass", () => {
    expect(counterItemProblem(base)?.ne).toContain("अंक ठीक हो भने टिक गर्नुहोस्");
    expect(counterItemProblem({ ...base, doubtsConfirmed: true })).toBeNull();
    expect(counterItemProblem({ ...base, minWholesaleQty: 6, costPerPair: 150 })).toBeNull();
    expect(counterItemDoubts({ pairs: 20, minWholesaleQty: 6, costPerPair: 150, retailPrice: 222 })).toEqual([]);
  });
});

describe("the form", () => {
  it("shows the kind and how it came as the one chosen, Enter to accept", async () => {
    const sheet = await read("app/admin/pos/_components/PosNewItemSheet.tsx");
    expect(sheet).toContain("function ChoicePicker(");
    expect(sheet).toContain("data-enter-walk");
    expect(sheet).toContain("const categorySlug = chosenKind ?? guessed ?? kinds[0]?.slug ?? \"\";");
    expect(sheet).toContain('title={text("How did it come?", "यो माल कसरी आयो?")}');
  });

  it("ends the sizes on an empty size, and grows a row only from a filled one", async () => {
    const sheet = await read("app/admin/pos/_components/PosNewItemSheet.tsx");
    expect(sheet).toContain('if (event.key === "Enter" && !event.shiftKey && !row.size.trim()) {');
    expect(sheet).toContain("pileBox.current?.focus();");
    expect(sheet).toContain("index === rows.length - 1 && row.size.trim() && row.pairs.trim()");
  });

  it("keeps the box being typed in in view", async () => {
    const sheet = await read("app/admin/pos/_components/PosNewItemSheet.tsx");
    expect(sheet).toContain('target.scrollIntoView({ block: "center", behavior: "smooth" })');
  });

  it("opens the bill's own price and folds the rest", async () => {
    const sheet = await read("app/admin/pos/_components/PosNewItemSheet.tsx");
    expect(sheet).toContain("{isWholesale ? wholesaleBox : retailBox}");
    expect(sheet).toContain("{isWholesale ? retailBox : wholesaleBox}");
    expect(sheet).toContain("open={moreOpen || losses.length > 0 || doubts.length > 0}");
  });

  it("carries the confirmation to the server, which checks it too", async () => {
    const lib = await read("lib/counter-items.ts");
    expect(lib).toContain("doubtsConfirmed: input.doubtsConfirmed,");
    expect(lib).toContain("minWholesaleQty: input.minWholesaleQty,");
  });
});
