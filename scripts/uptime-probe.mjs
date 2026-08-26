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
 *
 * And it tells the owner. See scripts/uptime-alert.mjs — the alert is sent from
 * here, before the filing is even attempted, because filing needs the shop to
 * answer and the alert is for when it does not.
 */

import { env, sendUptimeAlert } from "./uptime-alert.mjs";

// env(), not process.env: these are pasted into GitHub by hand out of a file
// where every value is quoted, and the quotes come with them. A write token
// carrying them is a token that does not match — the reading is refused 401 and
// the outage it described is lost, quietly, which is the failure this whole
// file exists to prevent. See scripts/uptime-alert.mjs.
const PROBE_URL = env("PROBE_URL") || "https://krishoe-website.vercel.app/api/health";
const WRITE_URL =
  env("UPTIME_WRITE_URL") || new URL("/api/monitoring/uptime", PROBE_URL).toString();
const TOKEN = env("UPTIME_WRITE_TOKEN");

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

  // What the shop was before this reading landed, so an "up" that follows a
  // "down" can be recognised as a recovery. Absent on an older deployment that
  // does not answer with it yet, which simply means no recovery message.
  return await response.json().catch(() => ({}));
}

/**
 * The whole check, so a finished path can simply return.
 *
 * process.exit() was how this ended, and on Windows it aborts the process
 * mid-flight: the fetch that just sent the alert still has a socket closing,
 * and exiting through it trips a libuv assertion — the message goes out and
 * the run still reports a crash. Returning a code and letting Node close its
 * own handles ends the same way on every machine.
 */
async function main() {
  /**
   * Prove the alert works, on a day nothing is wrong.
   *
   * A shop that is up sends no alert, so the only thing that ever tests this
   * path is a real outage — and finding out then that a secret was pasted wrong
   * is finding out too late. Pressing "Send a test alert" in the Actions tab
   * sends one now.
   *
   * It deliberately files nothing. Writing a "down" row to prove the message
   * works would put a false outage into the uptime figure the owner is meant to
   * trust, which is a strange price to pay for a test.
   */
  if (env("UPTIME_TEST_ALERT").toLowerCase() === "true") {
    console.log("Test alert requested — sending, and filing nothing.");
    const results = await sendUptimeAlert({
      state: "down",
      url: `${PROBE_URL}  ·  TEST — पसल ठीकै छ / the shop is fine`,
      statusCode: 0,
      error: "TEST — यो जाँच मात्र हो / this is only a test",
    });

    const sent = results.filter((result) => result.sent).map((result) => result.channel);
    if (sent.length === 0) {
      // Named, because "add the secrets" is the same unhelpful shape as "the
      // shop is down": true, and no use to the person reading it. A secret can
      // be missing three ways that look identical from here — pasted into the
      // Variables tab instead of Secrets, saved under an Environment the job
      // does not use, or spelled differently — and all three arrive as an
      // empty string. Saying which name came through empty is what separates
      // them.
      const missing = results.flatMap((result) => result.missing ?? []);

      // A channel that was configured and still did not send failed for a
      // reason of its own — a rejected key, an unverified sender, a provider
      // that was itself down. That reason was going to console.error, which is
      // an ordinary log line: the owner reads the Annotations box at the top of
      // the run and never saw it. Raised to an annotation, because a diagnosis
      // nobody is shown is not a diagnosis.
      for (const failure of results.filter(
        (result) => !result.sent && result.reason !== "not configured",
      )) {
        console.log(`::error::${failure.channel} was configured but refused: ${failure.reason}`);
      }

      if (missing.length > 0) {
        console.log(`::error::Empty in this job: ${missing.join(", ")}`);
        console.log(
          "::error::Add them as repository SECRETS (not Variables) at Settings → Secrets and variables → Actions → New repository secret. The names must match exactly.",
        );
      }

      console.log("::error::No test alert was sent.");
      return 1;
    }

    console.log(`::notice::Test alert sent by ${sent.join(" and ")}. Nothing was filed.`);
    return 0;
  }

  const reading = await probe();
  console.log(
    `${reading.status.toUpperCase()}  ${reading.statusCode || "—"}  ${reading.responseTime}ms  ${PROBE_URL}${reading.note ? `  (${reading.note})` : ""}`,
  );

  // Told BEFORE the filing is attempted, and whether or not filing ever
  // succeeds. Filing needs the shop to answer; the alert exists precisely for
  // when it does not. Sending it first is what makes a long outage loud instead
  // of silent — waiting for a row to be written would mean the four-hour
  // failures, the only ones that really cost a customer, are the ones nobody is
  // told about.
  if (reading.status === "down") {
    console.log("::warning::KRISHOE did not answer this check.");
    const alerts = await sendUptimeAlert({
      state: "down",
      url: PROBE_URL,
      statusCode: reading.statusCode,
      error: reading.note,
    });

    // The shop is down and the owner was not told. Said loudly, because the
    // quiet version of this is the whole failure the alert exists to prevent,
    // wearing a different hat: nobody knows, and nothing says so.
    if (!alerts.some((alert) => alert.sent)) {
      console.log(
        "::error::KRISHOE is DOWN and no alert could be sent. Run this workflow with 'Send a test alert' to see which setting is wrong.",
      );
    }
  }

  if (!TOKEN) {
    console.error("No UPTIME_WRITE_TOKEN — the reading was taken but cannot be filed.");
    return 1;
  }

  // The reading carries its own checkedAt, so a late-landing "down" is still a
  // true record of when the shop was down.
  for (let attempt = 0; ; attempt += 1) {
    try {
      const filed = await file(reading);
      console.log(`filed — ${reading.status} at ${reading.checkedAt}`);

      // Answering again after a failure. Worth a message of its own: an owner who
      // was told the shop was down should not have to keep checking to find out
      // it came back, and how long it lasted is the number they will want.
      if (reading.status === "up" && filed?.previousStatus === "down") {
        await sendUptimeAlert({
          state: "up",
          url: PROBE_URL,
          downSince: filed.downSince,
        });
      }
      break;
    } catch (error) {
      if (attempt >= RETRY_DELAYS_MS.length) {
        // Out of retries. The shop has been unreachable for the whole window, so
        // there is nowhere to file this — and the gap it leaves in the readings
        // is itself the record. Said out loud rather than swallowed. The owner
        // has already been told, above.
        console.error(`Could not file the reading: ${error.message}`);
        console.log(
          "::warning::KRISHOE was unreachable for the whole retry window — this outage shows as a gap in the readings.",
        );
        return 1;
      }

      const wait = RETRY_DELAYS_MS[attempt];
      console.log(`  filing failed (${error.message}) — retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }

  return 0;
}

process.exitCode = await main();
