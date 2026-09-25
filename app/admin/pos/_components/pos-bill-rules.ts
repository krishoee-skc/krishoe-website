/**
 * What a counter bill is made of, apart from how it is drawn.
 *
 * Nothing here draws anything or touches React: the shape of a sellable
 * design, the lines on a bill, which sizes can still be sold, what the bill
 * comes to and what change goes back. The counter screen calls these, and the
 * tests call the same functions, so the sum on the screen and the sum in the
 * test cannot drift apart.
 *
 * The bill used to be a table of empty rows — code, design, size, pairs, rate,
 * discount — keyed box by box. It is now a list of lines the counter taps in:
 * a shoe, then a size. The rate fills itself from the channel and can be
 * bargained down on the line; the size is one of the design's own.
 */

export type LedgerOption = {
  id: string;
  label: string;
  /** Digits only, so a typed number finds the account however it was spaced. */
  phone?: string;
  customerName?: string;
  balanceDue?: number;
};

// A design the shop can sell: how many pairs are on hand, and the price for each
// channel. The counter picks from these so the rate fills itself and the stock
// is in view — no typing a name and a price from memory.
export type SellableItem = {
  design: string;
  sku: string;
  stock: number;
  retailRate: number;
  wholesaleRate: number;
  /** The design's size run as the catalog writes it — "36, 37, 38". */
  sizes: string;
  /** The same run as a list, for the size buttons. */
  sizeList?: string[];
  /**
   * Pairs on the shelf under one exact size ("41" → 5), read from the stock
   * rows that were entered size-wise. A size missing here is not "none left":
   * its pairs may be in the uncounted pile below.
   */
  sizeStock?: Record<string, number>;
  /** Pairs in a "Mixed" or range pile, whose sizes nobody has counted. */
  untrackedPairs?: number;
  image?: string;
  category?: string;
  nameNe?: string;
  colors?: string[];
  /** What one pair cost the shop; 0 when costing has no figure for it. */
  costPerPair?: number;
};

// The shop's most recent sale, ready to drop back into the bill so a repeat
// order does not have to be tapped in again.
export type RepeatBillItem = {
  sku: string;
  design: string;
  size: string;
  color: string;
  quantity: number;
  rate: number;
};

export type RepeatBill = {
  channel: string;
  invoiceNumber: string;
  items: RepeatBillItem[];
};

/** One line on the bill: a design in one size and colour, at one rate. */
export type CartLine = {
  key: string;
  design: string;
  sku: string;
  /** The customer's size — "41" — or "" when the design has no sizes. */
  size: string;
  color: string;
  quantity: number;
  /** What this line is charged per pair, after any bargaining. */
  rate: number;
  /** The channel's own price, so a bargained rate can show what it was. */
  listRate: number;
  /** In an exchange: this pair came back, rather than left. */
  back?: boolean;
};

// Wholesale gets its own price; retail and online sell at the shelf price.
export function rateForChannel(channel: string, item: SellableItem) {
  return channel === "Wholesale" ? item.wholesaleRate : item.retailRate;
}

/** A real, single shoe size like "41" or "9" — not "Mixed" or "36-41". */
export function isShoeSize(value: string) {
  return /^\d{1,2}$/.test(value.trim());
}

function bySize(a: string, b: string) {
  return Number(a) - Number(b) || a.localeCompare(b);
}

export function lineKey(design: string, size: string, color: string, back = false) {
  const key = [design.trim().toLowerCase(), size.trim(), color.trim().toLowerCase()].join("|");
  return back ? `${key}|back` : key;
}

function sameDesign(line: CartLine, design: string) {
  return line.design.trim().toLowerCase() === design.trim().toLowerCase();
}

/** Pairs of this design already on the bill — of one size, or of every size. */
export function pairsOnBill(cart: CartLine[], design: string, size?: string) {
  // A pair coming back in an exchange takes nothing off the shelf.
  return cart
    .filter((line) => !line.back && sameDesign(line, design) && (size === undefined || line.size === size))
    .reduce((total, line) => total + line.quantity, 0);
}

export type SizeChoice = {
  size: string;
  /**
   * Pairs of exactly this size still on the shelf once this bill is out, or
   * null when this size is not counted on its own and sells from the uncounted
   * pile.
   */
  left: number | null;
  sellable: boolean;
};

