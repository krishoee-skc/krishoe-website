import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { afterSale, deviceWords, factory, goods, trade, words } from "@/lib/words";

/**
 * The difference between a translation and a shop that has decided what it
 * calls things.
 *
 * Every screen here was translated by hand, one string at a time — the right
 * way to do it, and also how a shop ends up calling one thing three names. A
 * shopper never notices a good translation; they notice an inconsistent one,
 * and it reads as carelessness. That is what the owner meant by wanting
 * something that felt premium rather than machine-made.
 */
describe("the shop's own words", () => {
  it("gives every word both halves, and neither of them empty", () => {
    for (const [key, word] of Object.entries(words)) {
      expect(word.en.trim(), key).not.toBe("");
      expect(word.ne.trim(), key).not.toBe("");
    }
  });

  it("keeps exchange and return apart, because they are different promises", () => {
    // An exchange sends another size and keeps the sale; a return sends the
    // money back. One word for both is how a shop loses an argument it should
    // have won — the customer read the meaning that suited them.
    expect(afterSale.exchange.ne).toBe("साट्ने");
    expect(afterSale.return.ne).toBe("फिर्ता");
    expect(afterSale.exchange.ne).not.toBe(afterSale.return.ne);
  });

  it("keeps piece wage and salary apart, because they are different money", () => {
    // ज्याला is earned per pair by a worker; तलब is paid monthly to staff. The
    // factory has both, and the ledger has to know which it is looking at.
    expect(factory.pieceWage.ne).toBe("ज्याला");
    expect(factory.salary.ne).toBe("तलब");
  });

  it("says उधारो for money owed, never the English word in Nepali text", () => {
    expect(trade.credit.ne).toBe("उधारो");
    expect(trade.credit.ne).not.toMatch(/[A-Za-z]/);
  });

  it("counts shoes in जोडी, the way the counter and the factory both do", () => {
    expect(goods.pair.ne).toBe("जोडी");
    expect(goods.pairs.ne).toBe("जोडी");
  });

  it("leaves the device's own words in English, on purpose", () => {
    // A Nepali "Save" where the phone says Save sends the reader hunting for a
    // button that is not there. Written down so the decision is not re-argued
    // every time somebody spots English on a Nepali screen.
    for (const word of deviceWords) {
      expect(word, word).toMatch(/^[A-Za-z]/);
    }

    const nepaliSide = Object.values(words).map((word) => word.ne);
    for (const device of ["Save", "Login", "Cancel"]) {
      expect(nepaliSide, device).not.toContain(device);
    }
  });

  it("has no two things sharing a Nepali word by accident", () => {
    // Two entries may share a word only where they genuinely mean the same
    // thing — "pair" and "pairs" are one word in Nepali. Anything else sharing
    // one is a collision that will confuse a reader.
    const allowed = new Set(["जोडी"]);
    const seen = new Map<string, string>();

    for (const [key, word] of Object.entries(words)) {
      if (allowed.has(word.ne)) continue;
      const first = seen.get(word.ne);
      expect(first === undefined, `${key} and ${first} both say "${word.ne}"`).toBe(true);
      seen.set(word.ne, key);
    }
  });

  it("uses the words the factory screens already say", async () => {
    // Not invented here. These came off the search index and the home board,
    // which are what the owner types and taps every day.
    const search = await readFile("lib/admin-search.ts", "utf8");

    expect(search).toContain(factory.addWork.ne);
    expect(search).toContain(factory.worker.ne);
    expect(search).toContain(factory.salary.ne);
  });
});

/**
 * The first thing the glossary settled.
 *
 * One product page called one state two names: "बिक्री सकियो" on the badge and
 * above the button, plain "सकियो" on the button itself — a shopper reading down
 * the page met the shop's own word changing under them. Nobody would call it a
 * bug, and it is exactly what makes a shop feel machine-assembled.
 */
describe("the sold-out state, said once", () => {
  it("says the same thing everywhere on the product page", async () => {
    const actions = await readFile("components/ProductDetailActions.tsx", "utf8");

    expect(actions).toContain("goods.soldOut.ne");
    // The bare word no longer stands alone where the badge above it says more.
    expect(actions).not.toContain('text("Sold out", "सकियो")');
  });
});
