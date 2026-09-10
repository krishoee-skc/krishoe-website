import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A full-screen page that is taller than the screen.
 *
 * `min-h-screen` means "at least as tall as the window". Put `py-12` on the
 * same element and the padding sits inside that minimum, so the box is 96px
 * taller than the window before a word is drawn — and the page scrolls on a
 * monitor with room to spare. The owner asked why signing in needed a scroll on
 * a large display; every auth screen in the app had this, ten of them.
 *
 * `min-h-dvh` is the height actually visible, and on a centred box the padding
 * only matters once the content genuinely outgrows the viewport. (100vh on a
 * phone is the height with the address bar hidden, which is more than is
 * really there — another reason dvh is the right unit.)
 */
async function tsxFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await tsxFiles(full)));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("a page that fills the screen", () => {
  it("does not add its own padding on top of a full-screen minimum", async () => {
    // Both trees: the first version of this walked app/ only and missed two
    // components. And every padded box, not only centred ones — padding inside
    // a full-screen minimum overflows either way.
    const files = [...(await tsxFiles("app")), ...(await tsxFiles("components"))];
    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
    const offenders: string[] = [];

    files.forEach((file, index) => {
      const pattern = /className="([^"]*(?:min-h-screen|h-screen|min-h-\[100vh\])[^"]*)"/g;
      for (const match of sources[index].matchAll(pattern)) {
        const classes = match[1];
        // py, pt, pb or the all-round p — anything that adds height.
        const padded = /\b(?:py|pt|pb|p)-\d+/.test(classes);
        if (padded) offenders.push(`${file}: ${classes}`);
      }
    });

    expect(
      offenders.join("\n"),
      "a full-screen box plus padding is taller than the window — use min-h-dvh",
    ).toBe("");
  });

  it("uses dvh, which is the height a phone actually shows", async () => {
    const login = await readFile("app/(admin-auth)/admin/login/page.tsx", "utf8");

    // The screen the owner reported. 100vh on a phone is the height with the
    // address bar hidden, so a vh-sized sign-in overflows there too.
    expect(login).toContain("min-h-dvh");
    // In a className, not in prose: the comment above it explains why the old
    // value was wrong and naturally names it.
    expect(login).not.toMatch(/className="[^"]*min-h-screen/);
  });
});
