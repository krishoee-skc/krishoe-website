import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The owner scanned the QR on an iPhone and the first thing the phone showed
 * was the install tip sitting across the password field and half the Unlock
 * button — a card covering the form it was giving advice about.
 *
 * It floats a fixed distance off the bottom, an offset sized to clear the admin
 * dock. A sign-in page has no dock, so the gap put the card in the middle of
 * the form instead.
 */
describe("install help", () => {
  it("stays off every sign-in screen", async () => {
    const source = await readFile("components/PwaInstallHelp.tsx", "utf8");

    for (const path of ["/admin/login", "/worker/login", "/account/login"]) {
      expect(source, path).toContain(`"${path}"`);
    }
    expect(source).toContain("SIGN_IN_PATHS.includes(pathname)");
  });

  it("sits above the tab bar, and never over a page where someone is buying", async () => {
    const source = await readFile("components/PwaInstallHelp.tsx", "utf8");

    // At 1rem it lay across the top half of the tab bar; on a product page it
    // covered the name, the price and Add. It clears the tab bar everywhere,
    // and does not appear at all on a product, the cart, checkout or an order.
    expect(source).toContain("bottom-[calc(6.25rem+env(safe-area-inset-bottom))] lg:bottom-4");
    expect(source).toContain('pathname.startsWith("/product/")');
    expect(source).toContain('pathname === "/cart"');
    expect(source).toContain('pathname.startsWith("/checkout")');
    expect(source).toContain("|| isBuyingPage(pathname)");
  });

  it("waits for someone who is browsing, and for the language question first", async () => {
    const source = await readFile("components/PwaInstallHelp.tsx", "utf8");
    expect(source).toContain("const VIEWS_BEFORE_ASKING = 3;");
    expect(source).toContain("|| views < VIEWS_BEFORE_ASKING");
    expect(source).toContain("|| !languageSettled");
  });

  it("keeps the phone's own words", async () => {
    const source = await readFile("components/PwaInstallHelp.tsx", "utf8");

    // "Share" and "Add to Home Screen" are printed on the iPhone menu in
    // English. Translating them would send the reader hunting for a label that
    // is not on their screen.
    expect(source).toContain("In Safari, tap Share, then Add to Home Screen.");
    expect(source).toContain("Install app or Add to Home screen");
  });
});
