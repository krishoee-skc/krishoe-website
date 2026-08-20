// Somewhere to put a failure that must not stop the caller.
//
// Most of these sites sit after the real work has already committed: the bill
// is posted, the order is saved. Rethrowing there hands the admin an error for
// work that succeeded, and a retry posts it twice. Swallowing leaves nobody
// knowing. So: carry on, but say so.
//
// It is deliberately not a notification — the admin cannot act on "the catalog
// sync failed", and a failure loud enough to interrupt work should be thrown
// instead of reported. It is written twice: to the console, which the host
// captures into runtime logs, and to monitoring_errors, which is what
// /admin/monitoring reads.
//
// The second one is the point. Runtime logs live on a host nobody in this shop
// has ever signed into and drop what they hold after a few days, so a fault
// that ran for a week was, in practice, never recorded anywhere the owner could
// find it. Thirty-nine call sites already say exactly what was being attempted;
// they only needed somewhere to say it to.

import { after } from "next/server";
import { logError } from "@/lib/monitoring";

const PREFIX = "[krishoe]";

function firstLine(text: string) {
  return text.split("\n", 1)[0] ?? text;
}

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
  const described = describe(error);
  console.error(`${PREFIX} ${where} failed: ${described}`);
  record(where, described, error);
}

/**
 * Put the failure in the table, without making anyone wait for it.
 *
 * Every one of these sites sits after the real work has committed — the bill is
 * posted, the order is saved — so the response should leave at the speed it
 * would have left anyway. `after` is Next's own hook for exactly this: work
 * that runs once the response is on its way. Outside a request there is nothing
 * to run after — a script, a test, a build — so the write just runs; logError
 * swallows its own failures, so neither path can throw into the caller.
 */
function record(where: string, described: string, error: unknown) {
  const write = () =>
    logError({
      level: "error",
      // The first line only. The rest of a stack is not a sentence, and the
      // whole of it is kept in its own column.
      message: `${where} failed: ${firstLine(described)}`,
      stack: error instanceof Error ? error.stack : undefined,
      context: where,
    });

  try {
    after(write);
  } catch {
    void write();
  }
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
