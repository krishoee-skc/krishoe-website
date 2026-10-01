/**
 * The cheque book's rules, kept apart from the database so they can be read
 * and tested on their own (owner, 2026-10-01: "whose cheque, which bank, when
 * to deposit, did it clear or not — for us and for the customer").
 *
 * Dates are day keys, "YYYY-MM-DD" in Nepal time; a cheque's date is a day, not
 * a moment.
 */

export type ChequeDirection = "in" | "out";
export type ChequeSource = "bill" | "purchase" | "manual";
export const chequeStates = ["waiting", "deposited", "cleared", "bounced", "recovered", "cancelled"] as const;
export type ChequeBookState = (typeof chequeStates)[number];

export type Cheque = {
  id: string;
  direction: ChequeDirection;
  source: ChequeSource;
  sourceId: string;
  sourceNumber: string;
  partyName: string;
  partyPhone: string;
  bank: string;
  chequeNo: string;
  amount: number;
  /** The day it may be deposited, "" when not known (an older bill). */
  chequeDate: string;
  nameOnCheque: string;
  state: ChequeBookState;
  depositedOn: string;
  clearedOn: string;
  bouncedOn: string;
  bounceReason: string;
  bankCharge: number;
  note: string;
  createdAt: string;
  createdBy: string;
};

/** Banks a Nepali cheque usually comes from; anything else is typed. */
export const NEPAL_BANKS = [
  "NIC Asia Bank",
  "Nabil Bank",
  "Global IME Bank",
  "NMB Bank",
  "Prabhu Bank",
  "Himalayan Bank",
  "Nepal Investment Mega Bank",
  "Siddhartha Bank",
  "Sanima Bank",
  "Kumari Bank",
  "Laxmi Sunrise Bank",
  "Citizens Bank",
  "Prime Commercial Bank",
  "Everest Bank",
  "Machhapuchchhre Bank",
  "Standard Chartered Nepal",
  "Nepal SBI Bank",
  "Nepal Bank",
  "Rastriya Banijya Bank",
  "Agricultural Development Bank",
] as const;

export const BOUNCE_REASONS = [
  { id: "funds", en: "Not enough money in the account", ne: "खातामा पैसा पुगेन" },
  { id: "signature", en: "Signature did not match", ne: "सही मिलेन" },
  { id: "date", en: "Date problem (too early or too old)", ne: "मितिको समस्या" },
  { id: "stopped", en: "Payment stopped by the writer", ne: "चेक दिनेले रोक्यो" },
  { id: "closed", en: "Account closed", ne: "खाता बन्द" },
  { id: "other", en: "Other", ne: "अरू" },
] as const;

export function bounceReasonWords(id: string) {
  return BOUNCE_REASONS.find((reason) => reason.id === id) ?? { id, en: id, ne: id };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days from one day key to another, whole days. */
export function daysBetween(fromKey: string, toKey: string) {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / DAY_MS);
}

