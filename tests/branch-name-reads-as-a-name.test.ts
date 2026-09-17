import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The branch name must read as a name, not as broken text.
 *
 * `break-all` was put on this line for the fallback case, where the label is a
 * 45-character id with nothing to break on. But it applies to the name too, and
 * a name is exactly what it must not be applied to: in the sidebar at its real
 * width, "narayangadh kamalnagar" came out as
 *
 *     narayangadh kamalnaga
 *     r
 *
 * — a word guillotined mid-syllable with one letter stranded on its own line.
 * On a screen the owner looks at all day, that reads as broken software.
 *
 * `break-words` fixes it: ordinary text wraps between words, and only a single
 * unbreakable run — the id — is split. Both cases get what they need.
 *
 * The size went up with it. 12px is caption size, and this is the line that
 * answers "which shop am I looking at?" — the same question the chip below it
 * answers about scope. It should not be the smallest thing in the card.
 */
const CARD = "components/admin/AdminIdentityCard.tsx";

describe("the branch name", () => {
  it("wraps between words, never mid-word", async () => {
    const card = await readFile(CARD, "utf8");
    const code = card.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // The whole bug in one class: break-all splits "kamalnagar" after the "a".
    expect(code, "break-all guillotines the name").not.toContain("break-all");
    expect(code, "break-words still splits a long id").toContain("break-words");
  });

  it("is not the smallest text in the card", async () => {
    const card = await readFile(CARD, "utf8");

    const line = card.slice(
      card.indexOf("{branchMark}") - 400,
      card.indexOf("{branchLabel}") + 60,
    );

    expect(line.length, "the branch line moved").toBeGreaterThan(0);
    // text-sm or larger. This line names the place the numbers on screen
    // belong to; the caption size it had undersold that.
    expect(line, "the branch name needs a readable size").toMatch(/text-(sm|base)/);
  });

  it("keeps the symbol from being squeezed", async () => {
    const card = await readFile(CARD, "utf8");

    // A flex row will shrink the emoji before it wraps the text next to it,
    // which reads as a smudge beside the name.
    const line = card.slice(card.indexOf("{branchMark}") - 200, card.indexOf("{branchMark}") + 40);
    expect(line).toContain("shrink-0");
  });
});
