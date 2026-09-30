"use client";

import { useState, useTransition } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { ownerSummaryAction, type OwnerSummaryFacts } from "@/app/admin/owner-summary-action";

/**
 * "Today's summary" on the Owner's dashboard (owner, 2026-10-01): a press
 * writes three to five points for the day from the figures already on screen.
 * On demand, not on every visit, so the AI is asked only when wanted. Always
 * in Nepali — the Owner's own reading — and says whether the AI wrote it.
 */
export default function OwnerSummary({ facts }: { facts: OwnerSummaryFacts }) {
  const { text } = useLanguage();
  const [points, setPoints] = useState<string[] | null>(null);
  const [byAi, setByAi] = useState(false);
  const [failed, setFailed] = useState(false);
  const [asking, startAsking] = useTransition();

  function ask() {
    setFailed(false);
    startAsking(async () => {
      const result = await ownerSummaryAction(facts);
      if (result.ok) {
        setPoints(result.points);
        setByAi(result.byAi);
      } else {
        setFailed(true);
      }
    });
  }

  return (
    <div className="grid gap-2 rounded-2xl border border-brand-gold/60 bg-brand-cream-soft p-3">
      {points === null ? (
        <button
          type="button"
          onClick={ask}
          disabled={asking}
          className="min-h-11 rounded-xl bg-brand-green-ink px-4 text-sm font-black text-white disabled:opacity-60"
        >
          {asking ? text("Writing…", "लेख्दैछ…") : text("✨ Today's summary", "✨ आजको सारांश")}
        </button>
      ) : (
        <>
          <p className="text-sm font-black text-brand-gold-deep">
            ✨ {text("Today's summary", "आजको सारांश")}
            <span className="ml-1 font-semibold text-brand-muted">
              · {byAi ? text("written by AI from today's figures", "आजका अंकबाट AI ले लेखेको") : text("from today's figures", "आजका अंकबाट")}
            </span>
          </p>
          {points.length === 0 ? (
            <p className="text-sm text-brand-muted">{text("Nothing to add today.", "आज थप भन्नुपर्ने केही छैन।")}</p>
          ) : (
            <ol className="grid list-decimal gap-1 pl-5 text-base text-brand-green-ink">
              {points.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ol>
          )}
          <button type="button" onClick={ask} disabled={asking} className="w-fit text-xs font-bold text-brand-green underline">
            {asking ? text("Writing…", "लेख्दैछ…") : text("Write again", "फेरि लेख्ने")}
          </button>
        </>
      )}
      {failed ? <p className="text-xs font-bold text-brand-clay">{text("Could not write it. Try again.", "लेख्न सकिएन। फेरि प्रयास गर्नुहोस्।")}</p> : null}
    </div>
  );
}
