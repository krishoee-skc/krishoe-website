export function connectionStringWithoutLegacySslMode(connectionString) {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete("sslmode");
    return url.toString();
  } catch {
    return connectionString;
  }
}

export function postgresSslConfig(connectionString) {
  if (/localhost|127\.0\.0\.1/i.test(connectionString) || process.env.PGSSLMODE === "disable") {
    return false;
  }

  // Match the runtime client: validate remote certificates unless the operator
  // deliberately opts into a self-signed provider with PGSSL_INSECURE=true.
  return { rejectUnauthorized: process.env.PGSSL_INSECURE !== "true" };
}

export function postgresConnectionOptions(connectionString, extra = {}) {
  return {
    connectionString: connectionStringWithoutLegacySslMode(connectionString),
    ssl: postgresSslConfig(connectionString),
    ...extra,
  };
}
