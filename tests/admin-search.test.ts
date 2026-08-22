import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  ADMIN_SEARCH_PAGES,
  rankRecord,
  searchRecords,
  withKindTerms,
  type AdminSearchRecord,
} from "@/lib/admin-search";

const worker = (name: string, category = "Fibermen"): AdminSearchRecord => ({
  kind: "worker",
  title: name,
  detail: category,
  href: `/admin/factory/ledger?workerId=${name}`,
  terms: [name, category],
});

const product = (name: string, sku = ""): AdminSearchRecord => ({
  kind: "product",
  title: name,
  detail: "",
  href: "/admin/products",
  terms: [name, sku],
});

/**
 * The owner typed "ank" looking for their worker ankus and the search reported
 * nothing. Workers were never in it — it looked in products, customers,
 * suppliers and two kinds of bill, and nowhere else. A search that cannot find
 * a name the shop uses every day teaches its user to stop opening it.
 */
describe("finding a worker by part of their name", () => {
  it("finds ankus from ank", () => {
    const hits = searchRecords([worker("ankus"), worker("aarif"), product("bag open")], "ank");

    expect(hits.map((hit) => hit.title)).toEqual(["ankus"]);
  });

  it("finds every worker whose name starts with what was typed", () => {
    const hits = searchRecords([worker("aarif"), worker("aasif"), worker("ankus")], "aa");

    expect(hits.map((hit) => hit.title)).toEqual(["aarif", "aasif"]);
  });

  it("matches inside a word too, not only at the start", () => {
    // "happ" is nobody's prefix, and Doctor Chappal moto is still the answer.
    const hits = searchRecords([product("Doctor Chappal moto")], "happ");

    expect(hits).toHaveLength(1);
  });
});

describe("what comes first", () => {
  it("puts the name that starts with it above one that merely contains it", () => {
    const hits = searchRecords([product("bag open"), product("T bag open")], "bag");

    // "bag open" starts with it; "T bag open" has it as a later word.
    expect(hits[0].title).toBe("bag open");
  });

  it("narrows as more is typed, never widens", () => {
    const records = [worker("ankus", "Upper"), worker("aarif", "Fibermen")];

    expect(searchRecords(records, "a")).toHaveLength(2);
    // Every word has to match something, or typing more would bring back more.
    expect(searchRecords(records, "ankus upper").map((hit) => hit.title)).toEqual(["ankus"]);
    expect(searchRecords(records, "ankus fibermen")).toHaveLength(0);
  });

  it("finds nothing for nothing", () => {
    expect(rankRecord(worker("ankus"), "")).toBe(-1);
    expect(rankRecord(worker("ankus"), "   ")).toBe(-1);
    expect(searchRecords([worker("ankus")], "zzz")).toHaveLength(0);
  });
});

/**
 * Half of what anyone types into a search box is a place, not a record —
 * "stock", "काम टिप्ने", "salary". Without these the owner types a page name,
 * gets nothing, and goes back to hunting through the menu.
 */
describe("the screens themselves", () => {
  it("are found by their Nepali name", () => {
    const hits = searchRecords(ADMIN_SEARCH_PAGES, "स्टक");

    expect(hits[0].href).toBe("/admin/operations");
  });

  it("are found by their English name too", () => {
    expect(searchRecords(ADMIN_SEARCH_PAGES, "salary")[0].href).toBe("/admin/factory/salary");
    expect(searchRecords(ADMIN_SEARCH_PAGES, "add work")[0].href).toBe("/admin/factory/add-work");
  });

  it("every one of them goes somewhere under /admin", () => {
    for (const page of ADMIN_SEARCH_PAGES) {
      expect(page.href, page.title).toMatch(/^\/admin/);
    }
  });
});

/**
 * Every stored name in this shop is Roman — all eight workers, all ten factory
 * items, all seven products, all five customers, checked against the live data
 * rather than assumed. Typing "अंकुस" therefore cannot reach "ankus" without
 * transliterating, and Nepali romanisation is ambiguous enough that guessing
 * would return the wrong worker with confidence. The category is what works.
 */
describe("searching in Nepali", () => {
  it("lists a whole category by its Nepali word", () => {
    const records = [worker("ankus"), product("bag open")].map(withKindTerms);

    expect(searchRecords(records, "कामदार").map((hit) => hit.title)).toEqual(["ankus"]);
    expect(searchRecords(records, "जुत्ता").map((hit) => hit.title)).toEqual(["bag open"]);
  });

  it("takes the English word for the same category", () => {
    const records = [worker("ankus"), product("bag open")].map(withKindTerms);

    expect(searchRecords(records, "worker").map((hit) => hit.title)).toEqual(["ankus"]);
  });
});

describe("the screen", () => {
  it("answers from the first letter", async () => {
    const route = await readFile("app/api/admin/search/route.ts", "utf8");

    // A two-letter minimum was borrowed from searching a large catalogue. This
    // shop has eight workers and seven products, so "a" returning most of them
    // is a short list — and waiting for a second letter reads as a box that
    // does not work.
    expect(route).toContain("query.length === 0");
    expect(route).not.toContain("query.length < 2");
  });

  it("offers the screens when the box is empty", async () => {
    const route = await readFile("app/api/admin/search/route.ts", "utf8");

    // Opening search and seeing nothing is what sends someone back to the menu.
    expect(route).toContain("ADMIN_SEARCH_PAGES.map");
  });

  it("answers while you type", async () => {
    const page = await readFile("app/admin/search/SearchAsYouType.tsx", "utf8");

    expect(page).toContain("/api/admin/search?q=");
    // Debounced: each request asks seven tables.
    expect(page).toContain("window.setTimeout");
    // A slow reply for "an" must not land under a fast one for "ankus".
    expect(page).toContain("latest.current !== trimmed");
  });

  it("shows what kind each result is", async () => {
    const page = await readFile("app/admin/search/SearchAsYouType.tsx", "utf8");

    expect(page).toContain("ADMIN_SEARCH_LABELS");
  });
});

describe("the route", () => {
  it("looks in the places the old one never did", async () => {
    const route = await readFile("app/api/admin/search/route.ts", "utf8");

    for (const table of ["factory_workers", "factory_items", "orders", "products", "pos_invoices"]) {
      expect(route, table).toContain(`FROM ${table}`);
    }
  });

  it("narrows in the database rather than loading the shop", async () => {
    const route = await readFile("app/api/admin/search/route.ts", "utf8");

    // The old page loaded every product, all of operations, all of purchasing
    // and all of POS on each submit, then filtered in memory. Typing as you go
    // means a request per pause.
    expect(route).toContain("LIKE $1");
    expect(route).toContain("LIMIT ${PER_KIND}");
  });

  it("keeps working when one table does not", async () => {
    const route = await readFile("app/api/admin/search/route.ts", "utf8");

    // "No results" would read as "this does not exist".
    expect(route).toContain("async function safeQuery");
    expect(route).toContain("reportError(`search ${what}`");
  });
});
