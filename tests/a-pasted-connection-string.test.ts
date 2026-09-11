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

/**
 * A value copied only as far as the eye could see.
 *
 * The third run got past "base" and failed with:
 *
 *   getaddrinfo ENOTFOUND ep-proud-cherry-aozsz6ma-pooler.c-2.ap-
 *
 * That is a real prefix of the shop's real host, stopping mid-word in
 * "ap-southeast-1" — character 82 of 154. Notepad wraps a long line, and
 * dragging the mouse across what is visible selects about half of it. The
 * hostname looks plausible enough to read past, which is exactly what makes it
 * expensive.
 *
 * A host that ends in a hyphen or a dot, or carries no domain at all, was cut.
 */
describe("a connection string copied only halfway", () => {
  it("is refused, naming the host it was cut to", async () => {
    process.env.DATABASE_URL =
      "postgresql://u:p@ep-proud-cherry-aozsz6ma-pooler.c-2.ap-/neondb";
    process.env.DATA_BACKEND = "postgres";

    const { queryPostgres } = await import("@/lib/postgres/client");

    await expect(queryPostgres("t", "SELECT 1")).rejects.toThrow(/cut short/);
    await expect(queryPostgres("t", "SELECT 1")).rejects.toThrow(/Shift\+End/);
  });

  it("accepts the same string once it is complete", async () => {
    process.env.DATABASE_URL =
      "postgresql://u:p@ep-proud-cherry-aozsz6ma-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
    process.env.DATA_BACKEND = "postgres";

    const { queryPostgres } = await import("@/lib/postgres/client");

    // It gets past the check and fails on the network instead, which is the
    // proof that the guard is not what stopped it.
    await expect(queryPostgres("t", "SELECT 1")).rejects.not.toThrow(/cut short/);
  });

  it("leaves a password ending in a hyphen alone", async () => {
    process.env.DATABASE_URL = "postgresql://u:secret-@host.example.com/db";
    process.env.DATA_BACKEND = "postgres";

    const { queryPostgres } = await import("@/lib/postgres/client");

    // The check reads the host, not the credentials.
    await expect(queryPostgres("t", "SELECT 1")).rejects.not.toThrow(/cut short/);
  });
});
