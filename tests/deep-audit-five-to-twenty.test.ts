import { existsSync, readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { databaseAnswers, forgetDatabaseAnswer, REMEMBER_MS } from "@/lib/database-answer-memo";

const read = (path: string) => readFileSync(path, "utf8");

// Deep audit of 2026-10-20, items 5–20; the owner said "ङ garau" on 2026-10-24.
describe("the open health checks cannot keep the database awake (16)", () => {
  beforeEach(() => forgetDatabaseAnswer());

  it("asks once and remembers the answer for 30 seconds", async () => {
    let asked = 0;
    let clock = 1_000;
    const ask = async () => {
      asked += 1;
      return true;
    };
    expect(await databaseAnswers(ask, () => clock)).toBe(true);
    clock += REMEMBER_MS - 1;
    expect(await databaseAnswers(ask, () => clock)).toBe(true);
    expect(asked).toBe(1);
    clock += 2;
    await databaseAnswers(ask, () => clock);
    expect(asked).toBe(2);
  });

  it("lets calls that land together share one ask, and reads a failure as down", async () => {
    let asked = 0;
    const ask = async () => {
      asked += 1;
      throw new Error("asleep");
    };
    const answers = await Promise.all([databaseAnswers(ask), databaseAnswers(ask), databaseAnswers(ask)]);
    expect(answers).toEqual([false, false, false]);
    expect(asked).toBe(1);
  });

  it("is used by both open routes", () => {
    for (const route of ["app/api/health/route.ts", "app/api/deployment-info/route.ts"]) {
      expect(read(route), route).toContain("databaseAnswers(");
      expect(read(route), route).toContain("CACHE_30S");
    }
  });
});

describe("the rest of 5–20 that was built", () => {
  it("13: three new sign-in codes per 15 minutes per account", () => {
    const source = read("app/admin/login/actions.ts");
    expect(source).toContain('bucket: "admin:mfa-resend", maxAttempts: 3, windowMs: 15 * 60 * 1000');
    expect(source).toContain("checkAndRecordRateLimit({ ...MFA_RESEND_LIMIT, key: staff.id })");
  });

  it("5: the worker door speaks Nepali whatever the phone was set to", () => {
    expect(read("components/AdminLoginForm.tsx")).toContain('(portal === "worker" ? nepali : chosen(english, nepali))');
  });

  it("7 and 8: one cart on a phone, one menu on a tablet", () => {
    expect(read("components/NavbarControls.tsx")).toContain('pathname.startsWith("/product/") ? "grid" : "hidden md:grid"');
    const tabs = read("components/BottomTabBar.tsx");
    expect(tabs).toContain("duration-200 md:hidden");
    expect(tabs).not.toContain("duration-200 lg:hidden");
  });

  it("9 and 11: readable trust lines and sizes, and the size named on Buy now", () => {
    expect(read("components/TrustStrip.tsx")).toContain("text-[13px]");
    expect(read("components/CardSizes.tsx")).not.toContain("text-[11px]");
    expect(read("components/ProductDetailActions.tsx")).toContain("Buy now · Size ${size}");
  });

  it("12: an empty checkout leads with the way back to the shop", () => {
    const client = read("components/CheckoutClient.tsx");
    expect(client).toContain("data-empty-checkout");
    expect(client.indexOf('text("Go to the shop"')).toBeLessThan(client.indexOf('text("Choose a pair"'));
    expect(read("app/checkout/page.tsx")).toContain("group-has-[[data-empty-checkout]]:hidden");
  });

  it("19: the stale sitemap and the old plans are out of the way", () => {
    expect(existsSync("public/sitemap.xml")).toBe(false);
    expect(existsSync("app/sitemap.ts")).toBe(true);
    expect(existsSync("QUICK-START.md")).toBe(false);
    expect(existsSync("docs/old-plans/QUICK-START.md")).toBe(true);
  });
});
