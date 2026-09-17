import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * When the worker portal breaks, it must not talk to the worker like a shopper.
 *
 * Every route under app/ without its own error.tsx falls back to app/error.tsx,
 * which is written for a customer: "Your cart and browsing session are kept
 * safe", and a button offering the shop collection. A worker checking a payslip
 * on a factory phone has no cart, is not browsing, and does not want the shop —
 * they want their wages, and if that screen failed they need to know who to ask.
 *
 * The admin and checkout areas already have their own boundaries for exactly
 * this reason. The worker portal — five screens, including the one that shows
 * what somebody earned — did not.
 *
 * It is also the one part of the app written only in Nepali: the workers do not
 * use the language switch, so the error they see must be Nepali too rather than
 * the bilingual customer page.
 */
const WORKER_ERROR = "app/worker/error.tsx";
const SHOP_ERROR = "app/error.tsx";

describe("the worker portal has its own error screen", () => {
  it("exists", async () => {
    const source = await readFile(WORKER_ERROR, "utf8");
    expect(source).toContain('"use client"');
    // Next requires both props on an error boundary; reset is what makes the
    // "try again" button work at all.
    expect(source).toMatch(/reset/);
  });

  it("speaks Nepali, like the rest of the portal", async () => {
    const source = await readFile(WORKER_ERROR, "utf8");

    // The five worker screens carry Nepali directly rather than through
    // useLanguage — the workers never touch the English/Nepali switch.
    expect(source, "must contain Devanagari").toMatch(/[ऀ-ॿ]/);
    expect(source, "no language switch here").not.toContain("useLanguage");
  });

  it("does not send a worker to the shop", async () => {
    const source = await readFile(WORKER_ERROR, "utf8");

    // The customer page's way back is /shop. A worker's way back is their own
    // dashboard; offering the shop is offering the wrong door.
    expect(source, "no shop link").not.toContain('href="/shop"');
    expect(source, "back to the worker's own screen").toContain('href="/worker/dashboard"');
  });

  it("says nothing about carts or browsing", async () => {
    const source = await readFile(WORKER_ERROR, "utf8");

    // Comments blanked first: the doc comment explains what this screen exists
    // *instead of*, and naming that is not the same as showing it. Reading the
    // prose would fail on the explanation while passing on the markup.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "").toLowerCase();

    // Reassurance written for somebody mid-purchase reads as nonsense to a
    // worker, and worse, as though their wage record were a shopping basket.
    expect(code).not.toContain("cart");
    expect(code).not.toContain("browsing");
  });
});

describe("the customer error page stays a customer page", () => {
  it("still reassures about the cart", async () => {
    const source = await readFile(SHOP_ERROR, "utf8");

    // Proves the fix was an addition, not a rewrite: the shop's own wording is
    // right for the shop and must not have been flattened to suit the factory.
    expect(source.toLowerCase()).toContain("cart");
    expect(source).toContain('href="/shop"');
  });
});
