// A read answered once, then reused for a moment.
//
// React's `cache` would be the right tool — it scopes a memo to one request —
// but it only exists under the react-server condition, and this project runs
// React 18.3, where importing it breaks in plain Node (and in the tests). So
// the scope is approximated with a short time window instead.
//
// That approximation is only safe because of how narrowly this is used: a
// report read of shop-wide data, identical for every viewer, where being a
// second stale changes nothing a person could notice. It must never wrap a read
// that a writer depends on — see getOperationsDataForReports for why.

type Pending<T> = { value: Promise<T>; expiresAt: number };

/**
 * Reuse an in-flight or just-finished result for `ttlMs`.
 *
 * A rejected call is not cached: the next caller retries rather than inheriting
 * a failure it had no part in — which matters here, since the failure being
 * retried is usually a dropped connection.
 */
export function cacheBriefly<T>(load: () => Promise<T>, ttlMs = 1_000): () => Promise<T> {
  let pending: Pending<T> | null = null;

  return () => {
    const now = Date.now();

    if (pending && pending.expiresAt > now) {
      return pending.value;
    }

    const value = load();
    pending = { value, expiresAt: now + ttlMs };

    // Clearing on failure has to happen without marking the promise handled, or
    // a rejection with no other listener becomes an unhandled rejection.
    value.catch(() => {
      if (pending?.value === value) {
        pending = null;
      }
    });

    return value;
  };
}
