import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { purchaseMemory, rateKey, sizesFromNote } from "@/lib/purchase-memory";
import type { PurchaseInvoice } from "@/lib/purchasing";

/**
 * The purchase bill, as the owner asked for it (demo 2): one box for both
 * kinds, the last rate filled in, sizes required on ready-made pairs, VAT
 * remembered per supplier, a warning for a bill number already entered, the
 * last bill repeated in one press, and the bill shown after saving.
 */

const item = (overrides: Partial<PurchaseInvoice["items"][number]>) =>
  ({
    id: "L1", lineNo: 1, kind: "Raw Material", materialId: "RAW-1", itemName: "EVA Sole", design: "",
    channel: "", sizeRun: "Mixed", unit: "pair", quantity: 100, rate: 95, lineSubtotal: 9500, lineTotal: 9500, note: "",
    ...overrides,
  }) as PurchaseInvoice["items"][number];

const bill = (overrides: Partial<PurchaseInvoice>) =>
  ({ id: "P", supplierLedgerId: "S1", supplierBillNo: "", createdAt: "2026-09-01T00:00:00Z", tax: 0, items: [], ...overrides }) as PurchaseInvoice;

describe("what the bill remembers", () => {
  const memory = purchaseMemory([
    bill({ id: "old", createdAt: "2026-08-01T00:00:00Z", supplierBillNo: "A-1", items: [item({ rate: 80 })] }),
    bill({
      id: "new",
      createdAt: "2026-09-20T00:00:00Z",
      supplierBillNo: "A-2",
      tax: 1300,
      items: [
        item({ rate: 95 }),
        item({ kind: "Trading Goods", materialId: "", design: "Ladies Heel", itemName: "Ladies Heel", unit: "pair", quantity: 12, rate: 1150, sizeRun: "36-41", note: "Sizes 36×2, 37×10" }),
      ],
    }),
    bill({ id: "other", supplierLedgerId: "S2", supplierBillNo: "X9", items: [item({ materialId: "RAW-2", rate: 40 })] }),
  ]);

  it("fills the rate from the newest bill, not an older one", () => {
    expect(memory.lastRates[rateKey("Raw Material", "RAW-1")].rate).toBe(95);
    expect(memory.lastRates[rateKey("Trading Goods", "ladies heel")]).toEqual({ rate: 1150, unit: "pair", sizeRun: "36-41" });
  });

  it("knows each supplier's bill numbers, to warn about a second entry", () => {
    expect(memory.suppliers.S1.billNos).toEqual(["a-2", "a-1"]);
    expect(memory.suppliers.S2.billNos).toEqual(["x9"]);
  });

  it("remembers the last bill — VAT and lines, sizes included — for repeating it", () => {
    const last = memory.suppliers.S1.last!;
    expect(last.billNo).toBe("A-2");
    expect(last.vat).toBe(true);
    expect(last.lines[1]).toMatchObject({ kind: "Trading Goods", design: "Ladies Heel", sizes: { "36": 2, "37": 10 } });
    expect(memory.suppliers.S2.last!.vat).toBe(false);
  });

  it("reads a size split back off a line's note", () => {
    expect(sizesFromNote("Sizes 38×3, 40×1 · rush order")).toEqual({ "38": 3, "40": 1 });
    expect(sizesFromNote("rush order")).toEqual({});
  });
});

describe("the form keeps its promises", () => {
  const form = () => readFile("app/admin/purchasing/_components/PurchaseInvoiceForm.tsx", "utf8");

  it("requires sizes on a ready-made line, and posts them", async () => {
    const source = await form();
    expect(source).toContain("name={`item${index}Sizes`}");
    expect(source).toContain('text("Pairs by size (required)", "साइजअनुसार जोडी (अनिवार्य)")');
    expect(source).toContain("readOnly={trading}");
  });

  it("never lets the item box shrink away", async () => {
    const source = await form();
    expect(source).toContain("md:grid-cols-[42px_minmax(0,2.2fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1fr)_40px]");
    expect(source).not.toMatch(/_0\.7fr_|_104px_/);
  });

  it("moves the cursor on Enter straight away, and still never saves on Enter", async () => {
    const source = await form();
    expect(source).toContain("if (pendingFocus.current) setFocusTick((tick) => tick + 1);");
    expect(source).toContain("phoneSaveButton.current)?.focus();");
    expect(source).not.toMatch(/key === "Enter"[^\n]*requestSubmit/);
  });

  it("warns, never refuses, over a bill number already entered", async () => {
    const source = await form();
    expect(source).toContain("supplierMemory?.billNos.includes(billNo.trim().toLowerCase())");
  });

  it("shows the bill after saving, with New bill first", async () => {
    const source = await form();
    expect(source).toContain("if (receipt) newBillButton.current?.focus();");
    expect(source).toContain('🖨️ {text("See / print", "हेर्ने / प्रिन्ट")}');
  });

  it("the save links to the saved bill, where it can be printed", async () => {
    const actions = await readFile("app/admin/purchasing/actions.ts", "utf8");
    expect(actions).toContain("href: `/admin/purchasing/${invoice.id}`");
  });
});

describe("the recheck's five fixes stay fixed", () => {
  const form = () => readFile("app/admin/purchasing/_components/PurchaseInvoiceForm.tsx", "utf8");

  it("a remembered rate follows the item; a typed rate is never overwritten", async () => {
    const source = await form();
    expect(source).toContain("if (row.rate && !row.rateAuto) return {};");
    expect(source).toContain("updateRow(row.key, { rate: event.target.value, rateAuto: false })");
  });

  it("Ctrl+S in another form on the page does not file this bill", async () => {
    expect(await form()).toContain("if (active && active !== document.body && !formRef.current.contains(active)) return;");
  });

  it("the next bill's photos are not wiped by the last bill's upload", async () => {
    const source = await form();
    expect(source.indexOf("setPhotos([]);", source.indexOf("const href = result.href"))).toBeLessThan(
      source.indexOf("const sent = await uploadBillPhoto"),
    );
  });

  it("on a phone the last box hands over to the Save in the bottom bar", async () => {
    expect(await form()).toContain("(saveButton.current?.offsetParent ? saveButton.current : phoneSaveButton.current)?.focus();");
  });

  it("changing a line's kind drops its sizes", async () => {
    expect(await form()).toContain('quantity: row.kind === "Trading Goods" ? "" : row.quantity,');
  });
});
