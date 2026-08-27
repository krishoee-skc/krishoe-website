import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  isSupplierPaymentType,
  missingReferenceMessage,
  paymentNeedsReference,
  paymentTransactionType,
  purchaseStatus,
  supplierPaymentMethods,
  supplierTransactionTypes,
  withSupplierTransactionApplied,
} from "@/lib/purchasing-rules";

/**
 * A payment method used to be named in eight places, and the type checker saw
 * two.
 *
 * Adding QR meant editing the union, the ledger transaction type, two "is this
 * a payment" guards, two method-to-transaction mappings, two reference rules,
 * the form's allow-list, two dropdowns and two database CHECK constraints. Six
 * of those are string comparisons living in two files — lib/purchasing.ts for
 * local-json and lib/purchasing-postgres.ts for Postgres — and nothing could
 * see a missed one. By the time it was noticed, the two copies of the reference
 * rule had ALREADY drifted: local-json named the wallet a QR payment came
 * through, and Postgres, which is what production runs, still said "cheque or
 * bank".
 *
 * The rules live in one module now. These tests exercise that module directly,
 * and hold the line that there is only one of it.
 */

describe("the rules live in one place", () => {
  it("is not copied into either backend", async () => {
    for (const file of ["lib/purchasing.ts", "lib/purchasing-postgres.ts"]) {
      const source = await readFile(file, "utf8");

      // Defining any of these locally is how the two copies come back.
      expect(source, `${file} defines its own`).not.toMatch(
        /^function (isSupplierPaymentType|paymentTransactionType|purchaseStatus|assertSupplierTransactionAllowed|applySupplierTransaction)\b/m,
      );
      expect(source, `${file} imports the rules`).toContain('from "@/lib/purchasing-rules"');
    }
  });

  it("is where the union types are declared", async () => {
    const rules = await readFile("lib/purchasing-rules.ts", "utf8");

    // A second declaration of the same union is a second thing to keep in step.
    expect(rules).toContain("export type SupplierPaymentMethod");
    expect(rules).toContain("export type SupplierTransactionType");

    const purchasing = await readFile("lib/purchasing.ts", "utf8");
    expect(purchasing).not.toMatch(/^export type SupplierPaymentMethod =/m);
    expect(purchasing).not.toMatch(/^export type SupplierTransactionType =/m);
  });

  it("still answers to everything that imports from lib/purchasing", async () => {
    // Moving the rules must not make every caller rewrite its imports.
    const purchasing = await readFile("lib/purchasing.ts", "utf8");
    expect(purchasing).toContain("export type { SupplierPaymentMethod");
    expect(purchasing).toContain("export {");
    expect(purchasing).toContain("paymentTransactionType,");
  });
});

describe("every way a supplier bill can be paid", () => {
  it("maps to a ledger transaction", () => {
    expect(paymentTransactionType("Cash")).toBe("Cash Payment");
    expect(paymentTransactionType("Cheque")).toBe("Cheque Payment");
    expect(paymentTransactionType("Bank")).toBe("Bank Payment");
    // Without this, QR fell through to the cash default and a wallet payment
    // was filed as notes counted at the counter.
    expect(paymentTransactionType("QR")).toBe("QR Payment");
  });

  it("counts as a payment when a ledger balance is worked out", () => {
    for (const type of supplierTransactionTypes.filter((value) => value.endsWith(" Payment"))) {
      expect(isSupplierPaymentType(type), type).toBe(true);
    }
    for (const type of ["Purchase Bill", "Return Adjustment", "Manual Adjustment"] as const) {
      expect(isSupplierPaymentType(type), type).toBe(false);
    }
  });

  it("recognises a payment added later without being told", () => {
    // Read off the name rather than listed, so the next method to exist is
    // already handled the moment its transaction type is named " Payment".
    expect(isSupplierPaymentType("QR Payment")).toBe(true);
  });

  it("is accepted by the form's allow-list, built from the rule", async () => {
    const actions = await readFile("app/admin/purchasing/actions.ts", "utf8");
    const list = actions.match(/const paymentMethods: SupplierPaymentMethod\[\] = \[([\s\S]*?)\];/)?.[1];

    expect(list, "paymentMethods array not found").toBeTruthy();
    for (const method of supplierPaymentMethods) {
      expect(list, method).toContain(`"${method}"`);
    }
  });

  it("is allowed by the database, not only by the code", async () => {
    const schema = await readFile("docs/schema.sql", "utf8");

    const methodCheck = schema.match(
      /payment_method TEXT NOT NULL CHECK \(payment_method IN \((.*?)\)\),/,
    )?.[1];
    expect(methodCheck, "purchase_invoices payment_method check not found").toBeTruthy();
    for (const method of supplierPaymentMethods) {
      expect(methodCheck, method).toContain(`'${method}'`);
    }

    const typeCheck = schema.match(/type TEXT NOT NULL CHECK \(type IN \('Purchase Bill'(.*?)\)\),/)?.[1];
    expect(typeCheck, "supplier_transactions type check not found").toBeTruthy();
    for (const type of supplierTransactionTypes.filter((value) => value !== "Purchase Bill")) {
      expect(typeCheck, type).toContain(`'${type}'`);
    }
  });

  it("ships a migration for databases that already exist", async () => {
    // schema.sql builds a new database. Production is not new.
    const migration = await readFile("scripts/migrations/20260827_purchase_qr_payment.sql", "utf8");

    expect(migration).toContain("purchase_invoices_payment_method_check");
    expect(migration).toContain("supplier_transactions_type_check");
    expect(migration).toContain("'QR'");
    expect(migration).toContain("'QR Payment'");
    expect((migration.match(/DROP CONSTRAINT IF EXISTS/g) ?? []).length).toBe(2);
  });
});

