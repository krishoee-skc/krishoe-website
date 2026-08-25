import { describe, expect, it } from "vitest";
import { formatAdminDate } from "@/lib/format-date";
import { toBikramSambatNumeric } from "@/lib/bikram-sambat";

/**
 * The shop keeps one clock, and it is not the server's.
 *
 * The owner caught this: a bill saved at 10:46 in the morning was reported as
 * 5:01 am. Neither the admin date formatter nor the Bikram Sambat converter
 * named a timezone, so both answered in whatever zone the machine was set to —
 * Kathmandu in the owner's browser, UTC on Vercel. Two answers for one moment,
 * and the wrong one arrives first, rendered into the page before the browser
 * hydrates and quietly corrects it.
 *
 * The date is the worse half. Nepal is UTC+5:45, so every moment between
 * midnight and a quarter to six in the morning is still YESTERDAY in UTC. A
 * bill written at one in the morning was filed against the previous day — in a
 * shop that closes its books by the day, and prints that date on the bill.
 *
 * These run under TZ=UTC in CI and under Kathmandu on the owner's machine, and
 * must give the same answer either way. That is the whole point.
 */

// 2026-08-25T05:01:15Z is the real bill the owner asked about: 10:46 am in
// Narayangadh, Bhadau 9.
const LILAS_BILL = "2026-08-25T05:01:15Z";

// 19:30 UTC is 01:15 the NEXT morning in Nepal — the case that moved the date.
const AFTER_MIDNIGHT = "2026-08-25T19:30:00Z";

describe("what time the shop says it is", () => {
  it("reads a bill at the hour it was written in Narayangadh", () => {
    expect(formatAdminDate(LILAS_BILL, { time: true })).toContain("10:46 am");
    expect(formatAdminDate(LILAS_BILL, { time: true })).not.toContain("5:01 am");
  });

  it("files a bill written after midnight against the day it happened", () => {
    // 26 August in Nepal, still 25 August in UTC.
    expect(formatAdminDate(AFTER_MIDNIGHT)).toContain("26 Aug 2026");
    expect(formatAdminDate(AFTER_MIDNIGHT, { time: true })).toContain("1:15 am");
  });

  it("gives the same Bikram Sambat day the shopkeeper would write", () => {
    expect(toBikramSambatNumeric(LILAS_BILL)).toBe("2083/05/09");
    // The day rolls with Nepal, not with UTC.
    expect(toBikramSambatNumeric(AFTER_MIDNIGHT)).toBe("2083/05/10");
  });

  it("names the zone rather than trusting the machine", async () => {
    const { readFile } = await import("node:fs/promises");
    const formatter = await readFile("lib/format-date.ts", "utf8");
    const calendar = await readFile("lib/bikram-sambat.ts", "utf8");

    expect(formatter).toContain("timeZone: NEPAL_TIME_ZONE");
    expect(calendar).toContain('NEPAL_TIME_ZONE = "Asia/Kathmandu"');
    // Every conversion, not the first one somebody remembered.
    expect(calendar).not.toContain("new NepaliDate(date)");
  });

  it("does not shift a date that carries no time of day", () => {
    // A plain calendar date has no zone to convert; it must survive untouched.
    expect(toBikramSambatNumeric("2026-08-25")).toBe("2083/05/09");
  });
});

/**
 * The fifteenth place.
 *
 * Fixing the admin formatter and the Nepali calendar left fourteen other date
 * formatters answering in whatever zone the machine was set to — the customer's
 * own order page among them, where a shopper in Qatar was shown a Qatari
 * timestamp for a Nepali shop's bill, and the nightly digest the owner reads at
 * eight. Every one is now pinned, and this counts them so a fifteenth cannot be
 * added quietly.
 *
 * Money formatting is deliberately not counted: `toLocaleString("en-IN")` on a
 * number is how rupees are written and has nothing to do with a clock.
 */
describe("every place that writes a date", () => {
  it("names Kathmandu, without exception", async () => {
    const { readdir, readFile } = await import("node:fs/promises");

    async function walk(dir: string, out: string[] = []): Promise<string[]> {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) await walk(path, out);
        else if (/\.tsx?$/.test(entry.name)) out.push(path);
      }
      return out;
    }

    const files = [...(await walk("lib")), ...(await walk("app")), ...(await walk("components"))];
    const unpinned: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");
      // Calls that certainly format a date, rather than a rupee amount.
      const calls = /(new Intl\.DateTimeFormat\(|\.toLocaleDateString\(|\.toLocaleTimeString\()/g;
      let match: RegExpExecArray | null;

      while ((match = calls.exec(source))) {
        const window = source.slice(match.index, match.index + 420);
        const close = Math.max(window.indexOf("});"), window.indexOf("})"), window.indexOf(");"));
        const call = window.slice(0, close > 0 ? close + 3 : 120);
        if (!call.includes("timeZone")) {
          unpinned.push(`${file}:${source.slice(0, match.index).split("\n").length}`);
        }
      }
    }

    expect(unpinned).toEqual([]);
  });
});
