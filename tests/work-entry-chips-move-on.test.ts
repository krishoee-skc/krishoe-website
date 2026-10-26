import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { completeColour } from "@/app/admin/factory/add-work/work-entry-rules";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
const FORM = "app/admin/factory/add-work/WorkEntryForm.tsx";

/**
 * Add work, owner 2026-10-26 (क and ग of the Enter sample): a colour or size
 * chip pressed with the mouse left the cursor on the chip, so the next Enter
 * pressed the chip again instead of moving on. And a colour can be typed by
 * its first letters.
 */
describe("क · a chip moves the cursor on", () => {
  it("goes from a colour chip to Size, and from a size run to Rejected", async () => {
    const form = await read(FORM);
    const colour = form.slice(form.indexOf("{colourChips.map((chip)"), form.indexOf("{sizeChips.map((chip)"));
    expect(colour).toContain('pendingFocus.current = "size";');
    const runs = form.slice(form.indexOf("{sizeChips.map((chip)"), form.indexOf("{itemSizes.map((size)"));
    expect(runs).toContain('if (!showSizeCounts) pendingFocus.current = "rejected";');
  });

  it("leaves the cursor on a single size, where several are picked one by one", async () => {
    const form = await read(FORM);
    const singles = form.slice(form.indexOf("{itemSizes.map((size)"), form.indexOf("{itemSizes.map((size)") + 900);
    expect(singles).toContain("toggleSize(prev.size, size)");
    expect(singles).not.toContain("pendingFocus.current");
  });
});

describe("ग · a few letters are a colour", () => {
  const chips = [
    { value: "Cream", names: ["Cream", "क्रिम"], star: true },
    { value: "Cherry", names: ["Cherry", "चेरी"] },
    { value: "Gray", names: ["Gray", "खैरो"] },
    { value: "Black", names: ["Black", "कालो"] },
    { value: "White", names: ["White", "सेतो"] },
    { value: "Red", names: ["Red", "रातो"] },
  ];

  it("completes the start of one colour's name", () => {
    expect(completeColour("cr", chips)).toBe("Cream");
    expect(completeColour("bl", chips)).toBe("Black");
    expect(completeColour("ch", chips)).toBe("Cherry");
    expect(completeColour("का", chips)).toBe("Black");
  });

  it("takes the shoe's usual colour when the letters start more than one, else guesses nothing", () => {
    expect(completeColour("c", chips)).toBe("Cream");
    expect(completeColour("c", chips.map((chip) => ({ ...chip, star: false })))).toBeNull();
  });

  it("spells a whole name the chip's way, and leaves other colours as typed", () => {
    expect(completeColour("cream", chips)).toBe("Cream");
    expect(completeColour("Cream", chips)).toBeNull();
    expect(completeColour("Maroon", chips)).toBeNull();
    expect(completeColour("  ", chips)).toBeNull();
  });

  it("is applied before Enter walks on from the colour box", async () => {
    const form = await read(FORM);
    const box = form.slice(form.indexOf('id="work-colour"'), form.indexOf('id="work-size"'));
    expect(box.indexOf("completeColourOnEnter(event);")).toBeGreaterThan(-1);
    expect(box.indexOf("completeColourOnEnter(event);")).toBeLessThan(box.indexOf('handleFieldWalk(event, "colour")'));
    const helper = form.slice(form.indexOf("function completeColourOnEnter"), form.indexOf("const repeatLast"));
    expect(helper).toContain("completeColour(formData.color, colourChips)");
    expect(helper).toContain('event.key !== "Enter" || event.shiftKey');
  });
});
