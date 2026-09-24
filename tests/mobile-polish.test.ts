import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { categories, isStandInPhoto } from "@/lib/products";

/**
 * What a phone and a tablet showed, measured in a real browser at Pixel 7,
 * iPhone SE and iPad Mini sizes, and what was changed because of it.
 */

async function sourceFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await sourceFiles(full)));
    else if (/\.(tsx|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function contrast(foreground: string, background: string) {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

describe("colours that could not be read", () => {
  it("uses no opacity step Tailwind does not generate", async () => {
    // text-white/78 produced no CSS at all, so the About page's paragraphs and
    // the cart's totals fell back to dark body ink on a dark green panel.
    const offenders: string[] = [];
    for (const file of [...(await sourceFiles("app")), ...(await sourceFiles("components"))]) {
      const source = await readFile(file, "utf8");
      for (const match of source.matchAll(/\b(?:text|bg|border|ring|from|to|via|fill|stroke|divide|outline|decoration|placeholder)-[a-z]+(?:-[a-z0-9]+)*\/(\d+)\b/g)) {
        if (Number(match[1]) % 5 !== 0) offenders.push(`${file}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("gives the small grey and gold text at least 4.5:1 on paper", async () => {
    const config = await readFile("tailwind.config.js", "utf8");
    const token = (name: string) => config.match(new RegExp(`"${name}": "(#[0-9A-Fa-f]{6})"`))?.[1] ?? "";
    for (const name of ["muted-soft", "gold-deep"]) {
      const colour = token(name);
      expect(colour, name).toMatch(/^#/);
      expect(contrast(colour, "#FDFBF7"), `${name} on paper`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("names white on the dark panels where a <p> would otherwise take body ink", async () => {
    expect(await readFile("components/admin/TodaySales.tsx", "utf8")).toContain("font-black leading-none text-white sm:text-6xl");
    expect(await readFile("components/Footer.tsx", "utf8")).toContain("gap-y-1 text-white/85");
  });
});

describe("the foot of a phone screen", () => {
  it("gives a product page one bar, the one that buys", async () => {
    const tabs = await readFile("components/BottomTabBar.tsx", "utf8");
    expect(tabs).toContain('isProduct ? "max-md:hidden" : ""');
    const buy = await readFile("components/ProductDetailActions.tsx", "utf8");
    expect(buy).toContain("fixed inset-x-3 bottom-[calc(0.65rem+env(safe-area-inset-bottom))] z-40");
    expect(buy).not.toContain("bottom-[calc(5.25rem");
  });

  it("puts the language question above the tab bar, not across it", async () => {
    const invite = await readFile("components/LanguageInvite.tsx", "utf8");
    expect(invite).not.toContain("fixed inset-x-3 bottom-3 ");
  });

  it("keeps the assistant bubble off the buying pages on a phone", async () => {
    const assistant = await readFile("components/AiAssistant.tsx", "utf8");
    expect(assistant).toContain('buyingPage ? "max-lg:hidden" : ""');
  });

  it("gets the bars out of the way while typing, but only while a box has focus", async () => {
    const hook = await readFile("lib/use-keyboard-open.ts", "utf8");
    expect(hook).toContain("window.innerHeight - viewport.height > 150 && editableHasFocus()");
    for (const file of ["components/BottomTabBar.tsx", "app/admin/AdminQuickDock.tsx"]) {
      const source = await readFile(file, "utf8");
      expect(source, file).toContain("useKeyboardOpen()");
      expect(source, file).toContain('keyboardOpen ? "translate-y-[150%]" : ""');
    }
  });

  it("labels the bottom bars in 12px, not 10px", async () => {
    for (const file of ["components/BottomTabBar.tsx", "app/admin/AdminQuickDock.tsx"]) {
      const source = await readFile(file, "utf8");
      expect(source, file).not.toContain("text-[10px] font-black");
    }
  });
});

describe("the shop's first screen", () => {
  it("makes the delivery promise once, in the header", async () => {
    const home = await readFile("app/page.tsx", "utf8");
    expect(home).not.toContain("order on WhatsApp too");
    expect(home).not.toContain("deliveryBadge");
    expect(home).toContain('en="Delivery across Nepal"');
  });

  it("keeps the header strip readable and one line on a phone", async () => {
    const nav = await readFile("components/Navbar.tsx", "utf8");
    expect(nav).not.toContain("text-[11px]");
    expect(nav).toContain('className="hidden flex-none items-center gap-1 sm:flex"');
    expect(nav).toContain("h-10 w-[56px]");
  });
});

describe("a product without its own photo", () => {
  it("is not shown another shoe's picture", () => {
    for (const category of categories) expect(isStandInPhoto(category.image)).toBe(true);
    expect(isStandInPhoto("https://example.public.blob.vercel-storage.com/products/own.jpg")).toBe(false);
    expect(isStandInPhoto("")).toBe(false);
  });

  it("gets the photo-coming tile on the card and the product page", async () => {
    expect(await readFile("components/ProductCard.tsx", "utf8")).toContain("isStandInPhoto(product.image) ? (");
    const gallery = await readFile("components/ProductGallery.tsx", "utf8");
    expect(gallery).toContain("isStandInPhoto(src)");
    expect(gallery).toContain("<NoPhotoYet name={name} />");
  });
});

describe("one heading per page", () => {
  it("demotes the form headings that sat under a page heading", async () => {
    for (const file of [
      "components/CartClient.tsx",
      "components/CheckoutClient.tsx",
      "components/WishlistClient.tsx",
      "components/account/AccountLoginForm.tsx",
      "components/account/AccountRegisterForm.tsx",
    ]) {
      expect(await readFile(file, "utf8"), file).not.toContain("<h1");
    }
  });

  it("gives the doors page a heading", async () => {
    expect(await readFile("app/enter/page.tsx", "utf8")).toContain("<h1 className=\"mb-0 font-tech");
  });
});

describe("the admin on a phone", () => {
  it("says where you are once: the band carries the trail on a factory or shop screen", async () => {
    const band = await readFile("app/admin/WorkspaceBand.tsx", "utf8");
    expect(band).toContain("adminTrail(pathname)");
    const trail = await readFile("app/admin/AdminTrail.tsx", "utf8");
    expect(trail).toContain('if (workspaceForPath(pathname ?? "") !== "both") return null;');
  });

  it("keeps the factory header to its row of sections, and lets it scroll away", async () => {
    const nav = await readFile("app/admin/factory/_components/factory-nav.tsx", "utf8");
    expect(nav).toContain('<div className="mb-2 hidden items-center justify-between gap-3 lg:flex">');
    expect(nav).toContain("lg:sticky lg:top-0");
    expect(nav).not.toContain("sticky top-[calc(3.5rem");
  });

  it("opens POS on the bill", async () => {
    const pos = await readFile("app/admin/pos/page.tsx", "utf8");
    expect(pos).toContain("max-md:-order-1");
    expect(pos).toContain('ne="⋯ थप: रिपोर्ट र दिन बन्द"');
  });

  it("gives the search box room beside a narrower language switch", async () => {
    const layout = await readFile("app/admin/layout.tsx", "utf8");
    expect(layout).toContain('<LanguageSwitch compact className="[&>button]:px-2.5 sm:[&>button]:px-3.5" />');
  });
});

describe("the admin on a tablet", () => {
  it("draws the sidebar as a rail of icons and leaves the phone dock off", async () => {
    const provider = await readFile("components/admin/SidebarProvider.tsx", "utf8");
    expect(provider).toContain("md:grid-cols-[80px_1fr]");
    const nav = await readFile("app/admin/AdminNav.tsx", "utf8");
    expect(nav).toContain("const isCollapsed = chosenCollapsed || onTablet;");
    expect(nav).toContain("md:block md:w-20");
    const dock = await readFile("app/admin/AdminQuickDock.tsx", "utf8");
    expect(dock).toContain("md:hidden print:hidden");
    expect(dock).not.toContain("lg:hidden");
  });
});

describe("losing the signal", () => {
  it("says so everywhere, and never resends an entry on its own", async () => {
    const layout = await readFile("app/layout.tsx", "utf8");
    expect(layout).toContain("<OfflineNotice />");
    const notice = await readFile("components/OfflineNotice.tsx", "utf8");
    expect(notice).not.toMatch(/fetch\(|requestSubmit|localStorage/);
  });
});
