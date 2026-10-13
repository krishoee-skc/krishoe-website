import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
const nepaliWords = (source: string) => (source.match(/[ऀ-ॿ]+/g) ?? []).length;

/**
 * The owner's sample, part 7 (2026-10-12): the pages outside the side menu —
 * a worker's ledger, a salary, one bill, a supplier's account.
 */
describe("Piece ledger", () => {
  it("leads with what is owed, pays from a tab, and reads a line in two rows on a phone", async () => {
    const ledger = await read("app/admin/factory/ledger/PieceLedger.tsx");
    expect(ledger).toContain('id="piece-ledger"');
    expect(ledger).toContain('key: "pay"');
    expect(ledger).toContain('key: "entries"');
    expect(ledger).toContain('value={<Amount>{money(ledgerData.summary.currentBalance)}</Amount>}');
    expect(ledger).toContain('<ul className="grid list-none gap-2 pl-0 md:hidden print:hidden">');
    expect(ledger).toContain('<div className="hidden md:block print:block">');
    // The Owner's correct and delete reach the phone's lines too.
    expect(ledger.match(/fixControls\(entry\)/g)?.length).toBe(2);
    // Paying is never printed onto a worker's sheet.
    expect(ledger).toContain("p-4 sm:p-6 print:hidden\">");
  });
});

describe("Staff salary", () => {
  it("is the ledger's shape, every word in both languages, the breakdown folded", async () => {
    const salary = await read("app/admin/factory/salary/StaffSalary.tsx");
    expect(salary).toContain('id="staff-salary"');
    expect(salary).toContain('{text("How the balance is worked out", "हिसाब कसरी निस्कियो")}');
    expect(salary).not.toContain("Salary Breakdown");
    expect(salary).not.toMatch(/>Date\n/);
    expect(salary).toContain('value={<Amount>{money(summary.remaining_balance)}</Amount>}');
  });
});

describe("One bill", () => {
  it("reads a line a shoe on a phone and keeps the paper's table", async () => {
    const bill = await read("app/admin/pos/[id]/page.tsx");
    expect(bill).toContain('<ol className="mt-4 grid list-none gap-1.5 pl-0 md:hidden print:hidden">');
    expect(bill).toContain('<div className="mt-4 hidden overflow-x-auto md:block print:block">');
    // The paper is word for word as before.
    expect(bill).toContain(">Product Description</th>");
    expect(bill).toContain('← <T en="Bills" ne="बिलहरू" />');
  });
});

describe("Supplier ledger", () => {
  it("is in both languages, three figures, four tabs, and the paper as before", async () => {
    const page = await read("app/admin/purchasing/supplier/[id]/page.tsx");
    expect(nepaliWords(page)).toBeGreaterThan(100);
    expect(page).toContain('id="supplier-ledger"');
    for (const key of ["pay", "statement", "bills", "month"]) expect(page).toContain(`key: "${key}"`);
    expect(page).toContain('{ en: "to pay", ne: "तिर्न बाँकी", value: summary.balanceDue, money: true');
    expect(page).toContain('<div className="hidden rounded-lg bg-brand-mist px-5 py-4 text-right print:block">');
    const fields = await read("app/admin/purchasing/supplier/[id]/SupplierPaymentFields.tsx");
    expect(fields).toContain('{ value: "Cash Payment", en: "Cash payment", ne: "नगद तिरेको" },');
  });
});

describe("Amount on paper", () => {
  it("prints the figure that waits behind the eye on screen", async () => {
    const kit = await read("components/admin/PageKit.tsx");
    expect(kit).toContain('<span className="hidden print:inline">{children}</span>');
  });
});

/** Part 7ख (2026-10-13): a purchase bill and a worker's production account. */
describe("One purchase bill", () => {
  it("is in both languages, a line an item on a phone, and the supplier's account a press away", async () => {
    const bill = await read("app/admin/purchasing/[id]/page.tsx");
    expect(nepaliWords(bill)).toBeGreaterThan(40);
    expect(bill).toContain('<ul className="mt-6 grid list-none gap-2 pl-0 md:hidden print:hidden">');
    expect(bill).toContain('<div className="mt-6 hidden overflow-x-auto md:block print:block">');
    expect(bill).toContain("href={`/admin/purchasing/supplier/${invoice.supplierLedgerId}`}");
    expect(bill).not.toContain("{invoice.status} / {invoice.postingStatus}");
  });
});

describe("A worker's production account", () => {
  it("leads with Saturday, folds the week's figures, and keeps reversing", async () => {
    const page = await read("app/admin/operations/production-accounts/worker/[id]/page.tsx");
    expect(nepaliWords(page)).toBeGreaterThan(80);
    expect(page).toContain('id="production-worker"');
    for (const key of ["pay", "work", "cash"]) expect(page).toContain(`key: "${key}"`);
    expect(page).toContain('{ en: "to pay on Saturday", ne: "शनिबार दिनुपर्ने", value: account.statement.payable, money: true');
    expect(page).toContain("<EnterWalkForm action={reverseProductionWorkEntryAction}");
    expect(page).toContain("href={`/admin/factory/ledger?workerId=${encodeURIComponent(account.employee.id)}`}");
  });
});
