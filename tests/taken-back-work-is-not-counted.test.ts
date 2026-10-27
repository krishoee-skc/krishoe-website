import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * A work entry taken back is marked status = 'reversed' (lower case) in
 * factory_daily_work. Four reads compared it with 'Reversed' — the spelling the
 * wages table uses — and Postgres compares case by case, so work taken back was
 * still counted: in the pairs ready to post to stock, in the uppers waiting for
 * a bottom, in the "more bottoms than uppers" warning, and in a shoe's last
 * colour and size. Found in the recheck of 2026-10-27.
 */
describe("work taken back is not counted again", () => {
  it("reads factory_daily_work's status in either case", async () => {
    for (const file of ["lib/factory-mutations.ts", "app/admin/factory/add-work/page.tsx", "app/api/factory/ready/route.ts"]) {
      const source = await read(file);
      const reads = source.split("FROM factory_daily_work").slice(1).map((after) => after.slice(0, 400));
      for (const sql of reads) {
        expect(sql, file).not.toMatch(/status <> 'Reversed'/);
      }
    }
    expect(await read("app/api/factory/ready/route.ts")).toContain("lower(work.status) <> 'reversed'");
    expect(await read("app/admin/factory/add-work/page.tsx")).toContain("WHERE lower(work.status) <> 'reversed'");
    expect(await read("lib/factory-mutations.ts")).toContain("WHERE item_id = $1 AND lower(status) <> 'reversed'");
  });

  it("is still marked in lower case where it is taken back", async () => {
    const mutations = await read("lib/factory-mutations.ts");
    expect(mutations).toContain("UPDATE factory_daily_work SET status = 'reversed'");
  });
});