/**
 * Pairs of the uncounted pile still free once this bill is out.
 *
 * A line draws from its own size's row first. Whatever a size's row cannot
 * cover comes out of the pile — the same order the save follows.
 */
export function untrackedLeft(item: SellableItem, cart: CartLine[]) {
  const counted = item.sizeStock ?? {};
  const sizes = new Set(cart.filter((line) => !line.back && sameDesign(line, item.design)).map((line) => line.size));
  let fromPile = 0;
  for (const size of sizes) {
    fromPile += Math.max(0, pairsOnBill(cart, item.design, size) - (counted[size] ?? 0));
  }
  return (item.untrackedPairs ?? 0) - fromPile;
}

/**
 * The size buttons for one design, each saying whether it can still be sold.
 *
 * A size with its own counted pairs sells until those run out, then from the
 * uncounted pile if there is one. A size nobody counted sells from the pile
 * alone. A size with neither is shown, and cannot be tapped.
 */
export function sizeChoices(item: SellableItem, cart: CartLine[]): SizeChoice[] {
  const counted = item.sizeStock ?? {};
  const sizes = [...new Set([...(item.sizeList ?? []), ...Object.keys(counted)])]
    .map((size) => size.trim())
    .filter(isShoeSize)
    .sort(bySize);
  const pileLeft = untrackedLeft(item, cart);

  return sizes.map((size) => {
    const own = counted[size];
    const ownLeft = own === undefined ? null : own - pairsOnBill(cart, item.design, size);
    const hasOwn = ownLeft !== null && ownLeft > 0;
    return {
      size,
      // Its own count while that lasts; then the pile, whose sizes are unknown;
      // then nothing.
      left: hasOwn ? ownLeft : pileLeft > 0 ? null : 0,
      sellable: hasOwn || pileLeft > 0,
    };
  });
}

/**
 * Pairs of a design still free once this bill is out, across every size.
 *
 * For a design with no sizes at all — a bag, a polish — this is what the
 * catalog says is in stock.
 */
export function pairsLeft(item: SellableItem, cart: CartLine[]) {
  return Math.max(0, item.stock - pairsOnBill(cart, item.design));
}

/** Whether the design has any size button to press. */
export function hasSizes(item: SellableItem) {
  return (item.sizeList ?? []).some(isShoeSize) || Object.keys(item.sizeStock ?? {}).some(isShoeSize);
}

/** Whether one more pair of this design and size may go on the bill. */
export function canAddPair(item: SellableItem, size: string, cart: CartLine[]) {
  if (!hasSizes(item) || !isShoeSize(size)) {
    return pairsLeft(item, cart) > 0;
  }
  return sizeChoices(item, cart).some((choice) => choice.size === size && choice.sellable);
}

/**
 * The bill with one more pair on it.
 *
 * Tapping the same shoe in the same size and colour again adds a pair to that
 * line rather than a second line, so the bill reads the way the customer's
 * bag does.
 */
export function addPair(
  cart: CartLine[],
  item: SellableItem,
  channel: string,
  size: string,
  color = "",
  back = false,
): CartLine[] {
  const key = lineKey(item.design, size, color, back);
  const existing = cart.find((line) => line.key === key);
  if (existing) {
    return cart.map((line) => (line.key === key ? { ...line, quantity: line.quantity + 1 } : line));
  }
  const rate = rateForChannel(channel, item);
  return [
    ...cart,
    { key, design: item.design, sku: item.sku, size, color, quantity: 1, rate, listRate: rate, ...(back ? { back } : {}) },
  ];
}

/**
 * The line's pairs set to a new number. Zero takes the line off the bill; the
 * screen offers to bring it back.
 */
export function setPairs(cart: CartLine[], key: string, quantity: number): CartLine[] {
  const pairs = Math.max(0, Math.round(quantity));
  return pairs === 0
    ? cart.filter((line) => line.key !== key)
    : cart.map((line) => (line.key === key ? { ...line, quantity: pairs } : line));
}

/** The line charged at a bargained rate. A rate of nothing is not a sale. */
export function setRate(cart: CartLine[], key: string, rate: number): CartLine[] {
  const value = Math.round(rate);
  if (!(value > 0)) return cart;
  return cart.map((line) => (line.key === key ? { ...line, rate: value } : line));
}

/**
 * Every line re-priced for a channel, as a wholesale bill must not keep retail
 * rates. A rate bargained by hand goes too — it was agreed at the other price.
 */
