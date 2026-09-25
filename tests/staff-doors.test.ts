import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import manifest from "@/lib/app-manifest";

/**
 * The owner, the staff and the workers had no way in from the shop: the
 * sign-in pages were reachable only by typing their address. And a worker who
 * put the portal on the home screen got the shop's app, which opened the shop.
 */

describe("the team's door in the shop", () => {
  it("is at the end of the menu", async () => {
    const menu = await readFile("components/NavbarControls.tsx", "utf8");
    expect(menu).toContain('href="/enter"');
    expect(menu).toContain('text("Staff & worker login", "स्टाफ र कामदार login")');
  });

  it("is a small lock at the foot of every page, beside Privacy and Terms, with no words", async () => {
    const footer = await readFile("components/Footer.tsx", "utf8");
    expect(footer).toContain('href="/enter"');
    expect(footer).toContain('aria-label="Staff and worker login"');
    expect(footer).toContain('<span aria-hidden="true">🔐</span>');
    expect(footer).not.toContain('<T en="Staff & worker login"');
  });

  it("leads to a page that exists", () => {
    expect(existsSync("app/enter/page.tsx")).toBe(true);
  });

  it("is not covered by the install bar at the end of a page", async () => {
    const card = await readFile("components/PwaInstallHelp.tsx", "utf8");
    expect(card).toContain('<div aria-hidden="true" className="max-lg:h-20 print:hidden" />');
  });
});

describe("the shop app's long-press menu", () => {
  it("offers the worker login beside the shop, cart and admin", () => {
    const shortcuts = manifest().shortcuts ?? [];
    expect(shortcuts.map((shortcut) => shortcut.url)).toEqual(["/shop", "/cart", "/admin", "/worker/login"]);
  });
});

describe("the worker portal as its own app", () => {
  it("names its own manifest, which a file convention would not allow", async () => {
    // app/manifest.ts puts its link on every page with nothing able to
    // override it; the shop's manifest is served from a route and named in the
    // root layout instead.
    expect(existsSync("app/manifest.ts")).toBe(false);
    expect(existsSync("app/manifest.webmanifest/route.ts")).toBe(true);
    const root = await readFile("app/layout.tsx", "utf8");
    expect(root).toContain('manifest: "/manifest.webmanifest"');
    const worker = await readFile("app/worker/layout.tsx", "utf8");
    expect(worker).toContain('manifest: "/worker.webmanifest"');
    expect(worker).toContain('icons: { apple: "/icons/worker-192.png" }');
  });

  it("opens the worker sign-in, installs beside the shop app, and has its icons", async () => {
    const app = JSON.parse(await readFile("public/worker.webmanifest", "utf8"));
    expect(app.start_url).toBe("/worker/login");
    expect(app.id).toBe("/worker");
    expect(app.id).not.toBe(manifest().start_url);
    // "/" so the first sign-in's password change stays inside the app window.
    expect(app.scope).toBe("/");
    expect(app.display).toBe("standalone");
    const sizes = app.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(app.icons.some((icon: { purpose: string }) => icon.purpose === "maskable")).toBe(true);
    for (const icon of app.icons) expect(existsSync(`public${icon.src}`), icon.src).toBe(true);
  });
});
