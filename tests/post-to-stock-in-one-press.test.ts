import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Posting finished pairs in one press.
 *
 * Until now the screen showed what could be ready and then asked the owner to
 * walk to the godown, count, and type the number back in. That count was the
 * only real check, and it was worth having while the app could not say which
 * pairs it meant — "bagopen, sixty" could have been any colour or size.
 *
 * It can say now. A row is one item in one colour in one size run, with both
 * stages recorded against it, so the number on screen is a real claim about
 * real pairs rather than an estimate. The owner asked for the walk to go.
 *
 * What stays is the decision. The button posts the number the row already
 * shows, but the box beside it remains, because the number is right most days
 * and wrong on the day something was damaged between the two stages — and on
 * that day the owner must be able to type 55 without fighting the screen.
 *
 * The box being pre-filled is what makes it one press. The box still existing
 * is what keeps it honest.
 */
const SCREEN = "app/admin/factory/add-work/ReadyToPost.tsx";

describe("one press posts what the row says", () => {
  it("pre-fills the box with the pairs the row found", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // Nothing to type on the ordinary day: the value falls back to what the
    // row computed, so pressing the button straight away posts the right
    // number.
    expect(screen).toMatch(/drafts\[groupKeyOf\(item\)\]\s*\?\?\s*String\(item\.pendingPairs\)/);
  });

  it("writes drafts under the same key it reads them from", async () => {
    const screen = await readFile(SCREEN, "utf8");
    const code = screen.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

    // The read moved to the group key and the write did not, so typing into
    // one row's box stored it under the item — where the row never looked for
    // it. The box appeared to reject every keystroke.
    // Scoped to the typing handler. The other setDrafts on this screen clears
    // the box after a successful post and already uses rowKey, so a whole-file
    // match would read that one and pass while the bug stood.
    const onChange = code.slice(code.indexOf("onChange={(event) =>"));
    expect(onChange.length, "the input's handler moved").toBeGreaterThan(0);

    expect(onChange.slice(0, 400), "the write must use the group key").not.toContain(
      "[item.itemId]",
    );
    expect(onChange.slice(0, 400)).toContain("[groupKeyOf(item)]");
  });

  it("keeps the box, so a damaged pair can be taken off", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // Sixty uppers and sixty bottoms with five spoiled in between is fifty-five
    // pairs. Removing the box would make that day impossible to record.
    expect(screen).toMatch(/type="number"/);
    expect(screen).toMatch(/min=\{1\}/);
  });
});

describe("what the button says it will do", () => {
  it("names the number it is about to post", async () => {
    const screen = await readFile(SCREEN, "utf8");

    // "Post to stock" hides what is being posted. With the count on the button
    // the owner reads the number and the action in one glance, which is the
    // whole point of removing the walk to the godown.
    expect(screen).toMatch(/Post \$\{|\$\{[^}]*\}\s*जोडी चढाउने|postLabel/);
  });

  it("stays a real tap target on a phone", async () => {
    const screen = await readFile(SCREEN, "utf8");
    const button = screen.slice(screen.indexOf("void post(item)"), screen.indexOf("void post(item)") + 700);

    expect(button.length, "the button moved").toBeGreaterThan(0);
    // The factory reads this screen on a phone. 44px is the target the rest of
    // the admin holds to.
    expect(button).toMatch(/min-h-12/);
  });
});
