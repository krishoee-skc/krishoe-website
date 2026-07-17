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

// A store that reads back what was written to it. A write-only mock would let
// a second purchase start from an empty file, which is not how the store
// behaves and would hide anything that depends on what is already saved —
// reusing an existing supplier, for one.
const files = new Map<string, string>();

vi.mock("node:fs/promises", () => ({
  readFile: (path: string) => {
    const content = files.get(path);

    return content === undefined
      ? Promise.reject(Object.assign(new Error("no file"), { code: "ENOENT" }))
      : Promise.resolve(content);
  },
}));

vi.mock("@/lib/atomic-json", () => ({
  writeFileAtomic: (path: string, content: string) => {
    files.set(path, content);
    return writeFileAtomic(path, content);
  },
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

const tradingGoodsLine = {
  kind: "Trading Goods" as const,
  materialId: "",
  design: "Doctor Chappal",
  channel: "Online" as const,
  sizeRun: "36-41",
  quantity: 60,
  rate: 500,
  note: "",
};

const tradingGoods = {
  ...supplier,
  items: [tradingGoodsLine],
  paidAmount: 30000,
};

beforeEach(() => {
  // Each test starts from an empty store, or it would inherit the bills and
  // suppliers the last one wrote.
  files.clear();
  // clearAllMocks keeps a mockRejectedValue set by an earlier test, which then
  // fails every test after it. Reset the behaviour explicitly instead: these
  // must resolve for the code under test to reach the part being tested.
  vi.clearAllMocks();
  addStockMovement.mockResolvedValue(undefined);
  addRawMaterialReceipt.mockResolvedValue(undefined);
  syncProductCatalogStockWithFinishedStock.mockResolvedValue(undefined);
  writeFileAtomic.mockResolvedValue(undefined);
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
      items: [
        {
          kind: "Raw Material",
          materialId: "RAW-1",
          design: "",
          channel: "" as const,
          sizeRun: "",
          quantity: 25,
          rate: 400,
          note: "",
        },
      ],
      paidAmount: 10000,
    });

    expect(addRawMaterialReceipt).toHaveBeenCalledTimes(1);
    expect(addStockMovement).not.toHaveBeenCalled();
    // Raw material is not a sellable pair, so the shop has nothing to refresh.
    expect(syncProductCatalogStockWithFinishedStock).not.toHaveBeenCalled();
  });

  it("posts each line of a bill that carries both kinds", async () => {
    // The owner's real bills do this: leather and ready-made chappals from one
    // supplier, on one bill. Each line has to land where its kind belongs.
    await createPurchaseInvoice({
      ...supplier,
      items: [
        {
          kind: "Raw Material",
          materialId: "RAW-1",
          design: "",
          channel: "" as const,
          sizeRun: "",
          quantity: 25,
          rate: 400,
          note: "",
        },
        tradingGoodsLine,
        { ...tradingGoodsLine, design: "PU Chappal", quantity: 40, rate: 350 },
      ],
      paidAmount: 0,
      paymentMethod: "Credit" as const,
    });

    expect(addRawMaterialReceipt).toHaveBeenCalledTimes(1);
    expect(addStockMovement).toHaveBeenCalledTimes(2);
    // One bill, one sync, however many trading lines it carried.
    expect(syncProductCatalogStockWithFinishedStock).toHaveBeenCalledTimes(1);
  });
});

