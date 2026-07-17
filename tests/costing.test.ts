import { describe, expect, it } from "vitest";
import {
  buildDesignCosting,
  buildMaterialCostRates,
  marginRate,
  overheadPerPair,
  type BatchCostingRow,
} from "@/lib/costing";
import type { CostingSettings } from "@/lib/costing-settings";
import type { PurchaseInvoice } from "@/lib/purchasing";

function invoice(overrides: Partial<PurchaseInvoice> = {}): PurchaseInvoice {
  return {
    id: "PUR-1",
    purchaseNumber: "PUR-0001",
    createdAt: "2026-07-01T00:00:00.000Z",
    supplierLedgerId: "SUP-1",
    supplierName: "Kathmandu Leather",
    kind: "Raw Material",
    materialId: "RAW-1",
    materialName: "Sole Sheet",
    design: "",
    channel: "",
    sizeRun: "Mixed",
    unit: "kg",
    quantity: 10,
    rate: 100,
    discount: 0,
    tax: 0,
    total: 1000,
    paidAmount: 1000,
    creditAmount: 0,
    paymentMethod: "Cash",
    paymentReference: "",
    status: "Paid",
    postingStatus: "Posted",
    supplierTransactionIds: [],
    note: "",
    ...overrides,
  };
}

function settings(overrides: Partial<CostingSettings> = {}): CostingSettings {
  return {
    id: "default",
    updatedAt: "2026-07-01T00:00:00.000Z",
    laborRates: {
      Cutting: 0,
      Stitching: 0,
      "Sole Press": 0,
      Finishing: 0,
      Packing: 0,
      QC: 0,
    },
    factoryOverheadPerPair: 0,
    electricityPerPair: 0,
    rentPerPair: 0,
    miscellaneousPerPair: 0,
    monthlyFixedOverhead: 0,
    monthlyCapacityPairs: 0,
    note: "",
    ...overrides,
  };
}

function batch(overrides: Partial<BatchCostingRow> = {}): BatchCostingRow {
  return {
    batchId: "BATCH-1",
    design: "Doctor Chappal",
    status: "Packed",
    plannedPairs: 100,
    finishedPairs: 100,
    rejectedPairs: 0,
    materialCost: 20000,
    laborCost: 8000,
    overheadCost: 2000,
    totalProductionCost: 30000,
    unitCostPerPair: 300,
    consumptionCount: 1,
    laborTaskCount: 1,
    missingCostMaterials: [],
    missingLaborStations: [],
    missingOverheadRate: false,
    ...overrides,
  };
}

describe("material cost rates", () => {
  it("averages the unit cost over every invoice for a material", () => {
    // 10kg at 100 and 10kg at 200 is 3000 for 20kg — 150/kg, not 150 by luck.
    const rates = buildMaterialCostRates([
      invoice({ id: "PUR-1", quantity: 10, rate: 100, total: 1000 }),
      invoice({ id: "PUR-2", quantity: 10, rate: 200, total: 2000 }),
    ]);

    expect(rates).toHaveLength(1);
    expect(rates[0].purchasedQuantity).toBe(20);
    expect(rates[0].purchaseTotal).toBe(3000);
    expect(rates[0].averageUnitCost).toBe(150);
    expect(rates[0].invoiceCount).toBe(2);
  });

  it("weights the average by quantity, not by invoice count", () => {
    // 90kg cheap and 10kg dear must not average to the midpoint.
    const rates = buildMaterialCostRates([
      invoice({ id: "PUR-1", quantity: 90, rate: 100, total: 9000 }),
      invoice({ id: "PUR-2", quantity: 10, rate: 900, total: 9000 }),
    ]);

    expect(rates[0].averageUnitCost).toBe(180); // 18000 / 100, not (100+900)/2
  });

  it("keeps different materials apart", () => {
    const rates = buildMaterialCostRates([
      invoice({ id: "PUR-1", materialId: "RAW-1", materialName: "Sole Sheet" }),
      invoice({ id: "PUR-2", materialId: "RAW-2", materialName: "Gum", total: 500, quantity: 5 }),
    ]);

    expect(rates).toHaveLength(2);
  });

  it("leaves trading goods out of material costs", () => {
    // A trading goods invoice is finished pairs bought to resell. It carries no
    // materialId and its materialName is a shoe design, so counting it here
    // would invent a raw material called "Doctor Chappal" and charge the
    // factory for money that never bought material.
    const rates = buildMaterialCostRates([
      invoice({ id: "PUR-1", materialId: "RAW-1", materialName: "Sole Sheet", total: 1000 }),
      invoice({
        id: "PUR-2",
        kind: "Trading Goods",
        materialId: "",
        materialName: "Doctor Chappal",
        design: "Doctor Chappal",
        channel: "Online",
        unit: "pair",
        quantity: 60,
        rate: 500,
        total: 30000,
      }),
    ]);

    expect(rates).toHaveLength(1);
    expect(rates[0].materialName).toBe("Sole Sheet");
    expect(rates.some((rate) => rate.materialName === "Doctor Chappal")).toBe(false);
    // The headline "material purchase cost" sums these rows.
    expect(rates[0].purchaseTotal).toBe(1000);
  });

  it("does not collide two trading goods purchases on their empty material id", () => {
    const rates = buildMaterialCostRates([
      invoice({ id: "PUR-1", kind: "Trading Goods", materialId: "", materialName: "Doctor Chappal" }),
      invoice({ id: "PUR-2", kind: "Trading Goods", materialId: "", materialName: "PU Chappal" }),
    ]);

    expect(rates).toHaveLength(0);
  });
});

