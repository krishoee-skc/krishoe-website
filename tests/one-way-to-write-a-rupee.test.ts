import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * One rupee amount, written one way.
 *
 * Twenty-four screens had each written their own `money()`, and they had drifted
 * into three different answers for the same number — Rs. 1,250.50 read as
 * "Rs. 1,250.5" here, "Rs. 1,251" there, with nothing to say which was right.
 * They share lib/format-money now.
 *
 * A screen that defines its own again is how that comes back, so this holds the
 * door. It looks for the formatting itself rather than the name: a template
 * string putting "Rs." in front of a number is the thing, whatever the function
 * around it is called.
 */
async function screenFiles(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await screenFiles(path, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(path);
  }
  return out;
}

describe("writing a rupee amount", () => {
  it("goes through one formatter, not one per screen", async () => {
    const files = [...(await screenFiles("app")), ...(await screenFiles("components"))];
    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
    const offenders: string[] = [];

    files.forEach((file, index) => {
      // The shared one is allowed to format rupees; that is its job.
      if (file.endsWith("lib/format-money.ts")) return;

      const source = sources[index];

      for (const match of source.matchAll(/`Rs\.\s*\$\{([^}]*)\}/g)) {
        const expression = match[1];

        // Converting paisa to rupees is a different job that happens to end in
        // a rupee sign. Folding it into money() would hide the division.
        if (/\/\s*100|paisa/i.test(expression)) continue;

        // An amount inside a sentence — "Rs. 500 is unpaid — pick an account" —
        // is written around the number, and the Nepali half of the same
        // sentence says "रु." instead. money() prepends its own "Rs.".
        const sentence = source.slice(match.index, (match.index ?? 0) + 400);
        if (/(?:is unpaid|on credit|रु\.)/.test(sentence)) continue;

        if (!/toLocaleString/.test(expression)) continue;

        offenders.push(`${file}:${source.slice(0, match.index).split("\n").length}`);
      }
    });

    expect(
      offenders.join("\n"),
      "Use money() or roundedMoney() from @/lib/format-money instead of formatting rupees here",
    ).toBe("");
  });

  it("keeps the shared formatter where every screen can reach it", async () => {
    const source = await readFile("lib/format-money.ts", "utf8");

    expect(source).toContain("export function money(");
    expect(source).toContain("export function roundedMoney(");
  });
});
