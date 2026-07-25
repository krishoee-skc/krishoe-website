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
