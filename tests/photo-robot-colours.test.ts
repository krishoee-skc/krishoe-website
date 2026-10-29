import { readFile as readRaw } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { guessQuestion, readGuess, type GuessInput } from "@/lib/ai/photo-guess";

const read = async (path: string) => (await readRaw(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The robot named colours a shoe was never made in (owner, 2026-10-29, "colour
 * nai farak bhanyo"). It is now told each shoe's colours, and a colour it is
 * unsure of — or one outside the shoe's own, unless it is sure — stays blank.
 */
const input: GuessInput = {
  photo: { mimeType: "image/jpeg", data: "x" },
  shoes: [
    { id: "FI-lose", name: "lose hill panja", colours: ["Black", "Brown"] },
    { id: "FI-new", name: "new slipper" },
  ],
  colours: ["Black", "Brown", "Red", "Maroon"],
};

describe("the robot and colour", () => {
  it("is told the colours each shoe is made in", () => {
    const { prompt } = guessQuestion(input);
    expect(prompt).toContain("1. lose hill panja — made in: Black, Brown");
    expect(prompt).toContain("2. new slipper\n");
    expect(prompt).toContain("choose from the colours it is made in");
  });

  it("keeps a colour the shoe is made in", () => {
    expect(readGuess('{"shoe":1,"colour":"brown","pairs":24,"sure_shoe":"high","sure_colour":"medium"}', input)).toMatchObject({
      itemId: "FI-lose", color: "Brown", sureColor: "medium",
    });
  });

  it("leaves blank a colour the shoe was never made in, unless the robot is sure", () => {
    expect(readGuess('{"shoe":1,"colour":"red","pairs":24,"sure_shoe":"high","sure_colour":"medium"}', input)).toMatchObject({
      itemId: "FI-lose", color: "", sureColor: "",
    });
    expect(readGuess('{"shoe":1,"colour":"red","pairs":24,"sure_shoe":"high","sure_colour":"high"}', input)).toMatchObject({
      color: "Red", sureColor: "high",
    });
  });

  it("leaves blank any colour it is not sure of", () => {
    expect(readGuess('{"shoe":1,"colour":"black","pairs":24,"sure_shoe":"high","sure_colour":"low"}', input)).toMatchObject({
      color: "", sureColor: "",
    });
  });

  it("still names a colour for a shoe the books have no colours for", () => {
    expect(readGuess('{"shoe":2,"colour":"maroon","pairs":10,"sure_shoe":"medium","sure_colour":"medium"}', input)).toMatchObject({
      itemId: "FI-new", color: "Maroon",
    });
  });

  it("sends a larger, sharper copy than before, never the original, and each shoe's colours", async () => {
    const robot = await read("lib/worker-photo-robot.ts");
    expect(robot).toContain("small(photo.imageUrl, 1024, 85)");
    expect(robot).toContain("small(example.imageUrl, 512, 80)");
    expect(robot).toContain("colours: (history[item.id]?.colors ?? []).slice(0, 8),");
    expect(robot).toContain('.resize(side, side, { fit: "inside", withoutEnlargement: true })');
  });
});
