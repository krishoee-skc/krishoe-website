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

// The two places a pair of shoes can physically sit. Here rather than in
// lib/stock-transfers.ts because the purchase form is a client component and
// needs the names: importing them from stock-transfers would pull the Postgres
// client — and with it next/server — into the browser bundle.
export type StockPlace = "Factory" | "Shop";

export const stockPlaces: StockPlace[] = ["Factory", "Shop"];

export type StockMovementType =
  | "Production In"
  | "Purchase In"
  | "Dispatch Out"
  | "Return In"
  | "Sale Out"
  | "Market Sale"
  | "Adjustment"
  // Pairs written off the shelf — damaged, lost, or a quality reject after
  // packing. Takes stock off exactly like a dispatch, but for a reason that is
  // not a sale, so it never touches soldPairs.
  | "Damage Out";

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
  return type === "Dispatch Out" || type === "Sale Out" || type === "Damage Out";
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

/**
 * Where pairs leave from, and where returned pairs go back to.
 *
 * The counter and the website sell what is on the shop's shelf; wholesale and
 * the factory's own movements take pairs from the godown. Only the first place
 * is a preference — when it runs short, the rest comes from the other.
 */
export function placeOrderFor(channel: BusinessChannel): StockPlace[] {
  return channel === "Retail" || channel === "Online" ? ["Shop", "Factory"] : ["Factory", "Shop"];
}

/**
 * Split pairs leaving the shelf across the two places.
 *
 * Takes from the channel's own place first, then the other, and never below
 * zero: pairs that were never placed (bought before places existed, or still
 * on a challan) simply stay unaccounted for, which the Stock screen already
 * shows. Only places that give something up are returned.
 */
export function drawFromPlaces(
  channel: BusinessChannel,
  pairs: number,
  held: Partial<Record<StockPlace, number>>,
): { place: StockPlace; pairs: number }[] {
  let left = Math.max(0, Math.round(pairs));
  const draws: { place: StockPlace; pairs: number }[] = [];

  for (const place of placeOrderFor(channel)) {
    const take = Math.min(left, Math.max(0, Math.round(held[place] ?? 0)));
    if (take > 0) {
      draws.push({ place, pairs: take });
      left -= take;
    }
  }

  return draws;
}

/**
 * What a movement does to the places, as signed pair counts.
 *
 * finished_stock answers "how many"; stock_locations answers "where". A sale
 * used to change only the first, so the Stock screen showed more pairs in the
 * factory and the shop than were in stock at all — 222 placed against 182
 * held, the difference being exactly the pairs sold.
 *
 * Production In and Purchase In are left out on purpose: their callers already
 * place the pairs (the factory, or the place chosen on the purchase bill), and
 * an Adjustment is a count correction with no place of its own.
 */
export function placeChangesFor(
  movement: StockMovementEffect & { channel: BusinessChannel },
  held: Partial<Record<StockPlace, number>>,
  direction: "apply" | "reverse" = "apply",
): { place: StockPlace; pairs: number }[] {
  const leaves = isStockOutMovement(movement.type);
  const comesBack = movement.type === "Return In";
  if (!leaves && !comesBack) return [];

  const home = placeOrderFor(movement.channel)[0];
  const takesPairs = direction === "apply" ? leaves : comesBack;

  if (takesPairs) {
    return drawFromPlaces(movement.channel, movement.pairs, held).map((draw) => ({
      place: draw.place,
      pairs: -draw.pairs,
    }));
  }

  return movement.pairs > 0 ? [{ place: home, pairs: Math.round(movement.pairs) }] : [];
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

  // Written off, not sold — pairs leave the shelf without adding to soldPairs.
  if (movement.type === "Damage Out") {
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

  // Undoing a write-off puts the pairs back on the shelf.
  if (movement.type === "Damage Out") {
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
