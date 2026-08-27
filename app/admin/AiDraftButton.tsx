"use client";

import { useRef, useState, useTransition } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { draftProductCopyAction } from "./ai-copy-action";

/**
 * Fills the empty description boxes with a draft, and can put them back.
 *
 * Three decisions hold this together, and all three are about trust rather than
 * about the model:
 *
 *   Only empty boxes are touched. Words the owner typed are his; a tool that
 *   can quietly replace them is one he has to check after every press, which
 *   costs more attention than typing did.
 *
 *   What it filled is named, and undo is right there. He can see exactly which
 *   four boxes changed without scrolling the form comparing it to memory.
 *
 *   Nothing is saved. The draft sits in the inputs like anything he typed, and
 *   the Save button below is the same one it has always been. Closing the page
 *   without saving leaves the catalog untouched.
 */

/** Draft field name → the input's `name` on the product form. */
const FILLS = [
  "nameNe",
  "description",
  "descriptionNe",
  "longDescription",
  "longDescriptionNe",
  "material",
  "fit",
  "highlights",
  "care",
] as const;

const LABELS: Record<string, { en: string; ne: string }> = {
  nameNe: { en: "Nepali name", ne: "नेपाली नाम" },
  description: { en: "short description", ne: "छोटो विवरण" },
  descriptionNe: { en: "short Nepali description", ne: "नेपाली छोटो विवरण" },
  longDescription: { en: "long description", ne: "लामो विवरण" },
  longDescriptionNe: { en: "long Nepali description", ne: "नेपाली लामो विवरण" },
  material: { en: "material", ne: "सामग्री" },
  fit: { en: "fit", ne: "फिट" },
  highlights: { en: "highlights", ne: "विशेषता" },
  care: { en: "care", ne: "हेरचाह" },
};

type Field = HTMLInputElement | HTMLTextAreaElement;

type Note = { ok: boolean; head: { en: string; ne: string }; body: { en: string; ne: string } };

