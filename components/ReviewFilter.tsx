"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLanguage } from "@/components/LanguageProvider";

export type ReviewChip = { key: string; en: string; ne: string };

/**
 * The shoe buttons over the home page's reviews (owner, 2026-10-02: "the
 * reviews page's box, on the front"). The review cards are drawn on the server
 * with a data-review-shoe of their shoe's id ("shop" for the shop's own); a
 * button only hides the ones that are not about it, so nothing is fetched and
 * the cards stay in the page for search engines.
 */
export default function ReviewFilter({ chips, children }: { chips: ReviewChip[]; children: ReactNode }) {
  const { text } = useLanguage();
  const [chosen, setChosen] = useState("all");
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    element.querySelectorAll<HTMLElement>("[data-review-shoe]").forEach((card) => {
      // style, not the hidden attribute: the card's own "flex" class would win over it.
      card.style.display = chosen !== "all" && card.dataset.reviewShoe !== chosen ? "none" : "";
    });
    // Back to the start of the row, where the first card that is left sits.
    element.querySelector<HTMLElement>("[data-review-shoe]")?.parentElement?.scrollTo({ left: 0 });
  }, [chosen]);

  return (
    <div ref={box}>
      {chips.length > 2 ? (
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:justify-center" role="group" aria-label={text("Reviews of", "कुन जुत्ताको राय")}>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-pressed={chosen === chip.key}
              onClick={() => setChosen(chip.key)}
              className={`inline-flex min-h-10 flex-none items-center rounded-full px-4 text-sm font-bold transition ${
                chosen === chip.key
                  ? "bg-brand-green-ink text-white"
                  : "border border-brand-green-line bg-brand-paper text-brand-green-ink hover:border-brand-green"
              }`}
            >
              {text(chip.en, chip.ne)}
            </button>
          ))}
        </div>
      ) : null}
      {children}
    </div>
  );
}
