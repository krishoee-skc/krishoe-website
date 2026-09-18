import { describe, expect, it } from "vitest";
import { stageNeedingUpperFirst, upperShortfall } from "@/lib/stage-order";

/**
 * A bottom cannot be made for an upper that does not exist.
 *
 * The owner's rule, in his words: fibre and bottom work is only ever done on
 * uppers that are already made. You cannot fit a sole to nothing. The app never
 * knew this — createFactoryWork checks the item, the stage, the colour and the
 * size, and would happily accept sixty bottoms of a shoe whose upper had never
 * been cut.
 *
 * It has not happened yet: every pair in the records was entered upper-first.
 * But nothing stopped it, and once stock posts itself from these entries a
 * bottom-only entry would put pairs in the godown that were never made.
 *
 * The rule is about quantity, not just order. Sixty uppers and eighty bottoms
 * is twenty bottoms for shoes that do not exist, even though the upper came
 * first.
 *
 * Deliberately scoped: only the stages that sit on an upper are held back.
 * Upper itself is never blocked, and neither is Packing / QC, which counts
 * finished pairs rather than making them.
 */

describe("which stages need an upper first", () => {
  it("holds back the bottom stages", () => {
    expect(stageNeedingUpperFirst("Fibermen")).toBe(true);
    expect(stageNeedingUpperFirst("Fiber Preparation")).toBe(true);
    expect(stageNeedingUpperFirst("Fiber Silai")).toBe(true);
    expect(stageNeedingUpperFirst("Bottom Final")).toBe(true);
  });

  it("never blocks Upper itself", () => {
    // The first stage has nothing before it. Blocking it would stop the
    // factory entirely.
    expect(stageNeedingUpperFirst("Upper")).toBe(false);
  });

  it("does not block counting or staff work", () => {
    // Packing / QC counts pairs that already exist rather than making them,
    // and Staff work is not on a shoe at all.
    expect(stageNeedingUpperFirst("Packing / QC")).toBe(false);
    expect(stageNeedingUpperFirst("Staff")).toBe(false);
    expect(stageNeedingUpperFirst("")).toBe(false);
  });
});

describe("how many pairs are short", () => {
  it("allows a bottom run that matches the uppers made", () => {
    expect(upperShortfall({ uppersMade: 60, bottomsAlready: 0, wanted: 60 })).toBe(0);
  });

  it("allows less than the uppers made", () => {
    // Forty bottoms against sixty uppers is a part-finished batch, which is
    // normal — the rest follow tomorrow.
    expect(upperShortfall({ uppersMade: 60, bottomsAlready: 0, wanted: 40 })).toBe(0);
  });

  it("refuses more bottoms than uppers", () => {
    // Eighty bottoms on sixty uppers is twenty pairs that cannot exist.
    expect(upperShortfall({ uppersMade: 60, bottomsAlready: 0, wanted: 80 })).toBe(20);
  });

  it("counts the bottoms already made", () => {
    // Sixty uppers, forty bottoms done, thirty more asked for: ten too many.
    expect(upperShortfall({ uppersMade: 60, bottomsAlready: 40, wanted: 30 })).toBe(10);
  });

  it("refuses every pair when no upper was made at all", () => {
    expect(upperShortfall({ uppersMade: 0, bottomsAlready: 0, wanted: 60 })).toBe(60);
  });

  it("does not go negative when bottoms are behind", () => {
    // Twenty bottoms against sixty uppers leaves room, not a negative debt.
    expect(upperShortfall({ uppersMade: 60, bottomsAlready: 20, wanted: 10 })).toBe(0);
  });
});
