import { beforeEach, describe, expect, it, vi } from "vitest";

const getPurchasingSnapshot = vi.fn();
const getOperationsSnapshot = vi.fn();
const getProducts = vi.fn();
const reportError = vi.fn();

vi.mock("@/lib/purchasing", () => ({
  getPurchasingSnapshot: () => getPurchasingSnapshot(),
}));
vi.mock("@/lib/operations", () => ({
  getOperationsSnapshot: () => getOperationsSnapshot(),
}));
vi.mock("@/lib/product-store", () => ({
  getProducts: (...args: unknown[]) => getProducts(...args),
}));
vi.mock("@/lib/report-error", () => ({
  reportError: (...args: unknown[]) => reportError(...args),
  reportingErrors: vi.fn(),
}));
vi.mock("@/app/admin/purchasing/actions", () => ({
  createSupplierLedgerAction: vi.fn(),
  createSupplierTransactionAction: vi.fn(),
}));
vi.mock("@/app/admin/purchasing/_components/PurchaseInvoiceForm", () => ({ default: () => null }));
vi.mock("@/components/admin/LoadFailure", () => ({ default: () => null }));

const { default: AdminPurchasingPage } = await import("@/app/admin/purchasing/page");

// A shop that has bought nothing yet — every figure zero, every list empty.
// Spelled out rather than trimmed to what today's page happens to read, so a
// field added to the page shows up as a missing-fixture failure here instead of
// only in production.
const emptySnapshot = {
  summary: {
    todayPurchase: 0,
    monthPurchase: 0,
    yearPurchase: 0,
    todayProfitEstimate: 0,
    monthProfitEstimate: 0,
    yearProfitEstimate: 0,
    supplierDue: 0,
    supplierCount: 0,
    supplierOver90Due: 0,
    supplierAgingRiskCount: 0,
    supplierImmediatePaymentCount: 0,
    purchaseInvoiceCount: 0,
    postingNeedsReview: 0,
    postedInvoiceCount: 0,
  },
  reports: {
    materialTotals: [],
    postingReviewRows: [],
    recentInvoices: [],
    supplierAgingRows: [],
    supplierAgingTotals: {
      current: 0,
      days31To60: 0,
      days61To90: 0,
      over90: 0,
      agedTotal: 0,
      reconciliationDelta: 0,
      dueSupplierCount: 0,
      riskSupplierCount: 0,
    },
    supplierDueRows: [],
    supplierPaymentFollowups: [],
    supplierPaymentSummary: {
      immediateCount: 0,
      highCount: 0,
      scheduledCount: 0,
      normalCount: 0,
      clearCount: 0,
      immediateDue: 0,
      highDue: 0,
      paymentRunDue: 0,
      totalDue: 0,
    },
  },
  supplierLedgers: [],
  purchaseInvoices: [],
  supplierTransactions: [],
};

beforeEach(() => {
  getPurchasingSnapshot.mockReset().mockResolvedValue(emptySnapshot);
  getOperationsSnapshot.mockReset().mockResolvedValue({ rawMaterials: [], finishedStock: [] });
  getProducts.mockReset().mockResolvedValue([]);
  reportError.mockReset();
});

// Reported three times as "it says quick retry again" and diagnosed none,
// because the reason was replaced by a digest before it reached the owner. Any
// one of the three loads failing used to do it.
describe("the purchasing page failing to load", () => {
  const loaders = [
    ["the purchase bills", () => getPurchasingSnapshot],
    ["operations", () => getOperationsSnapshot],
    ["the catalog", () => getProducts],
  ] as const;

  for (const [label, get] of loaders) {
    it(`survives ${label} failing`, async () => {
      get().mockRejectedValue(new Error("Connection terminated unexpectedly"));

      await expect(AdminPurchasingPage()).resolves.toBeTruthy();
      expect(reportError).toHaveBeenCalledTimes(1);
      expect(reportError.mock.calls[0][0]).toContain("purchasing");
    });
  }

  it("renders normally when every load succeeds", async () => {
    await expect(AdminPurchasingPage()).resolves.toBeTruthy();
    expect(reportError).not.toHaveBeenCalled();
  });

  it("reads drafts too, so unpublished designs can still be purchased against", async () => {
    await AdminPurchasingPage();

    expect(getProducts).toHaveBeenCalledWith({ includeDrafts: true });
  });
});
