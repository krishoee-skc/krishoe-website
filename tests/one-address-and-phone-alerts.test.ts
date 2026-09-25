import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { pushEnvironment, type DeviceFacts } from "@/lib/push-environment";

const require = createRequire(import.meta.url);

/**
 * The owner signed in on Vercel's address for the project, added that to the
 * Home Screen, and met a stranger at krishoe.com. And on an iPhone the alert
 * card said only "This browser does not give notifications" — in Safari, in
 * Chrome, from a WhatsApp link — while the one place alerts work, the Home
 * Screen icon, was a clause at the end.
 */

describe("one address for the shop", () => {
  it("sends every page on Vercel's address to krishoe.com, and nothing else", async () => {
    const config = require("../next.config.js");
    const [rule] = await config.redirects();
    expect(rule.has).toEqual([{ type: "host", value: "krishoe-website\\.vercel\\.app" }]);
    expect(rule.destination).toBe("https://www.krishoe.com/:path");
    expect(rule.permanent).toBe(true);
  });

  it("leaves /api alone, so nightly jobs and payment callbacks are never redirected", async () => {
    const config = require("../next.config.js");
    const [rule] = await config.redirects();
    expect(rule.source).toBe("/:path((?!api(?:/|$)).*)");
    // The pattern inside :path(...), as the router applies it to the path.
    const inner = rule.source.slice("/:path(".length, -1);
    const allowed = (value: string) => new RegExp(`^/${inner}$`).test(value);
    expect(allowed("/admin/notifications")).toBe(true);
    expect(allowed("/")).toBe(true);
    expect(allowed("/apiary")).toBe(true);
    expect(allowed("/api")).toBe(false);
    expect(allowed("/api/cron/daily-sales")).toBe(false);
  });
});

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36";
const facts = (overrides: Partial<DeviceFacts>): DeviceFacts => ({
  userAgent: ANDROID,
  platform: "Linux armv8l",
  maxTouchPoints: 5,
  standalone: false,
  hasPush: true,
  ...overrides,
});

describe("the alert card knows where it is", () => {
  it("in iPhone Safari or Chrome, shows the way to the Home Screen", () => {
    expect(pushEnvironment(facts({ userAgent: IPHONE, platform: "iPhone" }))).toBe("iphone-browser");
    // Even if Safari shows the push objects: a tab subscription never delivers.
    expect(pushEnvironment(facts({ userAgent: IPHONE, platform: "iPhone", hasPush: true }))).toBe("iphone-browser");
  });

  it("knows an iPad that calls itself a Mac", () => {
    const ipad = facts({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", platform: "MacIntel", maxTouchPoints: 5 });
    expect(pushEnvironment(ipad)).toBe("iphone-browser");
    expect(pushEnvironment({ ...ipad, maxTouchPoints: 0 })).toBe("ready");
  });

  it("in the iPhone Home Screen app, can turn on — or asks for an update on an old iOS", () => {
    expect(pushEnvironment(facts({ userAgent: IPHONE, platform: "iPhone", standalone: true }))).toBe("ready-iphone-app");
    expect(pushEnvironment(facts({ userAgent: IPHONE, platform: "iPhone", standalone: true, hasPush: false }))).toBe("iphone-update");
  });

  it("on Android and computers, can turn on", () => {
    expect(pushEnvironment(facts({}))).toBe("ready");
    expect(pushEnvironment(facts({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0", platform: "Win32", maxTouchPoints: 0 }))).toBe("ready");
  });

  it("inside Facebook, Instagram or Messenger, asks for a real browser", () => {
    expect(pushEnvironment(facts({ userAgent: `${ANDROID} [FBAN/FB4A;FBAV/470.0]` }))).toBe("in-app");
    expect(pushEnvironment(facts({ userAgent: `${IPHONE} Instagram 300.0` }))).toBe("in-app");
  });

  it("registers the alert worker itself when admin was opened without the shop", async () => {
    const card = await readFile("components/admin/PushNotificationSetup.tsx", "utf8");
    expect(card).toContain('navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })');
    expect(card).toContain("const registration = await alertWorker();");
  });
});
