"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import T from "@/components/T";

/**
 * Lift a shoe off its background — shown, then kept or discarded.
 *
 * Never automatic, and that is the whole design. The model does well on a shoe
 * photographed against a plain surface, and on the shop's storeroom photos it
 * keeps the hand holding the shoe and some of the bagged stock behind, because
 * those are foreground too and no model can know which foreground was meant.
 * So it runs when asked, shows both pictures side by side, and writes nothing
 * until the owner says keep.
 *
 * The honest advice is in the panel itself: a white cloth behind the shoe does
 * more than this can, and costs a hundred rupees. This is for the photos that
 * already exist and cannot be taken again.
 */
export default function RemoveBackgroundButton({
  currentUrl,
  onKeep,
}: {
  /** The photo showing now, used as the "before" in the comparison. */
  currentUrl: string;
  /** Called with the new URL when the owner keeps the result. */
  onKeep: (url: string) => void;
}) {
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<{ url: string; keptPercent: number } | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function run(file: File) {
    setWorking(true);
    setError("");
    setResult(null);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/admin/remove-background", { method: "POST", body });
      const data = (await response.json()) as { url?: string; keptPercent?: number; error?: string };

      if (!response.ok || !data.url) {
        setError(data.error ?? "That did not work. The photo is unchanged.");
        return;
      }

      setResult({ url: data.url, keptPercent: data.keptPercent ?? 0 });
    } catch {
      setError("That did not work. The photo is unchanged.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-brand-green-ink">
            <T en="Remove the background" ne="पृष्ठभूमि हटाउने" />
          </p>
          <p className="mt-0.5 text-xs text-brand-muted">
            <T
              en="Works best on a shoe photographed against a plain surface. Nothing is saved until you keep it."
              ne="सादा पृष्ठभूमिमा खिचेको फोटोमा राम्रो काम गर्छ। तपाईंले राख्नु नभएसम्म केही सुरक्षित हुँदैन।"
            />
          </p>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={working}
          className="inline-flex min-h-11 items-center rounded-full bg-brand-green px-5 text-sm font-black text-white transition hover:bg-brand-green-ink disabled:opacity-60"
        >
          {working ? (
            <T en="Working…" ne="गर्दै…" />
          ) : (
            <T en="Try it" ne="प्रयास गर्ने" />
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        aria-label="Photo to remove the background from"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void run(file);
          event.target.value = "";
        }}
      />

      {error ? (
        <p className="mt-3 rounded-xl bg-brand-clay-tint px-3 py-2 text-xs font-semibold text-brand-clay">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-3">
            {currentUrl ? (
              <figure className="m-0">
                <div className="relative aspect-square overflow-hidden rounded-xl bg-brand-mist">
                  <Image src={currentUrl} alt="" fill sizes="200px" className="object-contain" />
                </div>
                <figcaption className="mt-1 text-center text-[11px] font-semibold text-brand-muted">
                  <T en="Now" ne="अहिले" />
                </figcaption>
              </figure>
            ) : null}

            <figure className="m-0">
              <div className="relative aspect-square overflow-hidden rounded-xl bg-brand-mist">
                <Image src={result.url} alt="" fill sizes="200px" className="object-contain" />
              </div>
              <figcaption className="mt-1 text-center text-[11px] font-semibold text-brand-green">
                <T en="After" ne="पछि" />
              </figcaption>
            </figure>
          </div>

          {/* A cut-out that kept most of the frame removed almost nothing —
              usually a busy background the model could not separate. Saying so
              is better than letting it look like a considered result. */}
          {result.keptPercent > 60 ? (
            <p className="mt-3 rounded-xl bg-brand-cream px-3 py-2 text-xs font-semibold text-brand-gold-ink">
              <T
                en="Most of the picture was kept, so little was removed. A plain background behind the shoe would do better."
                ne="धेरै भाग जस्ताको तस्तै रह्यो, थोरै मात्र हट्यो। जुत्ताको पछाडि सादा पृष्ठभूमि राखे राम्रो हुन्छ।"
              />
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onKeep(result.url);
                setResult(null);
              }}
              className="inline-flex min-h-11 items-center rounded-full bg-brand-green px-5 text-sm font-black text-white transition hover:bg-brand-green-ink"
            >
              <T en="Keep this one" ne="यही राख्ने" />
            </button>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="inline-flex min-h-11 items-center rounded-full border border-brand-green-line px-5 text-sm font-bold text-brand-green-ink transition hover:bg-brand-mist"
            >
              <T en="Discard" ne="नराख्ने" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
