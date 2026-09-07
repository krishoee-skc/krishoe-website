/**
 * What the factory board shows for a day, worked out in one place.
 *
 * The Factory Today screen used to fetch the day's work entries in the browser
 * and add them up there. That put the arithmetic behind a network round trip on
 * a phone in the workshop, and left the numbers untestable — the only way to
 * check "success rate" was to open the page and read it.
 *
 * The shaping lives here as plain functions over rows, so the server page can
 * render the board already filled in, and the sums can be tested without a
 * database, a browser, or a running app.
 */

/** One day's work entry, as the factory tables hand it over. */
export type FactoryWorkRow = {
  worker_id: string;
  worker_name: string;
  item_id: string;
  item_name: string;
  pairs_count: number;
  reject_pairs: number;
  amount_earned: number;
  status: string;
};

export type FactoryDayStats = {
  totalPairs: number;
  totalReject: number;
  totalAmount: number;
  workersActive: number;
  completedEntries: number;
  inProgressEntries: number;
  reworkEntries: number;
  /** Completed entries as a percentage of every entry made today. */
  successRate: number;
  /** Reject pairs as a percentage of pairs made today. */
  rejectRate: number;
  goodPairs: number;
};

export type FactoryWorkerTotal = { name: string; pairs: number; amount: number };
export type FactoryProductTotal = { name: string; pairs: number };

/**
 * Postgres hands NUMERIC columns over as strings, and a missing column as null.
 * Everything downstream does arithmetic, so the numbers are made real here —
 * once — rather than each caller remembering to. A string that slipped through
 * would turn `+` into concatenation and quietly report a wrong day's wage.
 */
export function normaliseWorkRow(row: Partial<FactoryWorkRow>): FactoryWorkRow {
  return {
    worker_id: String(row.worker_id ?? ""),
    worker_name: String(row.worker_name ?? ""),
    item_id: String(row.item_id ?? ""),
    item_name: String(row.item_name ?? ""),
    pairs_count: Number(row.pairs_count) || 0,
    reject_pairs: Number(row.reject_pairs) || 0,
    amount_earned: Number(row.amount_earned) || 0,
    status: String(row.status ?? ""),
  };
}

export function factoryDayStats(works: FactoryWorkRow[]): FactoryDayStats {
  let totalPairs = 0;
  let totalReject = 0;
  let totalAmount = 0;
  let completedEntries = 0;
  let inProgressEntries = 0;
  let reworkEntries = 0;
  const workers = new Set<string>();

  for (const work of works) {
    totalPairs += work.pairs_count;
    totalReject += work.reject_pairs;
    totalAmount += work.amount_earned;
    if (work.worker_id) workers.add(work.worker_id);
    if (work.status === "completed") completedEntries += 1;
    else if (work.status === "in_progress") inProgressEntries += 1;
    else if (work.status === "rework") reworkEntries += 1;
  }

  const totalEntries = completedEntries + inProgressEntries + reworkEntries;

  return {
    totalPairs,
    totalReject,
    totalAmount,
    workersActive: workers.size,
    completedEntries,
    inProgressEntries,
    reworkEntries,
    successRate: totalEntries > 0 ? Math.round((completedEntries / totalEntries) * 100) : 0,
    rejectRate: totalPairs > 0 ? Math.round((totalReject / totalPairs) * 100) : 0,
    // Never below zero: a day's rejects cannot outnumber its pairs, but a bad
    // entry should show as nothing made, not as a negative count on the board.
    goodPairs: Math.max(0, totalPairs - totalReject),
  };
}

/**
 * What a piece of work earns: pairs at a rate, to the paisa.
 *
 * The server settles this as `ROUND(rate * pairs, 2)` when the entry is
 * written. The add-work screen shows the worker the amount before it is saved,
 * and showing a different number from the one that lands in their ledger is how
 * a factory ends up arguing about a day's wage: 3 pairs at Rs. 25.555 is
 * 76.66499999999999 in plain JavaScript and 76.66 in the ledger.
 *
 * Rounding here the way the database does keeps the promise on screen equal to
 * the entry in the book.
 */
export function pieceWage(pairs: number, ratePerPair: number): number {
  const countedPairs = Number(pairs) || 0;
  const rate = Number(ratePerPair) || 0;

  if (countedPairs <= 0 || rate <= 0) {
    return 0;
  }

  return Math.round(rate * countedPairs * 100) / 100;
}

/**
 * The same day's figures, but built from a row the database already counted
 * rather than from the entries themselves.
 *
 * The two roads have to arrive at the same place — a board that sums one way
 * and a report that sums the other would eventually disagree about a day's
 * wage — so the rates and the good-pair floor are worked out here once, and
 * both callers land on this function.
 */
