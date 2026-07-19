import { describe, expect, it } from "vitest";
import {
  applyLedgerTransactionToBalances,
  assertLedgerTransactionAllowed,
  reverseLedgerTransactionFromBalances,
  type LedgerBalances,
  type LedgerTransactionType,
} from "@/lib/ledger-rules";

const allTypes: LedgerTransactionType[] = [
  "Cash Payment",
  "Cheque Payment",
  "Credit Sale",
  "Return Adjustment",
  "Manual Adjustment",
];

function ledger(overrides: Partial<LedgerBalances> = {}): LedgerBalances {
  return {
    customerName: "Shoes Palace Wholesale",
    cashPaid: 0,
    chequePaid: 0,
    creditGiven: 0,
    balanceDue: 10_000,
    ...overrides,
  };
}

// The rule that was broken, stated plainly: undoing an entry must put the
// ledger back exactly where it was. Anything else invents or destroys money the
// shop then acts on — chasing a customer for rupees never owed, or writing off
// rupees that are.
describe("undoing a ledger entry restores the ledger exactly", () => {
  for (const type of allTypes) {
    it(`round-trips ${type}`, () => {
      const before = ledger({ cashPaid: 4_000, chequePaid: 2_500, creditGiven: 9_000 });
      const transaction = { type, amount: 3_000 };

      const after = applyLedgerTransactionToBalances(before, transaction);
      const restored = reverseLedgerTransactionFromBalances(after, transaction);

      expect(restored).toEqual(before);
    });
  }

  it("round-trips a payment that settles the balance exactly", () => {
    const before = ledger({ balanceDue: 3_000 });
    const transaction = { type: "Cash Payment" as const, amount: 3_000 };

    const after = applyLedgerTransactionToBalances(before, transaction);
    expect(after.balanceDue).toBe(0);

    expect(reverseLedgerTransactionFromBalances(after, transaction)).toEqual(before);
  });

  // The failure this was all written for, with the exact figures.
  it("does not invent money when a payment is bigger than the balance", () => {
    const before = ledger({ balanceDue: 100 });
    const transaction = { type: "Cash Payment" as const, amount: 500 };

    // Refused up front, which is what keeps apply and reverse inverses.
    expect(() => assertLedgerTransactionAllowed(before, transaction)).toThrow(/only Rs. 100 due/);

    // And were it ever applied anyway, the round trip still comes back clean —
    // the old code turned a Rs. 100 debt into a Rs. 500 one right here.
    const after = applyLedgerTransactionToBalances(before, transaction);
    expect(reverseLedgerTransactionFromBalances(after, transaction).balanceDue).toBe(100);
  });

  it("survives many entries applied then undone in reverse order", () => {
    const start = ledger({ balanceDue: 50_000 });
    const entries = [
      { type: "Cash Payment" as const, amount: 5_000 },
      { type: "Credit Sale" as const, amount: 12_000 },
      { type: "Cheque Payment" as const, amount: 7_500 },
      { type: "Return Adjustment" as const, amount: 2_000 },
      { type: "Manual Adjustment" as const, amount: 900 },
    ];

    let current: LedgerBalances = start;
    for (const entry of entries) {
      assertLedgerTransactionAllowed(current, entry);
      current = applyLedgerTransactionToBalances(current, entry);
    }

    for (const entry of [...entries].reverse()) {
      current = reverseLedgerTransactionFromBalances(current, entry);
    }

    expect(current).toEqual(start);
  });
});

describe("what a ledger refuses to record", () => {
  it("refuses a payment larger than the balance due", () => {
    expect(() =>
      assertLedgerTransactionAllowed(ledger({ balanceDue: 2_000 }), {
        type: "Cheque Payment",
        amount: 2_001,
      }),
    ).toThrow(/Cannot post Rs. 2001/);
  });

  it("refuses a return larger than the balance due", () => {
    expect(() =>
      assertLedgerTransactionAllowed(ledger({ balanceDue: 500 }), {
        type: "Return Adjustment",
        amount: 600,
      }),
    ).toThrow(/only Rs. 500 due/);
  });

  it("allows a payment for exactly the balance due", () => {
    expect(() =>
      assertLedgerTransactionAllowed(ledger({ balanceDue: 500 }), {
        type: "Cash Payment",
        amount: 500,
      }),
    ).not.toThrow();
  });

  it("refuses zero and negative amounts", () => {
    for (const amount of [0, -1, -5_000]) {
      expect(() =>
        assertLedgerTransactionAllowed(ledger(), { type: "Cash Payment", amount }),
      ).toThrow(/greater than zero/);
    }
  });

  // A sale on credit and a manual correction both increase what is owed, so
  // there is no balance to check them against.
  it("allows a credit sale beyond the current balance", () => {
    expect(() =>
      assertLedgerTransactionAllowed(ledger({ balanceDue: 0 }), {
        type: "Credit Sale",
        amount: 80_000,
      }),
    ).not.toThrow();
  });
});

describe("what each entry moves", () => {
  it("a cash payment lowers the due and raises cash taken", () => {
    const after = applyLedgerTransactionToBalances(ledger({ balanceDue: 10_000 }), {
      type: "Cash Payment",
      amount: 4_000,
    });

    expect(after).toMatchObject({ cashPaid: 4_000, balanceDue: 6_000, chequePaid: 0 });
  });

  it("a credit sale raises both credit given and the due", () => {
    const after = applyLedgerTransactionToBalances(ledger({ balanceDue: 10_000 }), {
      type: "Credit Sale",
      amount: 15_000,
    });

    expect(after).toMatchObject({ creditGiven: 15_000, balanceDue: 25_000 });
  });

  it("leaves the ledger it was given untouched", () => {
    const before = ledger();
    const snapshot = { ...before };

    applyLedgerTransactionToBalances(before, { type: "Cash Payment", amount: 1_000 });
    reverseLedgerTransactionFromBalances(before, { type: "Cash Payment", amount: 1_000 });

    expect(before).toEqual(snapshot);
  });
});
