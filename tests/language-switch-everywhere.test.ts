import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Who could change the language, and who could not.
 *
 * The storefront has had a language switch since it was translated. The admin
 * screens, the factory and the worker portal never got one — not on a phone and
 * not on a computer — so the only people with no way to change the app's
 * language were the people who use it every day, and who read Nepali first.
 *
 * The owner asked for the button in the factory and the shop, on the PC and on
 * the phone. This holds all four doors open.
 */
const SWITCH = "components/LanguageSwitch.tsx";

describe("the language switch", () => {
  it("is one component, so the four places cannot drift apart", async () => {
    const source = await readFile(SWITCH, "utf8");

    expect(source).toContain('"use client"');
    expect(source).toContain('setLanguage("ne")');
    expect(source).toContain('setLanguage("en")');
  });

  it("shows both languages rather than one letter that toggles", async () => {
    const source = await readFile(SWITCH, "utf8");

    // A lone "ने" asks the reader to work out that it is a button and to guess
    // what it does. Two halves with one filled name the other language before
    // it is chosen.
    expect(source).toContain("ने");
    expect(source).toContain("EN");
    expect(source).toContain("aria-pressed");
  });

  it("can be read against a deep green rail, where a green fill would vanish", async () => {
    const source = await readFile(SWITCH, "utf8");

    expect(source).toContain('tone === "dark"');
    expect(source).toContain("bg-brand-gold");
  });

  it("reaches every door — admin, factory, worker, on the computer and the phone", async () => {
    for (const file of [
      // The admin rail on a computer.
      "app/admin/AdminNav.tsx",
      // The admin bar on a phone, which is on screen all day.
      "app/admin/AdminMobileNav.tsx",
      // The factory, which runs in Nepali and had the English menu.
      "app/admin/factory/_components/factory-nav.tsx",
      // The workers, who have the least English and were served last.
      "components/worker/WorkerPortalShell.tsx",
    ]) {
      const source = await readFile(file, "utf8");
      expect(source, file).toContain("LanguageSwitch");
    }
  });

  it("still sits on the shop's own bar", async () => {
    const controls = await readFile("components/NavbarControls.tsx", "utf8");

    // The storefront keeps the switch it already had — on the bar for a
    // computer, and first in the menu drawer on a phone — and it is now the
    // same component as the other three doors rather than its own spelling.
    expect(controls.match(/<LanguageSwitch/g) ?? []).toHaveLength(2);
  });
});
