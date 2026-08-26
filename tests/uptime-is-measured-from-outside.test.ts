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

  it("writes the reading to the database, not through the app", () => {
    const probe = readFileSync(PROBE, "utf8");

    // Straight to Neon. Posting to the site that is down is the one moment the
    // recording would fail.
    expect(probe).toContain("INSERT INTO monitoring_uptime");
    expect(probe).toContain("DATABASE_URL");
    expect(probe).not.toMatch(/fetch\([^)]*\/api\/(monitoring|uptime)/);
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
