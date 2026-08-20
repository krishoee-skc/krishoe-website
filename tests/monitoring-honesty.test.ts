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
    // Grey, so the eye stops reading it as a fault.
    expect(dashboard).toContain('"bg-gray-100 text-gray-600"');
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
  it("says it is unmeasured rather than calling zero percent Good", async () => {
    const dashboard = await readFile("components/admin/MonitoringDashboard.tsx", "utf8");

    // Nothing records uptime — the tables were never created — so the figure
    // was zero for want of measurement. Shown as "0.00% · Good", the same
    // screen would have said Good on the day the shop really was down.
    expect(dashboard).toContain("monitoring.uptime > 0");
    expect(dashboard).toContain("अझै नापिएको छैन");
    expect(dashboard).not.toContain('? "Excellent" : "Good"');
  });
});
