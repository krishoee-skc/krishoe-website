/**
 * Asks, from outside, whether the shop is answering — and writes down what it
 * found.
 *
 * This runs on GitHub's machines, not Vercel's, and that is the entire point.
 * The obvious way to measure uptime is a cron inside the app that pings itself,
 * and it is worthless: when the site is down the cron does not run either, so
 * it records a wall of "up" and misses every outage. A checker has to live
 * somewhere the thing it is checking cannot take down with it.
 *
 * The reading goes straight to Neon rather than through the app, for the same
 * reason. Posting "the site is down" to the site that is down would be the
 * one moment the recording fails, which is the one moment it matters.
 *
 *   DATABASE_URL   the Neon connection string
 *   PROBE_URL      what to ask (defaults to the production health endpoint)
 *
 * Exits 0 whether the site was up or down: a failed check is a reading, not a
 * broken job. It exits non-zero only when it could not take a reading at all,
 * because that is the case a person needs to look at.
 */
import { Client } from "pg";
import { postgresConnectionOptions } from "./postgres-connection-options.mjs";

const PROBE_URL = process.env.PROBE_URL || "https://krishoe-website.vercel.app/api/health";

/**
 * Long enough that a slow cold start is not called an outage, short enough that
 * a hung request does not hold the job open. Vercel's own function ceiling is
 * ten seconds; fifteen means a timeout here is the site's fault, not ours.
 */
const TIMEOUT_MS = 15_000;

async function probe() {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(PROBE_URL, {
      signal: controller.signal,
      headers: { "Cache-Control": "no-cache" },
      // A cached 200 from a CDN edge would say the site is up while the app
      // behind it is not.
      cache: "no-store",
    });
    const responseTime = Date.now() - started;

    // /api/health answers 503 with a body when the database is unreachable, so
    // a 200 here means the whole path answered: edge, function, and Neon.
    return {
      status: response.ok ? "up" : "down",
      statusCode: response.status,
      responseTime,
      note: response.ok ? "" : `HTTP ${response.status}`,
    };
  } catch (error) {
    // No response at all — DNS, TLS, a timeout, or nothing listening. This is
    // the reading a self-hosted checker can never take.
    return {
      status: "down",
      statusCode: 0,
      responseTime: Date.now() - started,
      note: error instanceof Error ? error.name : "unreachable",
    };
  } finally {
    clearTimeout(timer);
  }
}

const reading = await probe();
console.log(
  `${reading.status.toUpperCase()}  ${reading.statusCode || "—"}  ${reading.responseTime}ms  ${PROBE_URL}${reading.note ? `  (${reading.note})` : ""}`,
);

if (!process.env.DATABASE_URL) {
  console.error("No DATABASE_URL — the reading was taken but cannot be recorded.");
  process.exit(1);
}

const client = new Client(postgresConnectionOptions(process.env.DATABASE_URL));

try {
  await client.connect();
  await client.query(
    `INSERT INTO monitoring_uptime (status, response_time, status_code, region, checked_at)
     VALUES ($1, $2, $3, $4, now())`,
    [reading.status, reading.responseTime, reading.statusCode, "github-actions"],
  );

  // Kept to thirty days. A reading every five minutes is 8,640 rows a month,
  // and nobody has ever asked what the site was doing last spring.
  await client.query(
    `DELETE FROM monitoring_uptime WHERE checked_at < now() - INTERVAL '30 days'`,
  );

  const { rows } = await client.query(
    `SELECT count(*)::int AS readings,
            count(*) FILTER (WHERE status = 'up')::int AS up
     FROM monitoring_uptime
     WHERE checked_at > now() - INTERVAL '30 days'`,
  );
  const { readings, up } = rows[0];
  console.log(`recorded — ${up}/${readings} up over 30 days (${((up / readings) * 100).toFixed(2)}%)`);
} catch (error) {
  console.error("Reading taken, but not recorded:", error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

// A down site is a fact to record, not a reason to fail the job — the workflow
// decides separately whether to raise the alarm.
if (reading.status === "down") {
  console.log("::warning::KRISHOE did not answer this check.");
}
