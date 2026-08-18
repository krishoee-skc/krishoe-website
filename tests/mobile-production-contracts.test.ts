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

  it("keeps the daily jobs one tap away", () => {
    const dock = source("app/admin/AdminQuickDock.tsx");
    // Booking a worker's pairs and checking stock happen every day and were not
    // on this bar at all, while Purchasing and HR — which this shop has never
    // recorded a single row in — took two of its five slots.
    for (const href of ["/admin/factory/add-work", "/admin/pos", "/admin/stock", "/admin/search"]) {
      expect(dock, href).toContain(href);
    }
    expect(dock).not.toContain("/admin/purchasing");
  });

  it("reflows POS and renders staff access as phone-first cards", () => {
    expect(source("app/admin/pos/_components/PosBillForm.tsx")).toContain("reflow-table");
    const staffCards = source("components/admin/StaffAccessManager.tsx");
    expect(staffCards).toContain("xl:grid-cols-2");
    expect(staffCards).toContain("Staff accounts");
    expect(staffCards).not.toContain("<table");
  });

  it("offers a fast stock-aware POS product picker", () => {
    const pos = source("app/admin/pos/_components/PosBillForm.tsx");
    expect(pos).toContain("Search item, SKU, size or scan barcode");
    expect(pos).toContain("Items ready to sell");
    expect(pos).toContain("addCatalogItem(item)");
    expect(pos).toContain("item.stock > 0");
    expect(pos).toContain("rateForChannel(channel, item)");
  });

  it("registers an offline-capable service worker", () => {
    expect(source("components/ServiceWorkerRegistration.tsx")).toContain(
      'navigator.serviceWorker.register("/sw.js"',
    );
    const worker = source("public/sw.js");
    expect(worker).toContain('const OFFLINE_URL = "/offline"');
    expect(worker).toContain('const CACHE_NAME = "krishoe-shell-v2"');
    expect(worker).toContain('fetch(request, { cache: "no-store" })');
    expect(worker).toContain('pathname.startsWith("/_next/static/")');
    expect(worker).not.toContain("caches.open(RUNTIME_CACHE).then((cache)");
  });

  it("never caches API, admin, account, checkout or worker responses", () => {
    const worker = source("public/sw.js");
    for (const prefix of ["/api", "/admin", "/account", "/checkout", "/worker"]) {
      expect(worker).toContain(`\"${prefix}\"`);
    }
    expect(worker).toContain("if (isPrivatePath(url.pathname))");
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
    expect(scanner).toContain("autoPlay");
    expect(scanner).toContain('preload="metadata"');
    expect(scanner).toContain('capture="environment"');
    expect(scanner).toContain('accept="image/*"');
  });

  it("keeps the worker worksheet fast on mobile", () => {
    const hr = source("app/admin/hr/page.tsx");
    expect(hr).toContain("Daily worker worksheet");
    expect(hr).toContain('name="checkIn" type="time"');
    expect(hr).toContain('name="checkOut" type="time"');
    expect(hr).toContain("Monthly attendance report");
    expect(hr).toContain("Monthly payroll report");
  });

  it("serves dedicated premium hero artwork for desktop and mobile", () => {
    const homepage = source("app/page.tsx");
    expect(homepage).toContain("/images/hero-krishoe-gold-v2.png");
    expect(homepage).toContain("/images/mobile-hero-krishoe-gold-v2.png");
    expect(homepage).toContain("Your Identity.");
    expect(homepage).toContain("The Signature Collection");
    expect(homepage).toContain("/icons/icon.svg");
    expect(homepage).toContain("Walk with Authority");
    // The deep maroon band under the hero. Named rather than spelled as
    // #651B24: the storefront's colours moved into tailwind.config.js so that
    // near-identical twins of the same shade stop accumulating, and a test that
    // insists on the literal hex would pull them back out.
    expect(homepage).toContain("bg-brand-clay-ink/95");
    expect(homepage).not.toContain("Trusted support");
  });

  it("keeps contact and delivery information honest and centralized", () => {
    const contact = source("app/contact/page.tsx");
    const checkout = source("components/CheckoutClient.tsx");
    expect(contact).toContain("businessContact.streetAddress");
    expect(contact).toContain("businessContact.email");
    expect(contact).not.toContain("hello@krishoe.com");
    expect(checkout).toContain("Delivery charge is not included in the product total");
    expect(source("lib/seo.ts")).toContain("/images/hero-krishoe-gold-v2.png");
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
