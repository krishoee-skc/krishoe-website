import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The number the supplier actually quotes.
 *
 * A purchase already carried KR-PUR-20260914-0001, but that is KRISHOE's own
 * number, made up when the bill is filed. The supplier's bill has its own
 * number printed on it, and that is the one they use on the phone: "the
 * payment for bill 4521". There was nowhere to put it — the owner noticed
 * while entering a real purchase.
 *
 * The form's answer had been to write it into the note, which is labelled
 * "Bill note, vehicle, gate pass, invoice no." — four things in one box, none
 * of them searchable. Reconciling an account then means reading free text down
 * every row.
 *
 * Optional, deliberately. Small suppliers here often hand goods over with no
 * printed bill at all, and a required field would mean a real delivery could
 * not be recorded. The list says "No bill no." rather than leaving a blank, so
 * a forgotten one is still visible.
 */
const TYPES = "lib/purchasing.ts";
const POSTGRES = "lib/purchasing-postgres.ts";
const FORM = "app/admin/purchasing/_components/PurchaseInvoiceForm.tsx";
const ACTION = "app/admin/purchasing/actions.ts";
const LIST = "app/admin/purchasing/page.tsx";
const MIGRATION = "scripts/migrations/20260914_purchase_supplier_bill_no.sql";

describe("the field itself", () => {
  it("is stored on the invoice, not buried in its note", async () => {
    const types = await readFile(TYPES, "utf8");

    expect(types).toContain("supplierBillNo: string;");
  });

  it("is optional when a bill is being created", async () => {
    const types = await readFile(TYPES, "utf8");

    // A supplier who hands over goods with no printed bill must not block the
    // delivery from being recorded.
    expect(types).toContain("supplierBillNo?: string;");
  });

  it("survives a round trip through the normaliser", async () => {
    const types = await readFile(TYPES, "utf8");

    // Declared but not normalised is the quiet failure: it saves, and comes
    // back undefined on the next read.
    expect(types).toContain('supplierBillNo: cleanText(invoice.supplierBillNo ?? "")');
  });
});

describe("the database path", () => {
  it("reads the column back out", async () => {
    const postgres = await readFile(POSTGRES, "utf8");

    expect(postgres).toContain("supplier_bill_no: string | null;");
    expect(postgres).toContain('supplierBillNo: row.supplier_bill_no ?? ""');
  });

  it("names the column in every select and returning list", async () => {
    const postgres = await readFile(POSTGRES, "utf8");

    // Three lists name the invoice columns; a column added to one and missed
    // in another reads back undefined from whichever query missed it.
    const lists = postgres.match(/supplier_transaction_ids, supplier_bill_no, note/g) ?? [];
    expect(lists.length, "a column list was missed").toBe(3);
  });

  it("has as many placeholders as it inserts values", async () => {
    const postgres = await readFile(POSTGRES, "utf8");
    const start = postgres.indexOf("INSERT INTO purchase_invoices (");
    const block = postgres.slice(start, postgres.indexOf("RETURNING", start));

    const columns = block
      .slice(block.indexOf("(") + 1, block.indexOf(")"))
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    const placeholders = new Set(block.match(/\$\d+/g) ?? []).size;

    // Adding a column and forgetting its $N shifts every value one field to
    // the left — the kind of bug that writes a note into a status column.
    // `created_at` is now(), a literal, and posting_status is 'Posted'.
    expect(placeholders + 2, "columns vs placeholders").toBe(columns.length);
    expect(columns).toContain("supplier_bill_no");
  });

  it("writes the value, not an empty string regardless of input", async () => {
    const postgres = await readFile(POSTGRES, "utf8");

    expect(postgres).toContain('cleanText(input.supplierBillNo ?? "")');
  });
});

describe("where the shopkeeper meets it", () => {
  it("has its own box on the purchase form", async () => {
    const form = await readFile(FORM, "utf8");

    expect(form).toContain('name="supplierBillNo"');
    expect(form).toContain('text("Supplier\'s bill no.", "साहुको बिल नं.")');
  });

  it("says the box may be left blank", async () => {
    const form = await readFile(FORM, "utf8");

    // A field that looks required, when it is not, gets filled with a guess.
    expect(form).toContain("optional");
  });

  it("is actually read off the form when the bill is saved", async () => {
    const action = await readFile(ACTION, "utf8");

    // A box the server never reads is a box that silently discards what was
    // typed into it.
    expect(action).toContain('supplierBillNo: textValue(formData, "supplierBillNo")');
  });

  it("shows on the invoice list, and says so when it is missing", async () => {
    const list = await readFile(LIST, "utf8");

    expect(list).toContain("invoice.supplierBillNo");
    expect(list).toContain('ne="साहुको बिल"');
    // A blank space reads as a layout bug; naming the absence reads as a fact.
    expect(list).toContain('ne="बिल नं. छैन"');
  });
});

describe("the migration", () => {
  it("adds the column without requiring it", async () => {
    const migration = await readFile(MIGRATION, "utf8");

    expect(migration).toContain("ADD COLUMN IF NOT EXISTS supplier_bill_no");
    // Defaulted, so the purchase already stored stays valid.
    expect(migration).toContain("NOT NULL DEFAULT ''");
  });

  it("indexes it, because looking a bill up by that number is the point", async () => {
    const migration = await readFile(MIGRATION, "utf8");

    expect(migration).toContain("CREATE INDEX IF NOT EXISTS purchase_invoices_supplier_bill_no_idx");
    // Partial: the blank ones are the majority and none of them is searched for.
    expect(migration).toContain("WHERE supplier_bill_no <> ''");
  });
});