export function repriceForChannel(cart: CartLine[], catalog: SellableItem[], channel: string) {
  return cart.map((line) => {
    const item = catalog.find((entry) => entry.design.trim().toLowerCase() === line.design.trim().toLowerCase());
    if (!item) return line;
    const rate = rateForChannel(channel, item);
    return { ...line, rate, listRate: rate };
  });
}

export type BillTotals = {
  pairs: number;
  /** Lines at their charged rates. */
  subtotal: number;
  /** How much bargaining took off the channel's prices. */
  bargained: number;
  discount: number;
  tax: number;
  total: number;
};

/** What the bill comes to: the lines, less a whole-bill discount, plus tax. */
export function billTotals(cart: CartLine[], billDiscount: number, tax: number): BillTotals {
  // The pairs that leave. Pairs coming back in an exchange are counted apart,
  // by returnedValue, and set against this total.
  const out = cart.filter((line) => !line.back);
  const subtotal = out.reduce((sum, line) => sum + line.quantity * line.rate, 0);
  const listTotal = out.reduce((sum, line) => sum + line.quantity * line.listRate, 0);
  const discount = Math.min(Math.max(0, Math.round(billDiscount) || 0), subtotal);
  const vat = Math.max(0, Math.round(tax) || 0);
  return {
    pairs: out.reduce((sum, line) => sum + line.quantity, 0),
    subtotal,
    bargained: Math.max(0, listTotal - subtotal),
    discount,
    tax: vat,
    total: Math.max(0, subtotal - discount + vat),
  };
}

/** A whole-bill discount given as a share of the lines, in whole rupees. */
export function percentOff(subtotal: number, percent: number) {
  return Math.round((subtotal * percent) / 100);
}

export type CashOutcome = {
  /** What the bill records as paid: never more than the bill. */
  paid: number;
  /** Notes handed back to the customer. */
  change: number;
  /** What the cash did not cover. */
  short: number;
};

/**
 * What a cash payment settles.
 *
 * Nothing typed means the customer handed over the exact amount — the common
 * case, which should cost no keystrokes. More than the bill is change to hand
 * back, and the bill still records only its own total as paid.
 */
export function cashOutcome(total: number, received: number | null): CashOutcome {
  if (received === null) return { paid: total, change: 0, short: 0 };
  const cash = Math.max(0, Math.round(received) || 0);
  return {
    paid: Math.min(cash, total),
    change: Math.max(0, cash - total),
    short: Math.max(0, total - cash),
  };
}

/**
 * The notes a customer is likely to hand over for this bill: the next round
 * hundred, five hundred and thousand above it, and a 5000 note for a smaller
 * bill. Three at most, smallest first.
 */
export function likelyNotes(total: number): number[] {
  if (total <= 0) return [];
  const notes = new Set<number>();
  for (const step of [100, 500, 1000]) {
    const note = Math.ceil(total / step) * step;
    if (note > total) notes.add(note);
  }
  if (total < 5000) notes.add(5000);
  return [...notes].sort((a, b) => a - b).slice(0, 3);
}

/**
 * Whether a line is being sold for less than it cost the shop.
 *
 * Only a warning — the owner's rule is that some stock has to go below cost,
 * so the bill is never stopped for it. A design costing has no figure for is
 * never flagged, rather than flagged against a cost of nothing.
 */
export function belowCost(rate: number, costPerPair: number | undefined) {
  return Boolean(costPerPair && costPerPair > 0 && rate < costPerPair);
}

/**
 * Whether a design answers what was typed in the search box.
 *
 * Two numbers alone are a size — the customer says "41" — and bring up every
 * design that can still sell a 41. Anything else is looked for in the name,
 * the Nepali name, the code and the category.
 */
export function matchesSearch(item: SellableItem, query: string, cart: CartLine[]) {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return true;
  if (isShoeSize(wanted)) {
    return sizeChoices(item, cart).some((choice) => choice.size === wanted && choice.sellable);
  }
  return [item.design, item.nameNe ?? "", item.sku, item.category ?? ""].some((value) =>
    value.toLowerCase().includes(wanted),
  );
}

/**
 * A scanned or typed code, matched to a design and, when it carries one, a size.
 *
 * A code reads "KS-0001" for the design or "KS-0001-41" for one size of it.
 * The whole code is tried first, so a SKU that itself ends in two digits is
 * never cut in half.
 */
