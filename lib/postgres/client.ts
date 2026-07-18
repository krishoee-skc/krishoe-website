import { createPostgresAdapterPendingError, getDataBackendConfig } from "@/lib/data-backend";
import { Pool, type QueryResultRow } from "pg";

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

// A dead connection handed out after Neon closed it fails before the statement
// runs, so trying again on a fresh one is safe — and is the difference between a
// silent recovery and the storefront's error page.
function isRetryableConnectionError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const code = (error as { code?: string } | null)?.code ?? "";

  return (
    code === "ECONNRESET" ||
    code === "57P01" || // admin shutdown / terminating connection
    code === "08006" || // connection failure
    code === "08003" || // connection does not exist
    message.includes("connection terminated") ||
    message.includes("connection reset") ||
    message.includes("econnreset") ||
    message.includes("server closed the connection") ||
    message.includes("terminating connection") ||
    message.includes("timeout")
  );
}

async function withConnectionRetry<T>(run: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;

      if (attempt === attempts || !isRetryableConnectionError(error)) {
        throw error;
      }

      // A short backoff so a cold Neon endpoint has a moment to accept the next
      // connection. No Date/random needed; a fixed step is enough.
      await new Promise((resolve) => setTimeout(resolve, attempt * 150));
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
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  });
}
