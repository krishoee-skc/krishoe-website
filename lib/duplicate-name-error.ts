/**
 * Recognises the database refusing a duplicate name.
 *
 * The API checks for a clash before inserting, but a check and an insert are
 * two statements with a gap between them: two requests that arrive together —
 * a double-tapped Save — both see no clash and both insert. A unique index
 * closes that gap, and this turns the raw constraint violation it raises into
 * the same sentence the pre-check would have produced, so the person at the
 * form is told the same thing either way instead of seeing a 500.
 */
const UNIQUE_VIOLATION = "23505";

export function isDuplicateNameViolation(error: unknown, indexName: string) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; constraint?: unknown; message?: unknown };
  if (candidate.code !== UNIQUE_VIOLATION) return false;

  // Postgres names the index in `constraint`; some drivers surface it only in
  // the message text, so both are worth looking at.
  return (
    candidate.constraint === indexName
    || (typeof candidate.message === "string" && candidate.message.includes(indexName))
  );
}
