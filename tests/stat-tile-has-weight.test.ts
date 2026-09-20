import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The headline figure is bigger than the ones supporting it.
 *
 * Every number on an admin screen is drawn at the same size, so a row reads as
 * four equal facts: "in stock 398", "factory 300", "shop 98", "sold 12". The
 * eye has to read all four to learn which one the screen is about, every time.
 *
 * The tile already carries tone — a coloured bar saying healthy or wanting
 * attention — so the screen can say *how* a figure is doing. It cannot yet say
 * *which figure matters*, and that is the more common question: a person
 * opening the stock screen wants the total first and the split second.
 *
 * So the tile gains a size. Not a new component: a second size on the one tile
 * every screen already uses, because a separate "big tile" is how a design
 * system starts drifting back into per-page cards.
 *
 * Default stays exactly as it is. Only a caller that asks for "lead" gets the
 * larger one, so no existing screen changes until someone chooses.
 */
const TILE = "components/admin/StatTile.tsx";

describe("the tile can carry weight", () => {
  it("offers a lead size as well as the ordinary one", async () => {
    const code = await readFile(TILE, "utf8");

    expect(code, "a size must be selectable").toMatch(/size\??:\s*Size|Size\s*=/);
    expect(code, "the two sizes are named").toMatch(/"lead"/);
  });

  it("keeps the ordinary size as the default", async () => {
    const code = await readFile(TILE, "utf8");
    const clean = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Every screen in the admin already calls this tile. A default that
    // changed would resize all of them at once, which is the opposite of
    // saying which figure matters.
    expect(clean, "default must be the normal size").toMatch(/size\s*=\s*"normal"/);
  });

  it("draws the lead value larger than the normal one", async () => {
    const code = await readFile(TILE, "utf8");
    const clean = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // Asserted as two different type scales, not as the word "lead" appearing:
    // a size that is declared and then ignored leaves every mention in place
    // while the row still reads as four equal facts.
    // Matched on the Tailwind type scale itself (text-2xl, text-4xl), not on
    // any text- class: text-brand-green-ink also starts with "text-", and
    // matching that compares the colour on both lines, which is the same by
    // design and would pass on two identically sized tiles.
    const scale = /text-((?:xs|sm|base|lg|xl|\d+xl))\b/;
    const normal = clean.match(/normal:\s*"([^"]*)"/)?.[1]?.match(scale);
    const lead = clean.match(/lead:\s*"([^"]*)"/)?.[1]?.match(scale);

    expect(normal, "the normal size must set a type scale").not.toBeNull();
    expect(lead, "the lead size must set a type scale").not.toBeNull();
    expect(lead?.[1], "lead must be a larger scale than normal").not.toBe(normal?.[1]);

    // And the chosen size has to reach the element. Declaring both scales and
    // then rendering VALUE.normal leaves every word above in place while every
    // tile still draws the same — the row of four equal facts, unchanged.
    expect(clean, "the value must be drawn at the chosen size").toMatch(
      /className=\{VALUE\[size\]\}/,
    );
  });

  it("still shows the tone bar at either size", async () => {
    const code = await readFile(TILE, "utf8");

    // The bar is how a glance down a row reads state before it reads numbers.
    // A lead tile that dropped it would be louder and say less.
    expect(code).toMatch(/ACCENT\[tone\]/);
  });

  it("keeps one tile rather than growing a second component", async () => {
    const code = await readFile(TILE, "utf8");

    // A separate "BigStatTile" is how a shared design system drifts back into
    // per-page cards — the exact drift this component was made to end.
    expect(code.match(/export default function/g) ?? []).toHaveLength(1);
  });
});
