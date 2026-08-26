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
