import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const CARD = "components/PwaInstallHelp.tsx";

/**
 * The shop kept asking the owner to install an app they had already installed.
 *
 * Two reasons, and the code looked right in both places. The dismissal was kept
 * in sessionStorage, which lives and dies with one tab — the owner had a dozen
 * Safari tabs open, so the card they had closed came back with every new one.
 * And a browser tab cannot be asked whether this site is on the home screen
 * beside it: Safari reports standalone only when it *is* the home-screen app,
 * so from an ordinary tab the shop had no way of knowing and simply asked
 * again.
 *
 * The answer to the second is to write it down the first time the shop is
 * opened from the home screen, and never ask afterwards.
 */
describe("asking someone to install what they already have", () => {
  it("remembers being dismissed for longer than one tab", async () => {
    const card = await readFile(CARD, "utf8");
    // Comments stripped. The one explaining why sessionStorage was wrong names
    // it, and searching the raw file fails on the record of the fix rather
    // than on the fix — which happened four times in a day before I learned.
    const code = card.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    expect(code).toContain("window.localStorage.setItem(DISMISSED_KEY");
    expect(code).not.toContain("sessionStorage");
  });

  it("records the install the first time the app runs from the home screen", async () => {
    const card = await readFile(CARD, "utf8");

    // The only moment Safari will admit it. Miss it and the shop is asking
    // forever.
    expect(card).toContain("if (standalone) {");
    expect(card).toContain("window.localStorage.setItem(INSTALLED_KEY");
  });

  it("stays quiet once either is remembered", async () => {
    const card = await readFile(CARD, "utf8");

    expect(card).toContain('window.localStorage.getItem(DISMISSED_KEY) === "yes"');
    expect(card).toContain('window.localStorage.getItem(INSTALLED_KEY) === "yes"');
  });

  it("records it again when the browser announces the install", async () => {
    const card = await readFile(CARD, "utf8");
    const installed = card.slice(card.indexOf("const onInstalled"));

    expect(installed).toContain("window.localStorage.setItem(INSTALLED_KEY");
  });

  it("survives a browser that refuses to store anything", async () => {
    const card = await readFile(CARD, "utf8");

    // Private windows and blocked site data throw on access. A shop must not
    // break over a card it was only offering.
    expect([...card.matchAll(/} catch \{/g)].length).toBeGreaterThanOrEqual(3);
  });

  it("never shows while running as the installed app", async () => {
    const card = await readFile(CARD, "utf8");

    expect(card).toContain('window.matchMedia("(display-mode: standalone)").matches');
    expect(card).toContain("!standalone && !dismissed");
  });
});
