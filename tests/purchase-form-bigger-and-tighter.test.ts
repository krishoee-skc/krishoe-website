import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const FORM = "app/admin/purchasing/_components/PurchaseInvoiceForm.tsx";
const read = async () => (await readFile(FORM, "utf8")).replace(/\r\n/g, "\n");

/**
 * The owner's two asks for the purchase bill (2026-09-29): the supplier's bill
 * no. took a line of its own, almost full width, for a number like "12"; and
 * the writing was small. Supplier, bill no. and the photo now share one line,
 * and every size in the form went up a step.
 */
describe("the purchase bill's 'who it came from' line", () => {
  it("puts supplier, bill no. and the photo on one row", async () => {
    const form = await read();
    const row = form.slice(form.indexOf("md:grid-cols-[minmax(0,1fr)_150px_48px]"));
    const end = row.indexOf("{photos.length > 0 ? (");
    const inRow = row.slice(0, end);
    expect(inRow).toContain('aria-controls="purchase-supplier-list"');
    expect(inRow).toContain('name="supplierBillNo"');
    expect(inRow).toContain('type="file"');
  });

  it("keeps the bill no. and the photo named for screen readers", async () => {
    const form = await read();
    expect(form).toContain('<span className="sr-only">{text("Supplier\'s bill no.", "साहुको बिल नं.")}</span>');
    expect(form).toContain('<span className="sr-only">{text("Photo of their bill", "साहुको बिलको फोटो")}</span>');
  });
});

describe("the purchase bill's writing", () => {
  it("has nothing smaller than 12px, and boxes at 16px", async () => {
    const form = await read();
    expect(form).not.toMatch(/(?<=[\s"'`:])text-(xs|\[1[01]px\])(?=[\s"'`])/);
    expect(form).toContain('"h-12 rounded-md border px-3 text-base outline-none');
    expect(form.split('<h3 className="text-[17px] font-black text-brand-green-ink">').length - 1).toBe(4);
  });
});
