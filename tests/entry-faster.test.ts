import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * Entering was slow (owner, 2026-09-30). The functions ran in Singapore
 * against a database in Mumbai; a bill read every bill twice, the whole
 * operations book, and synced the catalog twice; and six forms had no Enter
 * walk.
 */
describe("1. the functions run beside the database", () => {
  it("is Mumbai, where Supabase is", async () => {
    const vercel = JSON.parse(await read("vercel.json"));
    expect(vercel.regions).toEqual(["bom1"]);
  });
});

describe("2. a bill reads only what it needs", () => {
  it("finds one bill by its id, and the next number from the database", async () => {
    const pos = await read("lib/pos.ts");
    expect(pos).toContain("postgres: () => getPosInvoiceByIdFromPostgres(id),");
    expect(pos).toContain("postgres: async () => [await getHighestBillNumberFromPostgres(BILL_PREFIX[kind])],");
    const db = await read("lib/pos-postgres.ts");
    expect(db).toContain("SELECT ${columns} FROM pos_invoices WHERE id = $1");
    expect(db).toContain("WHERE invoice_number ~ ('^' || $1 || '[0-9]+$')");
  });

  it("syncs the catalog once, from the finished-stock table alone, and never fails a saved bill for it", async () => {
    const store = await read("lib/product-store.ts");
    const sync = store.slice(store.indexOf("export async function syncProductCatalogStockWithFinishedStock()"));
    expect(sync.slice(0, 600)).toContain("const finishedStock = await getFinishedStockOrThrow();");
    expect(sync.slice(0, 600)).not.toContain("getOperationsData()");

    const pos = await read("lib/pos.ts");
    expect(pos).toContain('await reportingErrors("sync catalog stock after a bill", () => syncProductCatalogStockWithFinishedStock());');

    const posActions = await read("app/admin/pos/actions.ts");
    expect(posActions).not.toContain('syncCatalogStockAfterBill("POS bill")');
    expect(posActions).not.toContain('syncCatalogStockAfterBill("POS exchange")');
    // A repair writes movements outside createPosInvoice, so it still syncs.
    expect(posActions).toContain('syncCatalogStockAfterBill("POS posting repair")');

    const purchaseActions = await read("app/admin/purchasing/actions.ts");
    expect(purchaseActions).not.toContain("syncProductCatalogStockWithFinishedStock");
  });

  it("reads the finished stock strictly for the sync — a hiccup must not zero every shoe", async () => {
    const operations = await read("lib/operations.ts");
    const strict = operations.slice(operations.indexOf("export async function getFinishedStockOrThrow()"));
    expect(strict.slice(0, 300)).not.toContain("catch");
  });
});

describe("3 and 4. Enter walks the forms that lacked it", () => {
  it("walks the counter's new-item form, and saves only through the question", async () => {
    const sheet = await read("app/admin/pos/_components/PosNewItemSheet.tsx");
    expect(sheet).toContain("<EnterWalkForm");
    expect(sheet).toContain("event.preventDefault();\n            save();");
    expect(sheet).toMatch(/<button\n\s+type="submit"\n\s+disabled=\{Boolean\(problem\) \|\| !ready \|\| saving\}/);
  });

  it("walks the product form and still lets the AI drafter read it", async () => {
    const form = await read("app/admin/ProductForm.tsx");
    expect(form).toContain("<EnterWalkForm formRef={formRef} onSubmit={handleSubmit}");
    expect(form).not.toContain("<form ");
    const walk = await read("components/admin/EnterWalkForm.tsx");
    expect(walk).toContain("if (outerRef) outerRef.current = node;");
  });

  it("walks the settings, staff and wholesale forms that take typing", async () => {
    const settings = await read("app/admin/settings/page.tsx");
    expect(settings.split("<EnterWalkForm").length - 1).toBe(7);
    // The database buttons have nothing to type and stay plain forms.
    expect(settings).toContain("<form action={prepareChequesDatabaseAction}");
    const staff = await read("components/admin/StaffAccessManager.tsx");
    expect(staff.split("<EnterWalkForm").length - 1).toBe(3);
    const wholesale = await read("app/admin/wholesale/page.tsx");
    expect(wholesale).toContain("<EnterWalkForm action={updateEnquiryStatusAction}");
  });
});
