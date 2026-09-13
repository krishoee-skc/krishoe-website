"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { saveProductPhotoAction, type PhotoActionState } from "./actions";

type PhotoProduct = {
  id: string;
  name: string;
  sku: string;
  image: string;
  galleryCount: number;
  hasRealPhoto: boolean;
};

/**
 * One product, one photo, two ways to change it.
 *
 * Two separate buttons rather than one, because `capture` is not a hint: a file
 * input carrying it opens the camera and gives no way to reach the gallery, and
 * one without it opens the gallery and makes re-shooting an extra trip through
 * the camera app. The owner photographs stock on the shop floor and also has
 * shots already on the phone, so both doors have to exist.
 *
 * The upload saves as soon as it finishes. There is no second Save to press —
 * with ten products on screen, a page full of unsaved changes is a page where
 * one gets forgotten.
 */
/**
 * A phone shoots 3000px or more, so anything this small did not come from a
 * camera — it came through WhatsApp, or is a screenshot. Those are the photos
 * that look sharp on the phone and blurred in the shop, where the product page
 * shows them large. Reading the real pixels is honest; guessing at "blurry"
 * from the image itself is not, so this checks only what it can measure.
 */
const MIN_GOOD_EDGE = 1000;

function readSize(file: File) {
  return new Promise<{ width: number; height: number } | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const probe = new window.Image();
    probe.onload = () => {
      resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
      URL.revokeObjectURL(url);
    };
    probe.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    probe.src = url;
  });
}

