// Somewhere to put a failure that must not stop the caller.
//
// Most of these sites sit after the real work has already committed: the bill
// is posted, the order is saved. Rethrowing there hands the admin an error for
// work that succeeded, and a retry posts it twice. Swallowing leaves nobody
// knowing. So: carry on, but say so.
//
// console.error is the whole delivery mechanism, which is enough because the
// host captures it into runtime logs. It is deliberately not a notification —
// the admin cannot act on "the catalog sync failed", and a failure loud enough
// to interrupt work should be thrown instead of reported.

const PREFIX = "[krishoe]";

function describe(error: unknown) {
  if (error instanceof Error) {
    return error.stack ?? `${error.name}: ${error.message}`;
  }

  return typeof error === "string" ? error : JSON.stringify(error);
}

/**
 * Record a failure that the caller is choosing to continue past.
 *
 * @param where what was being attempted, in the app's own words, e.g.
 *   "sync catalog stock after purchase PUR-12"
 */
export function reportError(where: string, error: unknown) {
  console.error(`${PREFIX} ${where} failed: ${describe(error)}`);
}

/**
 * Run something whose failure must not stop the caller, and report it if it
 * fails. Returns undefined on failure, so a value can still be awaited.
 */
export async function reportingErrors<T>(where: string, run: () => Promise<T>) {
  try {
    return await run();
  } catch (error) {
    reportError(where, error);
    return undefined;
  }
}
