import { beforeEach, describe, expect, it, vi } from "vitest";

const createPosInvoice = vi.fn();
const reportError = vi.fn();

vi.mock("@/lib/pos", () => ({
  createPosInvoice: (...args: unknown[]) => createPosInvoice(...args),
  repairPosInvoicePosting: vi.fn(),
}));
vi.mock("@/lib/admin-permissions", () => ({ requireAdminPermission: vi.fn() }));
vi.mock("@/lib/admin-audit", () => ({ recordAdminAuditEvent: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/report-error", () => ({
  reportError: (...args: unknown[]) => reportError(...args),
  reportingErrors: vi.fn(),
}));

import { createPosInvoiceAction } from "@/app/admin/pos/actions";

function saleForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("kind", "Sale");
  formData.set("channel", "Retail");
  formData.set("paymentMethod", "Cash");
  formData.set("itemCount", "1");
  formData.set("item0Design", "Ladies Heel");
  formData.set("item0Quantity", "2");
  formData.set("item0Rate", "1799");

  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }

  return formData;
}

beforeEach(() => {
  createPosInvoice.mockReset().mockResolvedValue({
    id: "POS-1",
    invoiceNumber: "KR-POS-20260720-0001",
    kind: "Sale",
    total: 3598,
  });
  reportError.mockReset();
});

// A counter sale that failed used to take the cashier to the admin error page,
// the whole bill gone with no word of why. These pin down that a sale now
// reports its outcome and hands back the receipt link on success.
describe("saving a POS bill reports what happened", () => {
  it("returns success with the invoice number and a receipt link", async () => {
    const state = await createPosInvoiceAction(null, saleForm());

    expect(state.ok).toBe(true);
    expect(state.message).toContain("KR-POS-20260720-0001");
    expect(state.href).toBe("/admin/pos/POS-1");
  });

  it("refuses a return with no ledger, in plain words, without throwing", async () => {
    const state = await createPosInvoiceAction(null, saleForm({ kind: "Return" }));

    expect(state.ok).toBe(false);
    expect(state.message).toContain("customer ledger");
    expect(createPosInvoice).not.toHaveBeenCalled();
  });

  it("refuses a credit bill that also carries a paid amount", async () => {
    const state = await createPosInvoiceAction(null, saleForm({ paymentMethod: "Credit", paidAmount: "500" }));

    expect(state.ok).toBe(false);
    expect(state.message).toContain("Credit");
  });

  // The failure the whole change is about: an oversell used to vanish into the
  // error page; now the cashier reads it.
  it("hands back the reason when the sale is refused deeper in", async () => {
    createPosInvoice.mockRejectedValue(new Error("Only 3 pairs of Ladies Heel are in stock."));

    const state = await createPosInvoiceAction(null, saleForm());

    expect(state.ok).toBe(false);
    expect(state.message).toBe("Only 3 pairs of Ladies Heel are in stock.");
  });

  it("tells the cashier to retry when the database connection drops", async () => {
    createPosInvoice.mockRejectedValue(new Error("Connection terminated unexpectedly"));

    const state = await createPosInvoiceAction(null, saleForm());

    expect(state.ok).toBe(false);
    expect(state.message).toContain("press Save again");
  });
});