export default function PhotoCard({ product }: { product: PhotoProduct }) {
  const { text } = useLanguage();
  const [image, setImage] = useState(product.image);
  const [state, setState] = useState<PhotoActionState | null>(null);
  const [sizeWarning, setSizeWarning] = useState<{ en: string; ne: string } | null>(null);
  // A cut-out waiting to be kept or discarded. Held here rather than saved,
  // because whether it worked is something only the owner can see.
  const [cutout, setCutout] = useState<{ url: string; keptPercent: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef<HTMLDialogElement>(null);

  async function upload(files: FileList | null, slot: "main" | "gallery") {
    const file = files?.[0];
    if (!file) return;

    setBusy(true);
    setState(null);
    setSizeWarning(null);

    try {
      const size = await readSize(file);
      if (size && Math.min(size.width, size.height) < MIN_GOOD_EDGE) {
        setSizeWarning({
          en: `This photo is small (${size.width}×${size.height}). Did it come through WhatsApp? It can look blurred in the shop — take it straight from the phone camera instead.`,
          ne: `यो फोटो सानो छ (${size.width}×${size.height})। WhatsApp बाट आएको हो कि? पसलमा धमिलो देखिन सक्छ — फोनको camera बाट सिधै खिच्नुहोस्।`,
        });
      }

      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/upload", { method: "POST", body });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || text(`The photo did not upload (${response.status}).`, `फोटो चढेन (${response.status})।`));
      }

      const { url } = (await response.json()) as { url: string };

      const save = new FormData();
      save.append("productId", product.id);
      save.append("image", url);
      save.append("slot", slot);
      const result = await saveProductPhotoAction(null, save);

      setState(result);
      if (result.ok && slot === "main") setImage(url);
    } catch (error) {
      // An upload error already carries its own sentence, in one language;
      // when it carries none, the pair below supplies both halves.
      const failed = error instanceof Error ? error.message : "";
      const fallback = { en: "The photo did not upload.", ne: "फोटो चढेन।" };
      setState({
        ok: false,
        en: failed || fallback.en,
        ne: failed || fallback.ne,
      });
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  /**
   * Lift the shoe off the photo that is already on this card.
   *
   * Sends the URL rather than a file: the photo has been uploaded, and asking
   * the shopkeeper to find the original on their phone again to do this would
   * be the long way round from the screen they are already on.
   *
   * The result is shown and not saved. `cutout` holds it until they press keep,
   * because the model does well on a plain background and keeps the hand when
   * the shoe is being held — that is a judgement, not something to write over
   * their photo unasked.
   */
  async function removeBackground() {
    setBusy(true);
    setState(null);
    setSizeWarning(null);
    setCutout(null);

    try {
      const body = new FormData();
      body.append("url", image);

      const response = await fetch("/api/admin/remove-background", { method: "POST", body });
      const data = (await response.json().catch(() => ({}))) as {
        url?: string;
        keptPercent?: number;
        error?: string;
      };

      if (!response.ok || !data.url) {
        throw new Error(
          data.error ||
            text("The background could not be removed.", "पृष्ठभूमि हटाउन सकिएन।"),
        );
      }

      setCutout({ url: data.url, keptPercent: data.keptPercent ?? 0 });
    } catch (error) {
      // An error that came back from the route already carries its own
      // sentence; when it carries none, this pair supplies both halves.
      const failed = error instanceof Error ? error.message : "";
      const fallback = { en: "The background could not be removed.", ne: "पृष्ठभूमि हटाउन सकिएन।" };
      setState({ ok: false, en: failed || fallback.en, ne: failed || fallback.ne });
    } finally {
      setBusy(false);
    }
  }

  /** Keep the cut-out: save it over the main photo, the same way an upload does. */
  async function keepCutout() {
    if (!cutout) return;

    setBusy(true);
    try {
      const save = new FormData();
      save.append("productId", product.id);
      save.append("image", cutout.url);
      save.append("slot", "main");

      const result = await saveProductPhotoAction(null, save);
      setState(result);
      if (result.ok) setImage(cutout.url);
      setCutout(null);
    } finally {
      setBusy(false);
    }
  }

  const previewable = image.startsWith("/") || image.startsWith("http");

  return (
    <article className="grid gap-3 rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm">
      {/* Tap to see it big. On the card a photo is 220px wide and a blurred one
          looks fine there; the shop shows it far larger, which is where the
          blur appears. Judging it needs the same size the customer gets. */}
      <button
        type="button"
        onClick={() => viewRef.current?.showModal()}
        disabled={!previewable}
        aria-label={text(`See ${product.name} larger`, `${product.name} को फोटो ठूलो हेर्ने`)}
        className="relative block aspect-square w-full overflow-hidden rounded-xl bg-brand-mist"
      >
        {previewable ? (
          <Image src={image} alt={product.name} fill sizes="(max-width: 640px) 45vw, 220px" className="object-cover" />
        ) : null}
        {previewable ? (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-black text-white">
            🔍 {text("See it big", "ठूलो हेर्ने")}
          </span>
        ) : null}
        {!product.hasRealPhoto ? (
          <span className="absolute left-2 top-2 rounded-full bg-brand-clay px-2.5 py-1 text-[11px] font-black text-white">
            {text("No photo", "फोटो छैन")}
          </span>
        ) : null}
        {busy ? (
          <span className="absolute inset-0 grid place-items-center bg-brand-paper/75 text-sm font-black text-brand-green-ink">
            {text("Uploading…", "चढ्दै…")}
          </span>
        ) : null}
      </button>

      <div>
        <h3 className="truncate font-black text-brand-green-ink">{product.name}</h3>
        <p className="truncate font-mono text-[11px] text-brand-muted-soft">
          {product.sku} · {text(`${product.galleryCount} photos`, `${product.galleryCount} फोटो`)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
          className="min-h-11 rounded-xl bg-brand-green px-2 text-sm font-black text-white transition hover:bg-brand-green-ink disabled:opacity-60"
        >
          📷 {text("Take one", "खिच्ने")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
          className="min-h-11 rounded-xl border border-brand-green-line px-2 text-sm font-black text-brand-green-ink transition hover:border-brand-green disabled:opacity-60"
        >
          🖼️ {text("From a file", "फाइलबाट")}
        </button>
      </div>

      {/* Offered only once there is a real photo to work on — on a card still
          showing a sample there is nothing to lift a shoe out of. */}
      {product.hasRealPhoto && previewable ? (
        <button
          type="button"
          disabled={busy}
          onClick={removeBackground}
          className="min-h-11 rounded-xl border border-brand-gold bg-brand-cream-soft px-2 text-sm font-black text-brand-gold-ink transition hover:border-brand-gold-deep disabled:opacity-60"
        >
          ✂️ {text("Remove the background", "पृष्ठभूमि हटाउने")}
        </button>
      ) : null}

      {cutout ? (
        <div className="grid gap-2 rounded-xl border border-brand-gold/40 bg-brand-paper-deep p-3">
          <div className="grid grid-cols-2 gap-2">
            <figure className="m-0">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-brand-mist">
                <Image src={image} alt="" fill sizes="110px" className="object-contain" />
              </div>
              <figcaption className="mt-1 text-center text-[10px] font-bold text-brand-muted">
                {text("Now", "अहिले")}
              </figcaption>
            </figure>
            <figure className="m-0">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-brand-mist">
                <Image src={cutout.url} alt="" fill sizes="110px" className="object-contain" />
              </div>
              <figcaption className="mt-1 text-center text-[10px] font-bold text-brand-green">
                {text("After", "पछि")}
              </figcaption>
            </figure>
          </div>

          {/* A cut-out that kept most of the frame removed almost nothing —
              usually a busy background the model could not separate. */}
          {cutout.keptPercent > 60 ? (
            <p className="rounded-lg bg-brand-cream px-2.5 py-1.5 text-[11px] font-bold text-brand-gold-ink">
              {/* Both halves on one line: the shop's English-mode test reads a
                  line at a time, so a wrapped pair looks like a bare Nepali
                  string to it. */}
              {text("Little was removed. A plain background behind the shoe would do better.", "थोरै मात्र हट्यो। जुत्ताको पछाडि सादा पृष्ठभूमि राखे राम्रो हुन्छ।")}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={keepCutout}
              className="min-h-11 rounded-xl bg-brand-green px-2 text-sm font-black text-white transition hover:bg-brand-green-ink disabled:opacity-60"
            >
              {text("Keep this one", "यही राख्ने")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setCutout(null)}
              className="min-h-11 rounded-xl border border-brand-green-line px-2 text-sm font-black text-brand-green-ink transition hover:bg-brand-mist disabled:opacity-60"
            >
              {text("Discard", "नराख्ने")}
            </button>
          </div>
        </div>
      ) : null}

      {/* capture asks the phone for the rear camera; a desktop ignores it and
          opens the file picker, which is the right fallback either way. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => upload(event.target.files, "main")}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => upload(event.target.files, "main")}
      />

      {state ? (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-xs font-bold ${
            state.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"
          }`}
        >
          {text(state.en, state.ne)}
        </p>
      ) : null}

      {sizeWarning ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
          ⚠️ {text(sizeWarning.en, sizeWarning.ne)}
        </p>
      ) : null}

      {/* Native dialog: the browser handles Escape, the backdrop and focus, so
          there is no hand-rolled modal to trap anyone in. */}
      <dialog
        ref={viewRef}
        onClick={(event) => {
          if (event.target === viewRef.current) viewRef.current?.close();
        }}
        className="max-h-[90dvh] max-w-[92vw] rounded-2xl bg-brand-paper p-3 backdrop:bg-black/70"
      >
        {previewable ? (
          // Plain img, not next/image: this is a one-off full-size look at the
          // original file, and optimising it would hide the very softness the
          // owner opened it to judge.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.name}
            className="max-h-[74dvh] w-auto rounded-xl object-contain"
          />
        ) : null}
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm font-black text-brand-green-ink">{product.name}</p>
          <button
            type="button"
            onClick={() => viewRef.current?.close()}
            className="min-h-11 rounded-xl bg-brand-green px-5 text-sm font-black text-white"
          >
            {text("Close", "बन्द गर्ने")}
          </button>
        </div>
      </dialog>
    </article>
  );
}
