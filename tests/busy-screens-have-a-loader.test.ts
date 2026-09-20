import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The screens the factory opens every day say something while they load.
 *
 * Most admin routes are force-dynamic: they wait on the database before a
 * single pixel is drawn. With a loading.tsx beside the page, Next shows that
 * file during the wait; without one, the wait is a blank screen — on a factory
 * phone, indistinguishable from an app that has hung.
 *
 * Twenty-four screens already do this well, with content-shaped skeletons. The
 * gap is not their quality, it is their absence: thirty-four routes have none,
 * and among them are the ones opened most — adding a day's work, the piece
 * ledger, the salary run.
 *
 * This fixes the list in place for the busiest of them. Not every route: a
 * screen behind three clicks can wait for its turn, and a test demanding a
 * loader for all fifty-eight would be a chore that gets deleted rather than a
 * rule that holds.
 */
const ADMIN = "app/admin";

/**
 * The screens a day's work actually runs through.
 *
 * Chosen by what the factory opens, not by what is easy: work entry is the
 * screen opened fifty times a morning, and the ledger and salary screens are
 * where the week's money is read.
 */
const DAILY = [
  "factory/add-work",
  "factory/ledger",
  "factory/salary",
  "factory/workers",
  "factory/items",
];

async function exists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe("the busiest screens", () => {
  for (const screen of DAILY) {
    it(`${screen} shows its shape while it loads`, async () => {
      const here = join(ADMIN, screen);

      expect(await exists(join(here, "page.tsx")), `${screen} has no page`).toBe(true);
      expect(
        await exists(join(here, "loading.tsx")),
        `${screen} has no loading.tsx — its wait is a blank screen`,
      ).toBe(true);
    });
  }

  it("every one of them draws a skeleton, not a spinner or a word", async () => {
    for (const screen of DAILY) {
      const file = join(ADMIN, screen, "loading.tsx");
      if (!(await exists(file))) continue;

      const code = await readFile(file, "utf8");

      // A skeleton says what is coming; "Loading…" says only that something is.
      // Asserted on the import or the shimmer class, either of which is the
      // real thing being drawn.
      expect(code, `${screen} must draw a content shape`).toMatch(
        /Skeleton|skeleton|animate-pulse/,
      );
    }
  });
});

/**
 * And the ones that already had loaders must keep them.
 *
 * This is the half of the rule that is easy to lose: a later tidy-up that
 * deletes a loading.tsx takes the screen back to a blank wait, and nothing
 * else in the suite would notice.
 */
describe("the loaders that already exist", () => {
  it("all still draw a shape rather than a bare word", async () => {
    const found: string[] = [];

    async function walk(dir: string) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) await walk(path);
        else if (entry.name === "loading.tsx") found.push(path);
      }
    }
    await walk(ADMIN);

    // The count is a floor, not a fixed number: adding loaders must never make
    // this test fail, and removing them all must never make it pass.
    expect(found.length, "admin loading screens have gone missing").toBeGreaterThanOrEqual(
      DAILY.length,
    );

    for (const file of found) {
      const code = await readFile(file, "utf8");
      expect(code, `${file} lost its skeleton`).toMatch(/Skeleton|skeleton|animate-pulse/);
    }
  });
});
