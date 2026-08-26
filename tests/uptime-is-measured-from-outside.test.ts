import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The thing that checks whether the shop is up does not live in the shop.
 *
 * This is the whole feature, and it is easy to undo by accident. The obvious
 * implementation — a Vercel cron that pings the site — cannot work: when the
 * site is down that cron does not run either, so it records a wall of "up" and
 * misses every outage. It would look like monitoring and measure nothing, which
 * is worse than the 0% this screen used to show, because 0% at least looked
 * wrong.
 *
 * The reading is written straight to Neon rather than posted back to the app,
 * for the same reason: sending "the site is down" to the site that is down
 * fails at exactly the moment it matters.
 */

const WORKFLOW = ".github/workflows/uptime.yml";
const PROBE = "scripts/uptime-probe.mjs";

describe("uptime is measured from outside", () => {
  it("runs on GitHub's machines, not Vercel's", () => {
    const workflow = readFileSync(WORKFLOW, "utf8");

    expect(workflow).toContain("runs-on: ubuntu-latest");
    expect(workflow).toContain("schedule:");
    // Often enough that a short outage is not invisible.
    expect(workflow).toContain('cron: "*/5 * * * *"');
    // And a person can ask right now without waiting for the schedule.
    expect(workflow).toContain("workflow_dispatch:");
  });

  it("is not scheduled inside the app, where it could not see an outage", () => {
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
    const paths: string[] = (vercel.crons ?? []).map((c: { path: string }) => c.path);

    // A Vercel cron pinging the site is the trap this whole design avoids.
    for (const path of paths) {
      expect(path, "no uptime cron inside Vercel").not.toMatch(/uptime|health|ping/i);
    }
  });

  it("never carries the database connection string", () => {
    const probe = readFileSync(PROBE, "utf8");
    const workflow = readFileSync(WORKFLOW, "utf8");

    // The blast radius of a stolen secret is the whole point here. DATABASE_URL
    // in GitHub would mean every order, wage and customer readable by anything
    // that reached those secrets. UPTIME_WRITE_TOKEN writes one row.
    expect(probe).not.toContain("DATABASE_URL");
    expect(workflow).not.toContain("DATABASE_URL");
    expect(workflow).toContain("UPTIME_WRITE_TOKEN");
    // And it pulls in no third-party code to do it — checked against the steps
    // that actually run, not the prose, which says the same thing in words.
    expect(workflow).not.toMatch(/^\s*run:\s*npm\b/m);
  });

  it("guards the door it files through", () => {
    const route = readFileSync("app/api/monitoring/uptime/route.ts", "utf8");

    // No token configured means no writing — silence, not a free door.
    expect(route).toContain("UPTIME_WRITE_TOKEN");
    expect(route).toContain("status: 503");
    expect(route).toContain("status: 401");
    // A plain === leaks the length of the correct prefix to anybody willing to
    // send a few thousand guesses.
    expect(route).toContain("timingSafeEqual");
    // One shape of row, one table, and nothing readable back out.
    expect(route).not.toMatch(/export async function GET/);
  });

  it("files a reading under the time it was taken, not the time it landed", () => {
    const probe = readFileSync(PROBE, "utf8");
    const monitoring = readFileSync("lib/monitoring.ts", "utf8");

    // A "down" reading cannot be filed until the shop comes back, so it lands
    // minutes late. Stamping it on arrival would record every outage as having
    // happened the moment it ended — the one time the timestamp matters.
    expect(probe).toContain("checkedAt");
    expect(probe).toContain("RETRY_DELAYS_MS");
    expect(monitoring).toContain("COALESCE($5::timestamptz, now())");
  });

  it("records a failure as a reading rather than as a broken job", () => {
    const probe = readFileSync(PROBE, "utf8");

    // A down site must still be written down. Exiting non-zero on "down" would
    // make GitHub retry or go red without ever recording what it saw.
    expect(probe).toContain('status: "down"');
    expect(probe).toContain("statusCode: 0");
    // No caching between the checker and the truth: a cached 200 from an edge
    // would report the site up while the app behind it was not.
    expect(probe).toContain('cache: "no-store"');
  });

  it("says nothing rather than 0% before the checker has ever run", () => {
    const monitoring = readFileSync("lib/monitoring.ts", "utf8");
    const evidence = monitoring.slice(monitoring.indexOf("export async function getUptimeEvidence"));

    // 0% and "never measured" are different facts, and printing the first for
    // the second is what this card was rewritten once already to stop doing.
    expect(evidence).toContain("checks > 0 ?");
    expect(evidence).toContain(": null");

    const dashboard = readFileSync("components/admin/MonitoringDashboard.tsx", "utf8");
    expect(dashboard).toContain("monitoring.uptime.outside.percent !== null");
    expect(dashboard).toContain("The outside check has not run yet");
  });

  it("keeps the shopper's own evidence beside the percentage", () => {
    const dashboard = readFileSync("components/admin/MonitoringDashboard.tsx", "utf8");

    // Two different questions. A perfect month of checks on a shop nobody
    // visits is not the same news as a real phone being served this minute.
    expect(dashboard).toContain("monitoring.uptime.outside.percent");
    expect(dashboard).toContain("monitoring.uptime.lastAnsweredAt");
  });
});
