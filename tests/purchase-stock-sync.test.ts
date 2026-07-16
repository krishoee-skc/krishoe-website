import { beforeEach, describe, expect, it, vi } from "vitest";

// The chain under test is a wiring one, not an arithmetic one: buying trading
// goods must leave the shop showing pairs it can sell. The pairs land in
// finished stock, but the shop reads products.stock — a cached column that only
// changes when the catalog sync runs. Miss that call and the bill posts, the
// ERP looks right, and the shop still says nothing is buyable.

const addStockMovement = vi.fn();
const addRawMaterialReceipt = vi.fn();
const syncProductCatalogStockWithFinishedStock = vi.fn();
const writeFileAtomic = vi.fn();

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockRejectedValue(Object.assign(new Error("no file"), { code: "ENOENT" })),
}));

vi.mock("@/lib/atomic-json", () => ({
  writeFileAtomic: (...args: unknown[]) => writeFileAtomic(...args),
}));

vi.mock("@/lib/operations", () => ({
  addStockMovement: (...args: unknown[]) => addStockMovement(...args),
  addRawMaterialReceipt: (...args: unknown[]) => addRawMaterialReceipt(...args),
  getOperationsData: () =>
    Promise.resolve({
      rawMaterials: [{ id: "RAW-1", name: "Sole Sheet", unit: "kg" }],
    }),
}));

vi.mock("@/lib/pos", () => ({
  getPosSnapshot: () => Promise.resolve({ invoices: [] }),
}));

vi.mock("@/lib/product-store", () => ({
  syncProductCatalogStockWithFinishedStock: () => syncProductCatalogStockWithFinishedStock(),
}));

const { createPurchaseInvoice } = await import("@/lib/purchasing");

const supplier = {
  supplierLedgerId: "",
  supplierName: "Kathmandu Shoe House",
  phone: "9800000000",
  paymentMethod: "Cash" as const,
  paymentReference: "",
  discount: 0,
  tax: 0,
  note: "",
};

const tradingGoods = {
  ...supplier,
  kind: "Trading Goods" as const,
  materialId: "",
  design: "Doctor Chappal",
  channel: "Online" as const,
  sizeRun: "36-41",
  quantity: 60,
  rate: 500,
  paidAmount: 30000,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buying trading goods", () => {
  it("raises finished stock for the channel it was bought for", async () => {
    await createPurchaseInvoice(tradingGoods);

    expect(addStockMovement).toHaveBeenCalledTimes(1);
    expect(addStockMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        design: "Doctor Chappal",
        channel: "Online",
        sizeRun: "36-41",
        type: "Purchase In",
        pairs: 60,
      }),
    );
  });

  it("refreshes the catalog stock the shop reads", async () => {
    await createPurchaseInvoice(tradingGoods);

    expect(syncProductCatalogStockWithFinishedStock).toHaveBeenCalledTimes(1);
  });

  it("refreshes the catalog only after the pairs exist", async () => {
    const order: string[] = [];
    addStockMovement.mockImplementation(() => {
      order.push("stock");
      return Promise.resolve();
    });
    syncProductCatalogStockWithFinishedStock.mockImplementation(() => {
      order.push("sync");
      return Promise.resolve();
    });

    await createPurchaseInvoice(tradingGoods);

    // Syncing first would read the old finished stock and cache the old number.
    expect(order).toEqual(["stock", "sync"]);
  });

  it("does not raise stock for a raw material purchase", async () => {
    await createPurchaseInvoice({
      ...supplier,
      kind: "Raw Material",
      materialId: "RAW-1",
      design: "",
      channel: "" as const,
      sizeRun: "",
      quantity: 25,
      rate: 400,
      paidAmount: 10000,
    });

    expect(addRawMaterialReceipt).toHaveBeenCalledTimes(1);
    expect(addStockMovement).not.toHaveBeenCalled();
    // Raw material is not a sellable pair, so the shop has nothing to refresh.
    expect(syncProductCatalogStockWithFinishedStock).not.toHaveBeenCalled();
  });
});

describe("a purchase that cannot be stocked", () => {
  it("rejects trading goods with no product", async () => {
    await expect(createPurchaseInvoice({ ...tradingGoods, design: "" })).rejects.toThrow(
      /Product and channel are required/,
    );
    expect(addStockMovement).not.toHaveBeenCalled();
    expect(syncProductCatalogStockWithFinishedStock).not.toHaveBeenCalled();
  });

  it("rejects trading goods with no channel", async () => {
    await expect(createPurchaseInvoice({ ...tradingGoods, channel: "" as const })).rejects.toThrow(
      /Product and channel are required/,
    );
    expect(addStockMovement).not.toHaveBeenCalled();
  });

  it("leaves the catalog alone when posting the pairs fails", async () => {
    addStockMovement.mockRejectedValue(new Error("stock movement failed"));

    await expect(createPurchaseInvoice(tradingGoods)).rejects.toThrow(/stock movement failed/);
    // The bill is rolled back, so caching a stock number from it would be wrong.
    expect(syncProductCatalogStockWithFinishedStock).not.toHaveBeenCalled();
  });
});