export function findByCode(catalog: SellableItem[], rawCode: string) {
  const code = rawCode.trim().toLowerCase();
  if (!code) return null;
  const exact = catalog.find(
    (entry) => (entry.sku && entry.sku.trim().toLowerCase() === code) || entry.design.trim().toLowerCase() === code,
  );
  if (exact) return { item: exact, size: "" };

  const sized = code.match(/^(.*?)[-\s/]+(\d{1,2})$/);
  if (!sized) return null;
  const item = catalog.find((entry) => entry.sku && entry.sku.trim().toLowerCase() === sized[1]);
  return item ? { item, size: sized[2] } : null;
}

/** The sizes a wholesale set is made of: one pair of each size still sellable. */
export function wholesaleSet(item: SellableItem, cart: CartLine[]) {
  return sizeChoices(item, cart)
    .filter((choice) => choice.sellable)
    .map((choice) => choice.size);
}

/** What the pairs coming back in an exchange are worth, at the rate on their line. */
export function returnedValue(cart: CartLine[]) {
  return cart.filter((line) => line.back).reduce((sum, line) => sum + line.quantity * line.rate, 0);
}

export type CounterPayment = "Cash" | "QR" | "eSewa" | "Khalti" | "Credit" | "Bank" | "Cheque";
export type MoneyPart = { method: Exclude<CounterPayment, "Credit">; amount: number; reference?: string };

export type PaymentPlan = {
  /** Toward the bill. */
  paid: number;
  /** Left on the customer's account. */
  credit: number;
  /** Cash handed back. */
  change: number;
  /** What nothing has settled yet — the bill cannot be saved while above zero. */
  short: number;
  /** Every money part toward the bill, a plain one-method payment included. */
  parts: MoneyPart[];
  /**
   * Whether the chosen button alone does not say how it was paid — cash and a
   * second method, or the whole bill by the "rest" method — so the parts must
   * be sent, and the payments column is needed.
   */
  split: boolean;
};

/**
 * How the money for a bill is settled, before it is saved.
 *
 *   total        what is owed for the pairs leaving (for an exchange, what is
 *                left after the returned pairs)
 *   method       the payment button pressed
 *   received     the cash typed in, or null for "exact"
 *   restMethod   how a cash shortfall is covered: another method, credit, or
 *                "" for not yet
 *   due          old credit collected on top, paid by the same method
 *
 * Old credit is only taken in full: cash that does not cover the bill and the
 * old credit together is a shortfall, never a quiet part-payment of either.
 */
export function planPayment(input: {
  total: number;
  method: CounterPayment;
  received: number | null;
  restMethod: CounterPayment | "";
  reference: string;
  restReference: string;
  due: number;
}): PaymentPlan {
  const total = Math.max(0, Math.round(input.total) || 0);
  const due = Math.max(0, Math.round(input.due) || 0);
  const none: PaymentPlan = { paid: 0, credit: 0, change: 0, short: 0, parts: [], split: false };

  if (total === 0 && due === 0) return none;
  if (input.method === "Credit") return { ...none, credit: total };

  if (input.method !== "Cash") {
    const reference = input.reference.trim();
    return {
      ...none,
      paid: total,
      parts: total > 0 ? [{ method: input.method, amount: total, ...(reference ? { reference } : {}) }] : [],
    };
  }

  const cash = cashOutcome(total + due, input.received);
  if (cash.short === 0) {
    return { ...none, paid: total, change: cash.change, parts: total > 0 ? [{ method: "Cash", amount: total }] : [] };
  }
  if (due > 0) return { ...none, short: cash.short };

  const cashIn = cash.paid;
  const rest = total - cashIn;
  const cashPart: MoneyPart[] = cashIn > 0 ? [{ method: "Cash", amount: cashIn }] : [];
  if (input.restMethod === "Credit") {
    return { ...none, paid: cashIn, credit: rest, parts: cashPart };
  }
  if (input.restMethod && input.restMethod !== "Cash") {
    const reference = input.restReference.trim();
    return {
      ...none,
      paid: total,
      parts: [...cashPart, { method: input.restMethod, amount: rest, ...(reference ? { reference } : {}) }],
      split: true,
    };
  }
  return { ...none, paid: cashIn, short: rest, parts: cashPart };
}