export function addDays(key: string, days: number) {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Banks used before first, then the usual list, each once. */
export function bankChoices(usedBefore: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const bank of [...usedBefore, ...NEPAL_BANKS]) {
    const name = bank.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export type ChequeStage =
  | "hold"
  | "deposit"
  | "in-bank"
  | "cashable"
  | "cleared"
  | "bounced"
  | "recovered"
  | "cancelled"
  | "no-date";

/**
 * Where a cheque stands today. A cheque taken waits in hand until its date
 * ("hold"), then is due at the bank ("deposit"); a cheque given can be cashed
 * by the supplier from its date ("cashable").
 */
export function chequeStage(cheque: Pick<Cheque, "direction" | "state" | "chequeDate">, todayKey: string): ChequeStage {
  if (cheque.state === "cleared" || cheque.state === "bounced" || cheque.state === "recovered" || cheque.state === "cancelled") {
    return cheque.state;
  }
  if (cheque.state === "deposited") return "in-bank";
  if (!cheque.chequeDate) return "no-date";
  if (cheque.direction === "out") return "cashable";
  return cheque.chequeDate > todayKey ? "hold" : "deposit";
}

/** Still the shop's business: not cleared, collected or cancelled. */
export function isOpen(cheque: Pick<Cheque, "state">) {
  return cheque.state === "waiting" || cheque.state === "deposited" || cheque.state === "bounced";
}

export type ChequeTotals = {
  toDeposit: { amount: number; count: number };
  inBank: { amount: number; count: number };
  clearedThisMonth: { amount: number; count: number };
  bouncedOwed: { amount: number; count: number };
  givenOpen: { amount: number; count: number };
};

/** The five figures at the top of the page. */
export function chequeTotals(cheques: Cheque[], monthStartKey: string): ChequeTotals {
  const totals: ChequeTotals = {
    toDeposit: { amount: 0, count: 0 },
    inBank: { amount: 0, count: 0 },
    clearedThisMonth: { amount: 0, count: 0 },
    bouncedOwed: { amount: 0, count: 0 },
    givenOpen: { amount: 0, count: 0 },
  };
  const add = (bucket: { amount: number; count: number }, amount: number) => {
    bucket.amount += amount;
    bucket.count += 1;
  };
  for (const cheque of cheques) {
    if (cheque.direction === "out") {
      if (cheque.state === "waiting") add(totals.givenOpen, cheque.amount);
      continue;
    }
    if (cheque.state === "waiting") add(totals.toDeposit, cheque.amount);
    else if (cheque.state === "deposited") add(totals.inBank, cheque.amount);
    else if (cheque.state === "bounced") add(totals.bouncedOwed, cheque.amount + cheque.bankCharge);
    else if (cheque.state === "cleared" && cheque.clearedOn >= monthStartKey) add(totals.clearedThisMonth, cheque.amount);
  }
  return totals;
}

/**
 * What the Owner should hear about, from today: cheques taken that are due at
 * the bank by tomorrow, cheques given that a supplier may cash within two days
 * (the money must be in the account), and cheques that bounced.
 */
export function chequeReminders(cheques: Cheque[], todayKey: string) {
  const tomorrow = addDays(todayKey, 1);
  const twoDays = addDays(todayKey, 2);
  const toDeposit = cheques.filter(
    (cheque) => cheque.direction === "in" && cheque.state === "waiting" && cheque.chequeDate !== "" && cheque.chequeDate <= tomorrow,
  );
  const toCover = cheques.filter(
    (cheque) => cheque.direction === "out" && cheque.state === "waiting" && cheque.chequeDate !== "" && cheque.chequeDate <= twoDays,
  );
  const bounced = cheques.filter((cheque) => cheque.direction === "in" && cheque.state === "bounced");
  const byBank = new Map<string, number>();
  for (const cheque of toCover) byBank.set(cheque.bank || "?", (byBank.get(cheque.bank || "?") ?? 0) + cheque.amount);
  return { toDeposit, toCover, bounced, coverByBank: [...byBank.entries()].map(([bank, amount]) => ({ bank, amount })) };
}

export type ChequeWeek = {
  startKey: string;
  inAmount: number;
  outAmount: number;
  days: Array<{ key: string; cheques: Cheque[] }>;
};

/**
 * Open cheques by the week their date falls in, from this week on, with an
 * "earlier" group first for dates already past. Weeks start on Sunday, as the
 * shop's do.
 */
export function chequeWeeks(cheques: Cheque[], todayKey: string, weeks = 6) {
  const dayOfWeek = new Date(`${todayKey}T00:00:00Z`).getUTCDay();
  const firstWeek = addDays(todayKey, -dayOfWeek);
  const lastKey = addDays(firstWeek, weeks * 7 - 1);
  const dated = cheques
    .filter((cheque) => (cheque.state === "waiting" || cheque.state === "deposited") && cheque.chequeDate)
    .sort((a, b) => a.chequeDate.localeCompare(b.chequeDate));

  const earlier = dated.filter((cheque) => cheque.chequeDate < firstWeek);
  const out: ChequeWeek[] = [];
  for (let index = 0; index < weeks; index += 1) {
    const startKey = addDays(firstWeek, index * 7);
    const endKey = addDays(startKey, 6);
    const inWeek = dated.filter((cheque) => cheque.chequeDate >= startKey && cheque.chequeDate <= endKey);
    const days = new Map<string, Cheque[]>();
    for (const cheque of inWeek) days.set(cheque.chequeDate, [...(days.get(cheque.chequeDate) ?? []), cheque]);
    out.push({
      startKey,
      inAmount: inWeek.filter((cheque) => cheque.direction === "in").reduce((sum, cheque) => sum + cheque.amount, 0),
      outAmount: inWeek.filter((cheque) => cheque.direction === "out").reduce((sum, cheque) => sum + cheque.amount, 0),
      days: [...days.entries()].map(([key, list]) => ({ key, cheques: list })),
    });
  }
  const later = dated.filter((cheque) => cheque.chequeDate > lastKey);
  return { earlier, weeks: out, later };
}

/**
 * Whether an action is allowed from where the cheque stands — the buttons
 * show only these, and the server refuses the rest.
 */
export const chequeActions = ["deposit", "clear", "bounce", "recover", "cancel"] as const;
export type ChequeAction = (typeof chequeActions)[number];

export function allowedActions(cheque: Pick<Cheque, "direction" | "state">): ChequeAction[] {
  if (cheque.direction === "in") {
    if (cheque.state === "waiting") return ["deposit", "clear", "bounce", "cancel"];
    if (cheque.state === "deposited") return ["clear", "bounce"];
    if (cheque.state === "bounced") return ["recover"];
    return [];
  }
  if (cheque.state === "waiting") return ["clear", "bounce", "cancel"];
  if (cheque.state === "bounced") return ["recover"];
  return [];
}

/** The state an action leads to. */
export function stateAfter(action: ChequeAction): ChequeBookState {
  return action === "deposit"
    ? "deposited"
    : action === "clear"
      ? "cleared"
      : action === "bounce"
        ? "bounced"
        : action === "recover"
          ? "recovered"
          : "cancelled";
}

/**
 * A reason to refuse or question an action's date: depositing before the
 * cheque's own date is refused (the bank returns it); a day in the future is
 * refused for anything that already happened.
 */
export function actionDateProblem(
  cheque: Pick<Cheque, "chequeDate">,
  action: ChequeAction,
  onKey: string,
  todayKey: string,
): { en: string; ne: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(onKey)) return { en: "Pick the date.", ne: "मिति छान्नुहोस्।" };
  if (onKey > todayKey) return { en: "That day has not come yet.", ne: "त्यो दिन अझै आएको छैन।" };
  if (action === "deposit" && cheque.chequeDate && onKey < cheque.chequeDate) {
    return {
      en: "The cheque's date has not come — the bank would return it.",
      ne: "चेकको मिति आएको छैन — बैंकले फर्काउँछ।",
    };
  }
  return null;
}

/** A cheque dated this long ago may be too old for the bank — ask before taking it. */
export const OLD_CHEQUE_DAYS = 150;

export function chequeDateWarning(chequeDate: string, todayKey: string): { en: string; ne: string } | null {
  if (!chequeDate) return null;
  if (daysBetween(chequeDate, todayKey) > OLD_CHEQUE_DAYS) {
    return {
      en: "This cheque's date is months old — ask the bank whether it still takes it.",
      ne: "यो चेकको मिति धेरै महिना पुरानो छ — बैंकले लिन्छ कि लिँदैन, सोध्नुहोस्।",
    };
  }
  return null;
}

/** "Rs. 3,900" */
export function chequeRupees(amount: number) {
  return `Rs. ${Math.round(amount).toLocaleString("en-IN")}`;
}

/**
 * The WhatsApp words for the other side of the cheque — before its date, once
 * it clears, and when it bounces; for a supplier, when they may cash it.
 */
export function chequeMessage(
  cheque: Pick<Cheque, "direction" | "partyName" | "bank" | "chequeNo" | "amount" | "bankCharge" | "sourceNumber" | "state">,
  dateWords: string,
): { en: string; ne: string } {
  const who = cheque.partyName.trim();
  const amount = chequeRupees(cheque.amount);
  const bank = cheque.bank ? `${cheque.bank} ` : "";
  const bill = cheque.sourceNumber ? ` (${cheque.sourceNumber})` : "";
  if (cheque.direction === "out") {
    return {
      en: `Namaste ${who} 🙏 Our ${bank}cheque no. ${cheque.chequeNo} for ${amount}${bill} can be deposited from ${dateWords}. — KRISHOE`,
      ne: `नमस्ते ${who} जी 🙏 हाम्रो ${bank}चेक नं. ${cheque.chequeNo}, ${amount}${bill}, ${dateWords} देखि बैंकमा राख्न सकिन्छ। — KRISHOE`,
    };
  }
  if (cheque.state === "cleared") {
    return {
      en: `Namaste ${who} 🙏 Your cheque no. ${cheque.chequeNo} for ${amount} has cleared. Thank you! — KRISHOE`,
      ne: `नमस्ते ${who} जी 🙏 तपाईंको चेक नं. ${cheque.chequeNo}, ${amount}, बैंकबाट पास भयो। धन्यवाद! — KRISHOE`,
    };
  }
  if (cheque.state === "bounced") {
    const owed = chequeRupees(cheque.amount + cheque.bankCharge);
    const fee = chequeRupees(cheque.bankCharge);
    const charge = cheque.bankCharge > 0 ? { en: ` including the ${fee} bank charge`, ne: ` (बैंकको शुल्क ${fee} सहित)` } : { en: "", ne: "" };
    return {
      en: `Namaste ${who} 🙏 Your cheque no. ${cheque.chequeNo} for ${amount} came back from the bank. Please pay ${owed}${charge.en} by cash or QR. — KRISHOE`,
      ne: `नमस्ते ${who} जी 🙏 तपाईंको चेक नं. ${cheque.chequeNo}, ${amount}, बैंकबाट फर्कियो। कृपया ${owed}${charge.ne} नगद वा QR बाट तिरिदिनुहोस्। — KRISHOE`,
    };
  }
  return {
    en: `Namaste ${who} 🙏 Your ${bank}cheque no. ${cheque.chequeNo} for ${amount}${bill} will be deposited on ${dateWords}. Please keep the balance in the account. — KRISHOE`,
    ne: `नमस्ते ${who} जी 🙏 तपाईंको ${bank}चेक नं. ${cheque.chequeNo}, ${amount}${bill}, ${dateWords} मा बैंकमा राखिनेछ। खातामा पैसा राखिदिनुहोस्। — KRISHOE`,
  };
}

/**
 * Cheques taken before the book existed: bills paid by cheque with no row in
 * it yet. They are listed to be filled in once — bank and date — and their
 * state comes from what was marked on the counter page.
 */
export function billsMissingDetails<T extends { id: string }>(chequeBills: T[], cheques: Pick<Cheque, "source" | "sourceId">[]) {
  const have = new Set(cheques.filter((cheque) => cheque.source === "bill").map((cheque) => cheque.sourceId));
  return chequeBills.filter((bill) => !have.has(bill.id));
}
