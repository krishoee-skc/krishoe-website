export type DataBackend = "local-json" | "postgres";

const supportedBackends: DataBackend[] = ["local-json", "postgres"];
const implementedPostgresStores = [
  "products",
  "orders",
  "payment transactions",
  "contact messages",
  "users",
  "password reset tokens",
  "operations",
  "POS invoices",
  "purchasing",
  "costing settings",
  "HR",
  "admin audit events",
  "notification events",
  "rate limit attempts",
  "admin settings",
] as const;
const pendingPostgresStores = [] as const;

function envValue(key: string) {
  return process.env[key]?.trim() ?? "";
}

export function getDataBackendConfig() {
  const rawBackend = envValue("DATA_BACKEND") || "local-json";
  const isSupported = supportedBackends.includes(rawBackend as DataBackend);
  const backend = isSupported ? (rawBackend as DataBackend) : "local-json";
  const databaseUrl = envValue("DATABASE_URL");

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