export function factoryTotalsFromRow(row: Record<string, string | number | null | undefined>): FactoryDayStats {
  const count = (key: string) => Number(row[key]) || 0;

  const totalPairs = count("total_pairs");
  const totalReject = count("total_reject");
  const completedEntries = count("completed_entries");
  const inProgressEntries = count("in_progress_entries");
  const reworkEntries = count("rework_entries");
  const totalEntries = completedEntries + inProgressEntries + reworkEntries;

  return {
    totalPairs,
    totalReject,
    totalAmount: count("total_amount"),
    workersActive: count("workers_active"),
    completedEntries,
    inProgressEntries,
    reworkEntries,
    successRate: totalEntries > 0 ? Math.round((completedEntries / totalEntries) * 100) : 0,
    rejectRate: totalPairs > 0 ? Math.round((totalReject / totalPairs) * 100) : 0,
    goodPairs: Math.max(0, totalPairs - totalReject),
  };
}

/** One worker's month, as the monthly-summary table keeps it. */
export type FactoryPayrollRow = {
  worker_id: string;
  worker_name: string;
  category: string;
  total_pairs: number;
  total_earned: number;
  total_paid: number;
  final_balance: number;
  status: string;
};

export type FactoryPayrollTotals = {
  totalPairs: number;
  totalEarned: number;
  totalPaid: number;
  totalBalance: number;
  workerCount: number;
  /** How many are still owed something for the month. */
  owedCount: number;
};

/**
 * NUMERIC columns reach the browser as strings. A payroll total built by adding
 * those with `+` is string concatenation — "250" + "200" is "250200" — so the
 * month's wage bill is made of real numbers here before anything sums it.
 */
export function normalisePayrollRow(row: Partial<FactoryPayrollRow>): FactoryPayrollRow {
  return {
    worker_id: String(row.worker_id ?? ""),
    worker_name: String(row.worker_name ?? ""),
    category: String(row.category ?? ""),
    total_pairs: Number(row.total_pairs) || 0,
    total_earned: Number(row.total_earned) || 0,
    total_paid: Number(row.total_paid) || 0,
    final_balance: Number(row.final_balance) || 0,
    status: String(row.status ?? ""),
  };
}

/** The month's wage bill across the whole team. */
export function payrollTotals(rows: FactoryPayrollRow[]): FactoryPayrollTotals {
  let totalPairs = 0;
  let totalEarned = 0;
  let totalPaid = 0;
  let totalBalance = 0;
  let owedCount = 0;

  for (const row of rows) {
    totalPairs += row.total_pairs;
    totalEarned += row.total_earned;
    totalPaid += row.total_paid;
    totalBalance += row.final_balance;
    if (row.final_balance > 0) owedCount += 1;
  }

  return {
    totalPairs,
    // Wages are money: rounded to the paisa, so a month of fractions cannot
    // drift into a total that no payslip adds up to.
    totalEarned: Math.round(totalEarned * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalBalance: Math.round(totalBalance * 100) / 100,
    workerCount: rows.length,
    owedCount,
  };
}

/** Most earned first — the order a payroll is read in. */
export function sortPayroll(rows: FactoryPayrollRow[]): FactoryPayrollRow[] {
  return [...rows].sort(
    (first, second) =>
      second.total_earned - first.total_earned ||
      first.worker_name.localeCompare(second.worker_name),
  );
}

/** Who made the most today. Entries without a name are not a person. */
export function topWorkers(works: FactoryWorkRow[], limit = 5): FactoryWorkerTotal[] {
  const byWorker = new Map<string, FactoryWorkerTotal>();

  for (const work of works) {
    if (!work.worker_id || !work.worker_name) continue;
    const current = byWorker.get(work.worker_id) ?? { name: work.worker_name, pairs: 0, amount: 0 };
    current.pairs += work.pairs_count;
    current.amount += work.amount_earned;
    byWorker.set(work.worker_id, current);
  }

  return [...byWorker.values()]
    .sort((first, second) => second.pairs - first.pairs || first.name.localeCompare(second.name))
    .slice(0, limit);
}

/** What was made today, most pairs first. */
export function topProducts(works: FactoryWorkRow[], limit = 5): FactoryProductTotal[] {
  const byItem = new Map<string, FactoryProductTotal>();

  for (const work of works) {
    if (!work.item_id || !work.item_name) continue;
    const current = byItem.get(work.item_id) ?? { name: work.item_name, pairs: 0 };
    current.pairs += work.pairs_count;
    byItem.set(work.item_id, current);
  }

  return [...byItem.values()]
    .sort((first, second) => second.pairs - first.pairs || first.name.localeCompare(second.name))
    .slice(0, limit);
}
