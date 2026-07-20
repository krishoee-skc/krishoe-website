import { beforeEach, describe, expect, it, vi } from "vitest";

const createPurchaseInvoice = vi.fn();
const reportError = vi.fn();

vi.mock("@/lib/purchasing", () => ({
  createPurchaseInvoice: (...args: unknown[]) => createPurchaseInvoice(...args),
  addSupplierLedger: vi.fn(),
  addSupplierTransaction: vi.fn(),
}));
vi.mock("@/lib/admin-permissions", () => ({ requireAdminPermission: vi.fn() }));
vi.mock("@/lib/admin-audit", () => ({ recordAdminAuditEvent: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/report-error", () => ({
  reportError: (...args: unknown[]) => reportError(...args),
  reportingErrors: vi.fn(),
}));

import { createPurchaseInvoiceAction } from "@/app/admin/purchasing/actions";

// One trading line: gems shoes selling Ladies Heel, 50 pairs at Rs. 350.
function purchaseForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("supplierName", "gems shoes");
  formData.set("itemCount", "1");
  formData.set("item0Kind", "Trading Goods");
  formData.set("item0Design", "Ladies Heel");
  formData.set("item0Channel", "Wholesale");
  formData.set("item0SizeRun", "Mixed");
  formData.set("item0Quantity", "50");
  formData.set("item0Rate", "350");
  formData.set("paymentMethod", "Cash");

  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }

  return formData;
}

beforeEach(() => {
  createPurchaseInvoice.mockReset().mockResolvedValue({
    purchaseNumber: "KR-PUR-20260720-0002",
    kind: "Trading Goods",
    items: [{}],
    total: 17500,
  });
  reportError.mockReset();
});

// The owner filled a bill, pressed Save, and nothing happened — no saved bill,
// and no word of why. The action threw straight to the admin error page, taking
// every line with it. These pin down that a purchase now reports its outcome.
describe("saving a purchase reports what happened", () => {
  it("returns success with the purchase number", async () => {
    const state = await createPurchaseInvoiceAction(null, purchaseForm());

    expect(state.ok).toBe(true);
    expect(state.message).toContain("KR-PUR-20260720-0002");
  });

  // The exact reason the owner never saw. createPurchaseInvoice throws these by
  // line; the action must hand them back, not swallow them into a digest.
  it("shows the line that is not filled in", async () => {
    createPurchaseInvoice.mockRejectedValue(new Error("Item 2: choose a raw material."));

    const state = await createPurchaseInvoiceAction(null, purchaseForm());

    expect(state.ok).toBe(false);
    expect(state.message).toBe("Item 2: choose a raw material.");
  });

  it("names the missing supplier rather than failing silently", async () => {
    createPurchaseInvoice.mockRejectedValue(
      new Error("Choose an existing supplier or enter a new supplier name."),
    );

    const state = await createPurchaseInvoiceAction(null, purchaseForm({ supplierName: "" }));

    expect(state.ok).toBe(false);
    expect(state.message).toContain("supplier");
  });

  it("tells the owner to retry when the database connection drops", async () => {
    createPurchaseInvoice.mockRejectedValue(new Error("Connection terminated unexpectedly"));

    const state = await createPurchaseInvoiceAction(null, purchaseForm());

    expect(state.ok).toBe(false);
    expect(state.message).toContain("press Save again");
  });

  it("passes the whole bill through — every line, not just the first", async () => {
    await createPurchaseInvoiceAction(
      null,
      purchaseForm({
        itemCount: "2",
        item1Kind: "Raw Material",
        item1MaterialId: "RAW-1",
        item1Quantity: "10",
        item1Rate: "80",
      }),
    );

    const passed = createPurchaseInvoice.mock.calls[0][0];
    expect(passed.items).toHaveLength(2);
    expect(passed.items[1]).toMatchObject({ materialId: "RAW-1", quantity: 10, rate: 80 });
  });
});
