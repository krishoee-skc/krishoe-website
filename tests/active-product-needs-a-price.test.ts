import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * A shoe that is on sale must have a price.
 *
 * Checkout reads price_value straight off the product and multiplies: a row
 * that says Active with price_value 0 bills the customer nothing, ships real
 * shoes, and the order lands in the ledger as a sale worth zero. Nothing in the
 * chain refuses it — lib/checkout-order.ts only filters on `status !== "Active"`.
 *
 * That is not a hypothetical. Right now the two designs with stock on hand —
 * halka fom (48 pairs) and hill panja (50) — sit at price 0, and the moment the
 * owner flips either to Active to start selling, that is exactly the shape the
 * row would have. The guard has to exist before the flip, not after.
 *
 * Draft is left alone on purpose: a half-finished product with no price yet is
 * the normal way to start one. The rule is only that it cannot go on sale that
 * way.
 */
const ACTIONS = "app/admin/actions.ts";

describe("saving a product", () => {
  it("refuses Active with no price", async () => {
    const source = await readFile(ACTIONS, "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // The check must look at both together — price alone would block a Draft
    // that is still being written, and status alone checks nothing.
    expect(code, "the guard must exist").toMatch(/priceValue\s*(<=|<|===)\s*0/);
    expect(code, "and only apply to Active").toMatch(/status\s*===\s*"Active"/);
  });

  it("says what to do, not just what went wrong", async () => {
    const source = await readFile(ACTIONS, "utf8");

    // The owner meets this while trying to put a shoe on sale. "Invalid input"
    // would leave them guessing which of a dozen fields was meant.
    expect(source).toMatch(/price[\s\S]{0,120}?Draft|Draft[\s\S]{0,120}?price/i);
  });

  it("still lets a Draft have no price", async () => {
    const source = await readFile(ACTIONS, "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // A product is normally started as a Draft with the price filled in later;
    // blocking that would make the form unusable for its main purpose.
    expect(code, "the guard is conditional on Active").not.toMatch(
      /if\s*\(\s*priceValue\s*<=\s*0\s*\)\s*\{[^}]*return/,
    );
  });
});

describe("what checkout trusts", () => {
  it("bills straight from the stored price", async () => {
    const checkout = await readFile("lib/checkout-order.ts", "utf8");

    // This is why the guard belongs at the save. Checkout multiplies what it is
    // given and asks no questions, so a zero that gets saved is a zero that
    // gets charged.
    expect(checkout).toContain("cleanCount(product.price_value)");
    expect(checkout).toMatch(/unitPricePaisa\s*\*\s*item\.quantity/);
  });
});
