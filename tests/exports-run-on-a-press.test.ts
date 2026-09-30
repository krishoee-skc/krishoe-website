import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A Next <Link> is fetched as soon as it is on screen. Pointed at an export,
 * that ran the export on every visit: the Orders page wrote nine "exported as
 * CSV" rows in a minute nobody pressed, and the Activity page built a whole
 * backup each time it opened (owner, 2026-09-30). An export or backup address
 * is only ever behind a button.
 */
async function tsxFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return tsxFiles(full);
      return Promise.resolve(entry.name.endsWith(".tsx") ? [full] : []);
    }),
  );
  return nested.flat();
}

describe("exports run on a press", () => {
  it("never puts an export or backup address in a <Link>", async () => {
    const offenders: string[] = [];
    for (const file of [...(await tsxFiles("app")), ...(await tsxFiles("components"))]) {
      const source = (await readFile(file, "utf8")).replace(/\r\n/g, "\n");
      const links = source.match(/<Link\b[^>]*>/g) ?? [];
      for (const tag of links) {
        if (/href=["{`][^"`}]*\/api\/[^"`}]*(export|backup|csv)/i.test(tag)) offenders.push(`${file}: ${tag.slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("uses the button on the Orders and Activity pages", async () => {
    const orders = await readFile("app/admin/orders/page.tsx", "utf8");
    expect(orders).toContain('href="/api/orders/export?type=orders"');
    expect(orders).toContain("<ExportButton");
    const activity = await readFile("app/admin/activity/page.tsx", "utf8");
    expect(activity.replace(/\r\n/g, "\n")).toMatch(/<ExportButton\n\s+href="\/api\/admin\/backup"/);
  });
});
