import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { groupBillLines, sizeSummary, sortSizes } from "@/lib/bill-lines";

/**
 * A wholesale bill of two shoes in five sizes each ran to ten lines. The
 * owner: "dherai item holsel lai bechda ta kati lamo bill". One line per
 * shoe, colour and rate now, with the sizes inside it — on the counter screen
 * and on the printed bill. Underneath, every size is still its own line.
 */

const line = (design: string, size: string, rate: number, color = "Black", quantity = 1) => ({
  design,
  size,
  color,
  rate,
  quantity,
});

describe("grouping the lines", () => {
  it("puts five sizes of one shoe at one rate on one line", () => {
    const cart = [
      ...["36", "37", "38", "39", "40"].map((size) => line("eva slipers efm 029", size, 400)),
      ...["36", "37", "38", "39", "40"].map((size) => line("lose hill panja", size, 650)),
    ];
    const groups = groupBillLines(cart);
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => [group.design, group.rate, group.lines.length])).toEqual([
      ["eva slipers efm 029", 400, 5],
      ["lose hill panja", 650, 5],
    ]);
  });

  it("keeps a size sold at another rate on a line of its own", () => {
    const groups = groupBillLines([line("bantu hill", "36", 650), line("bantu hill", "37", 600)]);
    expect(groups).toHaveLength(2);
  });

  it("keeps another colour apart, and ignores case and spaces in the name", () => {
    expect(groupBillLines([line("Bantu Hill", "36", 650), line(" bantu hill", "37", 650)])).toHaveLength(1);
    expect(groupBillLines([line("bantu hill", "36", 650, "Black"), line("bantu hill", "36", 650, "Brown")])).toHaveLength(2);
  });

  it("keeps lines the caller says must stay apart — a pair coming back", () => {
    const groups = groupBillLines(
      [
        { ...line("bantu hill", "36", 650), back: true },
        { ...line("bantu hill", "37", 650), back: false },
      ],
      (row) => (row.back ? "back" : ""),
    );
    expect(groups).toHaveLength(2);
  });

  it("keeps the order the shoes went on the bill", () => {
    const groups = groupBillLines([line("B", "36", 1), line("A", "36", 1), line("B", "37", 1)]);
    expect(groups.map((group) => group.design)).toEqual(["B", "A"]);
  });
});

describe("the sizes, in a few characters", () => {
  it("shortens an unbroken run bought evenly", () => {
    expect(sizeSummary(["40", "36", "38", "37", "39"].map((size) => ({ size, pairs: 1 })))).toBe("36-40 ×1 each");
    expect(sizeSummary(["36", "37"].map((size) => ({ size, pairs: 2 })))).toBe("36-37 ×2 each");
  });

  it("lists each size when the run is broken or uneven", () => {
    expect(sizeSummary([{ size: "36", pairs: 2 }, { size: "38", pairs: 1 }])).toBe("36×2, 38×1");
    expect(sizeSummary([{ size: "36", pairs: 2 }, { size: "37", pairs: 1 }])).toBe("36×2, 37×1");
  });

  it("writes one size as it always was", () => {
    expect(sizeSummary([{ size: "40", pairs: 1 }])).toBe("40");
    expect(sizeSummary([{ size: "40", pairs: 3 }])).toBe("40 ×3");
    expect(sizeSummary([{ size: "", pairs: 1 }])).toBe("");
  });

  it("orders sizes as shoes are, not as text", () => {
    expect(sortSizes([{ size: "9", pairs: 1 }, { size: "10", pairs: 1 }, { size: "Mixed", pairs: 1 }]).map((row) => row.size)).toEqual([
      "9",
      "10",
      "Mixed",
    ]);
  });
});

describe("where it is used", () => {
  it("draws the counter bill one group at a time", async () => {
    const form = await readFile("app/admin/pos/_components/PosBillForm.tsx", "utf8");
    expect(form).toContain("groupBillLines(cart, (line) => (line.back ? \"back\" : \"\"))");
  });

  it("prints the bill one group at a time, sizes in the Size column", async () => {
    const page = await readFile("app/admin/pos/[id]/page.tsx", "utf8");
    expect(page).toContain("groupBillLines(invoice.items");
    expect(page).toContain("sizeSummary(");
  });
});
