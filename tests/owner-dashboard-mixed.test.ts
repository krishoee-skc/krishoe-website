import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { bsMonthSoFar, netSalesBetween, salesByDay, stockAtSellingPrice } from "@/lib/dashboard-figures";

/**
 * The owner's dashboard, as chosen on 2026-09-28 from two samples: the news
 * strip and shop/factory halves of one, the day's money and "what now" of the
 * other, a seven-day chart under it.
 */
describe("stock at selling price", () => {
  it("reads price_value as paisa — it showed Rs. 99,80,000 for about Rs. 99,800", () => {
    expect(stockAtSellingPrice([{ priceValue: 46_400, stock: 215 }])).toBe(99_760);
    expect(stockAtSellingPrice([{ priceValue: 50_000, stock: -3 }])).toBe(0);
  });
});

const invoices = [
  { createdAt: "2026-09-28T04:00:00Z", kind: "Sale", status: "Paid", total: 1000 },
  { createdAt: "2026-09-28T05:00:00Z", kind: "Return", status: "Returned", total: 200 },
  { createdAt: "2026-09-28T06:00:00Z", kind: "Sale", status: "Voided", total: 5000 },
  { createdAt: "2026-09-25T06:00:00Z", kind: "Sale", status: "Credit", total: 700 },
  // 18:30 UTC on the 27th is 00:15 on the 28th in Nepal.
  { createdAt: "2026-09-27T18:30:00Z", kind: "Sale", status: "Paid", total: 300 },
];

describe("the last seven days", () => {
  const now = new Date("2026-09-28T08:00:00Z");

  it("are Nepal days, oldest first, today last, net of returns and without voided bills", () => {
    const days = salesByDay(invoices, 7, now);
    expect(days).toHaveLength(7);
    expect(days[6]).toMatchObject({ key: "2026-09-28", today: true, net: 1100 });
    expect(days[3]).toMatchObject({ key: "2026-09-25", net: 700 });
    expect(days[0].key).toBe("2026-09-22");
  });

  it("add up over a range", () => {
    expect(netSalesBetween(invoices, "2026-09-22", "2026-09-29")).toBe(1800);
  });
});

describe("the Bikram Sambat month", () => {
  it("is Asoj 2083 so far on 28 September 2026", () => {
    const month = bsMonthSoFar(new Date("2026-09-28T08:00:00Z"));
    expect(month?.startKey).toBe("2026-09-17");
    expect(month?.endKey).toBe("2026-09-29");
    expect(month?.dayOfMonth).toBe(12);
    expect(month?.daysInMonth).toBeGreaterThanOrEqual(29);
  });
});

describe("the screen", () => {
  it("gives the owner the mixed dashboard and keeps staff on theirs", async () => {
    const page = await readFile("app/admin/page.tsx", "utf8");
    expect(page).toContain("<OwnerDashboard");
    expect(page).toContain("<StaffToday");
    expect(page).not.toContain("(product?.priceValue || 0) * (product?.stock || 0)");
    expect(page).toContain("stockValue: stockAtSellingPrice(active),");
  });

  it("calls sales less purchases what it is, and names a sold-out shoe as sold out", async () => {
    const page = await readFile("app/admin/page.tsx", "utf8");
    const card = await readFile("components/admin/OwnerDashboard.tsx", "utf8");
    expect(card).toContain('"नाफा होइन · किनेको माल स्टकमै छ"');
    expect(card).not.toContain("This month's profit");
    expect(page).toContain("ne: `${names(soldOut)} सकियो`,");
  });

  it("moves: counting numbers, a clock, the strip, periods, ticks, keys and the chart's tooltip", async () => {
    const card = await readFile("components/admin/OwnerDashboard.tsx", "utf8");
    for (const piece of [
      "function useCountUp(",
      "function useNepalClock(",
      "setTurn((value) => value + 1)",
      "aria-pressed={period === key}",
      "function toggleDone(",
      'if (key === "b") router.push("/admin/pos");',
      "onMouseEnter={() => setHoverDay(day.key)}",
    ]) {
      expect(card, piece).toContain(piece);
    }
  });
});
