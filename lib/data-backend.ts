export type DataBackend = "local-json" | "postgres";

const supportedBackends: DataBackend[] = ["local-json", "postgres"];
const implementedPostgresStores = [
  "products",
  "orders",
  "payment transactions",
  "contact messages",
  "users",
  "password reset tokens",
  "email verification tokens",
  "operations",
  "POS invoices",
  "purchasing",
  "costing settings",
  "HR",
  "admin audit events",
  "notification events",
  "rate limit attempts",
  "admin settings",
  "customer voice",
] as const;
const pendingPostgresStores = [] as const;

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

/**
 * The connection string, tidied of the two ways it is usually pasted wrong.
 *
 * Copying a line out of .env.local and into a secret box takes the key name
 * with it. `DATABASE_URL=postgresql://…` then parses with the host read as
 * "base" — out of the word data-BASE — and the only symptom is
 * `getaddrinfo EAI_AGAIN base`, which names neither the setting nor the
 * mistake. That cost a real hour of the owner's evening; the string is
 * unambiguous, so it is repaired here rather than diagnosed again.
 *
 * Surrounding quotes come from the same copy: .env files keep them, secret
 * boxes and real connection strings do not.
 */
function connectionString(raw: string) {
  let value = raw.trim();

  // DATABASE_URL=… , PGURL=… , anything of that shape before the scheme.
  // [\s\S] rather than the s flag, which this TypeScript target rejects.
  const withKeyName = value.match(/^[A-Za-z_][A-Za-z0-9_]*[ \t]*=[ \t]*([\s\S]+)$/);
  if (withKeyName && /^["']?[a-z+]+:\/\//i.test(withKeyName[1])) {
    value = withKeyName[1].trim();
  }

  if (value.length > 1 && /^["']/.test(value) && value.at(-1) === value[0]) {
    value = value.slice(1, -1).trim();
  }

  return value;
}

export function getDataBackendConfig() {
  const rawBackend = envValue("DATA_BACKEND") || "local-json";
  const isSupported = supportedBackends.includes(rawBackend as DataBackend);
  const backend = isSupported ? (rawBackend as DataBackend) : "local-json";
  const databaseUrl = connectionString(envValue("DATABASE_URL"));

  return {
    rawBackend,
    backend,
    isSupported,
    databaseUrl,
    hasDatabaseUrl: databaseUrl.length > 0,
    postgresSelected: backend === "postgres",
    postgresAdapterStatus: "complete" as const,
    implementedPostgresStores,
    pendingPostgresStores,
  };
}

export function getDataBackend() {
  return getDataBackendConfig().backend;
}

export function getSafeDataBackendStatus() {
  const config = getDataBackendConfig();

  return {
    backend: config.backend,
    rawBackend: config.rawBackend,
    isSupported: config.isSupported,
    databaseUrlConfigured: config.hasDatabaseUrl,
    postgresAdapterStatus: config.postgresAdapterStatus,
    implementedPostgresStores: [...config.implementedPostgresStores],
    pendingPostgresStores: [...config.pendingPostgresStores],
  };
}

export function createPostgresAdapterPendingError(storeName: string) {
  const config = getDataBackendConfig();

  if (!config.isSupported) {
    return new Error(
      `Unsupported DATA_BACKEND="${config.rawBackend}". Use "local-json" until the Postgres adapters are implemented.`,
    );
  }

  if (!config.hasDatabaseUrl) {
    return new Error(`DATA_BACKEND=postgres requires DATABASE_URL before ${storeName} can run.`);
  }

  return new Error(
    `${storeName} Postgres adapter is not implemented yet. Implement the pending repository before switching this store to DATA_BACKEND=postgres.`,
  );
}

export async function runWithDataBackend<T>({
  storeName,
  localJson,
  postgres,
}: {
  storeName: string;
  localJson: () => Promise<T>;
  postgres?: () => Promise<T>;
}) {
  const config = getDataBackendConfig();

  if (!config.isSupported) {
    throw createPostgresAdapterPendingError(storeName);
  }

  if (config.backend === "local-json") {
    return localJson();
  }

  if (!postgres) {
    throw createPostgresAdapterPendingError(storeName);
  }

  return postgres();
}
