import { beforeEach, describe, expect, it, vi } from "vitest";

// A raw purchase may name a material that is not in the list yet — the way a
// bill can name a new supplier — and the material is found-or-created before the
// bill posts. This pins that wiring: the typed name becomes a real material id,
// and the receipt lands against it.

const addStockMovement = vi.fn();
const addRawMaterialReceipt = vi.fn();
const resolveOrCreateRawMaterial = vi.fn();
const syncProductCatalogStockWithFinishedStock = vi.fn();

// A live list, so a material created mid-bill is visible to the read that posts
// the receipt — which is exactly what the real store does.
const materials: { id: string; name: string; unit: string }[] = [];

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
    return Promise.resolve();
  },
}));

vi.mock("@/lib/operations", () => ({
  addStockMovement: (...args: unknown[]) => addStockMovement(...args),
  addRawMaterialReceipt: (...args: unknown[]) => addRawMaterialReceipt(...args),
  resolveOrCreateRawMaterial: (...args: unknown[]) => resolveOrCreateRawMaterial(...args),
  getOperationsData: () => Promise.resolve({ rawMaterials: materials }),
}));

vi.mock("@/lib/pos", () => ({ getPosSnapshot: () => Promise.resolve({ invoices: [] }) }));

vi.mock("@/lib/product-store", () => ({
  syncProductCatalogStockWithFinishedStock: () => syncProductCatalogStockWithFinishedStock(),
}));

const { createPurchaseInvoice } = await import("@/lib/purchasing");

const supplier = {
  supplierLedgerId: "",
  supplierName: "rijal supplyres",
  phone: "",
  paymentMethod: "Cash" as const,
  paymentReference: "",
  discount: 0,
  tax: 0,
  paidAmount: 0,
  note: "",
};

beforeEach(() => {
  files.clear();
  materials.length = 0;
  materials.push({ id: "RAW-REXIN", name: "rexin", unit: "kg" });
  addStockMovement.mockReset();
  addRawMaterialReceipt.mockReset().mockResolvedValue(undefined);
  syncProductCatalogStockWithFinishedStock.mockReset().mockResolvedValue(undefined);
  // Resolve-or-create: reuse an existing name, otherwise add it to the live list.
  resolveOrCreateRawMaterial.mockReset().mockImplementation((name: string, unit: string) => {
    const key = name.trim().toLowerCase();
    const existing = materials.find((material) => material.name.trim().toLowerCase() === key);
    if (existing) {
      return Promise.resolve(existing);
    }
    const created = { id: "RAW-NEW", name, unit };
    materials.push(created);
    return Promise.resolve(created);
  });
});

describe("buying a raw material that is not in the list yet", () => {
  it("creates the material from its name and posts the receipt to it", async () => {
    await createPurchaseInvoice({
      ...supplier,
      items: [
        { kind: "Raw Material", materialId: "", materialName: "PU Granule", materialUnit: "kg", design: "", channel: "", sizeRun: "", quantity: 40, rate: 300, note: "" },
      ],
    });

    expect(resolveOrCreateRawMaterial).toHaveBeenCalledWith("PU Granule", "kg");
    expect(addRawMaterialReceipt).toHaveBeenCalledWith({ materialId: "RAW-NEW", quantity: 40 });
  });

  it("still uses an existing material when one is picked, without creating", async () => {
    await createPurchaseInvoice({
      ...supplier,
      items: [
        { kind: "Raw Material", materialId: "RAW-REXIN", design: "", channel: "", sizeRun: "", quantity: 50, rate: 350, note: "" },
      ],
    });

    expect(resolveOrCreateRawMaterial).not.toHaveBeenCalled();
    expect(addRawMaterialReceipt).toHaveBeenCalledWith({ materialId: "RAW-REXIN", quantity: 50 });
  });

  it("creates one material when the same new name appears on two lines", async () => {
    await createPurchaseInvoice({
      ...supplier,
      items: [
        { kind: "Raw Material", materialId: "", materialName: "PU Granule", materialUnit: "kg", design: "", channel: "", sizeRun: "", quantity: 40, rate: 300, note: "" },
        { kind: "Raw Material", materialId: "", materialName: "pu granule", materialUnit: "kg", design: "", channel: "", sizeRun: "", quantity: 10, rate: 300, note: "" },
      ],
    });

    expect(resolveOrCreateRawMaterial).toHaveBeenCalledTimes(1);
    expect(addRawMaterialReceipt).toHaveBeenCalledTimes(2);
    expect(addRawMaterialReceipt).toHaveBeenCalledWith({ materialId: "RAW-NEW", quantity: 40 });
    expect(addRawMaterialReceipt).toHaveBeenCalledWith({ materialId: "RAW-NEW", quantity: 10 });
  });

  it("refuses a raw line with neither a chosen material nor a typed name", async () => {
    await expect(
      createPurchaseInvoice({
        ...supplier,
        items: [
          { kind: "Raw Material", materialId: "", design: "", channel: "", sizeRun: "", quantity: 40, rate: 300, note: "" },
        ],
      }),
    ).rejects.toThrow(/choose a raw material, or type a new material name/);
  });
});
