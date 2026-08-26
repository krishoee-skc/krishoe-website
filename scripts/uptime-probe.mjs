/**
 * Asks, from outside, whether the shop is answering — and files what it found.
 *
 * This runs on GitHub's machines, not Vercel's, and that is the entire point.
 * The obvious way to measure uptime is a cron inside the app that pings itself,
 * and it is worthless: when the site is down the cron does not run either, so
 * it records a wall of "up" and misses every outage. A checker has to live
 * somewhere the thing it is checking cannot take down with it.
 *
 * It files the reading through a narrow endpoint rather than writing to the
 * database directly. Writing direct would mean the database connection string
 * living in GitHub's secrets — and anything reaching those could then read
 * every order, wage and customer this shop has. The token used here can write
 * one uptime row and do nothing else, so the worst a stolen one buys is a false
 * uptime figure.
 *
 * The cost of that choice is real and handled below: when the shop is down, the
 * place to file the reading is down too. So a failed check is retried for a few
 * minutes, and it is filed with the time the CHECK happened rather than the
 * time it landed — a "down" that arrives late is still a true record of when
 * the shop was down.
 *
 *   PROBE_URL           what to ask     (defaults to the production health URL)
 *   UPTIME_WRITE_URL    where to file it
 *   UPTIME_WRITE_TOKEN  the narrow token
 */

const PROBE_URL = process.env.PROBE_URL || "https://krishoe-website.vercel.app/api/health";
const WRITE_URL =
  process.env.UPTIME_WRITE_URL || new URL("/api/monitoring/uptime", PROBE_URL).toString();
const TOKEN = (process.env.UPTIME_WRITE_TOKEN || "").trim();

/**
 * Long enough that a slow cold start is not called an outage, short enough that
 * a hung request does not hold the job open. Vercel's function ceiling is ten
 * seconds, so fifteen means a timeout here is the site's fault, not ours.
 */
const TIMEOUT_MS = 15_000;

/** Roughly three minutes of retries, backing off. Most Vercel blips are shorter. */
const RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 45_000, 60_000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function probe() {
  const checkedAt = new Date().toISOString();
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

    // /api/health answers 503 when the database is unreachable, so a 200 here
    // means the whole path answered: edge, function, and Neon.
    return {
      checkedAt,
      status: response.ok ? "up" : "down",
      statusCode: response.status,
      responseTime: Date.now() - started,
      note: response.ok ? "" : `HTTP ${response.status}`,
    };
  } catch (error) {
    // No response at all — DNS, TLS, a timeout, or nothing listening. This is
    // the reading a checker inside the app can never take.
    return {
      checkedAt,
      status: "down",
      statusCode: 0,
      responseTime: Date.now() - started,
      note: error instanceof Error ? error.name : "unreachable",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function file(reading) {
  const response = await fetch(WRITE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ ...reading, region: "github-actions" }),
  });

  if (!response.ok) {
    throw new Error(`filing returned HTTP ${response.status}`);
  }
}

const reading = await probe();
console.log(
  `${reading.status.toUpperCase()}  ${reading.statusCode || "—"}  ${reading.responseTime}ms  ${PROBE_URL}${reading.note ? `  (${reading.note})` : ""}`,
);

if (!TOKEN) {
  console.error("No UPTIME_WRITE_TOKEN — the reading was taken but cannot be filed.");
  process.exit(1);
}

// The reading carries its own checkedAt, so a late-landing "down" is still a
// true record of when the shop was down.
for (let attempt = 0; ; attempt += 1) {
  try {
    await file(reading);
    console.log(`filed — ${reading.status} at ${reading.checkedAt}`);
    break;
  } catch (error) {
    if (attempt >= RETRY_DELAYS_MS.length) {
      // Out of retries. The shop has been unreachable for the whole window, so
      // there is nowhere to file this — and the gap it leaves in the readings
      // is itself the record. Said out loud rather than swallowed.
      console.error(`Could not file the reading: ${error.message}`);
      console.log(
        "::warning::KRISHOE was unreachable for the whole retry window — this outage shows as a gap in the readings.",
      );
      process.exit(1);
    }

    const wait = RETRY_DELAYS_MS[attempt];
    console.log(`  filing failed (${error.message}) — retrying in ${wait / 1000}s`);
    await sleep(wait);
  }
}

if (reading.status === "down") {
  console.log("::warning::KRISHOE did not answer this check.");
}
