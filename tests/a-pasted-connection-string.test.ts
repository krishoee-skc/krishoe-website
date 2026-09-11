import { afterEach, describe, expect, it } from "vitest";
import { getDataBackendConfig } from "@/lib/data-backend";

/**
 * A connection string copied the way people copy.
 *
 * The weekly stock tests failed on their first run with:
 *
 *   Error: getaddrinfo EAI_AGAIN base
 *   Serialized Error: { hostname: 'base' }
 *
 * Nothing in the shop is called "base". The secret had been pasted straight
 * out of .env.local with the key name still attached —
 * `DATABASE_URL=postgresql://…` — and pg-connection-string reads that as a
 * host of "base", out of the middle of the word data-BASE, with the whole real
 * URL shoved into the database field.
 *
 * The message names neither the setting nor the mistake, and the owner is not
 * going to guess it. The string is unambiguous, so it is repaired instead: a
 * value that begins `SOMETHING=` followed by a scheme is a pasted line, and the
 * part after the equals is the URL. Quotes come off for the same reason — an
 * .env file keeps them, a secret box does not.
 */
const original = process.env.DATABASE_URL;

afterEach(() => {
  if (original === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = original;
});

const REAL = "postgresql://neondb_owner:npg_secret@ep-proud-cherry.aws.neon.tech/neondb?sslmode=require";

describe("a connection string pasted with its key name", () => {
  it("is read as the URL, not as a host called base", () => {
    process.env.DATABASE_URL = `DATABASE_URL=${REAL}`;

    expect(getDataBackendConfig().databaseUrl).toBe(REAL);
  });

  it("survives spaces around the equals, the way an editor leaves them", () => {
    process.env.DATABASE_URL = `DATABASE_URL = ${REAL}`;

    expect(getDataBackendConfig().databaseUrl).toBe(REAL);
  });

  it("takes the quotes off a value copied out of an env file", () => {
    process.env.DATABASE_URL = `"${REAL}"`;

    expect(getDataBackendConfig().databaseUrl).toBe(REAL);
  });

  it("handles both at once, which is the whole line copied verbatim", () => {
    process.env.DATABASE_URL = `DATABASE_URL="${REAL}"`;

    expect(getDataBackendConfig().databaseUrl).toBe(REAL);
  });
});

describe("what it must not touch", () => {
  it("leaves a correctly pasted string exactly as it is", () => {
    process.env.DATABASE_URL = REAL;

    expect(getDataBackendConfig().databaseUrl).toBe(REAL);
  });

  it("leaves a password containing an equals sign alone", () => {
    // The repair only fires when what precedes the equals is a bare name and
    // what follows is a scheme — never inside the credentials.
    const withEquals = "postgresql://user:pa=ss@host.example/db";
    process.env.DATABASE_URL = withEquals;

    expect(getDataBackendConfig().databaseUrl).toBe(withEquals);
  });

  it("does not invent a URL out of something that is not one", () => {
    process.env.DATABASE_URL = "SOME_NOTE=this is not a connection string";

    expect(getDataBackendConfig().databaseUrl).toBe("SOME_NOTE=this is not a connection string");
  });

  it("still reports an empty setting as empty", () => {
    process.env.DATABASE_URL = "";

    expect(getDataBackendConfig().hasDatabaseUrl).toBe(false);
  });
});

/**
 * When the paste is not a URL at all.
 *
 * The first two scheduled runs both failed with `getaddrinfo EAI_AGAIN base`.
 * The word "base" is not a typo of anything in this shop — it is what
 * pg-connection-string returns as the HOST when the value it is given is the
 * bare word "database", or any bare word: it reads "data" as a scheme-less
 * prefix and "base" as a hostname.
 *
 * Repairing that is impossible — there is no URL in it to recover. So it is
 * refused by name, at the moment the pool is built, rather than becoming a DNS
 * lookup for a host nobody typed.
 */
describe("a secret that is not a connection string at all", () => {
  it("is what makes the driver look for a host called base", async () => {
    const { parse } = await import("pg-connection-string");

    // The evidence, kept in the test so the next person does not have to
    // rediscover where "base" comes from.
    expect(parse("database").host).toBe("base");
  });

  it("is refused with a message that names the setting and the fix", async () => {
    process.env.DATABASE_URL = "database";
    process.env.DATA_BACKEND = "postgres";

    const { queryPostgres } = await import("@/lib/postgres/client");

    await expect(queryPostgres("t", "SELECT 1")).rejects.toThrow(/DATABASE_URL does not look like/);
    await expect(queryPostgres("t", "SELECT 1")).rejects.toThrow(/postgresql:\/\//);
  });
});
