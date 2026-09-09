/**
 * How each worker's month is reading — pairs, wage, quality, turning up.
 *
 * The analytics screen was counting from `production_work_entries`, which is
 * the dormant production-accounting ledger: two rows in it against four in
 * `factory_daily_work`, where the work-entry screen actually writes. So the
 * screen showed santosh 120 pairs and Rs. 4,920 for a month he had made 240
 * pairs and earned Rs. 9,720 — half of everything, and a bonus figured on half.
 *
 * The arithmetic lives here, apart from the query, so the rates that decide a
 * bonus can be checked without a database.
 */

/** One worker's rows for the window, already summed by the database. */
export type WorkerMonthRow = {
  workerId: string;
  workerName: string;
  pairs: number;
  rejectedPairs: number;
  earnings: number;
  /** Days this worker posted work in the window. */
  daysWorked: number;
};

export type WorkerPerformance = {
  workerId: string;
  workerName: string;
  pairsThisMonth: number;
  earningsThisMonth: number;
  /** Good pairs as a percentage of pairs made. */
  qualityRate: number;
  /** Days worked out of the days the factory ran. */
  attendanceRate: number;
  bonusEligible: boolean;
  bonusAmount: number;
};

/** Quality above this, and attendance above this, earns the bonus. */
export const BONUS_QUALITY_RATE = 95;
export const BONUS_ATTENDANCE_RATE = 90;
/** The bonus itself, as a share of what was earned. */
export const BONUS_SHARE = 0.05;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * Good pairs as a percentage of pairs made.
 *
 * A worker who made nothing has no quality to report — 100% would say they did
 * flawless work on a day they were not there, and 0% would accuse them of
 * ruining everything. Neither is true, so it reads as zero and the bonus rule
 * below refuses it on the pairs instead.
 */
export function qualityRate(pairs: number, rejected: number) {
  if (!(pairs > 0)) return 0;
  const good = Math.max(0, pairs - Math.max(0, rejected));
  return round2(Math.min(100, (good / pairs) * 100));
}

/**
 * Days worked out of the days the factory ran.
 *
 * The shop keeps no attendance register, so this counts turning up by the work
 * that arrived. On a day nobody posted anything, the factory did not run, and
 * nobody is marked absent for it.
 */
export function attendanceRate(daysWorked: number, daysFactoryRan: number) {
  if (!(daysFactoryRan > 0)) return 0;
  return round2(Math.min(100, (Math.max(0, daysWorked) / daysFactoryRan) * 100));
}

/**
 * What a worker's month comes to, and whether it earns the bonus.
 *
 * The bonus is a suggestion the owner reads, not money that moves: nothing here
 * writes to a ledger. It is shown so a month of clean work is visible next to
 * the wage rather than having to be remembered.
 */
export function workerPerformance(
  row: WorkerMonthRow,
  daysFactoryRan: number,
): WorkerPerformance {
  const quality = qualityRate(row.pairs, row.rejectedPairs);
  const attendance = attendanceRate(row.daysWorked, daysFactoryRan);

  // Pairs matter as well as rates: a worker with one perfect pair has 100% on
  // both counts, and a bonus for a day's work is not what this is for.
  const bonusEligible =
    row.pairs > 0 && quality > BONUS_QUALITY_RATE && attendance > BONUS_ATTENDANCE_RATE;

  return {
    workerId: row.workerId,
    workerName: row.workerName,
    pairsThisMonth: Math.max(0, Math.round(row.pairs)),
    earningsThisMonth: Math.round(Math.max(0, row.earnings)),
    qualityRate: quality,
    attendanceRate: attendance,
    bonusEligible,
    bonusAmount: bonusEligible ? Math.round(Math.max(0, row.earnings) * BONUS_SHARE) : 0,
  };
}
