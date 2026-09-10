import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * A staff member's month, entry by entry.
 *
 * A piece-rate worker's ledger lists every row — what was made, what was paid,
 * when. Monthly staff got four tiles and a form: "Total paid Rs. 12,000" with
 * nothing behind it, so there was no way to see that a salary went out on the
 * 5th and an advance on the 12th, or to spot one entered twice. The owner asked
 * to see suchana's ledger and there was nothing to show them.
 *
 * The rows live in two tables because they are two different things — salary
 * payments in factory_worker_ledger, advances in factory_weekly_advance — and
 * the screen wants one list in date order.
 */
const API = "app/api/factory/salary/route.ts";
const SCREEN = "app/admin/factory/salary/StaffSalary.tsx";

describe("the staff salary API", () => {
  it("returns the month's entries, not only its totals", async () => {
    const api = await readFile(API, "utf8");

    expect(api).toContain("entries: entries.map");
  });

  it("reads salary payments and advances as one list", async () => {
    const api = await readFile(API, "utf8");

    expect(api).toContain("FROM factory_worker_ledger");
    expect(api).toContain("FROM factory_weekly_advance");
    expect(api).toContain("UNION ALL");
    expect(api).toContain("'payment' AS kind");
    expect(api).toContain("'advance' AS kind");
  });

  it("keeps them in the order they happened", async () => {
    const api = await readFile(API, "utf8");

    const union = api.slice(api.indexOf("'payment' AS kind"), api.indexOf("const totalSalary"));
    expect(union).toContain("ORDER BY date ASC");
  });

  it("counts a month the Bikram way, both ends given", async () => {
    const api = await readFile(API, "utf8");
    const union = api.slice(api.indexOf("'payment' AS kind"), api.indexOf("const totalSalary"));

    // Bhadra runs 17 August to 17 September and Asoj 17 September to 18
    // October — start + INTERVAL '1 month' drops a day of someone's pay.
    expect(union).toContain("range.startKey");
    expect(union).toContain("range.endKey");
  });

  it("caps the read, like every other list query", async () => {
    const api = await readFile(API, "utf8");
    const union = api.slice(api.indexOf("'payment' AS kind"), api.indexOf("const totalSalary"));

    expect(union).toMatch(/LIMIT \d+/);
  });
});

describe("what the owner sees", () => {
  it("lists the entries under the totals", async () => {
    const screen = await readFile(SCREEN, "utf8");

    expect(screen).toContain(`text("This month's entries", "यो महिनाका entry")`);
    expect(screen).toContain("summary.entries");
  });

  it("says which kind each row is", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // Both are money going out, so both carry a minus; the type says which.
    expect(screen).toContain(`text("Advance / kharcha", "पेस्की / खर्च")`);
    expect(screen).toContain(`text("Salary payment", "तलब")`);
  });

  it("marks a reversed entry rather than showing it as a second payment", async () => {
    const screen = await readFile(SCREEN, "utf8");
    const table = screen.slice(screen.indexOf("This month's entries"));

    expect(table).toContain(`entry.status === "reversed"`);
    expect(table).toContain("line-through");
  });

  it("reflows into cards on a phone", async () => {
    const screen = await readFile(SCREEN, "utf8");
    const table = screen.slice(screen.indexOf("This month's entries"));

    expect(table).toContain("reflow-table");
    expect(table).toContain("reflow-primary");
    expect(table).toContain("overflow-x-auto");
  });

  it("says so plainly when the month is empty", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // suchana has no entries at all; a bare table would read as broken.
    expect(screen).toContain("Nothing paid or advanced this month yet");
  });
});
