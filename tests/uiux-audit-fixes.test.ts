import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { quietPage } from "@/components/LanguageInvite";

const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

/** The owner's UI/UX audit, items 4, 5 and 6 (2026-10-29). */
describe("UI/UX audit fixes", () => {
  it("4: the language card leaves the buying pages alone and goes by itself", () => {
    expect(quietPage("/product/lose-hill-panja-kr-206")).toBe(true);
    expect(quietPage("/cart")).toBe(true);
    expect(quietPage("/checkout")).toBe(true);
    expect(quietPage("/")).toBe(false);
    expect(quietPage("/shop/ladies-slippers")).toBe(false);
    const card = read("components/LanguageInvite.tsx");
    expect(card).toContain("const STAY_MS = 10_000;");
    expect(card).toContain("const MAX_SHOWINGS = 2;");
    // The provider saves "en" by itself, so only "ne" means already chosen.
    expect(card).toContain('getItem(SAVED_KEY) === "ne") return;');
  });

  it("5: no shop text under 12px in the trust cards, the delivery facts or the language switch", () => {
    for (const file of ["components/TrustStrip.tsx", "app/page.tsx", "components/NavbarControls.tsx"]) {
      const source = read(file);
      expect(source, file).not.toMatch(/text-\[(?:9|10|10\.5|11|11\.5)px\][^"]*(?:leading|font-bold|uppercase)/);
    }
    expect(read("components/NavbarControls.tsx")).toContain("[&>button]:text-xs");
  });

  it("admin sidebar grows with the text size, and the size letter follows the language", () => {
    expect(read("app/admin/AdminNav.tsx")).toContain('"lg:w-[15rem]"');
    expect(read("app/admin/AdminNav.tsx")).toContain('<span className="break-words text-xs font-semibold');
    expect(read("components/admin/SidebarProvider.tsx")).toContain('"lg:grid-cols-[15rem_1fr]"');
    const size = read("components/admin/AdminTextSize.tsx");
    expect(size).toContain('{children ?? text("A", "अ")}');
    expect(size).not.toMatch(/>\s*अ\s*</);
  });

  it("dashboard money figures shrink to their cell instead of running into the next one", () => {
    const board = read("components/admin/OwnerDashboard.tsx");
    expect(board.match(/\[container-type:inline-size\]/g)?.length).toBe(2);
    expect(board.match(/whitespace-nowrap font-display text-\[length:min\(1\.875rem,13\.5cqi\)\]/g)?.length).toBe(2);
  });

  it("6: the chat bubble steps aside on a phone while the customer scrolls down", () => {
    const bubble = read("components/AiAssistant.tsx");
    expect(bubble).toContain("setTucked(y > lastY && y > 80)");
    expect(bubble).toContain("max-md:translate-x-16 max-md:opacity-0");
  });
});
