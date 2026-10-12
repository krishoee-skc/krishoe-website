import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-12: every screen in one frame — its name, a few figures,
 * tabs, the list — and nothing taken away. The stock screen first: fifteen
 * parts one under another become five tabs, shoes first.
 */
describe("the shared frame", () => {
  it("has a title, a strip of figures with money behind the eye, and tabs", async () => {
    const kit = await read("components/admin/PageKit.tsx");
    expect(kit).toContain("export function PageHead(");
    expect(kit).toContain("export function StatStrip(");
    expect(kit).toContain("export function PageTabs(");
    expect(kit).toContain('item.money && !shown');
  });

  it("keeps every tab rendered, prints them all, and opens the tab a link points into", async () => {
    const kit = await read("components/admin/PageKit.tsx");
    expect(kit).toContain('tab.key === active ? "" : openOnWide ? "hidden print:grid lg:grid" : "hidden print:grid"');
    expect(kit).toContain('closest<HTMLElement>("[data-tab-panel]")');
    expect(kit).toContain('window.addEventListener("hashchange", fromHash);');
  });
});

describe("the stock screen in tabs", () => {
  it("has the five tabs of the sample, shoes first", async () => {
    const places = await read("app/admin/stock/WherePairsAre.tsx");
    const tabs = places.slice(places.indexOf("<PageTabs"));
    const keys = [...tabs.matchAll(/\{ key: "([a-z]+)", en: "([^"]+)"/g)].map((match) => match[1]);
    expect(keys.slice(0, 1)).toEqual(["shoes"]);
    expect(places).toContain('key: "todo",');
    for (const key of ["move", "material", "history"]) expect(places).toContain(`key: "${key}"`);
  });

  it("keeps the old count box with the shoes to put right, where its button is", async () => {
    const places = await read("app/admin/stock/WherePairsAre.tsx");
    const putRight = places.slice(places.indexOf("const putRightPart = ("), places.indexOf("const shoesPart = ("));
    expect(putRight).toContain('id="put-right"');
    expect(putRight).toContain("<div ref={countBox}>");
    const shoes = places.slice(places.indexOf("const shoesPart = ("), places.indexOf("const movePart = ("));
    expect(shoes).toContain('id="every-shoe"');
    expect(shoes).not.toContain("<div ref={countBox}>");
  });

  it("hands the page's own parts to their tabs, nothing dropped", async () => {
    const page = await read("app/admin/stock/page.tsx");
    const todo = page.slice(page.indexOf("        todo={"), page.indexOf("        material={"));
    for (const part of ["<CounterGoodsWatch", 'id="not-on-website"', "loaded.catalogWarnings.length > 0", "loaded.designDrift.length > 0"]) {
      expect(todo).toContain(part);
    }
    const material = page.slice(page.indexOf("        material={"), page.indexOf("        history={"));
    expect(material).toContain('<T en="Raw material store" ne="कच्चा पदार्थको भण्डार" />');
    const history = page.slice(page.indexOf("        history={"));
    expect(history).toContain('<T en="Recent stock movement" ne="पछिल्लो चलखेल" />');
    expect(history).toContain("Where the ready pairs came from");
  });
});