describe("a purchase that cannot be stocked", () => {
  it("rejects trading goods with no product", async () => {
    await expect(
      createPurchaseInvoice({ ...tradingGoods, items: [{ ...tradingGoodsLine, design: "" }] }),
    ).rejects.toThrow(/choose a product and a channel/i);
    expect(addStockMovement).not.toHaveBeenCalled();
    expect(syncProductCatalogStockWithFinishedStock).not.toHaveBeenCalled();
  });

  it("rejects trading goods with no channel", async () => {
    await expect(
      createPurchaseInvoice({
        ...tradingGoods,
        items: [{ ...tradingGoodsLine, channel: "" as const }],
      }),
    ).rejects.toThrow(/choose a product and a channel/i);
    expect(addStockMovement).not.toHaveBeenCalled();
  });

  it("names the line that is wrong", async () => {
    // On a twenty-five line bill, "product and channel are required" is not
    // something the owner can act on. The line number is.
    await expect(
      createPurchaseInvoice({
        ...tradingGoods,
        items: [tradingGoodsLine, { ...tradingGoodsLine, design: "" }],
      }),
    ).rejects.toThrow(/Item 2/);
  });

  it("rejects a bill with nothing on it", async () => {
    await expect(createPurchaseInvoice({ ...tradingGoods, items: [] })).rejects.toThrow(
      /at least one item/i,
    );
  });

  it("ignores the blank rows the form always carries", async () => {
    const blank = {
      kind: "Raw Material" as const,
      materialId: "",
      design: "",
      channel: "" as const,
      sizeRun: "",
      quantity: 0,
      rate: 0,
      note: "",
    };

    await createPurchaseInvoice({ ...tradingGoods, items: [tradingGoodsLine, blank, blank] });

    // The spare row at the bottom of the form is not a mistake to complain
    // about, and not a line to post.
    expect(addStockMovement).toHaveBeenCalledTimes(1);
  });

  it("refuses a half-filled row rather than dropping it", async () => {
    // Something was typed, so the owner meant it. Dropping it silently would
    // post a bill missing an item the supplier charged for.
    await expect(
      createPurchaseInvoice({
        ...tradingGoods,
        items: [tradingGoodsLine, { ...tradingGoodsLine, quantity: 12, rate: 0 }],
      }),
    ).rejects.toThrow(/Item 2: quantity and rate are required/);
  });

  it("leaves the catalog alone when posting the pairs fails", async () => {
    addStockMovement.mockRejectedValue(new Error("stock movement failed"));

    await expect(createPurchaseInvoice(tradingGoods)).rejects.toThrow(/stock movement failed/);
    // The bill is rolled back, so caching a stock number from it would be wrong.
    expect(syncProductCatalogStockWithFinishedStock).not.toHaveBeenCalled();
  });
});

// One real bill, end to end: what the owner types, what gets written, and what
// costing then reads. The pieces are tested apart elsewhere; this is the seam.
describe("a real supplier bill", () => {
  // What Nobel Shoe's bill looks like: leather and two ready-made designs, one
  // discount for the lot.
  const bill = {
    ...supplier,
    paymentMethod: "Credit" as const,
    paidAmount: 0,
    discount: 5000,
    tax: 0,
    items: [
      {
        kind: "Raw Material" as const,
        materialId: "RAW-1",
        design: "",
        channel: "" as const,
        sizeRun: "",
        quantity: 100,
        rate: 500,
        note: "",
      }, // 50000
      { ...tradingGoodsLine, design: "Doctor Chappal", quantity: 200, rate: 350 }, // 70000
      { ...tradingGoodsLine, design: "PU Chappal", quantity: 50, rate: 1200 }, // 60000
    ],
  };

  function savedInvoice() {
    // The last write is the bill; writeFileAtomic gets (path, json).
    const calls = writeFileAtomic.mock.calls;
    const payload = JSON.parse(calls[calls.length - 1][1] as string) as {
      purchaseInvoices: Array<Record<string, unknown>>;
    };
    return payload.purchaseInvoices[0];
  }

  it("keeps all three lines on one bill", async () => {
    await createPurchaseInvoice(bill);
    const invoice = savedInvoice();

    expect(invoice.items).toHaveLength(3);
    expect(invoice.purchaseNumber).toBeTruthy();
  });

  it("calls a bill carrying both kinds Mixed", async () => {
    await createPurchaseInvoice(bill);

    expect(savedInvoice().kind).toBe("Mixed");
  });

  it("totals the bill the way the supplier wrote it", async () => {
    await createPurchaseInvoice(bill);

    // 50000 + 70000 + 60000 - 5000 discount
    expect(savedInvoice().total).toBe(175000);
  });

  it("shares the discount across the lines, adding back to the bill", async () => {
    await createPurchaseInvoice(bill);
    const invoice = savedInvoice();
    const items = invoice.items as Array<{ lineTotal: number }>;
    const sum = Math.round(items.reduce((total, item) => total + item.lineTotal, 0) * 100) / 100;

    // The lines are what costing charges a pair at. If they do not add up to
    // the bill, the ledger and the cost of goods disagree forever.
    expect(sum).toBe(invoice.total);
  });

  it("posts each line where its kind belongs", async () => {
    await createPurchaseInvoice(bill);

    expect(addRawMaterialReceipt).toHaveBeenCalledWith({ materialId: "RAW-1", quantity: 100 });
    expect(addStockMovement).toHaveBeenCalledTimes(2);
    expect(addStockMovement).toHaveBeenCalledWith(
      expect.objectContaining({ design: "Doctor Chappal", pairs: 200, type: "Purchase In" }),
    );
    expect(addStockMovement).toHaveBeenCalledWith(
      expect.objectContaining({ design: "PU Chappal", pairs: 50, type: "Purchase In" }),
    );
  });

  it("owes the supplier the whole bill on credit", async () => {
    await createPurchaseInvoice(bill);
    const invoice = savedInvoice();

    expect(invoice.creditAmount).toBe(175000);
    expect(invoice.status).toBe("Credit");
  });

  it("posts one ledger entry, not one per line", async () => {
    await createPurchaseInvoice(bill);
    const calls = writeFileAtomic.mock.calls;
    const payload = JSON.parse(calls[calls.length - 1][1] as string) as {
      supplierTransactions: Array<{ type: string; amount: number }>;
    };
    const bills = payload.supplierTransactions.filter((row) => row.type === "Purchase Bill");

    // The supplier wrote one bill. Three ledger entries could never be
    // reconciled against their statement.
    expect(bills).toHaveLength(1);
    expect(bills[0].amount).toBe(175000);
  });
});

