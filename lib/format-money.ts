/**
 * One rupee amount, written the same way everywhere.
 *
 * Twenty-four screens had each defined their own `money()`, and they had
 * drifted into three different answers for the same number:
 *
 *   Rs. ${value.toLocaleString("en-IN")}                        13 screens
 *   Rs. ${Math.round(value).toLocaleString("en-IN")}             5 screens
 *   Rs. ${value.toLocaleString("en-IN", {maximumFractionDigits: 2})}   3
 *
 * So Rs. 1,250.50 read as "Rs. 1,250.5" on one screen, "Rs. 1,251" on the
 * next, and "Rs. 1,250.5" on a third — the same wage, three figures, with no
 * way for the owner to tell which was the real one.
 *
 * Two functions, because the shop genuinely wants two things:
 *
 * `money` shows the paisa when there are paisa and drops them when there are
 * none, which is how a bill or a wage is read: "Rs. 1,250.50", "Rs. 900".
 *
 * `roundedMoney` is for a headline figure — a month's turnover, a day's total
 * — where the paisa are noise. It rounds rather than truncating, so a total
 * never reads lower than it is.
 *
 * Both use the Indian grouping the shop reads (1,25,000 rather than 125,000),
 * which is what every one of those twenty-four already did.
 */
const DECIMAL = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const WHOLE = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** A number that is safe to format: NaN and null read as nothing owed. */
function amount(value: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Whether the amount carries paisa worth showing. */
function hasPaisa(value: number) {
  return Math.round(value * 100) % 100 !== 0;
}

/**
 * "Rs. 1,250.50", "Rs. 900". The everyday one — a bill line, a wage, a due.
 */
export function money(value: number) {
  const parsed = amount(value);
  return `Rs. ${hasPaisa(parsed) ? DECIMAL.format(parsed) : WHOLE.format(parsed)}`;
}

/**
 * "Rs. 1,251". A headline figure, where paisa are noise — a month's purchase,
 * a day's net sales. Rounded, never truncated.
 */
export function roundedMoney(value: number) {
  return `Rs. ${WHOLE.format(Math.round(amount(value)))}`;
}
