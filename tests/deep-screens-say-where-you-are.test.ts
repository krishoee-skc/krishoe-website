import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { adminTrail } from "@/app/admin/AdminTrail";

/**
 * A screen four levels down says how it was reached.
 *
 * The sidebar marks the section you are in, which answers the question on a
 * screen one level deep. It stops answering below that: `/admin/operations/
 * production-accounts/worker/<id>` shows a worker's piece history under a menu
 * that highlights "Operations", and nothing on the page names the two steps in
 * between. Seven screens sit at that depth, and the only way back up is the
 * browser's own back button — which is not on the screen, and on a phone is a
 * gesture rather than a control.
 *
 * So the path itself is drawn, once, in the admin layout: every screen gets it
 * without any screen asking, and a new one added next month is covered the day
 * it appears.
 *
 * Only below the first level. On `/admin/stock` the trail would say "Stock"
 * under a heading that already says Stock — a line of chrome repeating what is
 * beneath it, on every screen the owner opens most.
 */

describe("the trail a screen shows", () => {
  it("is empty on the dashboard", () => {
    // Nothing to retrace: this is where a trail would lead back to.
    expect(adminTrail("/admin")).toEqual([]);
  });

  it("is empty one level down, where the menu already answers it", () => {
    // The sidebar highlights "Stock" while this page's own heading says Stock.
    // A third statement of the same word is noise on the busiest screens.
    expect(adminTrail("/admin/stock")).toEqual([]);
    expect(adminTrail("/admin/products")).toEqual([]);
  });

  it("names the steps between, once it is worth saying", () => {
    expect(adminTrail("/admin/factory/add-work")).toEqual([
      { href: "/admin/factory", label: "Factory" },
      { href: "/admin/factory/add-work", label: "Add work" },
    ]);
  });

  it("carries every step of a four-level path", () => {
    // The screen that prompted this: a worker's piece history, three steps
    // below the section the menu highlights.
    const trail = adminTrail("/admin/operations/production-accounts/lots");

    expect(trail).toEqual([
      { href: "/admin/operations", label: "Operations" },
      { href: "/admin/operations/production-accounts", label: "Production accounts" },
      { href: "/admin/operations/production-accounts/lots", label: "Lots" },
    ]);
  });

  it("does not offer an id as a place to go back to", () => {
    // A row id is not a section. Naming it "8f3a-…" would be worse than
    // silence, and linking it goes nowhere useful — the page you are on.
    const trail = adminTrail("/admin/purchasing/supplier/8f3a2b1c-44de");

    expect(trail.map((step) => step.label)).toEqual(["Purchasing", "Supplier"]);
    expect(trail.at(-1)?.href).toBe("/admin/purchasing/supplier");
  });

  it("reads a hyphenated segment as words", () => {
    // "production-accounts" is a URL, not a label.
    expect(adminTrail("/admin/factory/worker-portal-qr").at(-1)?.label).toBe(
      "Worker portal qr",
    );
  });

  it("ignores a trailing slash and an empty path", () => {
    expect(adminTrail("/admin/stock/")).toEqual([]);
    expect(adminTrail("")).toEqual([]);
  });
});

describe("where it is drawn", () => {
  it("sits in the layout, so every screen gets it", async () => {
    const layout = await readFile("app/admin/layout.tsx", "utf8");
    const code = layout.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Asserted as the element in the tree, not the import: importing it and
    // never rendering it leaves fifty-eight screens exactly as they were.
    expect(code, "the trail must be rendered").toMatch(/<AdminTrail\s*\/>/);
  });

  it("is drawn above the page, not inside it", async () => {
    const layout = await readFile("app/admin/layout.tsx", "utf8");
    const code = layout.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    const trail = code.indexOf("<AdminTrail");
    const children = code.indexOf("{children}");

    expect(trail, "the trail is missing").toBeGreaterThan(0);
    expect(trail, "the trail must come before the page").toBeLessThan(children);
  });
});
