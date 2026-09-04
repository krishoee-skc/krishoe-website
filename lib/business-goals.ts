import { queryPostgres } from "@/lib/postgres/client";
import { bikramMonthKeyOf } from "@/lib/bikram-sambat";

/**
 * The owner's monthly business goals, and how far along the month is.
 *
 * One row per Bikram month in business_goals. A month with no row (or all
 * zeros) simply has no goal set — the dashboard shows the numbers without a
 * target rather than a broken bar, so an empty goal is a normal state, never an
 * error. The write is an upsert keyed on the month, so setting a goal twice
 * updates it in place.
 *
 * All figures are read straight back; no arithmetic that could drift lives here
 * beyond clamping a negative to zero.
 */

const STORE = "business goals";

export type BusinessGoal = {
  monthKey: string;
  salesGoal: number;
  profitGoal: number;
  productionGoal: number;
  note: string;
};

type GoalRow = {
  month_key: string;
  sales_goal: string | number;
  profit_goal: string | number;
  production_goal: string | number;
  note: string;
};

function num(value: string | number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** The Bikram month key ("2083-05") for a date, defaulting to now. */
export function currentGoalMonthKey(date: Date = new Date()): string {
  return bikramMonthKeyOf(date);
}

/** The goal for a month, or a zeroed goal (meaning "not set") if none. */
export async function getBusinessGoal(monthKey: string): Promise<BusinessGoal> {
  const rows = await queryPostgres<GoalRow>(
    STORE,
    `SELECT month_key, sales_goal, profit_goal, production_goal, note
       FROM business_goals WHERE month_key = $1`,
    [monthKey],
  );
  const row = rows[0];
  if (!row) {
    return { monthKey, salesGoal: 0, profitGoal: 0, productionGoal: 0, note: "" };
  }
  return {
    monthKey: row.month_key,
    salesGoal: num(row.sales_goal),
    profitGoal: num(row.profit_goal),
    productionGoal: num(row.production_goal),
    note: row.note ?? "",
  };
}

/** Set (or update) the goal for a month. Upsert keyed on the month. */
export async function saveBusinessGoal(input: {
  monthKey: string;
  salesGoal: number;
  profitGoal: number;
  productionGoal: number;
  note?: string;
}): Promise<void> {
  await queryPostgres(
    STORE,
    `INSERT INTO business_goals
       (month_key, sales_goal, profit_goal, production_goal, note, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (month_key) DO UPDATE SET
       sales_goal = EXCLUDED.sales_goal,
       profit_goal = EXCLUDED.profit_goal,
       production_goal = EXCLUDED.production_goal,
       note = EXCLUDED.note,
       updated_at = EXCLUDED.updated_at`,
    [
      input.monthKey,
      Math.max(0, Math.round(Number(input.salesGoal) || 0)),
      Math.max(0, Math.round(Number(input.profitGoal) || 0)),
      Math.max(0, Math.round(Number(input.productionGoal) || 0)),
      (input.note ?? "").trim().slice(0, 200),
    ],
  );
}

/**
 * How far a running total is toward a goal, as a whole percent, and the day's
 * fair share of the month so "today" can be judged against the month's pace.
 *
 * A zero goal returns null progress — "not tracking" — which the UI shows as no
 * bar rather than 0% or a divide-by-zero.
 */
export function goalProgress(
  achieved: number,
  goal: number,
): { percent: number | null; achieved: number; goal: number } {
  if (goal <= 0) return { percent: null, achieved, goal };
  return { percent: Math.round((achieved / goal) * 100), achieved, goal };
}
