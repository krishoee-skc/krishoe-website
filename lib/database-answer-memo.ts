/**
 * The open health checks (/api/health?deep=1, /api/deployment-info) need no
 * login, so anyone could call them in a loop and keep the database awake —
 * and the database bills every wake-up (deep audit 16, owner 2026-10-24).
 *
 * The answer is remembered for 30 seconds, here in the server and at the
 * edge (CACHE_30S), and calls that land together share one ask. A dead
 * database is still seen within half a minute.
 */
export const REMEMBER_MS = 30_000;

export const CACHE_30S = "public, max-age=0, s-maxage=30";

let last: { at: number; ok: boolean } | null = null;
let asking: Promise<boolean> | null = null;

export async function databaseAnswers(ask: () => Promise<boolean>, now: () => number = Date.now) {
  if (last && now() - last.at < REMEMBER_MS) return last.ok;
  if (!asking) {
    asking = ask()
      .catch(() => false)
      .then((ok) => {
        last = { at: now(), ok };
        asking = null;
        return ok;
      });
  }
  return asking;
}

/** For tests: forget the remembered answer. */
export function forgetDatabaseAnswer() {
  last = null;
  asking = null;
}
