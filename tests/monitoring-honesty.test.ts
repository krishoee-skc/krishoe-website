import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the monitoring screen is allowed to claim.
 *
 * It showed Email, SMS and Cache in alarming red, and not one of them was
 * broken. Email had been sending the whole time — the check read
 * BREVO_API_KEY, which is the key for reading delivery statistics, not the one
 * that sends anything. SMS and Cache were red for services the shop never
 * bought.
 *
 * A dashboard that cries outage over things that are fine teaches its reader to
 * ignore red, which is the one thing a health screen must never do.
 */

const ORIGINAL = { ...process.env };

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network in tests")));
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("what red means", () => {
  it("reserves it for something configured that failed", async () => {
    const dashboard = await readFile("components/admin/MonitoringDashboard.tsx", "utf8");

    expect(dashboard).toContain('status === "off"');
    expect(dashboard).toContain("Not set up");
    // Quiet, so the eye stops reading it as a fault — and quiet in the
    // brand's own neutrals now, not in a borrowed grey.
    expect(dashboard).toContain('"bg-brand-mist text-brand-muted"');
    expect(dashboard).toContain('"bg-red-100 text-red-700"');
  });

  it("checks the variable that actually sends email", async () => {
    const source = await readFile("lib/monitoring.ts", "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    // BREVO_API_KEY reads statistics. EMAIL_PROVIDER_URL is what notifications
    // send through, and it has been set the whole time.
    expect(code).toContain("EMAIL_PROVIDER_URL");
    expect(code).not.toContain("BREVO_API_KEY");
  });

  it("goes and looks at the cache rather than assuming an answer", async () => {
    const source = await readFile("lib/monitoring.ts", "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

    // `cache: "off"` was a hard-coded value that had never looked at anything,
    // and it read on the dashboard as a service the shop had failed to buy.
    // The shop's pages are prerendered and served from Vercel's edge cache —
    // /shop answers from it — so the honest report is whatever that cache says
    // when asked.
    expect(code).toContain("x-vercel-cache");
    expect(code).toContain("cacheStatusFromHeader");
  });

  it("calls an unconfigured service off, not down", async () => {
    delete process.env.EMAIL_PROVIDER_URL;
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.BLOB_READ_WRITE_TOKEN;
    vi.resetModules();

    const { checkSystemHealth } = await import("@/lib/monitoring");
    const health = await checkSystemHealth();

    expect(health.sms).toBe("off");
    expect(health.email).toBe("off");
    expect(health.storage).toBe("off");
  });

  it("calls a configured service up", async () => {
    process.env.EMAIL_PROVIDER_URL = "https://api.brevo.com/v3/smtp/email";
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    vi.resetModules();

    const { checkSystemHealth } = await import("@/lib/monitoring");
    const health = await checkSystemHealth();

    expect(health.email).toBe("up");
    expect(health.sms).toBe("up");
  });

  it("treats whitespace as unset, the way a pasted value arrives", async () => {
    process.env.EMAIL_PROVIDER_URL = "   ";
    vi.resetModules();

    const { checkSystemHealth } = await import("@/lib/monitoring");
    expect((await checkSystemHealth()).email).toBe("off");
  });
});

describe("uptime", () => {
  it("never grades a shop whose uptime it has not measured", async () => {
    const dashboard = await readFile("components/admin/MonitoringDashboard.tsx", "utf8");

    // This first said "0.00% · Good" — the same screen would have read Good on
    // the day the shop was actually down. Then it said "अझै नापिएको छैन", which
    // was honest but useless. There is no grade on it at all now: the card
    // reports when a browser last got an answer, and the tests below hold that
    // shape. What must never come back is a verdict on an unmeasured number.
    expect(dashboard).not.toContain('? "Excellent" : "Good"');
    expect(dashboard).not.toContain('"Excellent" : "Needs attention"');
  });
});

/**
 * The uptime figure was a lie of a particular kind: not wrong, unmeasured.
 *
 * The screen said "Uptime (30 days)" and a percentage. `recordUptimeCheck`
 * exists and is called from nowhere, and `monitoring_uptime` holds zero rows —
 * so the number was 0 for want of measurement, and 0% under a badge is the
 * worst possible reading of "we never looked".
 *
 * The obvious fix is worse than the problem, which is why it is worth a test.
 * A cron pinging the site from inside Vercel cannot observe Vercel being down:
 * when the site is down the cron does not run either. It would record a wall of
 * "up" and miss every outage — a second lie, this time wearing a measurement's
 * clothes.
 */
describe("what the shop can honestly say about being up", () => {
  it("reports evidence rather than a percentage nobody measured", async () => {
    const monitoring = await readFile("lib/monitoring.ts", "utf8");
    const route = await readFile("app/api/admin/monitoring/route.ts", "utf8");

    expect(monitoring).toContain("export async function getUptimeEvidence");
    expect(route).toContain("getUptimeEvidence");
    // The percentage reader is not wired to anything any more.
    expect(route).not.toContain("getUptimePercentage");
  });

  it("counts a real browser answering, not a machine pinging itself", async () => {
    const monitoring = await readFile("lib/monitoring.ts", "utf8");
    const evidence = monitoring.slice(monitoring.indexOf("export async function getUptimeEvidence"));

    // Every performance reading is a shopper's own browser confirming the site
    // answered at that moment. That is the only "up" this shop can prove.
    expect(evidence).toContain("FROM monitoring_performance");
    expect(evidence).toContain("monitoring_errors");
  });

  it("never invents a percentage from what it holds", async () => {
    const dashboard = await readFile("components/admin/MonitoringDashboard.tsx", "utf8");
    const card = dashboard.slice(
      dashboard.indexOf("जवाफ दिइरहेको छ?"),
      dashboard.indexOf("जवाफ दिइरहेको छ?") + 2000,
    );

    // A share of readings is not a share of minutes: there is no counting the
    // minutes nobody was looking.
    expect(card).not.toContain("toFixed(2)");
    expect(card).not.toContain("99.9");
  });

  it("says plainly what it cannot know", async () => {
    const dashboard = await readFile("components/admin/MonitoringDashboard.tsx", "utf8");

    // The recommendation used to advise on the invented number. It now names
    // the gap instead, and points at the only thing that closes it.
    expect(dashboard).toContain("बाहिरबाट जाँच्ने कोही छैन");
    expect(dashboard).toContain("UptimeRobot");
  });

  it("shows the age of the answer, not a timestamp to subtract", async () => {
    const dashboard = await readFile("components/admin/MonitoringDashboard.tsx", "utf8");

    // "6 मिनेटअघि" answers the question. A clock time makes the reader do
    // arithmetic across the 5h45m between Kathmandu and the server.
    expect(dashboard).toContain("function minutesAgo");
    expect(dashboard).toContain("मिनेटअघि");
  });
});
