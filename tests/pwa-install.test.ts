import { readFile, access } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Whether KRISHOE installs as a real app on a real phone.
 *
 * The manifest declared its icons as inline SVG data URIs containing a 👟
 * emoji, while three properly drawn PNGs sat unused in public/icons. iOS
 * ignores SVG icons entirely, and Android renders the emoji at whatever its own
 * font decides — so the shop's own logo, which exists, was reaching neither
 * platform. On the phone the owner actually uses, the installed app wore a
 * coloured square.
 *
 * It also advertised a share target at /api/share, a route that does not exist:
 * Android offered "share to KRISHOE" in every share sheet on the device and the
 * share landed on a 404.
 */

const manifestPromise = readFile("public/manifest.json", "utf8").then(
  (raw) =>
    JSON.parse(raw) as {
      theme_color: string;
      display: string;
      icons: { src: string; sizes: string; type: string; purpose: string }[];
      shortcuts?: { url: string }[];
      share_target?: unknown;
    },
);

describe("the app icon", () => {
  it("uses the drawn PNGs, not an emoji in an SVG", async () => {
    const manifest = await manifestPromise;

    for (const icon of manifest.icons) {
      expect(icon.type, icon.src).toBe("image/png");
      expect(icon.src, icon.src).toMatch(/^\/icons\//);
      // A data URI here is what put an emoji on the home screen.
      expect(icon.src, icon.src).not.toMatch(/^data:/);
    }
  });

  it("points at files that are actually there", async () => {
    const manifest = await manifestPromise;

    for (const icon of manifest.icons) {
      await expect(access(`public${icon.src}`), icon.src).resolves.toBeUndefined();
    }
  });

  it("offers a maskable icon, so Android does not crop the logo", async () => {
    const manifest = await manifestPromise;
    const purposes = manifest.icons.map((icon) => icon.purpose);

    expect(purposes).toContain("maskable");
    expect(purposes).toContain("any");
  });

  it("still gives iOS its own icon, which ignores the manifest", async () => {
    // iOS reads <link rel="apple-touch-icon">, which Next emits from this file.
    await expect(access("app/apple-icon.png")).resolves.toBeUndefined();
  });
});

describe("what the installed app looks like", () => {
  it("wears the brand colour, not a stray blue", async () => {
    const manifest = await manifestPromise;
    const pwa = await readFile("lib/pwa.ts", "utf8");

    // #1f3a93 was a blue from nowhere in this shop; the status bar and the app
    // switcher showed it while every page showed green.
    expect(manifest.theme_color).toBe("#10231D");
    expect(pwa).toContain("#10231D");
  });

  it("opens as an app rather than inside the browser", async () => {
    const manifest = await manifestPromise;
    const pwa = await readFile("lib/pwa.ts", "utf8");

    expect(manifest.display).toBe("standalone");
    // Safari before iOS 17 reads only the apple-prefixed name, and without it
    // an added-to-home-screen KRISHOE opens in Safari with the address bar.
    expect(pwa).toContain("apple-mobile-web-app-capable");
    expect(pwa).toContain("viewportFit");
  });
});

describe("what the manifest promises", () => {
  it("advertises no feature that has no route behind it", async () => {
    const manifest = await manifestPromise;

    // share_target put KRISHOE in every share sheet on the phone and sent the
    // share to a 404.
    expect(manifest.share_target).toBeUndefined();
  });

  it("only shortcuts to pages that exist", async () => {
    const manifest = await manifestPromise;
    const pages: Record<string, string> = {
      "/admin/orders": "app/admin/orders/page.tsx",
      "/shop": "app/shop/page.tsx",
      "/worker/dashboard": "app/worker/dashboard/page.tsx",
    };

    for (const shortcut of manifest.shortcuts ?? []) {
      const file = pages[shortcut.url];
      expect(file, shortcut.url).toBeDefined();
      await expect(access(file), shortcut.url).resolves.toBeUndefined();
    }
  });
});
