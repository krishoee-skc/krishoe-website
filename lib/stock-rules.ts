// How a movement changes a finished stock row. Nothing here reads a file or a
// database, so both backends can share it.
//
// These rules used to exist twice, once in lib/operations.ts for local-json and
// again in lib/operations-postgres.ts for Postgres. The copies were identical,
// which is exactly the problem: the tests only reached the local-json copy, and
// production only runs the Postgres one. A fix to one would have looked tested
// and shipped untested. Neither module can import the other — they already form
// a cycle — so the rules live here, on their own, and both sides call in.

// Both channel and movement type are defined here, not in lib/operations.ts, so
// the dependency only ever points this way: operations imports rules. The other
// direction would put this module back inside the cycle it exists to avoid.
export type BusinessChannel = "Factory" | "Wholesale" | "Retail" | "Online";

export type StockMovementType =
  | "Production In"
  | "Purchase In"
  | "Dispatch Out"
  | "Return In"
  | "Sale Out"
  | "Market Sale"
  | "Adjustment";

// Only what the rules need. The stored rows carry more (id, size run), and the
// callers keep those.
export type StockCounts = {
  design: string;
  channel: BusinessChannel;
  stockPairs: number;
  soldPairs: number;
  returnedPairs: number;
};

export type StockMovementEffect = {
  type: StockMovementType;
  pairs: number;
};

/** Movements that take pairs off the shelf, so they have to be checked first. */
export function isStockOutMovement(type: StockMovementType) {
  return type === "Dispatch Out" || type === "Sale Out";
}

function isStockInMovement(type: StockMovementType) {
  return type === "Production In" || type === "Purchase In" || type === "Adjustment";
}

export function assertStockAvailable(
  stock: StockCounts,
  movement: StockMovementEffect,
  action: string = movement.type,
) {
  if (movement.pairs > stock.stockPairs) {
    throw new Error(
      `${stock.design} ${stock.channel} has only ${stock.stockPairs} pairs. Cannot ${action} ${movement.pairs} pairs.`,
    );
  }
}

/** Apply a movement in place. */
export function applyStockMovementToStock(stock: StockCounts, movement: StockMovementEffect) {
  if (movement.pairs <= 0) {
    throw new Error("Stock movement pairs must be greater than zero.");
  }

  if (isStockOutMovement(movement.type)) {
    assertStockAvailable(stock, movement);
  }

  if (isStockInMovement(movement.type)) {
    stock.stockPairs += movement.pairs;
  }

  if (movement.type === "Dispatch Out") {
    stock.stockPairs -= movement.pairs;
  }

  if (movement.type === "Sale Out") {
    stock.stockPairs -= movement.pairs;
    stock.soldPairs += movement.pairs;
  }

  // Market Sale is stock already dispatched, so the pairs left the shelf when
  // the vehicle loaded them. Only the sold count moves here.
  if (movement.type === "Market Sale") {
    stock.soldPairs += movement.pairs;
  }

  if (movement.type === "Return In") {
    stock.stockPairs += movement.pairs;
    stock.returnedPairs += movement.pairs;
  }
}

/** Undo a movement in place, for deleting one that was already applied. */
export function reverseStockMovementFromStock(stock: StockCounts, movement: StockMovementEffect) {
  if (
    (isStockInMovement(movement.type) || movement.type === "Return In") &&
    movement.pairs > stock.stockPairs
  ) {
    throw new Error(
      `${stock.design} ${stock.channel} stock depends on this movement. Add stock back before deleting it.`,
    );
  }

  if (isStockInMovement(movement.type)) {
    stock.stockPairs -= movement.pairs;
  }

  if (movement.type === "Dispatch Out") {
    stock.stockPairs += movement.pairs;
  }

  if (movement.type === "Sale Out") {
    stock.stockPairs += movement.pairs;
    stock.soldPairs = Math.max(0, stock.soldPairs - movement.pairs);
  }

  if (movement.type === "Market Sale") {
    stock.soldPairs = Math.max(0, stock.soldPairs - movement.pairs);
  }

  if (movement.type === "Return In") {
    stock.stockPairs -= movement.pairs;
    stock.returnedPairs = Math.max(0, stock.returnedPairs - movement.pairs);
  }
}

/** Apply a movement to a copy, for callers that must not mutate their input. */
export function withStockMovementApplied<T extends StockCounts>(stock: T, movement: StockMovementEffect) {
  const next = { ...stock };
  applyStockMovementToStock(next, movement);
  return next;
}

/** Undo a movement on a copy. */
export function withStockMovementReversed<T extends StockCounts>(stock: T, movement: StockMovementEffect) {
  const next = { ...stock };
  reverseStockMovementFromStock(next, movement);
  return next;
}
