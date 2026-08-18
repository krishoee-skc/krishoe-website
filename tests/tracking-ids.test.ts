import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Which advertising tags the shop runs, and where.
 *
 * The Meta pixel id lives in the code because it is not a secret — it ships in
 * the HTML of every page. That convenience buys one hazard, which is the thing
 * these tests exist for: with the id compiled in, anyone running the shop
 * locally would send real AddToCart and Purchase events into the live ad
 * account. Meta does not merely display those, it bids on what it learns from
 * them, so an afternoon of clicking through checkout would spend the owner's
 * money chasing the wrong buyers.
 */

const KEYS = [
  "NEXT_PUBLIC_META_PIXEL_ID",
  "NEXT_PUBLIC_GA4_ID",
  "NEXT_PUBLIC_TIKTOK_PIXEL_ID",
] as const;

const ORIGINAL = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

async function load() {
  vi.resetModules();
  return import("@/lib/tracking-ids");
}

beforeEach(() => {
  for (const key of KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of KEYS) {
    const value = ORIGINAL[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("the shop's own tracking ids", () => {
  it("ships the KRISHOE Meta pixel without needing a variable set", async () => {
    const { configuredTrackingIds } = await load();
    expect(configuredTrackingIds().meta).toBe("2120035412198709");
  });

  it("lets a deployment override it", async () => {
    // Anyone running a copy of this site must be able to keep their traffic out
    // of KRISHOE's advertising account.
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "9999999999999999";
    const { configuredTrackingIds } = await load();
    expect(configuredTrackingIds().meta).toBe("9999999999999999");
  });

  it("treats a blank override as no override, not as switching the pixel off", async () => {
    // A variable created in a hosting dashboard and left empty is the normal
    // way this ends up as "", and it must not silently stop the measurement.
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "";
    const { configuredTrackingIds } = await load();
    expect(configuredTrackingIds().meta).toBe("2120035412198709");
  });

  it("trims padding, which a pasted value usually carries", async () => {
    process.env.NEXT_PUBLIC_GA4_ID = "  G-GQ6KLH97N4\n";
    const { configuredTrackingIds } = await load();
    expect(configuredTrackingIds().ga4).toBe("G-GQ6KLH97N4");
  });

  it("reports a tracker with no id as empty rather than guessing one", async () => {
    const { configuredTrackingIds } = await load();
    expect(configuredTrackingIds().ga4).toBe("");
    expect(configuredTrackingIds().tiktok).toBe("");
  });
});

describe("what actually fires", () => {
  it("sends nothing at all outside production", async () => {
    process.env.NEXT_PUBLIC_GA4_ID = "G-GQ6KLH97N4";
    vi.stubEnv("NODE_ENV", "development");

    const { activeTrackingIds } = await load();
    expect(activeTrackingIds()).toEqual({ meta: "", ga4: "", tiktok: "" });
  });

  it("sends the real ids in production", async () => {
    process.env.NEXT_PUBLIC_GA4_ID = "G-GQ6KLH97N4";
    vi.stubEnv("NODE_ENV", "production");

    const { activeTrackingIds } = await load();
    expect(activeTrackingIds()).toEqual({
      meta: "2120035412198709",
      ga4: "G-GQ6KLH97N4",
      tiktok: "",
    });
  });

  it("still reports the setup as configured while developing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { configuredTrackingIds } = await load();

    // The admin page answers "is the pixel installed?", which is a question
    // about production. Answering it from the local environment would tell the
    // owner their pixel is missing when it is live.
    expect(configuredTrackingIds().meta).toBe("2120035412198709");
  });
});
