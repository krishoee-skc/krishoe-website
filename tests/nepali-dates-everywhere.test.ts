import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { formatAdminDate } from "@/lib/format-date";

/** Source with comments removed. */
function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
}

async function screens(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...(await screens(path)));
    else if (entry.name.endsWith(".tsx")) found.push(path);
  }

  return found;
}

/**
 * A Nepali shop reads dates in Bikram Sambat. Half the app already did — bills,
 * POS, purchasing, customers, HR — and the other half was still printing
 * "8/31/2026", which is the one the owner spotted on the goals panel.
 *
 * The rule is not "no English date". It is that a date shown to a person
 * carries both, which is what formatAdminDate and DateDisplayAdmin produce:
 * the English one for a courier or a bank, the Nepali one for everybody in the
 * building.
 */
const DATE_METHODS = /\.toLocaleDateString\(|new Date\([^)]*\)\.toLocaleString\(/;

describe("dates shown to a person", () => {
  it("do not go out in the English calendar alone", async () => {
    const files = [
      ...(await screens("app/admin")),
      ...(await screens("app/account")),
      ...(await screens("components/admin")),
      ...(await screens("components/account")),
    ];
    expect(files.length).toBeGreaterThan(40);

    const offenders: string[] = [];
    for (const file of files) {
      // The date components are where the English format is built on purpose.
      if (file.includes("DateDisplay")) continue;
      const source = code(await readFile(file, "utf8"));
      if (DATE_METHODS.test(source)) offenders.push(file);
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("reaches the panel the owner pointed at", async () => {
    const goals = await readFile("components/admin/AdvancedAnalyticsDashboard.tsx", "utf8");

    // "Due: 8/31/2026" — an English month-end on a shop that closes its books
    // on the Nepali one.
    expect(goals).toContain("formatAdminDate(goal.deadline)");
  });

  it("reaches the two the owner reads for money", async () => {
    const orders = await readFile("app/admin/OrdersClient.tsx", "utf8");
    const payments = await readFile("app/admin/payments/page.tsx", "utf8");

    expect(orders).toContain("<DateDisplayAdmin date={order.createdAt} />");
    expect(payments).toContain("<DateDisplayAdmin date={transaction.createdAt} time />");
  });

  it("reaches the worker's own ledger", async () => {
    const ledger = await readFile("app/admin/factory/ledger/page.tsx", "utf8");

    // Where a wage disagreement gets settled.
    expect(ledger).toContain("<DateDisplayAdmin date={entry.date} />");
  });
});

describe("what a formatted date actually says", () => {
  it("carries both calendars", () => {
    const shown = formatAdminDate("2026-08-22T06:00:00.000Z");

    expect(shown).toContain("2026");
    // 22 August 2026 is 6 Bhadra 2083.
    expect(shown).toContain("B.S 2083");
  });

  it("says nothing rather than something wrong", () => {
    expect(formatAdminDate("not a date")).toBe("");
  });
});

/**
 * A review's date is read by a shopper deciding whether to buy. ne-NP gave the
 * English calendar in Nepali numerals — a month no Nepali shopper counts by,
 * which is worse than plain English because it looks correct.
 */
describe("a review's date", () => {
  it("is Bikram Sambat for a Nepali reader", async () => {
    const reviews = await readFile("components/ProductReviews.tsx", "utf8");

    expect(reviews).toContain("toBikramSambatNepali(review.createdAt)");
    expect(code(reviews)).not.toContain('"ne-NP"');
  });
});