export default function AiDraftButton({ formRef }: { formRef: React.RefObject<HTMLFormElement | null> }) {
  const { text } = useLanguage();
  const [pending, startDrafting] = useTransition();
  const [message, setMessage] = useState<Note | null>(null);
  const [filled, setFilled] = useState<string[]>([]);

  /** What each box held before the draft went in, so undo is exact. */
  const before = useRef<Map<string, string>>(new Map());

  const read = (name: string) => {
    const field = formRef.current?.elements.namedItem(name) as Field | null;
    return field && "value" in field ? field : null;
  };

  const handleDraft = () => {
    const form = formRef.current;
    if (!form) return;

    const value = (name: string) => read(name)?.value.trim() ?? "";
    const name = value("name");

    if (!name) {
      setMessage({
        ok: false,
        head: { en: "Type the name first", ne: "पहिले जुत्ताको नाम लेख्नुहोस्" },
        body: {
          en: "The draft is written from the name, price and material — it needs at least the name.",
          ne: "नाम, मूल्य र सामग्री हेरेर विवरण लेखिन्छ — कम्तीमा नाम चाहिन्छ।",
        },
      });
      return;
    }

    // Only the boxes standing empty right now. Read at press time, not at
    // render, so a box he filled a moment ago is already protected.
    const empty = FILLS.filter((field) => !value(field));

    if (!empty.length) {
      setMessage({
        ok: false,
        head: { en: "Nothing is empty", ne: "भर्न बाँकी केही छैन" },
        body: {
          en: "Every description box already has words in it. Clear one to have it drafted.",
          ne: "सबै विवरण भरिसकियो। कुनै खाली गर्नुभयो भने त्यसैको मात्र लेखिन्छ।",
        },
      });
      return;
    }

    const category = read("categorySlug") as HTMLSelectElement | null;

    startDrafting(async () => {
      const result = await draftProductCopyAction({
        name,
        // The visible category text, not the slug — "Ladies Sandals" tells the
        // model what the shoe is; "ladies-sandals" makes it guess.
        category: category?.selectedOptions?.[0]?.text ?? "",
        price: value("priceRupees") ? `Rs. ${value("priceRupees")}` : "",
        material: value("material"),
        fit: value("fit"),
        colors: value("colors"),
        sizes: value("sizes"),
        badge: value("badge"),
        fields: [...empty],
      });

      if (!result.ok) {
        setMessage({
          ok: false,
          head: result.reason,
          // The technical half is written in English on purpose — it names quota
          // limits and environment variables, and it is the same sentence that
          // went into the audit log for whoever ends up fixing it.
          body: { en: result.detail, ne: result.detail },
        });
        return;
      }

      const written: string[] = [];
      before.current = new Map();

      for (const [field, draft] of Object.entries(result.draft)) {
        const input = read(field);
        // Checked again after the round trip: the owner had thirty seconds to
        // start typing while it thought, and that typing wins.
        if (!input || input.value.trim()) continue;

        before.current.set(field, input.value);
        input.value = draft;
        written.push(field);
      }

      setFilled(written);
      setMessage({
        ok: true,
        head: {
          en: `Drafted ${written.length} field${written.length === 1 ? "" : "s"} — nothing is saved yet`,
          ne: `${written.length} ठाउँ लेखियो — अझै save भएको छैन`,
        },
        body: result.dropped.length
          ? {
              en: `${result.dropped.length} draft was thrown away for promising something the shop has not offered.`,
              ne: `${result.dropped.length} ठाउँको लेखाइ फालियो — पसलले नगरेको वाचा लेखेको थियो।`,
            }
          : {
              en: "Read it, change what you want, then press Save.",
              ne: "पढ्नुहोस्, मन नपरेको सच्याउनुहोस्, अनि Save थिच्नुहोस्।",
            },
      });
    });
  };

  const handleUndo = () => {
    for (const [field, original] of before.current) {
      const input = read(field);
      if (input) input.value = original;
    }

    before.current = new Map();
    setFilled([]);
    setMessage(null);
  };

  return (
    <div className="rounded-lg border border-brand-gold/40 bg-brand-mist p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-brand-green-ink">
            {text("Let AI write the descriptions", "विवरण AI ले लेखोस्")}
          </p>
          <p className="mt-0.5 text-xs text-brand-muted">
            {text(
              "Fills only the empty boxes. Nothing is saved until you press Save.",
              "खाली ठाउँ मात्र भरिन्छ। Save नथिचेसम्म केही पनि सुरक्षित हुँदैन।",
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {filled.length ? (
            <button
              type="button"
              onClick={handleUndo}
              className="inline-flex h-10 items-center rounded-full border border-black/10 px-4 text-sm font-bold text-brand-green transition hover:bg-brand-paper"
            >
              {text("Undo", "फिर्ता लिने")}
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleDraft}
            disabled={pending}
            className="inline-flex h-10 items-center rounded-full bg-brand-gold-bright px-5 text-sm font-black text-brand-green-ink transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? text("Writing…", "लेख्दै…") : text("Write with AI", "AI ले लेखोस्")}
          </button>
        </div>
      </div>

      {message ? (
        <div
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            message.ok
              ? "border-brand-green/30 bg-brand-paper text-brand-green-ink"
              : "border-brand-clay/40 bg-brand-paper text-brand-clay-ink"
          }`}
        >
          <p className="font-bold">{text(message.head.en, message.head.ne)}</p>
          <p className="mt-0.5 text-xs text-brand-muted">{text(message.body.en, message.body.ne)}</p>

          {filled.length ? (
            <p className="mt-1.5 text-xs text-brand-muted">
              {text("Filled: ", "भरिएको: ")}
              {filled
                .map((field) => text(LABELS[field]?.en ?? field, LABELS[field]?.ne ?? field))
                .join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