describe("overhead per pair", () => {
  it("adds the per-pair rates together", () => {
    expect(
      overheadPerPair(
        settings({
          factoryOverheadPerPair: 10,
          electricityPerPair: 5,
          rentPerPair: 8,
          miscellaneousPerPair: 2,
        }),
      ),
    ).toBe(25);
  });

  it("spreads monthly fixed overhead across monthly capacity", () => {
    expect(
      overheadPerPair(settings({ monthlyFixedOverhead: 50000, monthlyCapacityPairs: 1000 })),
    ).toBe(50);
  });

  it("does not divide by a capacity of zero", () => {
    // An owner who has not entered capacity yet must not get Infinity per pair.
    const rate = overheadPerPair(settings({ monthlyFixedOverhead: 50000, monthlyCapacityPairs: 0 }));

    expect(rate).toBe(0);
    expect(Number.isFinite(rate)).toBe(true);
  });
});

describe("margin rate", () => {
  it("reports margin as a percentage of revenue", () => {
    expect(marginRate(250, 1000)).toBe(25);
  });

  it("reports a loss as a negative margin", () => {
    expect(marginRate(-100, 1000)).toBe(-10);
  });

  it("returns zero rather than dividing by no revenue", () => {
    expect(marginRate(0, 0)).toBe(0);
    expect(marginRate(100, 0)).toBe(0);
  });
});

describe("design costing", () => {
  it("costs a sale at the unit cost the batches worked out", () => {
    const rows = buildDesignCosting(
      [batch({ finishedPairs: 100, totalProductionCost: 30000 })],
      new Map([
        ["doctor chappal", { design: "Doctor Chappal", soldPairs: 10, returnedPairs: 0, netRevenue: 5000 }],
      ]),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].unitCostPerPair).toBe(300); // 30000 / 100
    expect(rows[0].estimatedCogs).toBe(3000); // 10 pairs at 300
    expect(rows[0].grossProfit).toBe(2000); // 5000 - 3000
    expect(rows[0].grossMarginRate).toBe(40);
  });

  it("charges returns back out of the pairs sold", () => {
    const rows = buildDesignCosting(
      [batch({ finishedPairs: 100, totalProductionCost: 30000 })],
      new Map([
        ["doctor chappal", { design: "Doctor Chappal", soldPairs: 10, returnedPairs: 4, netRevenue: 3000 }],
      ]),
    );

    expect(rows[0].netPairs).toBe(6);
    expect(rows[0].estimatedCogs).toBe(1800); // 6 pairs, not 10
  });

  it("does not charge cost for a net negative sale", () => {
    // More returned than sold in the period. Cost must not go negative and
    // quietly manufacture profit.
    const rows = buildDesignCosting(
      [batch({ finishedPairs: 100, totalProductionCost: 30000 })],
      new Map([
        ["doctor chappal", { design: "Doctor Chappal", soldPairs: 2, returnedPairs: 5, netRevenue: -900 }],
      ]),
    );

    expect(rows[0].netPairs).toBe(-3);
    expect(rows[0].estimatedCogs).toBe(0);
  });

  it("falls back to planned pairs when a batch has finished none", () => {
    const rows = buildDesignCosting(
      [batch({ plannedPairs: 100, finishedPairs: 0, totalProductionCost: 30000 })],
      new Map(),
    );

    expect(rows[0].unitCostPerPair).toBe(300);
  });

  it("matches a sale to its batches whatever the design was typed like", () => {
    const rows = buildDesignCosting(
      [batch({ design: "Doctor Chappal" })],
      new Map([
        ["doctor chappal", { design: "doctor  chappal", soldPairs: 5, returnedPairs: 0, netRevenue: 2500 }],
      ]),
    );

    // One design, not two — design is free text and gets typed inconsistently.
    expect(rows).toHaveLength(1);
    expect(rows[0].soldPairs).toBe(5);
  });

  it("flags a sale it has no cost for instead of reporting pure profit", () => {
    // This is what selling trading goods looks like today: pairs bought
    // finished have no production batch, so there is no unit cost to charge
    // against them and the margin reads 100%. The flag is the only thing
    // standing between that and the owner believing it.
    const rows = buildDesignCosting(
      [],
      new Map([
        ["doctor chappal", { design: "Doctor Chappal", soldPairs: 10, returnedPairs: 0, netRevenue: 6000 }],
      ]),
    );

    expect(rows[0].unitCostPerPair).toBe(0);
    expect(rows[0].grossProfit).toBe(6000);
    expect(rows[0].grossMarginRate).toBe(100);
    expect(rows[0].missingCostData).toBe(true);
  });

  it("carries a batch's missing cost data through to the design", () => {
    const rows = buildDesignCosting(
      [batch({ missingCostMaterials: ["Sole Sheet"] })],
      new Map(),
    );

    expect(rows[0].missingCostData).toBe(true);
  });

  it("adds up every batch of the same design", () => {
    const rows = buildDesignCosting(
      [
        batch({ batchId: "B-1", finishedPairs: 60, totalProductionCost: 18000 }),
        batch({ batchId: "B-2", finishedPairs: 40, totalProductionCost: 14000 }),
      ],
      new Map(),
    );

    expect(rows[0].batchCount).toBe(2);
    expect(rows[0].finishedPairs).toBe(100);
    expect(rows[0].productionCost).toBe(32000);
    expect(rows[0].unitCostPerPair).toBe(320);
  });
});
