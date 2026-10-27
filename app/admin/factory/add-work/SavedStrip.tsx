"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { money } from "@/lib/format-money";
import { colourSwatch, compactSizes } from "@/lib/shoe-colour";

/** What was just saved, as the form holds it. */
export type SavedCard = {
  workerId: string;
  workerName: string;
  itemName: string;
  color: string;
  size: string;
  pairs: string;
  amount: number;
  pending: boolean;
  /** Kept on this phone for want of the internet (rule 4). */
  kept?: boolean;
  /** Stepped aside after a few seconds; the day's list still marks the row. */
  hidden?: boolean;
};

/**
 * What was just saved, in full, until the next entry is begun (owner,
 * 2026-10-04: after a save the form showed "Save 60 pairs · Rs. 2,400" again,
 * and it read as not saved).
 *
 * One strip, not a card (owner's sample क, 2026-10-26): the card pushed the
 * form about 170px down and said again what the day's list beside it already
 * says. Everything on the card is still here. A pointer or the cursor on it
 * holds it (onHold), so the form's five-second timer leaves it be.
 */
export default function SavedStrip({
  card,
  onHold,
  onNextEntry,
  onAnotherWorker,
}: {
  card: SavedCard;
  onHold: (held: boolean) => void;
  onNextEntry: () => void;
  onAnotherWorker: () => void;
}) {
  const { text } = useLanguage();
  return (
    <div
      role="status"
      onMouseEnter={() => onHold(true)}
      onMouseLeave={() => onHold(false)}
      onFocus={() => onHold(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onHold(false);
      }}
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border-2 border-brand-green bg-brand-green-wash px-3 py-2"
    >
      <p className="font-black text-brand-green">
        {card.pending
          ? text("⏳ Saving…", "⏳ टिप्दै…")
          : card.kept
            ? text("📴 Kept on this phone", "📴 फोनमा राखियो")
            : text("✓ Saved", "✓ टिपियो")}
      </p>
      <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm font-bold text-brand-green-ink">
        <span>{card.workerName}</span>
        <span aria-hidden="true">·</span>
        <span>{card.itemName}</span>
        {card.color ? (
          <>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              {colourSwatch(card.color) ? (
                <span aria-hidden="true" className="h-3 w-3 rounded-full ring-1 ring-black/20" style={{ background: colourSwatch(card.color) ?? undefined }} />
              ) : null}
              {card.color}
            </span>
          </>
        ) : null}
        {card.size ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{compactSizes(card.size)}</span>
          </>
        ) : null}
      </p>
      <p className="text-sm font-black tabular-nums text-brand-green">
        {text(`${card.pairs} pairs`, `${card.pairs} जोडी`)}
        {card.amount > 0 ? ` · ${money(card.amount)}` : ""}
      </p>
      <p className="text-xs font-bold text-brand-muted">{text("just now", "भर्खर")}</p>
      <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
        <button
          type="button"
          title={text("Next entry · same worker", "अर्को entry · उही कामदार")}
          onClick={onNextEntry}
          className="min-h-11 rounded-full bg-brand-green px-3 text-xs font-black text-white"
        >
          ➕ {text("Next entry", "अर्को entry")}
        </button>
        <button
          type="button"
          onClick={onAnotherWorker}
          className="min-h-11 rounded-full border border-brand-green-line bg-brand-paper px-3 text-xs font-black text-brand-green-ink"
        >
          👤 {text("Another worker", "अर्को कामदार")}
        </button>
        <Link
          href={`/admin/factory/ledger?workerId=${card.workerId}`}
          className="inline-flex min-h-11 items-center rounded-full px-2 text-xs font-bold text-brand-green underline underline-offset-4"
        >
          ✏️ {text("Wrong? Fix it", "गल्ती? सच्याउने")}
        </Link>
      </div>
    </div>
  );
}
