import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { colourList, colourSwap, coloursNotOnShoe, swapColourWords } from "@/lib/colour-words";

/**
 * Owner, 2026-10-20: Lose Hill Panja's colour was changed to cherry and its
 * description still said "Black regular-fit ladies sandals". Change the colour
 * and the descriptions follow; a description naming another colour is shown,
 * with one press to put it right.
 */
const loseHill = "Black regular-fit ladies sandals with premium synthetic finish.";

describe("the colour said again in the descriptions", () => {
  it("changes the old colour's name to the new one, as it was written", () => {
    expect(swapColourWords(loseHill, "Black", "cherry")).toBe("Cherry regular-fit ladies sandals with premium synthetic finish.");
    expect(swapColourWords("soft black sandal, BLACK strap", "Black", "Cream")).toBe("soft cream sandal, CREAM strap");
    expect(swapColourWords("कालो रङको चप्पल", "Black", "Cherry")).toBe("चेरी रङको चप्पल");
  });

  it("changes a whole word only", () => {
    expect(swapColourWords("Blackberry red", "Red", "Cream")).toBe("Blackberry cream");
    expect(swapColourWords("Blackberry", "Black", "Cream")).toBe("Blackberry");
    expect(swapColourWords("Golden buckle", "Gold", "Silver")).toBe("Golden buckle");
  });

  it("knows one colour out and one in, and nothing else", () => {
    expect(colourSwap(["Black"], ["cherry"])).toEqual({ from: "Black", to: "cherry" });
    expect(colourSwap(["Black"], ["Black", "Cream"])).toBeNull();
    expect(colourSwap(["Black"], [])).toBeNull();
    expect(colourSwap(["Black"], ["black"])).toBeNull();
    expect(colourList(" Cherry, , cream ")).toEqual(["Cherry", "cream"]);
  });

  it("points out a description that names another colour", () => {
    expect(coloursNotOnShoe([loseHill], ["cherry"])).toEqual(["Black"]);
    expect(coloursNotOnShoe(["कालो चप्पल"], ["Cherry"])).toEqual(["Black"]);
    expect(coloursNotOnShoe([loseHill], ["Black"])).toEqual([]);
    expect(coloursNotOnShoe(["Grey sole"], ["Gray"])).toEqual([]);
    expect(coloursNotOnShoe(["Comfortable all day"], ["Cherry"])).toEqual([]);
  });

  it("is wired into the product form, before Save", async () => {
    const form = await readFile("app/admin/ProductForm.tsx", "utf8");
    expect(form).toContain("onBlur={(event) => coloursChanged(event.currentTarget.value)}");
    expect(form).toContain("विवरणमा पनि ${typedColours[0]} बनाउने");
    expect(form.match(/onInput=\{\(\) => checkDescriptions\(\)\}/g)).toHaveLength(4);
  });
});
