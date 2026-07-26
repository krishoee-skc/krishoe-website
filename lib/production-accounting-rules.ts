export const productionStages = [
  "Upper",
  "Fiber Preparation",
  "Fiber Silai",
  "Bottom Final",
] as const;

export type ProductionStage = (typeof productionStages)[number];

export const workerPaymentTypes = [
  "Saturday Kharcha",
  "Midweek Advance",
  "Final Settlement",
  "Bonus",
  "Deduction",
  "Correction",
] as const;

export type WorkerPaymentType = (typeof workerPaymentTypes)[number];
export type WorkerPaymentDirection = "Paid" | "Added" | "Recovered";
export type SizeBreakdown = Record<string, number>;

export type WageInput = {
  totalPairs: number;
  rejectedPairs?: number;
  reworkPairs?: number;
  ratePerPair: number;
  status?: "Submitted" | "Approved" | "Reversed";
};

export type WorkerLedgerLine = {
  amount: number;
  kind: "Earned Wage" | WorkerPaymentType;
  direction?: WorkerPaymentDirection;
  reversed?: boolean;
};

export type FinishedStockPostingInput = {
  productionType: "Manufactured" | "Resale" | "Mixed";
  catalogProductId: string;
  packingQcApproved: boolean;
  totalPairs: number;
  sizeBreakdown: SizeBreakdown;
};

function money(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function whole(value: number) {
  return Math.max(0, Math.round(Number(value) || 0));
}

export function normalizeSizeBreakdown(value: SizeBreakdown) {
  return Object.fromEntries(
    Object.entries(value)
      .map(([size, pairs]) => [size.trim(), whole(pairs)] as const)
      .filter(([size, pairs]) => size.length > 0 && pairs > 0),
  );
}

export function sizeBreakdownTotal(value: SizeBreakdown) {
  return Object.values(normalizeSizeBreakdown(value)).reduce((total, pairs) => total + pairs, 0);
}

export function assertWorkQuantity(input: WageInput, sizes: SizeBreakdown = {}) {
  const totalPairs = whole(input.totalPairs);
  const rejectedPairs = whole(input.rejectedPairs ?? 0);
  const reworkPairs = whole(input.reworkPairs ?? 0);
  const sizedPairs = sizeBreakdownTotal(sizes);

  if (totalPairs <= 0) {
    throw new Error("Completed pairs must be greater than zero.");
  }
  if (rejectedPairs + reworkPairs > totalPairs) {
    throw new Error("Reject and rework pairs cannot exceed total pairs.");
  }
  if (sizedPairs > 0 && sizedPairs !== totalPairs) {
    throw new Error("Size-wise pairs must match total pairs.");
  }
}

export function calculateEarnedWage(input: WageInput) {
  assertWorkQuantity(input);
  if (input.status === "Reversed") return 0;

  // Corrected rework is entered only when the worker hands it over again.
  // Rejects never earn piece wage.
  const payablePairs = whole(input.totalPairs) - whole(input.rejectedPairs ?? 0);
  return money(payablePairs * Math.max(0, Number(input.ratePerPair) || 0));
}

export function workerLedgerBalance(lines: WorkerLedgerLine[]) {
  return money(
    lines.reduce((balance, line) => {
      if (line.reversed) return balance;
      const amount = Math.max(0, Number(line.amount) || 0);
      if (line.kind === "Earned Wage" || line.direction === "Added") return balance + amount;
      if (line.direction === "Paid" || line.direction === "Recovered") return balance - amount;
      return balance;
    }, 0),
  );
}

function dateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Date must use YYYY-MM-DD.");
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDay(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function saturdayToFridayPeriod(value: string) {
  const date = dateOnly(value);
  const daysSinceSaturday = (date.getUTCDay() + 1) % 7;
  const start = new Date(date);
  start.setUTCDate(start.getUTCDate() - daysSinceSaturday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: isoDay(start), end: isoDay(end) };
}

export function assertFinishedStockPosting(input: FinishedStockPostingInput) {
  if (input.productionType === "Resale") {
    throw new Error("Resale items enter stock from Purchasing, not factory production.");
  }
  if (!input.catalogProductId.trim()) {
    throw new Error("Link the production item to a catalog product first.");
  }
  if (!input.packingQcApproved) {
    throw new Error("Packing/QC approval is required before finished stock posting.");
  }
  if (whole(input.totalPairs) <= 0) {
    throw new Error("Finished pairs must be greater than zero.");
  }

  const sizedPairs = sizeBreakdownTotal(input.sizeBreakdown);
  if (sizedPairs > 0 && sizedPairs !== whole(input.totalPairs)) {
    throw new Error("Finished size-wise pairs must match total pairs.");
  }
}

export function nextProductionStage(stage: ProductionStage) {
  const index = productionStages.indexOf(stage);
  return index >= 0 && index < productionStages.length - 1
    ? productionStages[index + 1]
    : "Packing / QC";
}

export function handoverSignal(sentPairs: number, receivedPairs: number) {
  const sent = whole(sentPairs);
  const received = whole(receivedPairs);
  if (sent <= 0) throw new Error("Sent pairs must be greater than zero.");
  if (received === sent) return { signal: "Matched" as const, difference: 0 };
  if (received < sent) return { signal: "Short" as const, difference: sent - received };
  return { signal: "Excess" as const, difference: received - sent };
}
