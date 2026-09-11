import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { formatAdminDate } from "@/lib/format-date";

/**
 * The time, on the screens where the day is closed.
 *
 * The owner asked where the app shows weather and the time. Weather was never
 * built — the only match in the whole codebase is an AI "temperature" setting,
 * which is a different thing wearing the same word. The date is built and used
 * in thirty-three places. The clock was not anywhere.
 *
 * That is thin on the factory board in particular: work is entered there
 * against a particular hour, and the day is closed there. The wall clock in the
 * workshop and the clock the shop records against should be the same one.
 *
 * Two things make a clock in this app harder than it sounds, and both have bit
 * this codebase before:
 *
 *   the server runs 5h45m behind Kathmandu, and a bill saved at 10:46 once
 *   rendered as "5:01 am" before the browser corrected it
 *
 *   a time rendered during the server pass and again in the browser is two
 *   different values, which React reports as a hydration mismatch — and which
 *   is genuinely two answers to one question
 */
const CLOCK = "components/admin/NowClock.tsx";

describe("which clock it reads", () => {
  it("formats in Kathmandu, whatever the machine thinks", () => {
    // A fixed moment. Kathmandu is UTC+5:45, so noon UTC is a quarter to six
    // in the evening there — and the formatter writes it as a 12-hour clock,
    // which is how the admin shows every other time.
    const noonUtc = new Date("2026-09-11T12:00:00.000Z");
    const shown = formatAdminDate(noonUtc, { time: true });

    expect(shown).toContain("5:45 pm");
    // Not the server's own noon, which is what this exists to prevent.
    expect(shown).not.toContain("12:00");
  });

  it("goes through that same formatter rather than its own", async () => {
    const source = await readFile(CLOCK, "utf8");

    // Writing a second time formatter is how the two would drift apart.
    expect(source).toContain("formatAdminDate(now, { time: true })");
    expect(source).not.toContain("toLocaleTimeString");
  });
});

describe("rendering it without two answers", () => {
  it("holds the time back until the browser has it", async () => {
    const source = await readFile(CLOCK, "utf8");

    // A time in the server HTML and a different one a moment later is the
    // hydration mismatch, and the older 5h45m bug in a new costume.
    expect(source).toContain("useState<Date | null>(null)");
    expect(source).toContain("if (!now)");
  });

  it("shows the date meanwhile, so the heading does not jump", async () => {
    const source = await readFile(CLOCK, "utf8");
    const fallback = source.slice(source.indexOf("if (!now)"), source.indexOf("const bikram"));

    expect(fallback.length, "the fallback branch is missing").toBeGreaterThan(0);
    expect(fallback).toContain("formatAdminDate");
  });
});

describe("how often it ticks", () => {
  it("once a minute, not once a second", async () => {
    const source = await readFile(CLOCK, "utf8");

    // Sixty renders a minute on a workshop phone spends battery to tell nobody
    // anything; the display has no seconds in it.
    expect(source).toContain("60_000");
    expect(source).not.toContain("1000)");
  });

  it("lines up with the top of the minute", async () => {
    const source = await readFile(CLOCK, "utf8");

    // Otherwise the shown time changes up to 59 seconds after the real one.
    expect(source).toContain("60 - new Date().getSeconds()");
  });

  it("clears both timers when it goes away", async () => {
    const source = await readFile(CLOCK, "utf8");

    // Two timeouts now: the first reading, and the alignment to the minute.
    expect(source).toContain("clearTimeout(first)");
    expect(source).toContain("clearTimeout(timeout)");
    expect(source).toContain("clearInterval(interval)");
  });
});

describe("what it says", () => {
  it("carries both calendars, like the rest of the admin", async () => {
    const source = await readFile(CLOCK, "utf8");

    expect(source).toContain("toBikramSambatNepali");
    expect(source).toContain("toBikramSambatRoman");
  });

  it("is on the two screens opened every day", async () => {
    const factory = await readFile("app/admin/factory/FactoryBoard.tsx", "utf8");
    const home = await readFile("components/admin/QuickAdminHome.tsx", "utf8");

    expect(factory).toContain("<NowClock");
    expect(home).toContain("<NowClock");
  });
});