describe("what a payment has to say about itself", () => {
  it("asks a cheque and a transfer for their number", () => {
    expect(paymentNeedsReference("Cheque")).toBe(true);
    expect(paymentNeedsReference("Bank")).toBe(true);
  });

  it("asks a QR payment which wallet it came through", () => {
    expect(paymentNeedsReference("QR")).toBe(true);
    // The message the two copies disagreed about: Postgres, which production
    // runs, told a QR payer about cheques.
    expect(missingReferenceMessage("QR")).toContain("wallet");
    expect(missingReferenceMessage("QR")).toContain("eSewa");
  });

  it("asks cash for nothing — it was counted", () => {
    expect(paymentNeedsReference("Cash")).toBe(false);
    expect(paymentNeedsReference("Credit")).toBe(false);
  });
});

describe("what a bill is once you know what was handed over", () => {
  it("is Paid, Partial or Credit and nothing else", () => {
    expect(purchaseStatus(1000, 1000)).toBe("Paid");
    expect(purchaseStatus(1000, 400)).toBe("Partial");
    expect(purchaseStatus(1000, 0)).toBe("Credit");
    // More handed over than the bill asks for is still simply paid.
    expect(purchaseStatus(1000, 1200)).toBe("Paid");
  });
});

describe("what a transaction does to a supplier's account", () => {
  const ledger = {
    supplierName: "nobel shoe",
    totalPurchase: 0,
    paidAmount: 0,
    balanceDue: 0,
    lastTransaction: "",
  };

  it("adds a bill to the due, and takes a payment off it", () => {
    const billed = withSupplierTransactionApplied(
      ledger,
      { type: "Purchase Bill", amount: 84525 },
      "2026-08-27",
    );
    expect(billed).toMatchObject({ totalPurchase: 84525, balanceDue: 84525, paidAmount: 0 });

    const paid = withSupplierTransactionApplied(
      billed,
      { type: "QR Payment", amount: 50000 },
      "2026-08-27",
    );
    expect(paid).toMatchObject({ paidAmount: 50000, balanceDue: 34525 });
  });

  it("refuses to pay more than is owed", () => {
    const billed = withSupplierTransactionApplied(
      ledger,
      { type: "Purchase Bill", amount: 1000 },
      "2026-08-27",
    );

    // Paying more than is owed leaves the supplier owing the shop money through
    // a door meant for the other direction.
    expect(() =>
      withSupplierTransactionApplied(billed, { type: "Cash Payment", amount: 5000 }, "2026-08-27"),
    ).toThrow(/only Rs. 1000/);
  });

  it("leaves the ledger it was given alone", () => {
    const before = { ...ledger };
    withSupplierTransactionApplied(ledger, { type: "Purchase Bill", amount: 500 }, "2026-08-27");
    expect(ledger).toEqual(before);
  });
});
