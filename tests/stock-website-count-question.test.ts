import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The stock page asked "the website shows 215 pairs — why a different number?"
 * under a ready count of 215 (owner, 2026-09-29). The question is asked only
 * when the two numbers differ, and then it says by how much.
 */
describe("the website's pair count on the stock page", () => {
  it("asks why only when the website and the stock differ, and names the gap", async () => {
    const page = (await readFile("app/admin/stock/page.tsx", "utf8")).replace(/\r\n/g, "\n");
    expect(page).toContain("summary.sellableCatalogPairs === summary.readyPairs ?");
    expect(page).toContain("वेबसाइटमा पनि उही ${summary.sellableCatalogPairs} जोडी देखिन्छ।");
    expect(page).toContain("Math.abs(summary.readyPairs - summary.sellableCatalogPairs)");
    expect(page).not.toContain("why a different number?");
  });

  it("explains the gap in Nepali too, not English alone", async () => {
    const page = await readFile("app/admin/stock/page.tsx", "utf8");
    expect(page).not.toContain("<strong>Do not add catalog stock twice:</strong>");
    expect(page).toContain("त्यसैले दुई अंक जोड्नु हुँदैन");
  });
});
