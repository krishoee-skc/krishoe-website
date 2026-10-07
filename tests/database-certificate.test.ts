import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { caFromEnv } from "@/lib/postgres/client";

/**
 * Owner, 2026-10-07: the link to Supabase was encrypted but did not check it
 * was really Supabase (PGSSL_INSECURE=true), because Supabase signs with its
 * own root. With that root in PGSSL_CA the certificate is checked again.
 * Checked by hand the same day: the pooler's chain ends in "Supabase Root 2021
 * CA", and a read-only connection with that root and checking on succeeded.
 */
const PEM = "-----BEGIN CERTIFICATE-----\nMIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJ\n-----END CERTIFICATE-----";

describe("the database's own certificate authority", () => {
  it("is read as the PEM text, as base64, or with its line breaks written as \\n", () => {
    expect(caFromEnv(PEM)).toBe(PEM);
    expect(caFromEnv(Buffer.from(PEM).toString("base64"))).toBe(PEM);
    expect(caFromEnv(PEM.replace(/\n/g, "\\n"))).toBe(PEM);
  });

  it("is nothing when unset or not a certificate", () => {
    expect(caFromEnv(undefined)).toBeNull();
    expect(caFromEnv("  ")).toBeNull();
    expect(caFromEnv("not-a-certificate")).toBeNull();
  });

  it("turns checking on, and wins over PGSSL_INSECURE", async () => {
    const client = await readFile("lib/postgres/client.ts", "utf8");
    const ssl = client.slice(client.indexOf("function getSslConfig"));
    expect(ssl.indexOf("return { rejectUnauthorized: true, ca };")).toBeGreaterThan(-1);
    expect(ssl.indexOf("const ca = caFromEnv();")).toBeLessThan(ssl.indexOf('if (process.env.PGSSL_INSECURE === "true")'));
  });
});
