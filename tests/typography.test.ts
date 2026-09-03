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
 *
 * Two DESIGNS, that is, which is what a reader perceives. Each now comes in two
 * scripts, because Inter and Fraunces carry no Devanagari and the Nepali was
 * falling through to whatever font the reader's phone happened to ship with.
 * Mukta stands in for Inter and Tiro Devanagari Hindi for Fraunces, and the two
 * never compete for a letter — a browser takes each character from the first
 * font in the stack that contains it. A page still shows one sans and one
 * serif; it just no longer borrows half of them.
 */
const SANS = ["Inter", "Mukta"];
const SERIF = ["Fraunces", "Tiro_Devanagari_Hindi"];
// A robotic accent face used ONLY on the sign-in doors (/enter, admin & worker
// login) — never on the shop or in body copy. It is a deliberate, narrowly
// scoped fifth family (a "secure terminal" mark), not the template sprawl this
// test exists to stop, so it is allowed alongside the two designs.
const TECH = ["Orbitron"];

describe("the shop's typefaces", () => {
  it("loads two designs and nothing more, each in both scripts", async () => {
    const layout = await readFile("app/layout.tsx", "utf8");
    const imported = layout.match(/from "next\/font\/google"/)
      ? (layout.match(/import \{([^}]*)\} from "next\/font\/google"/)?.[1] ?? "")
      : "";
    const families = imported
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);

    // A third *shop* design is what this test exists to stop — sprawl on the
    // pages a customer reads is what made the shop look assembled from a
    // template. The robotic TECH face is exempt because it never appears there;
    // it is confined to the sign-in doors.
    expect([...families].sort()).toEqual([...SANS, ...SERIF, ...TECH].sort());
  });

  it("gives each script a face rather than leaving one to the device", async () => {
    const layout = await readFile("app/layout.tsx", "utf8");

    // A Devanagari family imported without the "devanagari" subset downloads
    // Latin glyphs and leaves the Nepali borrowed all the same.
    expect(layout).toContain('subsets: ["devanagari"]');
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
