import { lastUptimeReading, recordUptimeCheck } from "@/lib/monitoring";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Where the outside checker files what it saw.
 *
 * The checker has to live somewhere this shop cannot take down with it — a
 * cron inside Vercel cannot observe Vercel being down, because when the site is
 * down the cron does not run either. So it runs on GitHub's machines, and this
 * is the one door it needs.
 *
 * A door, not a key to the house. The alternative was handing GitHub the
 * database connection string, which would have let anything that reached those
 * secrets read every order, every wage and every customer. This accepts one
 * shape of row, writes it to one table, and answers "ok". There is nothing here
 * to read: a stolen token buys the ability to write a false uptime figure, and
 * nothing else at all.
 *
 * The token lives in UPTIME_WRITE_TOKEN and is compared in constant time — a
 * plain === leaks the length of the correct prefix to anybody willing to send a
 * few thousand guesses.
 */

/** Nothing is written until a token is configured. Silence, not a free door. */
function expectedToken() {
  return (process.env.UPTIME_WRITE_TOKEN ?? "").trim();
}

function tokenMatches(offered: string) {
  const expected = expectedToken();
  if (!expected || !offered) return false;

  const a = Buffer.from(offered);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself be the
  // leak. Compare the lengths separately and cheaply.
  return a.length === b.length && timingSafeEqual(a, b);
}

function reading(value: unknown) {
  const body = (value ?? {}) as Record<string, unknown>;
  const status: "up" | "down" | null =
    body.status === "down" ? "down" : body.status === "up" ? "up" : null;
  if (!status) return null;

  const number = (input: unknown, max: number) => {
    const parsed = Math.round(Number(input));
    return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, max) : 0;
  };

  // Sent by the checker, and only trusted within reason: a stamp from the
  // future, or from before this shop existed, is a bug or a forgery either way.
  const stamp = typeof body.checkedAt === "string" ? Date.parse(body.checkedAt) : NaN;
  const now = Date.now();
  const checkedAt =
    Number.isFinite(stamp) && stamp <= now + 60_000 && stamp > now - 24 * 3_600_000
      ? new Date(stamp).toISOString()
      : undefined;

  return {
    status,
    checkedAt,
    // Bounded, because a checker sending 9,999,999 ms would poison every
    // average drawn from this table afterwards.
    responseTime: number(body.responseTime, 120_000),
    statusCode: number(body.statusCode, 599),
    region: typeof body.region === "string" ? body.region.slice(0, 40) : "outside",
  };
}

export async function POST(request: Request) {
  const offered = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();

  if (!expectedToken()) {
    return Response.json(
      { ok: false, error: "Uptime recording is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!tokenMatches(offered)) {
    return Response.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = await request.json().catch(() => null);
  const check = reading(body);

  if (!check) {
    return Response.json(
      { ok: false, error: "status must be 'up' or 'down'." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Read before writing, so "what was it before this reading" is answerable.
  //
  // The checker needs it to know whether this is a recovery — it runs on a
  // fresh machine every time and remembers nothing between runs. It cannot keep
  // that state itself without somewhere to keep it, and the obvious somewhere
  // is this shop, which is exactly the thing that goes away. Answering it here
  // costs one query on a reading that already opened a connection, and the
  // shop is by definition up whenever the question can be asked at all.
  const previous = await lastUptimeReading();

  await recordUptimeCheck(check);

  return Response.json(
    { ok: true, recorded: check.status, previousStatus: previous?.status ?? null, downSince: previous?.downSince ?? null },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
