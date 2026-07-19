import { beforeEach, describe, expect, it, vi } from "vitest";

// This is a wiring test, not an arithmetic one. tests/ledger-rules.test.ts pins
// the maths; this pins that the stored path actually runs it. The two used to
// be the same code written out twice, so "the rules are right" and "the ledger
// on disk is right" were different claims.

// A store that reads back what was written, so a second transaction starts from
// the ledger the first one left behind — which is the whole point here.
const files = new Map<string, string>();

vi.mock("node:fs/promises", () => ({
  readFile: (path: string) => {
    const content = files.get(path);

    return content === undefined
      ? Promise.reject(Object.assign(new Error("no file"), { code: "ENOENT" }))
      : Promise.resolve(content);
  },
}));

vi.mock("@/lib/atomic-json", () => ({
  writeFileAtomic: (path: string, content: string) => {
    files.set(path, content);
    return Promise.resolve();
  },
}));

const { addCustomerLedger, addLedgerTransaction, deleteOperationRecord, getOperationsData } =
  await import("@/lib/operations");

async function ledgerById(id: string) {
  const data = await getOperationsData();
  const found = data.customerLedgers.find((item) => item.id === id);

  if (!found) {
    throw new Error(`Ledger ${id} vanished from the store.`);
  }

  return found;
}

async function openLedgerOwing(amount: number) {
  const created = await addCustomerLedger({
    customerName: "Shoes Palace Wholesale",
    channel: "Wholesale",
    phone: "9800000001",
    cashPaid: 0,
    chequePaid: 0,
    creditGiven: 0,
    balanceDue: amount,
    creditLimit: 0,
  });

  return created.id;
}

beforeEach(() => {
  files.clear();
});

describe("a ledger entry that is later deleted", () => {
  // The failure that started this. A customer owing Rs. 100 recorded as paying
  // Rs. 500: the balance clamped to 0, then deleting the entry added the whole
  // Rs. 500 back and the shop was chasing Rs. 400 it had never been owed.
  it("cannot record a payment larger than the customer owes", async () => {
    const id = await openLedgerOwing(100);

    await expect(
      addLedgerTransaction({
        ledgerId: id,
        type: "Cash Payment",
        amount: 500,
        note: "Paid in full.",
      }),
    ).rejects.toThrow(/only Rs. 100 due/);

    // Refused means refused: nothing moved.
    expect(await ledgerById(id)).toMatchObject({ balanceDue: 100, cashPaid: 0 });
  });

  it("puts the balance back exactly where it was", async () => {
    const id = await openLedgerOwing(10_000);
    const before = { ...(await ledgerById(id)) };

    const transaction = await addLedgerTransaction({
      ledgerId: id,
      type: "Cash Payment",
      amount: 4_000,
      note: "Part payment.",
    });

    expect(await ledgerById(id)).toMatchObject({ balanceDue: 6_000, cashPaid: 4_000 });

    await deleteOperationRecord("ledgerTransaction", transaction.id);

    const after = await ledgerById(id);
    expect(after.balanceDue).toBe(before.balanceDue);
    expect(after.cashPaid).toBe(before.cashPaid);
  });

  it("settles to zero and back on an exact payment", async () => {
    const id = await openLedgerOwing(3_000);

    const transaction = await addLedgerTransaction({
      ledgerId: id,
      type: "Cash Payment",
      amount: 3_000,
      note: "Cleared.",
    });

    expect((await ledgerById(id)).balanceDue).toBe(0);

    await deleteOperationRecord("ledgerTransaction", transaction.id);

    expect((await ledgerById(id)).balanceDue).toBe(3_000);
  });

  it("keeps a credit sale and its undo in step", async () => {
    const id = await openLedgerOwing(0);

    const transaction = await addLedgerTransaction({
      ledgerId: id,
      type: "Credit Sale",
      amount: 25_000,
      note: "Goods on credit.",
    });

    expect(await ledgerById(id)).toMatchObject({ balanceDue: 25_000, creditGiven: 25_000 });

    await deleteOperationRecord("ledgerTransaction", transaction.id);

    expect(await ledgerById(id)).toMatchObject({ balanceDue: 0, creditGiven: 0 });
  });
});
