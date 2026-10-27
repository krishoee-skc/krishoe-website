import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { isCounterRule, PosNeedsAnswer } from "@/lib/pos-questions";
import { readPosScreen } from "./helpers/pos-screen";

/**
 * The bug audit, phase 1 (money), owner 2026-10-27. Found by browser checks
 * on a local test database in Chrome and the Safari engine, computer and phone.
 */
describe("KR-BUG-002: a refused bill's reason is not hidden under the counter's bar", () => {
  it("stops the scroll below the bar", async () => {
    const screen = await readPosScreen();
    // On a computer the green "Cut a bill" bar sits over the top 56px; the
    // reason was scrolled to y=25, under it, and Save seemed to do nothing.
    expect(screen).toContain('<span ref={answerRef} aria-hidden="true" className="block scroll-mt-28" />');
    expect(screen).toContain('answerRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });');
  });
});

describe("KR-BUG-003: pressing Credit brings the account box into sight", () => {
  it("scrolls to the box once, when the bill first needs an account", async () => {
    const screen = await readPosScreen();
    expect(screen).toContain("const askingForAccount = needsAccount && cart.length > 0 && !accountId;");
    expect(screen).toContain('accountBoxRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });');
    expect(screen).toContain("<div ref={accountBoxRef} ");
  });
});

describe("KR-BUG-004: the counter's own rules are not filed as errors", () => {
  it("knows the rule refusals", () => {
    expect(isCounterRule(new Error("Test Sandal (size 39) has only 3 pairs. Cannot bill 7 pairs."))).toBe(true);
    // Two counters at once: the locked stock row says no in its own words.
    expect(isCounterRule(new Error("Test Sandal Retail has only 3 pairs. Cannot Sale Out 7 pairs."))).toBe(true);
    expect(isCounterRule(new Error("Test Ram has only Rs. 800 due. Cannot post Rs. 1500."))).toBe(true);
    expect(isCounterRule(new Error("Test Ram has only Rs. 0 due. Cannot post Rs. 1500."))).toBe(true);
    expect(isCounterRule(new Error("Kitto 770 is not in stock yet."))).toBe(true);
  });

  it("still reports everything else", () => {
    expect(isCounterRule(new Error("connect ECONNREFUSED 127.0.0.1:5432"))).toBe(false);
    expect(isCounterRule(new Error('duplicate key value violates unique constraint "pos_invoices_pkey"'))).toBe(false);
    expect(isCounterRule(new PosNeedsAnswer({ en: "x", ne: "x" }, null))).toBe(false);
    expect(isCounterRule("has only 3 pairs. Cannot bill 7 pairs.")).toBe(false);
  });

  it("tells the counter, and skips Monitoring, for a bill and an exchange", async () => {
    const actions = (await readFile("app/admin/pos/actions.ts", "utf8")).replace(/\r\n/g, "\n");
    expect(actions).toContain('if (isCounterRule(error)) return { ok: false, message: (error as Error).message };\n    reportError("save POS bill", error);');
    expect(actions).toContain('if (isCounterRule(error)) return { ok: false, message: (error as Error).message };\n    reportError("save POS exchange", error);');
  });
});
