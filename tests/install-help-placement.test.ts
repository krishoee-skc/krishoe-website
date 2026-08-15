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

  it("only clears the bottom where something is actually there", async () => {
    const source = await readFile("components/PwaInstallHelp.tsx", "utf8");

    // The admin dock and the product page's add-to-cart bar own the bottom of a
    // phone screen; nothing else does.
    expect(source).toContain('pathname.startsWith("/product/")');
    expect(source).toContain("bottom-[calc(6rem+env(safe-area-inset-bottom))]");
    expect(source).toContain("bottom-[calc(1rem+env(safe-area-inset-bottom))]");
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
