import { describe, expect, it } from "vitest";
import {
  buildDesignCosting,
  buildMaterialCostRates,
  buildTradingGoodsCostRates,
  marginRate,
  overheadPerPair,
  type BatchCostingRow,
} from "@/lib/costing";
import type { CostingSettings } from "@/lib/costing-settings";
import type { PurchaseInvoice } from "@/lib/purchasing";

// A bill of one line, described by the line. Costing reads invoice.items, so
// the summary columns are filled from the line rather than set apart from it —
// a fixture that disagrees with itself would test nothing real.
function invoice(overrides: Partial<PurchaseInvoice> = {}): PurchaseInvoice {
  const base: PurchaseInvoice = {
    id: "PUR-1",
    purchaseNumber: "PUR-0001",
    createdAt: "2026-07-01T00:00:00.000Z",
    supplierLedgerId: "SUP-1",
    supplierName: "Kathmandu Leather",
    kind: "Raw Material",
    items: [],
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

  if (base.items.length > 0) {
    return base;
  }

  return {
    ...base,
    items: [
      {
        id: `${base.id}-L1`,
        lineNo: 1,
        kind: base.kind === "Trading Goods" ? "Trading Goods" : "Raw Material",
        materialId: base.materialId,
        itemName: base.materialName,
        design: base.design,
        channel: base.channel,
        sizeRun: base.sizeRun,
        unit: base.unit,
        quantity: base.quantity,
        rate: base.rate,
        lineSubtotal: base.quantity * base.rate,
        // One line carries the whole bill, discount and tax included.
        lineTotal: base.total,
      note: "",
      },
    ],
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
    // Sold, but never made and never bought — so nothing says what the pairs
    // cost. Reporting the full revenue as profit is the honest arithmetic; the
    // flag is what stops it being read as a real margin.
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
    expect(rows[0].costSource).toBe("Unknown");
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

// KRISHOE runs two businesses through one shop: it makes chappals from raw
// material, and it buys finished slippers to resell. Purchase, sales and stock
// are shared; only the way cost is worked out differs. These cover the trading
// half and the seam where the two meet.
describe("trading goods cost rates", () => {
  const bought = (overrides: Partial<PurchaseInvoice> = {}) =>
    invoice({
      kind: "Trading Goods",
      materialId: "",
      materialName: "Doctor Chappal",
      design: "Doctor Chappal",
      channel: "Online",
      unit: "pair",
      quantity: 60,
      rate: 500,
      total: 30000,
      ...overrides,
    });

  it("works out what a pair cost to buy in", () => {
    const rates = buildTradingGoodsCostRates([bought()]);

    expect(rates).toHaveLength(1);
    expect(rates[0].design).toBe("Doctor Chappal");
    expect(rates[0].purchasedPairs).toBe(60);
    expect(rates[0].averageCostPerPair).toBe(500);
  });

  it("averages across purchases by pairs, not by invoice", () => {
    const rates = buildTradingGoodsCostRates([
      bought({ id: "PUR-1", quantity: 90, rate: 500, total: 45000 }),
      bought({ id: "PUR-2", quantity: 10, rate: 900, total: 9000 }),
    ]);

    expect(rates[0].purchasedPairs).toBe(100);
    expect(rates[0].averageCostPerPair).toBe(540); // 54000 / 100, not (500+900)/2
  });

  it("counts discount and tax as part of what the pairs cost", () => {
    // rate * quantity is 30000, but 1000 came off and 500 tax went on. What
    // left the bank is what the pairs cost.
    const rates = buildTradingGoodsCostRates([
      bought({ quantity: 60, rate: 500, discount: 1000, tax: 500, total: 29500 }),
    ]);

    expect(rates[0].averageCostPerPair).toBe(491.67); // 29500 / 60
  });

  it("keeps designs apart", () => {
    const rates = buildTradingGoodsCostRates([
      bought({ id: "PUR-1", design: "Doctor Chappal", materialName: "Doctor Chappal" }),
      bought({ id: "PUR-2", design: "PU Chappal", materialName: "PU Chappal", total: 10000, quantity: 20 }),
    ]);

    expect(rates).toHaveLength(2);
    expect(rates.map((rate) => rate.design).sort()).toEqual(["Doctor Chappal", "PU Chappal"]);
  });

  it("groups the same design however it was typed", () => {
    const rates = buildTradingGoodsCostRates([
      bought({ id: "PUR-1", design: "Doctor Chappal" }),
      bought({ id: "PUR-2", design: "doctor  chappal" }),
    ]);

    expect(rates).toHaveLength(1);
    expect(rates[0].purchasedPairs).toBe(120);
  });

  it("ignores raw material purchases", () => {
    // The factory's leather is not a slipper anyone can sell.
    const rates = buildTradingGoodsCostRates([invoice({ kind: "Raw Material" })]);

    expect(rates).toHaveLength(0);
  });
});

describe("costing the trading half of the business", () => {
  const doctorChappalBought = {
    design: "Doctor Chappal",
    purchasedPairs: 60,
    purchaseTotal: 30000,
    averageCostPerPair: 500,
    invoiceCount: 1,
  };

  it("charges a bought pair at what it cost to buy", () => {
    // Buy 60 at 500, sell 10 at 800. Profit is 3000, not the full 8000 the app
    // used to report because it only knew how to cost a production batch.
    const rows = buildDesignCosting(
      [],
      new Map([
        ["doctor chappal", { design: "Doctor Chappal", soldPairs: 10, returnedPairs: 0, netRevenue: 8000 }],
      ]),
      [doctorChappalBought],
    );

    expect(rows[0].unitCostPerPair).toBe(500);
    expect(rows[0].estimatedCogs).toBe(5000);
    expect(rows[0].grossProfit).toBe(3000);
    expect(rows[0].grossMarginRate).toBe(37.5);
  });

  it("no longer calls a bought design's cost missing", () => {
    const rows = buildDesignCosting(
      [],
      new Map([
        ["doctor chappal", { design: "Doctor Chappal", soldPairs: 10, returnedPairs: 0, netRevenue: 8000 }],
      ]),
      [doctorChappalBought],
    );

    expect(rows[0].missingCostData).toBe(false);
    expect(rows[0].costSource).toBe("Bought");
  });

  it("keeps the bought cost out of the production figures", () => {
    // The factory did not spend this. Material, labour and overhead must stay
    // at zero or the production side of the ledger is a fiction.
    const rows = buildDesignCosting([], new Map(), [doctorChappalBought]);

    expect(rows[0].purchaseCost).toBe(30000);
    expect(rows[0].productionCost).toBe(0);
    expect(rows[0].materialCost).toBe(0);
    expect(rows[0].laborCost).toBe(0);
    expect(rows[0].overheadCost).toBe(0);
    expect(rows[0].batchCount).toBe(0);
  });

  it("shows a design that is bought and made as both", () => {
    // 100 made at 300 and 60 bought at 500 is 48000 over 160 pairs.
    const rows = buildDesignCosting(
      [batch({ finishedPairs: 100, totalProductionCost: 30000 })],
      new Map(),
      [doctorChappalBought],
    );

    expect(rows[0].costSource).toBe("Made and bought");
    expect(rows[0].finishedPairs).toBe(100);
    expect(rows[0].purchasedPairs).toBe(60);
    expect(rows[0].unitCostPerPair).toBe(375); // 48000 / 160
  });

  it("labels a design that is only made", () => {
    const rows = buildDesignCosting([batch()], new Map(), []);

    expect(rows[0].costSource).toBe("Made");
    expect(rows[0].purchasedPairs).toBe(0);
    expect(rows[0].purchaseCost).toBe(0);
  });

  it("matches a purchase to its sales however the design was typed", () => {
    const rows = buildDesignCosting(
      [],
      new Map([
        ["doctor chappal", { design: "Doctor Chappal", soldPairs: 10, returnedPairs: 0, netRevenue: 8000 }],
      ]),
      [{ ...doctorChappalBought, design: "doctor  chappal" }],
    );

    // One design. Two rows here would mean a purchase with no sales beside a
    // sale with no cost — and a 100% margin on the second.
    expect(rows).toHaveLength(1);
    expect(rows[0].unitCostPerPair).toBe(500);
    expect(rows[0].soldPairs).toBe(10);
  });

  it("costs returns of bought pairs at the same rate", () => {
    const rows = buildDesignCosting(
      [],
      new Map([
        ["doctor chappal", { design: "Doctor Chappal", soldPairs: 10, returnedPairs: 4, netRevenue: 4800 }],
      ]),
      [doctorChappalBought],
    );

    expect(rows[0].netPairs).toBe(6);
    expect(rows[0].estimatedCogs).toBe(3000); // 6 at 500
    expect(rows[0].grossProfit).toBe(1800);
  });

  it("does not charge unsold bought pairs to the profit", () => {
    // 60 pairs bought, none sold. The 30000 sits in stock; it is not a loss.
    const rows = buildDesignCosting([], new Map(), [doctorChappalBought]);

    expect(rows[0].estimatedCogs).toBe(0);
    expect(rows[0].grossProfit).toBe(0);
  });
});
