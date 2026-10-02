"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { findFramedPhotosAction, fixFramedPhotoAction, type FramedPhoto, type PhotoActionState } from "./actions";

/**
 * "Mend old photos" (owner, 2026-10-02). Looks first: each shoe whose cover has
 * bars in it is shown as it is now and as it would be, side by side, and only
 * a press saves one. A saved fix is a new photo; the old one stays behind it.
 */
export default function FixFramedPhotos() {
  const { text } = useLanguage();
  const router = useRouter();
  const [found, setFound] = useState<FramedPhoto[] | null>(null);
  const [replies, setReplies] = useState<Record<string, PhotoActionState>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [looking, startLooking] = useTransition();

  function look() {
    startLooking(async () => {
      setReplies({});
      setFound(await findFramedPhotosAction());
    });
  }

  async function mend(ids: string[]) {
    for (const id of ids) {
      setBusy(id);
      const reply = await fixFramedPhotoAction(id);
      setReplies((current) => ({ ...current, [id]: reply }));
    }
    setBusy(null);
    router.refresh();
  }

  const waiting = (found ?? []).filter((item) => !replies[item.productId]?.ok);

  return (
    <div className="mt-5 rounded-2xl border border-brand-green-line bg-brand-paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-black text-brand-green-ink">{text("Mend old photos", "पुराना फोटो मिलाउने")}</p>
          <p className="text-sm leading-6 text-brand-muted">
            {text(
              "Old photos were squared with grey bars at the sides, so the shoe shows small on a phone. This cuts the bars and frames the shoe 4:5. You see each one first; the old photo is kept.",
              "पुराना फोटोमा छेउमा खैरो पट्टी छन्, त्यसैले फोनमा जुत्ता सानो देखिन्छ। यसले पट्टी काटेर जुत्ता ४:५ मा मिलाउँछ। पहिले हेर्न पाइन्छ; पुरानो फोटो पनि रहन्छ।",
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={look}
          disabled={looking || busy !== null}
          className="inline-flex min-h-11 items-center rounded-xl bg-brand-green px-4 text-sm font-black text-white disabled:opacity-60"
        >
          {looking ? text("Looking…", "हेर्दै…") : text("Find photos with bars", "पट्टी भएका फोटो खोज्ने")}
        </button>
      </div>

      {found && found.length === 0 ? (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">
          {text("No cover photo has bars ✅", "कुनै मुख्य फोटोमा पट्टी छैन ✅")}
        </p>
      ) : null}

      {found && found.length > 0 ? (
        <>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {found.map((item) => {
              const reply = replies[item.productId];
              const { frame } = item;
              return (
                <li key={item.productId} className="grid gap-2 rounded-xl border border-brand-green-line p-3">
                  <p className="truncate text-sm font-black text-brand-green-ink">{item.name}</p>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold text-brand-muted">
                    <figure className="grid gap-1">
                      <span className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-brand-mist">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      </span>
                      <figcaption>{text("Now", "अहिले")}</figcaption>
                    </figure>
                    <figure className="grid gap-1">
                      {/* The kept piece, drawn from the same photo: what the
                          saved one will look like. */}
                      <span className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-brand-mist">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.image}
                          alt=""
                          className="absolute max-w-none"
                          style={{
                            width: `${(frame.width / frame.cropWidth) * 100}%`,
                            height: `${(frame.height / frame.cropHeight) * 100}%`,
                            left: `${(-frame.left / frame.cropWidth) * 100}%`,
                            top: `${(-frame.top / frame.cropHeight) * 100}%`,
                          }}
                        />
                      </span>
                      <figcaption className="text-brand-green">{text("Mended", "मिलाएपछि")}</figcaption>
                    </figure>
                  </div>
                  {reply ? (
                    <p className={`text-sm font-bold ${reply.ok ? "text-emerald-800" : "text-brand-clay"}`}>{text(reply.en, reply.ne)}</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void mend([item.productId])}
                      disabled={busy !== null}
                      className="inline-flex min-h-11 items-center justify-center rounded-xl border border-brand-green px-3 text-sm font-black text-brand-green disabled:opacity-60"
                    >
                      {busy === item.productId ? text("Mending…", "मिलाउँदै…") : text("Mend this one", "यो मिलाउने")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {waiting.length > 1 ? (
            <button
              type="button"
              onClick={() => void mend(waiting.map((item) => item.productId))}
              disabled={busy !== null}
              className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-brand-green px-4 text-sm font-black text-white disabled:opacity-60"
            >
              {text(`Mend all ${waiting.length}`, `सबै ${waiting.length} मिलाउने`)}
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
