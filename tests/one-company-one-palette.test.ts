import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The admin was wearing another company's clothes.
 *
 * The storefront is deep green, gold and cream. The admin screens — the ones
 * the owner is in all day — were a stock indigo primary, an amber accent that
 * appears nowhere else in KRISHOE, and neutral greys throughout: 487 white
 * surfaces, 404 grey hairlines, 609 grey captions, 116 borrowed blues. Two
 * halves of one shop that did not look like one company.
 *
 * What did NOT change is as deliberate as what did. Red, amber, emerald and
 * orange carry meaning — a due date, a warning, a posted bill — and repainting
 * them in brand colours would destroy the only thing they do.
 */
const SEMANTIC = /\b[a-z:]*-(?:red|amber|emerald|orange)-\d+\b/g;
const BORROWED = /(?<![\w-])[a-z:]*-(?:gray|slate|blue)-\d+(?![\w-])/g;

async function adminFiles(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      await adminFiles(path, out);
      continue;
    }
    if (!entry.name.endsWith(".tsx")) continue;
    if (/\/(admin|worker)\//.test(path) || /Admin|Worker/.test(entry.name)) out.push(path);
  }
  return out;
}

describe("one company, one palette", () => {
  it("has no borrowed grey, slate or blue left on the admin screens", async () => {
    const files = [...(await adminFiles("app")), ...(await adminFiles("components"))];

    const offenders: string[] = [];
    // Read together rather than one after another: this walks the whole app,
    // and a file at a time was slow enough to trip the test's own time limit.
    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));

    for (const [index, file] of files.entries()) {
      const found = sources[index].match(BORROWED);
      if (found) offenders.push(`${file}: ${[...new Set(found)].join(", ")}`);
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the colours that carry meaning", async () => {
    const files = [...(await adminFiles("app")), ...(await adminFiles("components"))];

    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
    const counts = sources.map((source) => (source.match(SEMANTIC) ?? []).length);

    // A due date is red because it is late, not because of a palette. If this
    // ever collapses toward zero, somebody has repainted a warning.
    //
    // Averaged over the files that actually carry a meaning-colour, not over
    // every admin file. Measuring across all of them made the number move for
    // reasons that have nothing to do with repainting: deleting a screen lowers
    // it, and so does adding one that is meant to be colourless — a loading
    // skeleton is grey bars by design, and eight of them dragged this average
    // under the line while every warning in the app stayed exactly as red.
    const painted = counts.filter((count) => count > 0);
    const total = painted.reduce((sum, count) => sum + count, 0);

    expect(painted.length, "files carrying a meaning-colour").toBeGreaterThan(40);
    expect(total / painted.length).toBeGreaterThan(5);
  });

  it("gives the admin tokens the brand's own colours", async () => {
    const tailwind = await readFile("tailwind.config.js", "utf8");
    const admin = tailwind.slice(tailwind.indexOf("admin: {"), tailwind.indexOf("admin: {") + 600);

    expect(admin).toContain('primary: "#0B4D3B"');
    expect(admin).toContain('accent: "#C8A04D"');
    expect(admin).not.toContain("#1E40AF");
  });

  it("leaves no hover that paints the colour already there", async () => {
    const files = [...(await adminFiles("app")), ...(await adminFiles("components"))];

    // bg-blue-600 and its partner bg-blue-700 both mapped to one green, which
    // left buttons with a hover rule that changes nothing — they look dead
    // under the cursor.
    const dead: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const attribute of source.match(/className="[^"]*"/g) ?? []) {
        for (const hover of attribute.match(/hover:(?:bg|text)-brand-[a-z-]+/g) ?? []) {
          const base = hover.slice("hover:".length);
          if (new RegExp(`(?<![\\w:-])${base}(?![\\w-])`).test(attribute)) {
            dead.push(`${file}: ${hover}`);
          }
        }
      }
    }

    expect(dead).toEqual([]);
  });
});
