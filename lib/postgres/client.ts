import { createPostgresAdapterPendingError, getDataBackendConfig } from "@/lib/data-backend";
import { Pool, type QueryResultRow } from "pg";

export type SqlValue = string | number | boolean | Date | null | string[];
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
    globalThis.krishoePgPool = new Pool({
      connectionString: config.databaseUrl,
      ssl: getSslConfig(config.databaseUrl),
    });
  }

  return globalThis.krishoePgPool;
}

export async function queryPostgres<TRecord extends QueryResultRow>(
  storeName: string,
  sql: string,
  params: SqlValue[] = [],
): Promise<TRecord[]> {
  const result = await getPool(storeName).query<TRecord>(sql, params);
  return result.rows;
}

export async function transactionPostgres<T>(
  storeName: string,
  callback: (db: PostgresExecutor) => Promise<T>,
) {
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
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
