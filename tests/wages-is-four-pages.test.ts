import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Wages & kharcha, as four pages instead of one scroll.
 *
 * It was eighteen sections on a single 783-line page, in the order they were
 * built rather than the order they are used: six CSV buttons, four summary
 * cards and an audit board, then eleven forms — five of which have never been
 * used once. Paying workers on Saturday meant scrolling past every one of them.
 *
 * The factory side already reads well this way — a small nav across the top,
 * one job per page — so this is the same shape, named for the work.
 */
const DIR = "app/admin/operations/production-accounts";
const WEEK = `${DIR}/page.tsx`;
const PAYMENTS = `${DIR}/payments/page.tsx`;
const RATES = `${DIR}/rates/page.tsx`;
const LOTS = `${DIR}/lots/page.tsx`;
const NAV = `${DIR}/_components/wages-nav.tsx`;

async function read(path: string) {
  return readFile(path, "utf8");
}

describe("the four pages", () => {
  it("keeps the original path as the page opened daily", async () => {
    // Every existing link, bookmark and menu entry points here. Moving it would
    // have broken all of them for the sake of a tidier URL.
    const week = await read(WEEK);

    expect(week).toContain("export default async function WagesWeekPage");
  });

  it("leads with the week, because wages are settled Saturday to Friday", async () => {
    const week = await read(WEEK);

    // The four cards this replaced read work_date = CURRENT_DATE, so they were
    // all zero on any morning before the first entry — which is most mornings,
    // and was what the owner saw beside a month holding 240 pairs.
    expect(week).toContain("saturdayToFridayPeriod");
    expect(week).toContain("weekEarned");
    expect(week).toContain("This week&rsquo;s wage");
  });

  it("still shows today, in one line rather than four cards", async () => {
    const week = await read(WEEK);

    expect(week).toContain("control.todayGoodPairs");
  });

  it("puts every form on exactly one page", async () => {
    const pages = Object.fromEntries(
      await Promise.all(
        [WEEK, PAYMENTS, RATES, LOTS].map(async (path) => [path, await read(path)] as const),
      ),
    );

    // A form that appears twice is two ways to enter the same thing, which is
    // how this shop's ledgers drifted apart in the first place.
    const actions = [
      "createProductionItemAction",
      "saveStageRateAction",
      "saveWorkerStageRateAction",
      "mapProductionItemAction",
      "approvePackingQcAction",
      "saveItemMaterialAction",
      "approveCostCardAction",
      "createWorkOrderAction",
      "createHandoverAction",
      "createWorkerPaymentAction",
    ];

    for (const action of actions) {
      const found = Object.entries(pages).filter(([, source]) =>
        source.includes(`action={${action}}`),
      );
      expect(found.length, `${action} should be on exactly one page`).toBe(1);
    }
  });

  it("keeps Saturday's payment one tap from the daily page", async () => {
    const week = await read(WEEK);
    const payments = await read(PAYMENTS);

    expect(week).toContain(`${"/admin/operations/production-accounts/payments"}`);
    expect(payments).toContain("Saturday payment center");
    expect(payments).toContain("createWorkerPaymentAction");
  });

  it("keeps the never-used forms together, off the daily path", async () => {
    const lots = await read(LOTS);
    const week = await read(WEEK);

    // Work Orders, handovers, QC postings, recipes and cost cards are all
    // empty tables. They are built and they are next; they are not daily.
    for (const form of ["createWorkOrderAction", "createHandoverAction", "approvePackingQcAction"]) {
      expect(lots).toContain(form);
      expect(week).not.toContain(form);
    }
  });
});

describe("the nav across the top", () => {
  it("names the four pages for the work, not the tables", async () => {
    const nav = await read(NAV);

    for (const label of ["This week", "Payments", "Wage rates", "Lots & cost"]) {
      expect(nav).toContain(label);
    }
    expect(nav).toContain("हप्ता");
    expect(nav).toContain("भुक्तानी");
  });

  it("matches the week page exactly, so it is not lit on every child", async () => {
    const nav = await read(NAV);

    // The week page is the parent path; startsWith would mark it current on
    // all four.
    expect(nav).toContain("pathname === link.href");
  });
});
