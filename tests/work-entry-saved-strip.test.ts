import { describe, expect, it } from "vitest";
import { readWorkEntryScreen } from "./helpers/work-entry-screen";

const read = () => readWorkEntryScreen();

/**
 * Add work, owner's sample क and ग (2026-10-26): what was just saved is one
 * strip above the form, not a card that pushed the form down, and "✓ Saved"
 * steps aside after five seconds.
 */
describe("क · one strip, with everything the card had", () => {
  it("keeps the three states, the details, the count and the three ways on", async () => {
    const form = await read();
    const strip = form.slice(form.indexOf("{savedCard && !savedCard.hidden ? ("), form.indexOf("{success && ("));
    for (const piece of [
      'text("⏳ Saving…", "⏳ टिप्दै…")',
      'text("📴 Kept on this phone", "📴 फोनमा राखियो")',
      'text("✓ Saved", "✓ टिपियो")',
      // The strip is its own part since 2026-10-27, given the card as card.
      "card={savedCard}",
      "card.workerName",
      "card.itemName",
      "card.color",
      "compactSizes(card.size)",
      "money(card.amount)",
      'text("just now", "भर्खर")',
      'text("Next entry", "अर्को entry")',
      'text("Another worker", "अर्को कामदार")',
      'text("Wrong? Fix it", "गल्ती? सच्याउने")',
      "/admin/factory/ledger?workerId=",
    ]) {
      expect(strip, piece).toContain(piece);
    }
    expect(strip).toContain('className="flex flex-wrap items-center gap-x-3');
    expect(strip).not.toContain("text-2xl");
  });
});

describe("ग · steps aside after five seconds", () => {
  it("hides only a finished save, and never one kept on the phone", async () => {
    const form = await read();
    expect(form).toContain("const SAVED_CARD_SECONDS = 5;");
    const timer = form.slice(form.indexOf("const [cardHeld, setCardHeld]"), form.indexOf("}, [savedCard, cardHeld]);"));
    expect(timer).toContain("savedCard.pending || savedCard.kept || savedCard.hidden || cardHeld");
    expect(timer).toContain("hidden: true");
  });

  it("stays while a pointer or the cursor is on it", async () => {
    const form = await read();
    expect(form).toContain("onMouseEnter={() => onHold(true)}");
    expect(form).toContain("onFocus={() => onHold(true)}");
    expect(form).toContain("onHold={setCardHeld}");
  });

  it("only hides the strip: the day's list still marks the row just saved", async () => {
    const form = await read();
    expect(form).toContain("fresh={savedCard && !savedCard.pending ?");
  });
});
