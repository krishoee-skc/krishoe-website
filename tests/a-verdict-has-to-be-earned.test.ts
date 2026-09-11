import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { ENOUGH, TOO_EARLY, judge } from "@/lib/enough-to-judge";

/**
 * Why the reports kept being wrong.
 *
 * The owner asked the better question: not "fix this report" but "why is the
 * report always wrong". Six commits now have been the same shape —
 *
 *   "Home page 40.7s 🔴 Slow"       one phone on a bad connection, in ten
 *   "/review 6.0s 🔴 Slow"           two readings, one a cold rebuild
 *   "Rs. 0.00" coloured as money     a dash is not an amount
 *   "Database may be unavailable"    the owner had typed a short reason
 *   a month's wage read from the wrong table
 *   payroll coloured unlike the ledger beside it
 *
 * — and each was found by the owner, then fixed with a test locking that one
 * case. Six locks, no door.
 *
 * The shared fault: a percentage from two rows is drawn exactly like a
 * percentage from two hundred, so a figure with nothing behind it arrives
 * looking like a finding. That is fixable once, and this is the test that keeps
 * it fixed — it sweeps every admin screen rather than guarding one.
 *
 * Writing it found a live instance nobody had reported: the factory board's
 * success-rate tile. One entry still in progress is "0% success", and the tile
 * painted that red — a crisis announced from a single row.
 */
const VERDICT_SCREENS = [
  "app/admin/factory/FactoryBoard.tsx",
  "components/admin/MonitoringDashboard.tsx",
];

describe("the rule itself", () => {
  it("withholds a verdict under the threshold", () => {
    expect(judge(ENOUGH - 1, () => "danger")).toEqual({ enough: false, verdict: null });
  });

  it("gives it once the count earns it", () => {
    expect(judge(ENOUGH, () => "danger")).toEqual({ enough: true, verdict: "danger" });
  });

  it("does not run the caller's thresholds when it will not use them", () => {
    // A callback, not a value, so a screen cannot compute a verdict it is about
    // to discard — and cannot accidentally show one it computed.
    let ran = false;
    judge(1, () => {
      ran = true;
      return "good";
    });

    expect(ran).toBe(false);
  });

  it("treats a missing or broken count as not enough", () => {
    expect(judge(Number.NaN, () => "good").enough).toBe(false);
    expect(judge(-3, () => "good").enough).toBe(false);
  });

  it("says the same thing in both languages", () => {
    expect(TOO_EARLY.en).toBeTruthy();
    expect(TOO_EARLY.ne).toBeTruthy();
  });
});

describe("the screens that state a verdict", () => {
  it("the factory board no longer calls one entry a failure", async () => {
    const board = await readFile("app/admin/factory/FactoryBoard.tsx", "utf8");

    // Was: tone={successRate >= 90 ? "good" : successRate >= 70 ? "warn" : "danger"}
    // with nothing checking how many entries that rate came from.
    expect(board).toContain("judge(entriesToday");
    expect(board).not.toContain(`tone={stats.successRate >= 90 ? "good"`);
  });

  it("the speed table still holds its own thin-data rule", async () => {
    const dash = await readFile("components/admin/MonitoringDashboard.tsx", "utf8");

    expect(dash).toContain("const thin = endpoint.count < 5");
  });

  it("colours a withheld verdict neutrally, never red", async () => {
    const sources = await Promise.all(VERDICT_SCREENS.map((file) => readFile(file, "utf8")));

    // A grey "Too few" is honest; a red one is the same false alarm in new
    // words. Each screen falls back to its own neutral tone.
    expect(sources[0]).toContain('.verdict ?? "default"');
    expect(sources[1]).toContain(`thin ? "text-brand-muted" : verdict.tone`);
  });
});

describe("the figure itself is never hidden", () => {
  it("keeps showing the number, and withholds only the judgement", async () => {
    const board = await readFile("app/admin/factory/FactoryBoard.tsx", "utf8");

    // Hiding the rate would be its own kind of lying to the owner. The value
    // stays; what goes is the confident colour on top of it.
    expect(board).toContain("value={`${stats.successRate}%`}");
    expect(board).toContain("entries so far");
  });
});
