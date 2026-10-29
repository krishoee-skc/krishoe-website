import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// React error #418 on Dashboard and Stock (owner, 2026-10-25) had two causes.
// The first, a remembered menu side read during the first render, left with
// the side switch itself (2026-10-29): the simple menu has no side to remember.

// The same error #418, its other cause: the service worker served the app's
// scripts cache-first, so they ran before the page's HTML had all arrived.
describe("the service worker and the app's own scripts", () => {
  it("leaves /_next/static to the browser's cache", () => {
    const worker = readFileSync("public/sw.js", "utf8");
    const fetchHandler = worker.slice(worker.indexOf('self.addEventListener("fetch"'));
    const leave = fetchHandler.indexOf('if (url.pathname.startsWith("/_next/static/")) return;');
    expect(leave).toBeGreaterThan(-1);
    // Before the cache-first branch, so a script never reaches it.
    expect(leave).toBeLessThan(fetchHandler.indexOf("caches.match(request)"));
  });
});
