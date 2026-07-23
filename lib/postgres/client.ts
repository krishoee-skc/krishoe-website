import { createPostgresAdapterPendingError, getDataBackendConfig } from "@/lib/data-backend";
import { isRetryableConnectionError } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";
import { Pool, type QueryResultRow } from "pg";

export { isRetryableConnectionError };

// Buffer is here for bytea columns — uploaded image bytes go in as a Buffer.
export type SqlValue = string | number | boolean | Date | null | string[] | Buffer;
export type PostgresExecutor = {
  query: <TRecord extends QueryResultRow>(
    sql: string,
    params?: SqlValue[],
  ) => Promise<TRecord[]>;
};

declare global {
  var krishoePgPool: Pool | undefined;
}

type SslConfig = false | { rejectUnauthorized: boolean };

function getSslConfig(connectionString: string): SslConfig {
  if (/localhost|127\.0\.0\.1/i.test(connectionString) || process.env.PGSSLMODE === "disable") {
    return false;
  }

  // Validate the server certificate by default so the DB link can't be MITM'd.
  // Managed providers with publicly-trusted certs (Neon, Supabase, Vercel
  // Postgres) work as-is. Only set PGSSL_INSECURE=true for a provider whose
  // certificate chain is self-signed and cannot be validated.
  if (process.env.PGSSL_INSECURE === "true") {
    return { rejectUnauthorized: false };
  }

  return { rejectUnauthorized: true };
}

function getPool(storeName: string) {
  const config = getDataBackendConfig();

  if (!config.hasDatabaseUrl) {
    throw createPostgresAdapterPendingError(storeName);
  }

  if (!globalThis.krishoePgPool) {
    const pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: getSslConfig(config.databaseUrl),
      // Serverless-friendly. Neon closes idle server connections on its own; by
      // retiring ours a little sooner we hand out fresh ones instead of dead
      // ones. A small pool is right for per-request functions.
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    });

    // Without this, an error on an idle client — which Neon triggers every time
    // it hangs up a quiet connection — is an unhandled 'error' event that takes
    // down the request, and the storefront shows its retry page. Swallow it: the
    // pool discards the dead client and the next query gets a live one.
    pool.on("error", (error) => {
      console.error(`[krishoe] idle postgres client error: ${error.message}`);
    });

    globalThis.krishoePgPool = pool;
  }

  return globalThis.krishoePgPool;
}

async function withConnectionRetry<T>(run: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;

      if (attempt === attempts || !isRetryableConnectionError(error)) {
        throw error;
      }

      // Backoff sized for a Neon compute waking from idle: the first request
      // after a quiet spell can need a few seconds, and the earlier 150/300ms
      // steps gave up long before it was ready — the owner met the error page
      // on the first tap of the day. Up to ~3s of patience turns that into a
      // slightly slower page instead. No Date/random needed; fixed steps.
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }

  throw lastError;
}

export async function queryPostgres<TRecord extends QueryResultRow>(
  storeName: string,
  sql: string,
  params: SqlValue[] = [],
): Promise<TRecord[]> {
  return withConnectionRetry(async () => {
    const result = await getPool(storeName).query<TRecord>(sql, params);
    return result.rows;
  });
}

export async function transactionPostgres<T>(
  storeName: string,
  callback: (db: PostgresExecutor) => Promise<T>,
) {
  // The whole transaction is retried, not a statement within it: a connection
  // that dies mid-transaction never commits, so re-running the callback from a
  // clean BEGIN is safe. The callbacks here only touch the database.
  return withConnectionRetry(async () => {
    const client = await getPool(storeName).connect();

    try {
      await client.query("BEGIN");
      const result = await callback({
        query: async <TRecord extends QueryResultRow>(
          sql: string,
          params: SqlValue[] = [],
        ) => {
          const queryResult = await client.query<TRecord>(sql, params);
          return queryResult.rows;
        },
      });
      await client.query("COMMIT");
      return result;
    } catch (error) {
      // The original error is what the caller needs, so a failed ROLLBACK must
      // not replace it — but it must not vanish either. If the rollback did not
      // land, the connection is being released in an unknown state and that is
      // worth knowing about.
      await client.query("ROLLBACK").catch((rollbackError) => {
        reportError("roll back a failed postgres transaction", rollbackError);
      });
      throw error;
    } finally {
      client.release();
    }
  });
}
