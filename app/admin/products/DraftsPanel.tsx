"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { publishDraftAction, type PublishState } from "@/app/admin/products/actions";
import type { ShoeReadiness } from "@/lib/product-readiness";

type Draft = ShoeReadiness & { id: string; name: string; stock: number };

/**
 * The Drafts, each with what it still needs (owner, 2026-10-07).
 *
 * The list below said only "Draft", so a shoe one photo away from the shop sat
 * beside one with nothing filled in, and none went live. Here the ready ones
 * come first, each one press from the shop; the rest say what is missing.
 */
export default function DraftsPanel({ drafts }: { drafts: Draft[] }) {
  const { text } = useLanguage();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState("");
  const [reply, setReply] = useState<PublishState | null>(null);

  if (drafts.length === 0) return null;

  // Ready first; then the ones closest to ready; pairs in stock break a tie.
  const ordered = [...drafts].sort(
    (a, b) => a.blocking.length - b.blocking.length || b.stock - a.stock || a.name.localeCompare(b.name),
  );
  const readyCount = drafts.filter((draft) => draft.ready).length;

  const publish = (id: string) => {
    setBusyId(id);
    start(async () => {
      const result = await publishDraftAction(id);
      setReply(result);
      setBusyId("");
      if (result.ok) router.refresh();
    });
  };

  return (
    <section className="mt-6 rounded-2xl border border-brand-green-line bg-brand-paper p-4 sm:p-5">
      <h2 className="text-lg font-black text-brand-green-ink">
        📝 {text(`${drafts.length} shoes in Draft — customers do not see them`, `${drafts.length} जुत्ता Draft मा छन् — ग्राहकले देख्दैनन्`)}
      </h2>
      <p className="mt-1 text-sm text-brand-muted">
        {readyCount > 0
          ? text(`${readyCount} ready to go on the shop. The rest say what they still need.`, `${readyCount} पसलमा राख्न तयार छन्। बाँकीमा के चाहिन्छ, लेखिएको छ।`)
          : text("None is ready yet. Each says what it still needs.", "अहिले कुनै तयार छैन। हरेकमा के चाहिन्छ, लेखिएको छ।")}
      </p>

      {reply ? (
        <p role="status" className={`mt-3 rounded-xl px-4 py-2 text-sm font-bold ${reply.ok ? "bg-brand-green-tint text-brand-green" : "bg-brand-clay-tint text-brand-clay"}`}>
          {text(reply.en, reply.ne)}
        </p>
      ) : null}

      <ul className="mt-3 grid gap-2">
        {ordered.map((draft) => (
          <li
            key={draft.id}
            className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5 ${
              draft.ready ? "border-brand-green bg-brand-green-tint" : "border-brand-green-line"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-black text-brand-green-ink">
                {draft.name}
                <span className="ml-2 text-xs font-bold text-brand-muted">{text(`${draft.stock} pairs`, `${draft.stock} जोडी`)}</span>
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs font-bold">
                {draft.ready ? (
                  <span className="text-brand-green">✓ {text("Ready", "तयार")}</span>
                ) : (
                  draft.blocking.map((need) => (
                    <span key={need.key} className="rounded-full bg-brand-clay-tint px-2 py-0.5 text-brand-clay">
                      {text(`needs ${need.en}`, `${need.ne} चाहिन्छ`)}
                    </span>
                  ))
                )}
                {draft.advice.map((need) => (
                  <span key={need.key} className="rounded-full bg-brand-paper-deep px-2 py-0.5 text-brand-muted">
                    {text(`better with ${need.en}`, `${need.ne} भए राम्रो`)}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/admin/products?edit=${encodeURIComponent(draft.id)}`}
                className="inline-flex min-h-10 items-center rounded-full border border-brand-green-line px-3 text-xs font-bold text-brand-green"
              >
                ✏️ {text("Fill in", "भर्ने")}
              </Link>
              {draft.ready ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => publish(draft.id)}
                  className="min-h-10 rounded-full bg-brand-green px-4 text-xs font-black text-white disabled:opacity-60"
                >
                  {busyId === draft.id ? text("Putting on…", "राख्दै…") : text("🛍️ Put on the shop", "🛍️ पसलमा राख्ने")}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
