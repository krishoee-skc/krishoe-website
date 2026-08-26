import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

/**
 * A payment method is named in eight places, and the type checker sees two.
 *
 * Adding QR touched: the union type, the ledger transaction type, two
 * "is this a payment" guards, two method-to-transaction mappings, the form's
 * allow-list, two dropdowns, and two database CHECK constraints. Six of those
 * are string comparisons and string arrays — a missed one does not fail to
 * compile. It files a QR payment as cash, or lets the form send a value the
 * database refuses, and the first anyone hears of it is a supplier ledger that
 * does not add up.
 *
 * So the lists are held together here rather than by hoping.
 */

const METHODS = ["Cash", "Cheque", "Bank", "Credit", "QR"];
const PAYMENT_TYPES = ["Cash Payment", "Cheque Payment", "Bank Payment", "QR Payment"];

describe("every way a supplier bill can be paid", () => {
  it("is accepted by the form's allow-list", async () => {
    const actions = await readFile("app/admin/purchasing/actions.ts", "utf8");
    const list = actions.match(/const paymentMethods: SupplierPaymentMethod\[\] = \[([\s\S]*?)\];/)?.[1];

    expect(list, "paymentMethods array not found").toBeTruthy();
    for (const method of METHODS) {
      expect(list, method).toContain(`"${method}"`);
    }
  });

  it("maps to a ledger transaction on both backends", async () => {
    // Two copies of the same mapping — local-json and Postgres. Production runs
    // the second, the tests reach the first, so a method added to one only is
    // the shape of bug that looks tested and ships untested.
    for (const file of ["lib/purchasing.ts", "lib/purchasing-postgres.ts"]) {
      const source = await readFile(file, "utf8");
      const mapping = source.slice(
        source.indexOf("paymentTransactionType"),
        source.indexOf("paymentTransactionType") + 600,
      );

      expect(mapping, `${file} — Cheque`).toContain('=== "Cheque"');
      expect(mapping, `${file} — Bank`).toContain('=== "Bank"');
      // Without this line QR falls through to the "Cash Payment" default, and a
      // wallet payment is filed as notes counted at the counter.
      expect(mapping, `${file} — QR`).toContain('=== "QR"');
    }
  });

  it("counts as a payment when a ledger balance is worked out", async () => {
    for (const file of ["lib/purchasing.ts", "lib/purchasing-postgres.ts"]) {
      const source = await readFile(file, "utf8");
      const guard = source.slice(
        source.indexOf("isSupplierPaymentType"),
        source.indexOf("isSupplierPaymentType") + 400,
      );

      for (const type of PAYMENT_TYPES) {
        expect(guard, `${file} — ${type}`).toContain(`"${type}"`);
      }
    }
  });

  it("is allowed by the database, not only by the code", async () => {
    const schema = await readFile("docs/schema.sql", "utf8");

    const methodCheck = schema.match(
      /payment_method TEXT NOT NULL CHECK \(payment_method IN \((.*?)\)\),/,
    )?.[1];
    expect(methodCheck, "purchase_invoices payment_method check not found").toBeTruthy();
    for (const method of METHODS) {
      expect(methodCheck, method).toContain(`'${method}'`);
    }

    const typeCheck = schema.match(/type TEXT NOT NULL CHECK \(type IN \('Purchase Bill'(.*?)\)\),/)?.[1];
    expect(typeCheck, "supplier_transactions type check not found").toBeTruthy();
    for (const type of PAYMENT_TYPES.filter((value) => value !== "Cash Payment")) {
      expect(typeCheck, type).toContain(`'${type}'`);
    }
  });

  it("ships a migration for databases that already exist", async () => {
    // schema.sql builds a new database. Production is not new, so widening a
    // CHECK there does nothing to the shop's own Postgres.
    const migration = await readFile("scripts/migrations/20260827_purchase_qr_payment.sql", "utf8");

    expect(migration).toContain("purchase_invoices_payment_method_check");
    expect(migration).toContain("supplier_transactions_type_check");
    expect(migration).toContain("'QR'");
    expect(migration).toContain("'QR Payment'");
    // Run twice, on a database where it has already run, without failing.
    expect((migration.match(/DROP CONSTRAINT IF EXISTS/g) ?? []).length).toBe(2);
  });
});

describe("what a payment has to say about itself", () => {
  it("asks a QR payment which wallet it came through", async () => {
    for (const file of ["lib/purchasing.ts", "lib/purchasing-postgres.ts"]) {
      const source = await readFile(file, "utf8");

      // A cheque is traceable by its number and a transfer by its reference; a
      // QR payment by the wallet. Cash needs none of it — it was counted.
      expect(source, file).toMatch(/paymentMethod === "QR"\)? &&|paymentMethod === "QR"\s*\)/);
    }
  });
});
