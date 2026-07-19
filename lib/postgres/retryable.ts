// Kept apart from client.ts so callers that only want to *explain* a failure —
// a server action deciding what to tell the admin — can ask without pulling in
// the `pg` driver and the connection pool.

// A dead connection handed out after Neon closed it fails before the statement
// runs, so trying again on a fresh one is safe — and is the difference between a
// silent recovery and the storefront's error page.
//
// The net is cast wide on purpose. The Neon pooled endpoint (pgbouncer) reports
// a dropped connection in several shapes, and the cost of matching one too many
// is a harmless extra attempt: the queries retried here are reads and
// id-keyed upserts, both safe to run twice. Genuine SQL errors (bad column,
// constraint) carry a SQLSTATE and never match these, so they still fail fast.
export function isRetryableConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const code = (error as { code?: string } | null)?.code ?? "";

  // Connection-class SQLSTATEs (08xxx) and admin-shutdown, plus Node socket codes.
  if (
    code === "ECONNRESET" ||
    code === "EPIPE" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "57P01" || // admin shutdown / terminating connection
    code === "57P03" || // cannot connect now
    code.startsWith("08")
  ) {
    return true;
  }

  return (
    message.includes("connection terminated") ||
    message.includes("connection reset") ||
    message.includes("connection closed") ||
    message.includes("connection error") ||
    message.includes("econnreset") ||
    message.includes("epipe") ||
    message.includes("server closed the connection") ||
    message.includes("terminating connection") ||
    message.includes("not queryable") || // pg's message for a broken pooled client
    message.includes("socket") ||
    message.includes("timeout")
  );
}

// What to put in front of the admin when a write did not land. A dropped
// connection is not the admin's fault and pressing Save again fixes it, so say
// so plainly instead of showing a driver message they can do nothing with.
export function saveFailureMessage(error: unknown, fallback: string) {
  if (isRetryableConnectionError(error)) {
    return "The database did not answer. Nothing you typed was lost — press Save again.";
  }

  return error instanceof Error && error.message ? error.message : fallback;
}
