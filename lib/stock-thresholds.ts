// The "running low" line for finished designs, in pairs. It was written as the
// bare number 5 in five different files; pulling it here means the shop can
// change what "low" means in one place, and the dashboard, stock page, product
// cards, and alerts all agree.
export const LOW_STOCK_THRESHOLD = 5;

export type StockLevel = "out" | "low" | "ok";

// One rule for how a pair count reads, so "Out" / "Low" / fine is decided the
// same way everywhere.
export function stockLevel(stock: number): StockLevel {
  if (stock <= 0) {
    return "out";
  }

  if (stock <= LOW_STOCK_THRESHOLD) {
    return "low";
  }

  return "ok";
}

export function isLowOrOut(stock: number): boolean {
  return stockLevel(stock) !== "ok";
}
