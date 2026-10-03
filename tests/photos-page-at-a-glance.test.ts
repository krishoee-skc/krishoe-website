import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const inbox = () => readFile("app/admin/factory/photos/WorkerInbox.tsx", "utf8");

/**
 * Owner, 2026-10-03 ("1 2 3 4 code garau"): the photo screen at a glance and
 * one press to book — nothing it could do before is gone.
 */
describe("the workers' photo screen", () => {
  it("opens on how many wait, what they would pay, and what went on this week", async () => {
    const source = await inbox();
    expect(source).toContain('text("To check", "जाँच्न बाँकी")');
    expect(source).toContain('text("Waiting to book", "चढ्न बाँकी")');
    expect(source).toContain('text("Booked this week", "यो हप्ता चढेको")');
    expect(source).toContain('role="tablist"');
    expect(source).toContain('text("Everyone", "सबै कामदार")');
  });

  it("books a filled photo from its card, with the amount on the button", async () => {
    const source = await inbox();
    expect(source).toContain("const ready = bookable(photo) && draft.work && complete(draft) && Boolean(price?.rate);");
    expect(source).toContain("onClick={() => bookOne(photo)}");
    expect(source).toContain('text("Open to change", "खोलेर फेर्ने")');
  });

  it("checks in four steps, with the amount and ✓ together and the rest under More", async () => {
    const source = await inbox();
    for (const label of ['text("Work", "काम")', 'text("What · how many", "के · कति")', 'text("Colour · size", "रङ · साइज")', 'text("Stage · day", "चरण · दिन")']) {
      expect(source).toContain(label);
    }
    expect(source).toContain('⋯ {text("More", "अरू")}');
    // Delete, hide, take back and the robot are kept, inside More
    for (const kept of ["deletePhotoAction(photo.id)", "hidePhotoAction(photo.id", "takeBackPhotoWorkAction(photo.id)", "robotPhotoAction(photo.id)", "notWorkPhotoAction(photo.id"]) {
      expect(source).toContain(kept);
    }
  });

  it("keeps ✓ on a phone's screen and offers Undo after it", async () => {
    const source = await inbox();
    expect(source).toContain("sticky bottom-24");
    expect(source).toContain('text("Undo", "फिर्ता")');
    expect(source).toContain("notice.ok && undo && canAnswer && reviewOn");
  });
});
