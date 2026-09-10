import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The floor under the whole shop.
 *
 * Next.js 16.3.0 through 16.3.2 carried an unauthenticated remote code
 * execution hole in the Image Optimization API, reachable through AVIF — and
 * this app has AVIF switched on in next.config.ts, so it was reachable here.
 * "Unauthenticated" means nobody had to log in: a stranger could have run their
 * own code on the shop's server. It is the most serious kind of hole there is,
 * and it sat under an app that is otherwise carefully built.
 *
 * Everything else in this repo is guarded by a test. The floor was not, so it
 * drifted three patch releases behind without anything saying so. This is that
 * missing test: the version is pinned above the advisory, and the two settings
 * that decide whether the hole is reachable are stated out loud.
 *
 * When Next.js is upgraded, raise MINIMUM here too — deliberately, having read
 * what changed, rather than letting the floor drift again.
 */
const MINIMUM = [16, 3, 3] as const;

/** [major, minor, patch] from a version string, ignoring any range prefix. */
function parts(version: string): [number, number, number] {
  const match = version.replace(/^[\^~>=<\s]+/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`cannot read a version out of "${version}"`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function atLeast(version: string, floor: readonly [number, number, number]) {
  const [a, b, c] = parts(version);
  const [x, y, z] = floor;
  if (a !== x) return a > x;
  if (b !== y) return b > y;
  return c >= z;
}

describe("the version of Next.js the shop runs on", () => {
  it("is above the release that fixed the image RCE", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8"));
    const declared: string = pkg.dependencies.next;

    expect(
      atLeast(declared, MINIMUM),
      `package.json asks for next@${declared}; ${MINIMUM.join(".")} is the first release without the ` +
        "unauthenticated RCE in the Image Optimization API (GHSA-2xp9-vwfh-vxw4)",
    ).toBe(true);
  });

  it("is what is actually installed, not only what is asked for", async () => {
    // A caret range can resolve to anything; the lockfile is what ships.
    const installed = JSON.parse(await readFile("node_modules/next/package.json", "utf8"));

    expect(
      atLeast(installed.version, MINIMUM),
      `next ${installed.version} is installed, below the patched ${MINIMUM.join(".")}`,
    ).toBe(true);
  });
});

describe("why that version mattered here", () => {
  it("records that AVIF is on, which is what made the hole reachable", async () => {
    const config = await readFile("next.config.ts", "utf8").catch(() =>
      readFile("next.config.js", "utf8"),
    );

    // Turning AVIF off would also close it. This test does not demand either
    // choice — it fails loudly if the setting changes, so whoever changes it
    // reads this note and knows which risk they are moving.
    expect(config).toContain("image/avif");
  });
});

describe("the packages under the shop", () => {
  it("holds qs above the version with the parsing flaws", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8"));

    // Reached through twilio, which sends the shop's WhatsApp and SMS. Twilio 6
    // is a major version and a bigger risk than the flaw; an override lifts the
    // one package that needed lifting.
    expect(pkg.overrides?.qs).toBeTruthy();
    expect(atLeast(String(pkg.overrides.qs), [6, 16, 0])).toBe(true);
  });

  it("holds sharp above the libheif advisory", async () => {
    const installed = JSON.parse(await readFile("node_modules/sharp/package.json", "utf8"));

    // sharp resizes every product photo the shop uploads.
    expect(atLeast(installed.version, [0, 35, 4])).toBe(true);
  });
});
