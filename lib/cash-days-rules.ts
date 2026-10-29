/**
 * What should be in the drawer: the morning's cash, plus cash in, less cash out
 * (owner, 2026-10-29). Null without a morning figure. The difference is the
 * count less that: below 0 the drawer is short, above 0 it holds more than the
 * books say.
 */
export function drawerCheck(opening: number | null, cashIn: number, cashOut: number, counted: number | null) {
  if (opening == null) return { expected: null, difference: null };
  const expected = opening + cashIn - cashOut;
  return { expected, difference: counted == null ? null : counted - expected };
}
