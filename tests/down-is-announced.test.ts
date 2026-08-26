import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import { alertMessage, sendUptimeAlert } from "../scripts/uptime-alert.mjs";

/**
 * Uptime was measured and never mentioned.
 *
 * The checker filed a row and stopped. Nobody was told, so the owner learned
 * the shop was down by opening /admin/monitoring and looking — which is to say,
 * after the customers had already found out.
 *
 * These hold the two things that make the alert actually arrive: it is sent
 * from outside the shop, and it is sent before anything that needs the shop to
 * answer.
 */

describe("the alert leaves from outside the shop", () => {
  it("goes out before the reading is filed", async () => {
    const probe = await readFile("scripts/uptime-probe.mjs", "utf8");

    const alertedAt = probe.indexOf('state: "down"');
    const filedAt = probe.indexOf("await file(reading)");

    expect(alertedAt).toBeGreaterThan(-1);
    expect(filedAt).toBeGreaterThan(-1);
    // Filing needs the shop to answer. If the alert waited for it, the outages
    // long enough to exhaust the retries — the only ones that cost a customer —
    // would be the ones nobody hears about.
    expect(alertedAt).toBeLessThan(filedAt);
  });

  it("is not gated on the write token", async () => {
    const probe = await readFile("scripts/uptime-probe.mjs", "utf8");

    const alertedAt = probe.indexOf('state: "down"');
    const tokenExit = probe.indexOf("No UPTIME_WRITE_TOKEN");

    // A missing filing token must not also cost the owner the message.
    expect(alertedAt).toBeLessThan(tokenExit);
  });

  it("installs nothing to send it", async () => {
    const alert = await readFile("scripts/uptime-alert.mjs", "utf8");

    // The job runs every twenty minutes and pulls in no third-party code — see
    // the workflow. Reaching for the twilio package here would undo that, and
    // put someone else's code next to these secrets.
    expect(alert).not.toMatch(/from\s+["']twilio["']/);
    expect(alert).toContain("api.twilio.com");
  });
});

describe("what the owner is handed at three in the morning", () => {
  it("says the shop is down, in both languages", () => {
    const { subject, body } = alertMessage({
      state: "down",
      url: "https://krishoe-website.vercel.app/api/health",
      statusCode: 503,
    });

    expect(subject).toContain("KRISHOE");
    expect(body).toContain("पसल");
    expect(body).toContain("Customers cannot open the shop");
  });

  it("gives the address, the cause and the next step", () => {
    const { body } = alertMessage({
      state: "down",
      url: "https://krishoe-website.vercel.app/api/health",
      statusCode: 503,
    });

    expect(body).toContain("https://krishoe-website.vercel.app/api/health");
    expect(body).toContain("HTTP 503");
    // "KRISHOE is down" with nothing to do about it is worry, not information.
    expect(body).toContain("vercel.com/dashboard");
  });

  it("names the cause when there was no answer at all", () => {
    const { body } = alertMessage({
      state: "down",
      url: "https://example.test/api/health",
      statusCode: 0,
      error: "TimeoutError",
    });

    expect(body).toContain("TimeoutError");
    expect(body).not.toContain("HTTP 0");
  });

  it("reads the clock in Kathmandu", () => {
    const { body } = alertMessage({ state: "down", url: "https://example.test", statusCode: 500 });

    expect(body).toContain("Kathmandu");
  });

  it("says when it comes back, and for how long it was gone", () => {
    const { subject, body } = alertMessage({
      state: "up",
      url: "https://example.test",
      downSince: new Date(Date.now() - 95 * 60_000).toISOString(),
    });

    expect(subject).toContain("back");
    expect(body).toContain("95");
    expect(body).toContain("minutes");
  });

  it("does not invent a duration it was never given", () => {
    const { body } = alertMessage({ state: "up", url: "https://example.test" });

    expect(body).not.toContain("minutes");
  });
});

describe("a channel with no secrets", () => {
  const KEYS = [
    "EMAIL_PROVIDER_URL",
    "EMAIL_PROVIDER_TOKEN",
    "ALERT_EMAIL_TO",
    "ADMIN_NOTIFICATION_EMAIL",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_WHATSAPP_NUMBER",
    "WHATSAPP_ADMIN_NUMBER",
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("is skipped rather than failed", async () => {
    // The shop starts with email and adds WhatsApp when the Twilio account
    // exists. An unconfigured channel that threw would take the whole check
    // down with it — losing the reading as well as the message.
    const results = await sendUptimeAlert({ state: "down", url: "https://example.test", statusCode: 500 });

    expect(results.every((result) => result.sent === false)).toBe(true);
    expect(results.map((result) => result.reason)).toEqual(["not configured", "not configured"]);
  });
});

/**
 * Proving the alert works on a day nothing is wrong.
 *
 * Until this existed, the only thing that exercised the alert path was a real
 * outage — so a secret pasted wrong stayed wrong until the night it mattered.
 */
describe("the test alert", () => {
  it("files nothing", async () => {
    const probe = await readFile("scripts/uptime-probe.mjs", "utf8");
    const testBlock = probe.slice(
      probe.indexOf("UPTIME_TEST_ALERT"),
      probe.indexOf("const reading = await probe()"),
    );

    // A "down" row written to prove the message works would put a false outage
    // into the uptime figure the owner is meant to trust.
    expect(testBlock).not.toContain("await file(");
    // Returns rather than process.exit(): exiting through the socket the alert
    // just used aborts the process on Windows, so the message goes out and the
    // run still reports a crash.
    expect(testBlock).toContain("return 0;");
  });

  it("ends without process.exit, which crashes on the way out", async () => {
    const probe = await readFile("scripts/uptime-probe.mjs", "utf8");

    // As a statement, not as the comment above main() explaining why it went.
    expect(probe).not.toMatch(/^\s*process\.exit\(/m);
    expect(probe).toContain("process.exitCode = await main();");
  });

  it("says so plainly in the message", async () => {
    const probe = await readFile("scripts/uptime-probe.mjs", "utf8");

    // Read on a phone, it must not be mistaken for the real thing.
    expect(probe).toContain("TEST — पसल ठीकै छ");
  });

  it("fails the run when nothing could be sent", async () => {
    const probe = await readFile("scripts/uptime-probe.mjs", "utf8");
    const testBlock = probe.slice(
      probe.indexOf("UPTIME_TEST_ALERT"),
      probe.indexOf("const reading = await probe()"),
    );

    // The whole point is finding out. A green tick and no email would say the
    // secrets are fine when they are missing.
    expect(testBlock).toContain("::error::");
    expect(testBlock).toContain("return 1;");
  });

  it("is offered as a button on the workflow", async () => {
    const workflow = await readFile(".github/workflows/uptime.yml", "utf8");

    expect(workflow).toContain("send_test_alert");
    expect(workflow).toContain("UPTIME_TEST_ALERT: ${{ inputs.send_test_alert }}");
  });
});

/**
 * The first test run came back red saying only "No test alert was sent", which
 * is true and no use: a secret can be absent three ways that look identical
 * from inside the job — pasted into the Variables tab instead of Secrets, saved
 * under an Environment the job does not use, or spelled differently — and all
 * three arrive as an empty string.
 */
describe("when a secret has not arrived", () => {
  const KEYS = [
    "EMAIL_PROVIDER_URL",
    "EMAIL_PROVIDER_TOKEN",
    "ALERT_EMAIL_TO",
    "ADMIN_NOTIFICATION_EMAIL",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_WHATSAPP_NUMBER",
    "WHATSAPP_ADMIN_NUMBER",
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("names the ones that came through empty", async () => {
    const results = await sendUptimeAlert({ state: "down", url: "https://example.test", statusCode: 500 });
    const missing = results.flatMap((result) => result.missing ?? []);

    expect(missing).toContain("EMAIL_PROVIDER_URL");
    expect(missing).toContain("ALERT_EMAIL_TO");
    expect(missing).toContain("TWILIO_ACCOUNT_SID");
  });

  it("names only the empty ones", async () => {
    process.env.EMAIL_PROVIDER_URL = "https://api.brevo.com/v3/smtp/email";
    const results = await sendUptimeAlert({ state: "down", url: "https://example.test", statusCode: 500 });
    const missing = results.flatMap((result) => result.missing ?? []);

    expect(missing).not.toContain("EMAIL_PROVIDER_URL");
    expect(missing).toContain("ALERT_EMAIL_TO");
  });

  it("never puts a value in the log, only a name", async () => {
    const alert = await readFile("scripts/uptime-alert.mjs", "utf8");
    const probe = await readFile("scripts/uptime-probe.mjs", "utf8");

    // A build log is readable by anyone with access to the repository. Echoing
    // a key back to diagnose it would be a worse problem than the one being
    // diagnosed, so what is printed is `missing` — names the code chose, never
    // anything read out of the environment.
    for (const source of [alert, probe]) {
      expect(source).not.toMatch(/console\.(log|error)\([^)]*env\(/);
      expect(source).not.toMatch(/console\.(log|error)\([^)]*process\.env/);
    }
    expect(probe).toContain("Empty in this job:");
  });
});
