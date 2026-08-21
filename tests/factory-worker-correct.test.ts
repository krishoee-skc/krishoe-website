import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  FACTORY_WORKER_CATEGORIES,
  FACTORY_WORKER_TYPES,
} from "@/lib/factory-worker-options";

const API = "app/api/factory/workers/route.ts";
const PAGE = "app/admin/factory/workers/page.tsx";
const SCHEMA = "docs/schema.sql";

function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
}

/**
 * A worker record is created by typing a name while entering work, and none of
 * it could be changed afterwards. A name mistyped once printed on that person's
 * payslip every month after, and someone who left the factory stayed in every
 * dropdown, waiting for a day's work to be entered against them.
 */
describe("correcting a worker", () => {
  it("can be done from the app", async () => {
    const api = await readFile(API, "utf8");
    const page = await readFile(PAGE, "utf8");

    expect(api).toContain("const wantsDetails");
    expect(page).toContain("saveWorker");
    expect(page).toContain("सच्याउने");
  });

  it("retires rather than deletes", async () => {
    const api = code(await readFile(API, "utf8"));
    const page = await readFile(PAGE, "utf8");

    // factory_daily_work.worker_id is ON DELETE RESTRICT: the database refuses
    // to remove anyone who has worked a day, which is exactly right — their
    // wages are theirs.
    expect(api).not.toMatch(/DELETE\s+FROM\s+factory_workers/i);
    expect(page).toContain("बन्द गर्ने");
    expect(page).toContain("फेरि चालु गर्ने");
  });

  it("leaves last month's wages exactly where they are", async () => {
    const schema = await readFile(SCHEMA, "utf8");
    const dailyWork = schema.slice(schema.indexOf("CREATE TABLE IF NOT EXISTS factory_daily_work"));

    // Changing a stage is safe only because each day's work already carries
    // what it was paid at. If these columns ever go, corrections start
    // rewriting history.
    expect(dailyWork.slice(0, 900)).toContain("rate_applied");
    expect(dailyWork.slice(0, 900)).toContain("amount_earned");
  });

  it("refuses a stage or pay type the column would not hold", async () => {
    const api = await readFile(API, "utf8");
    const branch = api.slice(api.indexOf("const wantsDetails"));

    expect(branch).toContain("workerCategories.has(category)");
    expect(branch).toContain("workerTypes.has(workerType)");
    expect(branch).toContain('status !== "active" && status !== "inactive"');
  });
});

/**
 * The stage list was written out twice and the two copies had already drifted:
 * the screen and the API were both missing "Fibermen", which is where five of
 * this shop's eight workers work. Correcting one of them would have meant
 * moving them to a stage they do not work in, just to save the form.
 */
describe("the list of stages", () => {
  it("matches what the database will accept", async () => {
    const schema = await readFile(SCHEMA, "utf8");
    const constraint = schema.slice(
      schema.indexOf("factory_workers_category_check"),
      schema.indexOf("factory_workers_status_check"),
    );

    for (const category of FACTORY_WORKER_CATEGORIES) {
      expect(constraint, category).toContain(`'${category}'`);
    }
    for (const type of FACTORY_WORKER_TYPES) {
      expect(schema, type).toContain(`'${type}'`);
    }
  });

  it("includes the stage most of this shop works in", async () => {
    expect(FACTORY_WORKER_CATEGORIES).toContain("Fibermen");
  });

  it("is not written out a second time", async () => {
    const api = code(await readFile(API, "utf8"));
    const page = code(await readFile(PAGE, "utf8"));

    expect(api).toContain("FACTORY_WORKER_CATEGORIES");
    // The screen takes the shared list rather than declaring its own — the
    // second copy is how the first one lost "Fibermen".
    expect(page).toContain("const categories = FACTORY_WORKER_CATEGORIES;");

    // factoryCategoryForDepartment still names stages, and should: it
    // translates an HR department into a factory stage, which is a different
    // job from listing what a stage may be. What must not come back is a
    // second array of options.
    expect(api).not.toMatch(/new Set\(\[\s*"Upper"/);
    expect(page).not.toMatch(/const categories = \[/);
  });
});

describe("finding a retired worker again", () => {
  it("is possible, because this screen asks for them", async () => {
    const api = await readFile(API, "utf8");
    const page = await readFile(PAGE, "utf8");

    expect(api).toContain('searchParams.get("include") === "retired"');
    expect(page).toContain("/api/factory/workers?include=retired");
  });

  it("keeps them hidden anywhere that did not ask", async () => {
    const api = code(await readFile(API, "utf8"));

    expect(api).toContain(`includeRetired ? "" : "WHERE workers.status = 'active'"`);
  });
});

describe("the record of it", () => {
  it("says what changed, not just that something did", async () => {
    const api = await readFile(API, "utf8");

    expect(api).toContain('"factory_worker_retired"');
    expect(api).toContain('"factory_worker_updated"');
    expect(api).toContain("renamed from");
  });
});
