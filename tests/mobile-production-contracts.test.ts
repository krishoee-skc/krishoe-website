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
    // Versioned, not a specific version. A service worker whose file has not
    // changed is never reinstalled, so the number here has to move whenever the
    // worker does — pinning the literal made a correct bump look like a
    // regression. What must hold is that both caches carry the same version, or
    // the activate handler deletes the runtime cache it just filled.
    const shell = worker.match(/const CACHE_NAME = "krishoe-shell-v(\d+)"/);
    const runtime = worker.match(/const RUNTIME_CACHE = "krishoe-public-assets-v(\d+)"/);

    expect(shell?.[1]).toBeDefined();
    expect(runtime?.[1]).toBe(shell?.[1]);
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

  it("keeps the daily work entry fast on a phone", () => {
    const addWork = source("app/admin/factory/add-work/page.tsx");

    expect(addWork).toContain('type="date"');
    expect(addWork).toContain('type="number"');
    expect(addWork).toContain('text("Worker", "कामदार")');
    expect(addWork).toContain('text("Add daily work entry", "आजको काम टिप्नुहोस्")');

    // Every control on this form is thumb-height. A wage entry made standing
    // on a factory floor cannot need a fingertip.
    expect(addWork).not.toContain("h-8 px-2");
    expect((addWork.match(/min-h-12/g) ?? []).length).toBeGreaterThan(5);
  });

  it("serves dedicated premium hero artwork for desktop and mobile", () => {
    const homepage = source("app/page.tsx");
    expect(homepage).toContain("/images/hero-krishoe-gold-v2.png");
    expect(homepage).toContain("/images/mobile-hero-krishoe-gold-v2.png");
    expect(homepage).toContain("Your Identity.");
    expect(homepage).toContain("The Signature Collection");
    // The crest, not the placeholder. /icons/icon.svg was a rounded square
    // with a serif K typed into it — a stand-in from before the shop had a
    // logo — and it sat beside the word KRISHOE in the first thing any
    // customer sees. The real emblem is cut from the brand artwork.
    expect(homepage).toContain("/images/logo-mark.png");
    expect(homepage).not.toContain("/icons/icon.svg");
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
