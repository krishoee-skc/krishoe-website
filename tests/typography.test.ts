import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * How many typefaces the shop is allowed to load.
 *
 * It shipped four Google families — Inter, Poppins, Fraunces and Playfair
 * Display — plus Arial Black in the admin CSS. Playfair was downloaded on every
 * page for a `.luxury-text` class nothing used.
 *
 * Four typefaces on one page is the thing that makes a site read as assembled
 * from a template rather than designed, which was exactly the complaint. It also
 * cost nine font files on a Nepali mobile connection.
 *
 * Two remain: Inter for text, Fraunces for headings — the sans-and-serif pairing
 * that expensive-looking brands actually use.
 */
describe("the shop's typefaces", () => {
  it("loads exactly two families", async () => {
    const layout = await readFile("app/layout.tsx", "utf8");
    const imported = layout.match(/from "next\/font\/google"/)
      ? (layout.match(/import \{([^}]*)\} from "next\/font\/google"/)?.[1] ?? "")
      : "";
    const families = imported
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    expect(families).toEqual(["Inter", "Fraunces"]);
  });

  it("does not load a family it no longer uses", async () => {
    const layout = await readFile("app/layout.tsx", "utf8");
    for (const dropped of ["Poppins", "Playfair", "font-heading", "font-luxury"]) {
      expect(layout, dropped).not.toContain(dropped);
    }
  });

  it("has no rule left pointing at a font that is not loaded", async () => {
    const css = await readFile("app/globals.css", "utf8");
    expect(css).not.toContain("--font-heading");
    expect(css).not.toContain("--font-luxury");
    // Declarations only, not prose: the comment above the fixed rule names the
    // font it replaced, and that explanation is worth keeping. Android does not
    // ship Arial Black, so the same admin screen rendered heavy on Windows and
    // ordinary on a phone.
    const declarations = css.match(/^\s*font-family:.*$/gm) ?? [];
    expect(declarations.length).toBeGreaterThan(3);
    for (const rule of declarations) {
      expect(rule, rule).not.toContain("Arial Black");
    }
  });

  it("gives headings the display face and keeps admin on the sans", async () => {
    const css = await readFile("app/globals.css", "utf8");
    expect(css).toContain("font-family: var(--font-display)");
    // Admin is dense tables of numbers; a display serif costs legibility there
    // and sells to nobody.
    expect(css).toContain(".admin-canvas h1");
  });
});

describe("what gets deployed", () => {
  it("ships no backup or scratch images", async () => {
    const { readdir } = await import("node:fs/promises");
    const walk = async (dir: string): Promise<string[]> => {
      const entries = await readdir(dir, { withFileTypes: true });
      const found = await Promise.all(
        entries.map(async (entry) =>
          entry.isDirectory() ? walk(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`],
        ),
      );
      return found.flat();
    };

    const files = await walk("public");
    // 8.6MB of unreferenced backups and a file literally named "ChatGPT Image"
    // were being deployed on every push.
    for (const file of files) {
      expect(file, file).not.toMatch(/backup-original|ChatGPT|\bcopy\b|untitled/i);
    }
  });
});
