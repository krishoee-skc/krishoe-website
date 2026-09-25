import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { formatAdminDate } from "@/lib/format-date";

/**
 * Four places still showed an English date alone — a work order's window, the
 * latest activity, a customer's order page, and a review in English — while
 * everywhere else read "24 Sept 2026 · B.S 2083/06/08". The owner reads the
 * B.S date first; these now carry it too.
 */

describe("every date carries its B.S date", () => {
  it("reads the English date, then B.S", () => {
    expect(formatAdminDate("2026-09-24T06:00:00Z")).toBe("24 Sept 2026 · B.S 2083/06/08");
  });

  it.each([
    ["app/admin/operations/production-accounts/work-order/[id]/page.tsx", "formatAdminDate(value, { time: true })"],
    ["app/admin/activity/page.tsx", "formatAdminDate(latestEvent.createdAt, { time: true })"],
    ["app/order/[id]/page.tsx", "formatAdminDate(value, { time: true })"],
    ["components/ProductReviews.tsx", ": formatAdminDate(review.createdAt)"],
  ])("%s", async (file, call) => {
    const source = await readFile(file, "utf8");
    expect(source).toContain(call);
    expect(source).not.toMatch(/toLocaleDateString\(|new Intl\.DateTimeFormat\("en-GB"/);
  });

  it("keeps the review in Nepali words for a Nepali reader", async () => {
    const reviews = await readFile("components/ProductReviews.tsx", "utf8");
    expect(reviews).toContain("toBikramSambatNepali(review.createdAt)");
  });
});
