import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * "Enter did not move" after the cash box (owner, 2026-09-30). It had: Enter
 * on the last box brought up "Save?" — at the foot of a bill pinned beside a
 * long shoe list and taller than the screen, where no scrolling reached it.
 */
describe("the bill's Save? question is seen", () => {
  it("lets the bill scroll inside itself on a computer", async () => {
    const form = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(form).toContain("md:sticky md:top-4 md:block md:max-h-[calc(100dvh-2rem)] md:overflow-y-auto");
  });

  it("brings the question to the middle of the screen", async () => {
    const walk = await read("components/admin/EnterWalkForm.tsx");
    expect(walk).toContain('yesRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });');
  });
});
