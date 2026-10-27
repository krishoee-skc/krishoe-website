import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { moneyByMethod, refundedAtCounter, settledByExchange } from "@/lib/pos-payments";
import { readPosScreen } from "./helpers/pos-screen";

/**
 * Cash back on a return (KR-DEC-001, owner 2026-10-27, choice ख, then क).
 *
 * A return needed a customer account and could not be more than they owed,
 * so a walk-in who paid cash could not return a pair at all. Now a return
 * goes back in cash or to an account; the cash comes out of the drawer as a
 * refund part — the way an exchange's "give back" always has.
 */
const cashBack = {
  paidAmount: 0,
  paymentMethod: "Cash",
  payments: [{ method: "Cash" as const, amount: 1500, purpose: "refund" as const }],
};

describe("a cash-back return", () => {
  it("is told apart from an account return and from an exchange", () => {
    expect(refundedAtCounter(cashBack)).toBe(true);
    expect(refundedAtCounter({ payments: [] })).toBe(false);
    const exchange = { payments: [{ method: "Exchange" as const, amount: 800, purpose: "bill" as const }, { method: "Cash" as const, amount: 700, purpose: "refund" as const }] };
    expect(settledByExchange(exchange)).toBe(true);
    expect(refundedAtCounter(exchange)).toBe(false);
  });

  it("takes its cash out of the drawer", () => {
    expect(moneyByMethod(cashBack).get("Cash")).toBe(-1500);
  });
});

describe("the library", () => {
  it("lets a cash-back return through with no account, and posts nothing to one", async () => {
    const pos = (await readFile("lib/pos.ts", "utf8")).replace(/\r\n/g, "\n");
    expect(pos).toContain('if (input.kind === "Return" && !ledgerId && !input.cashBack) {');
    expect(pos).toContain('const cashBack = input.kind === "Return" && Boolean(input.cashBack);');
    expect(pos).toContain('ledgerId: cashBack ? "" : cleanText(input.ledgerId) || (due ? due.ledgerId : ""),');
    expect(pos).toContain('...(cashBack && total > 0 ? [{ method: "Cash" as const, amount: total, purpose: "refund" as const }] : []),');
    expect(pos).toContain('const needsLedger = (input.kind === "Sale" && creditAmount > 0) || (input.kind === "Return" && !cashBack);');
    // The posting review does not ask a cash-back return for an account.
    expect(pos).toContain('(invoice.kind === "Return" && !settledByExchange(invoice) && !refundedAtCounter(invoice))');
  });

  it("reads the counter's choice from the form", async () => {
    const actions = (await readFile("app/admin/pos/actions.ts", "utf8")).replace(/\r\n/g, "\n");
    expect(actions).toContain('const cashBack = kind === "Return" && textValue(formData, "returnMoney") === "cash";');
    expect(actions).toContain('if (kind === "Return" && !ledgerId && !cashBack) {');
    expect(actions).toContain('ledgerId: cashBack ? "" : ledgerId,');
  });
});

describe("the counter's return bill", () => {
  it("offers cash back or an account, and suggests one (choice क)", async () => {
    const screen = await readPosScreen();
    expect(screen).toContain('const suggestedReturnWay: "cash" | "account" = phoneAccount && (phoneAccount.balanceDue ?? 0) > 0 ? "account" : "cash";');
    expect(screen).toContain('text("💵 Cash back", "💵 नगद फिर्ता")');
    expect(screen).toContain('text("📒 Into an account", "📒 खातामा")');
    expect(screen).toContain('<input type="hidden" name="returnMoney" value={returnWay} />');
    expect(screen).toContain('<input type="hidden" name="ledgerId" value={cashBack ? "" : accountId} />');
    expect(screen).toContain('text("Cash back to the customer", "ग्राहकलाई नगद फिर्ता")');
    expect(screen).toContain("Save return · give back ${money(totals.total)}");
  });

  it("asks for an account only when the money goes to one", async () => {
    const screen = await readPosScreen();
    expect(screen).toContain("const needsAccount = isReturn ? !cashBack && totals.total > 0 : creditAmount > 0;");
  });
});
