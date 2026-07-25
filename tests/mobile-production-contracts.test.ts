import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("mobile production contracts", () => {
  it("keeps customer and admin navigation clear of phone safe areas", () => {
    expect(source("components/BottomTabBar.tsx")).toContain("env(safe-area-inset-bottom)");
    expect(source("app/admin/AdminQuickDock.tsx")).toContain("env(safe-area-inset-bottom)");
  });

  it("keeps frequent admin destinations one tap away", () => {
    const dock = source("app/admin/AdminQuickDock.tsx");
    for (const href of ["/admin/pos", "/admin/purchasing", "/admin/hr", "/admin/search"]) {
      expect(dock).toContain(href);
    }
  });

  it("reflows POS and staff tables into phone cards", () => {
    expect(source("app/admin/pos/_components/PosBillForm.tsx")).toContain("reflow-table");
    expect(source("app/admin/settings/page.tsx")).toContain("reflow-table");
  });

  it("registers an offline-capable service worker", () => {
    expect(source("components/ServiceWorkerRegistration.tsx")).toContain(
      'navigator.serviceWorker.register("/sw.js"',
    );
    expect(source("public/sw.js")).toContain('const OFFLINE_URL = "/offline"');
    expect(source("public/sw.js")).toContain('const CACHE_NAME = "krishoe-shell-v2"');
    expect(source("public/sw.js")).toContain("event.waitUntil(network");
  });

  it("supports installed apps in both portrait and landscape", () => {
    const manifest = source("app/manifest.ts");
    expect(manifest).toContain('scope: "/"');
    expect(manifest).not.toContain("orientation:");
  });

  it("prevents input zoom and horizontal overflow across touch devices", () => {
    const css = source("app/globals.css");
    expect(css).toContain("(pointer: coarse)");
    expect(css).toContain("(max-width: 1024px)");
    expect(css).toContain("overflow-x: hidden");
    expect(css).toContain("overflow-x: clip");
  });

  it("keeps camera scanning usable on iOS and Android", () => {
    const scanner = source("app/admin/pos/ScannerPanel.tsx");
    expect(scanner).toContain("playsInline");
    expect(scanner).toContain('capture="environment"');
    expect(scanner).toContain('accept="image/*"');
  });

  it("serves dedicated premium hero artwork for desktop and mobile", () => {
    const homepage = source("app/page.tsx");
    expect(homepage).toContain("/images/hero-krishoe-gold-v2.png");
    expect(homepage).toContain("/images/mobile-hero-krishoe-gold-v2.png");
    expect(homepage).toContain("Your Identity.");
    expect(homepage).toContain("The Signature Collection");
    expect(homepage).toContain("/icons/icon.svg");
    expect(homepage).toContain("Walk with Authority");
    expect(homepage).toContain("bg-[#651B24]/95");
    expect(homepage).not.toContain("Trusted support");
  });
});

describe("scheduled report safety contracts", () => {
  it("runs the daily report and conditionally adds weekly and monthly reports", () => {
    const cron = source("app/api/cron/daily-sales/route.ts");
    expect(cron).toContain('name: "daily"');
    expect(cron).toContain('name: "weekly"');
    expect(cron).toContain('name: "monthly"');
    expect(cron).toContain("Promise.allSettled");
  });

  it("keeps a one-hour idempotent backup schedule", () => {
    const config = JSON.parse(source("vercel.json")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    expect(config.crons).toEqual(
      expect.arrayContaining([
        { path: "/api/cron/daily-sales", schedule: "15 14 * * *" },
        { path: "/api/cron/daily-sales-backup", schedule: "15 15 * * *" },
      ]),
    );
  });
});

describe("database transport safety contracts", () => {
  it("removes ambiguous legacy sslmode and configures certificate verification explicitly", () => {
    const client = source("lib/postgres/client.ts");
    expect(client).toContain('url.searchParams.delete("sslmode")');
    expect(client).toContain("rejectUnauthorized: true");
    expect(client).toContain("connectionStringWithoutLegacySslMode(config.databaseUrl)");
  });
});
