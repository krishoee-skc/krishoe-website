import { describe, expect, it } from "vitest";
import { tiktokPixelSnippet } from "@/lib/analytics-snippets";

const PIXEL_ID = "CT0BQ3ABC123XYZ";

type InsertedScript = { type?: string; async?: boolean; src?: string };

/**
 * Runs the vendor snippet against the smallest stub browser it needs.
 *
 * A mistyped character in minified third-party code does not fail a build or a
 * type-check — it throws in the visitor's browser, or worse, quietly does
 * nothing while an ad budget buys untracked clicks. Executing it here is the
 * only cheap way to know it still works.
 */
function runSnippet(pixelId: string) {
  const inserted: InsertedScript[] = [];
  const firstScript = { parentNode: { insertBefore: (node: InsertedScript) => inserted.push(node) } };
  const documentStub = {
    createElement: () => ({}) as InsertedScript,
    getElementsByTagName: () => [firstScript],
  };
  const windowStub: Record<string, unknown> = {};

  new Function("window", "document", tiktokPixelSnippet(pixelId))(windowStub, documentStub);

  return { inserted, windowStub };
}

describe("TikTok pixel snippet", () => {
  it("executes without throwing", () => {
    expect(() => runSnippet(PIXEL_ID)).not.toThrow();
  });

  it("installs the ttq queue that TikTok's SDK expects to find", () => {
    const { windowStub } = runSnippet(PIXEL_ID);

    expect(windowStub.TiktokAnalyticsObject).toBe("ttq");
    const ttq = windowStub.ttq as { load?: unknown; page?: unknown; track?: unknown };
    expect(typeof ttq.load).toBe("function");
    expect(typeof ttq.page).toBe("function");
    expect(typeof ttq.track).toBe("function");
  });

  it("loads the SDK for the configured pixel id", () => {
    const { inserted } = runSnippet(PIXEL_ID);

    expect(inserted).toHaveLength(1);
    expect(inserted[0]?.src).toBe(
      `https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${PIXEL_ID}&lib=ttq`,
    );
    expect(inserted[0]?.async).toBe(true);
  });

  it("records the opening page view", () => {
    const { windowStub } = runSnippet(PIXEL_ID);
    const queued = windowStub.ttq as unknown[];

    // Calls made before the SDK arrives are queued as [method, ...args].
    expect(queued.some((entry) => Array.isArray(entry) && entry[0] === "page")).toBe(true);
  });

  it("keeps the id out of the snippet when no id is configured", () => {
    expect(tiktokPixelSnippet("")).toContain("ttq.load('');");
  });
});
