/**
 * Today in Kathmandu, in SQL. The database runs in UTC, so CURRENT_DATE is
 * yesterday from midnight until a quarter to six in the morning here: the
 * dashboard read 13 Aswin at 03:44 as 12 Aswin and showed the day before's
 * work as today's (owner, 2026-09-29).
 */
export const KATHMANDU_TODAY_SQL = "(now() AT TIME ZONE 'Asia/Kathmandu')::date";

/**
 * The Sunday this week began on, in Kathmandu. The shop's week is Sunday to
 * Saturday — wages are paid on Saturday (lib/period-report.ts) — while
 * Postgres's date_trunc('week') starts on Monday.
 */
export const KATHMANDU_WEEK_START_SQL =
  `(${KATHMANDU_TODAY_SQL} - EXTRACT(DOW FROM ${KATHMANDU_TODAY_SQL})::integer)`;