describe("one supplier, one ledger", () => {
  const line = {
    kind: "Raw Material" as const,
    materialId: "RAW-1",
    design: "",
    channel: "" as const,
    sizeRun: "",
    quantity: 10,
    rate: 100,
    note: "",
  };
  const paidAmount = 0;

  function savedLedgers() {
    const calls = writeFileAtomic.mock.calls;
    const payload = JSON.parse(calls[calls.length - 1][1] as string) as {
      supplierLedgers: Array<{ id: string; supplierName: string }>;
    };
    return payload.supplierLedgers;
  }

  it("creates the supplier the first time the name is typed", async () => {
    await createPurchaseInvoice({ ...supplier, paidAmount, supplierName: "Rijal Dai", items: [line] });

    expect(savedLedgers()).toHaveLength(1);
    expect(savedLedgers()[0].supplierName).toBe("Rijal Dai");
  });

  it("reuses the supplier when the name is typed again", async () => {
    // Two ledgers for Rijal Dai would split what he is owed across both, and
    // neither would show the real balance.
    await createPurchaseInvoice({ ...supplier, paidAmount, supplierName: "Rijal Dai", items: [line] });
    const first = savedLedgers()[0].id;

    await createPurchaseInvoice({ ...supplier, paidAmount, supplierName: "Rijal Dai", items: [line] });

    expect(savedLedgers()).toHaveLength(1);
    expect(savedLedgers()[0].id).toBe(first);
  });

  it("reuses the supplier however the name was typed", async () => {
    await createPurchaseInvoice({ ...supplier, paidAmount, supplierName: "Rijal Dai", items: [line] });
    await createPurchaseInvoice({ ...supplier, paidAmount, supplierName: "  rijal  dai ", items: [line] });

    expect(savedLedgers()).toHaveLength(1);
  });

  it("still creates a genuinely different supplier", async () => {
    await createPurchaseInvoice({ ...supplier, paidAmount, supplierName: "Rijal Dai", items: [line] });
    await createPurchaseInvoice({ ...supplier, paidAmount, supplierName: "Nobel Shoe", items: [line] });

    expect(savedLedgers()).toHaveLength(2);
  });
});
