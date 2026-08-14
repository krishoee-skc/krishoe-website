import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app", "components"];
const SKIP = new Set(["node_modules", ".next", "admin"]);

/**
 * globals.css colours every heading directly:
 *
 *   h1, h2, h3, h4, h5, h6 { color: var(--ink); }
 *
 * A rule that matches the element wins over a colour inherited from an
 * ancestor, whatever the ancestor's specificity. So a heading inside a
 * `text-white` dark panel still renders in dark ink and disappears — which is
 * exactly what happened on the Our Story page and the worker portal.
 *
 * Headings on dark panels therefore have to name their own colour.
 */
const DARK_PANEL = /bg-brand-green-ink|bg-brand-green\b/;
const HEADING = /<h[1-6]\s+className="([^"]*)"/g;

async function tsxFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await tsxFiles(full)));
    else if (entry.name.endsWith(".tsx")) found.push(full);
  }

  return found;
}

describe("headings on dark panels", () => {
  it("always state their own colour", async () => {
    const offenders: string[] = [];

    for (const root of ROOTS) {
      for (const file of await tsxFiles(root)) {
        const source = await readFile(file, "utf8");
        if (!DARK_PANEL.test(source)) continue;

        for (const match of source.matchAll(HEADING)) {
          const classes = match[1];
          if (!/\btext-/.test(classes)) {
            const line = source.slice(0, match.index).split("\n").length;
            offenders.push(`${file.replaceAll("\\", "/")}:${line}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
