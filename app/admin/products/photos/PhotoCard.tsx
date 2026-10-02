"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { CameraIcon, ImageIcon, SearchIcon } from "@/components/Icons";
import { removePhotoAction, saveProductPhotoAction, setCoverPhotoAction, type PhotoActionState } from "./actions";
import PhotoCropper from "./PhotoCropper";

type PhotoProduct = {
  id: string;
  name: string;
  sku: string;
  image: string;
  gallery: string[];
  hasRealPhoto: boolean;
};

/**
 * One shoe, its photos, and the ways to change them.
 *
 * Two doors to a photo rather than one, because `capture` is not a hint: a
 * file input carrying it opens the camera and gives no way to reach the
 * gallery, and one without it opens the gallery. The owner photographs stock
 * on the shop floor and also has shots already on the phone.
 *
 * Every photo is framed before it goes up (owner, 2026-10-02): the 4:5 frame
 * the shop shows, the shoe moved into it by finger — see PhotoCropper. Then it
 * saves at once; there is no second Save to forget. Up to six photos, the
 * first one the cover on every card, any of them made the cover with a tap.
 */
/**
 * A phone shoots 3000px or more, so anything this small did not come from a
 * camera — it came through WhatsApp, or is a screenshot. Reading the real
 * pixels is honest; guessing at "blurry" from the image itself is not, so
 * this checks only what it can measure.
 */
const MIN_GOOD_EDGE = 1000;
const MAX_PHOTOS = 6;

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
  const [gallery, setGallery] = useState(product.gallery.length ? product.gallery : product.image ? [product.image] : []);
  const [state, setState] = useState<PhotoActionState | null>(null);
  const [sizeWarning, setSizeWarning] = useState<{ en: string; ne: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [framing, setFraming] = useState<{ file: File; slot: "main" | "gallery" } | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const moreRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef<HTMLDialogElement>(null);

  async function choose(files: FileList | null, slot: "main" | "gallery") {
    const file = files?.[0];
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
    if (moreRef.current) moreRef.current.value = "";
    if (!file) return;
    setState(null);
    setSizeWarning(null);
    const size = await readSize(file);
    if (size && Math.min(size.width, size.height) < MIN_GOOD_EDGE) {
      setSizeWarning({
        en: `This photo is small (${size.width}×${size.height}). Did it come through WhatsApp? It can look blurred in the shop — take it straight from the phone camera instead.`,
        ne: `यो फोटो सानो छ (${size.width}×${size.height})। WhatsApp बाट आएको हो कि? पसलमा धमिलो देखिन सक्छ — फोनको camera बाट सिधै खिच्नुहोस्।`,
      });
    }
    // A GIF or an unusual file goes up as it is; everything else is framed first.
    if (/^image\/(jpeg|png|webp|heic|heif|avif)$/.test(file.type)) setFraming({ file, slot });
    else void upload(file, slot);
  }

  async function upload(file: File, slot: "main" | "gallery") {
    setBusy(true);
    try {
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
      if (result.ok && slot === "main") {
        setImage(url);
        setGallery((current) => [url, ...current.filter((item) => item !== image && item !== url)]);
      }
      if (result.ok && slot === "gallery") setGallery((current) => [...current.filter((item) => item !== url), url]);
    } catch (error) {
      // An upload error already carries its own sentence, in one language;
      // when it carries none, the pair below supplies both halves.
      const failed = error instanceof Error ? error.message : "";
      const fallback = { en: "The photo did not upload.", ne: "फोटो चढेन।" };
      setState({ ok: false, en: failed || fallback.en, ne: failed || fallback.ne });
    } finally {
      setBusy(false);
    }
  }

  async function makeCover(url: string) {
    setBusy(true);
    const form = new FormData();
    form.append("productId", product.id);
    form.append("image", url);
    const result = await setCoverPhotoAction(null, form);
    setState(result);
    if (result.ok) {
      setImage(url);
      setGallery((current) => [url, ...current.filter((item) => item !== url)]);
    }
    setBusy(false);
  }

  async function remove(url: string) {
    setBusy(true);
    const form = new FormData();
    form.append("productId", product.id);
    form.append("image", url);
    const result = await removePhotoAction(null, form);
    setState(result);
    if (result.ok) {
      const rest = gallery.filter((item) => item !== url);
      setGallery(rest);
      if (image === url) setImage(rest[0] ?? "");
    }
    setBusy(false);
  }

  const previewable = image.startsWith("/") || image.startsWith("http");
  const room = MAX_PHOTOS - gallery.length;

  return (
    <article className="grid gap-3 rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm">
      {/* Tap to see it big. The shop shows it far larger than this card, which
          is where a blurred photo shows. The frame is the shop's own, 4:5. */}
      <button
        type="button"
        onClick={() => viewRef.current?.showModal()}
        disabled={!previewable}
        aria-label={text(`See ${product.name} larger`, `${product.name} को फोटो ठूलो हेर्ने`)}
        className="relative block aspect-[4/5] w-full overflow-hidden rounded-xl bg-brand-mist"
      >
        {previewable ? <Image src={image} alt={product.name} fill sizes="(max-width: 640px) 45vw, 220px" className="object-cover" /> : null}
        {previewable ? (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-black text-white">
            <SearchIcon className="h-3.5 w-3.5" /> {text("See it big", "ठूलो हेर्ने")}
          </span>
        ) : null}
        {!product.hasRealPhoto ? (
          <span className="absolute left-2 top-2 rounded-full bg-brand-clay px-2.5 py-1 text-[11px] font-black text-white">{text("No photo", "फोटो छैन")}</span>
        ) : null}
        {busy ? (
          <span className="absolute inset-0 grid place-items-center bg-brand-paper/75 text-sm font-black text-brand-green-ink">{text("Working…", "हुँदैछ…")}</span>
        ) : null}
      </button>

      <div>
        <h3 className="truncate font-black text-brand-green-ink">{product.name}</h3>
        <p className="truncate font-mono text-[11px] text-brand-muted-soft">
          {product.sku} · {text(`${gallery.length} photo${gallery.length === 1 ? "" : "s"}`, `${gallery.length} फोटो`)}
        </p>
      </div>

      {/* The strip: tap a photo to make it the cover, × to take it off. */}
      {gallery.length > 0 ? (
        <ul className="flex flex-wrap gap-2 pl-0" data-photo-strip>
          {gallery.map((url) => (
            <li key={url} className="relative list-none">
              <button
                type="button"
                disabled={busy || url === image}
                onClick={() => makeCover(url)}
                aria-label={url === image ? text("The cover photo", "मुख्य फोटो") : text("Make this the cover", "यसलाई मुख्य फोटो बनाउने")}
                className={`relative block aspect-[4/5] w-14 overflow-hidden rounded-lg border-2 ${url === image ? "border-brand-green" : "border-transparent"}`}
              >
                <Image src={url} alt="" fill sizes="56px" className="object-cover" />
                {url === image ? (
                  <span className="absolute inset-x-0 bottom-0 bg-brand-green text-center text-[9px] font-black text-white">{text("Cover", "मुख्य")}</span>
                ) : null}
              </button>
              {gallery.length > 1 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(url)}
                  aria-label={text("Remove this photo", "यो फोटो हटाउने")}
                  className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-brand-paper text-xs font-black text-brand-clay shadow"
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-green px-2 text-sm font-black text-white transition hover:bg-brand-green-ink disabled:opacity-60"
        >
          <CameraIcon className="h-4 w-4" /> {text("Take one", "खिच्ने")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-brand-green-line px-2 text-sm font-black text-brand-green-ink transition hover:border-brand-green disabled:opacity-60"
        >
          <ImageIcon className="h-4 w-4" /> {text("From a file", "फाइलबाट")}
        </button>
      </div>
      {gallery.length > 0 && room > 0 ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => moreRef.current?.click()}
          className="min-h-11 rounded-xl border border-dashed border-brand-green px-2 text-sm font-black text-brand-green disabled:opacity-60"
        >
          {text("+ Add another photo", "+ अर्को फोटो थप्ने")}
        </button>
      ) : null}
      {gallery.length === 1 ? (
        <p className="rounded-lg bg-brand-cream-soft px-3 py-2 text-xs font-bold leading-5 text-brand-gold-deep">
          {text("Only one photo. Add the side and the sole — shoppers look for 3–4.", "एउटा मात्र फोटो। छेउ र तलुवाको पनि राख्नुहोस् — ग्राहकले ३–४ वटा हेर्छन्।")}
        </p>
      ) : null}

      {/* capture asks the phone for the rear camera; a desktop ignores it and
          opens the file picker, which is the right fallback either way. */}
      <input aria-label={text("Take a photo", "फोटो खिच्ने")} ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => choose(event.target.files, "main")} />
      <input aria-label={text("Choose a photo", "फोटो छान्ने")} ref={galleryRef} type="file" accept="image/*" hidden onChange={(event) => choose(event.target.files, "main")} />
      <input aria-label={text("Add another photo", "अर्को फोटो थप्ने")} ref={moreRef} type="file" accept="image/*" hidden onChange={(event) => choose(event.target.files, "gallery")} />

      {framing ? (
        <PhotoCropper
          file={framing.file}
          onCancel={() => setFraming(null)}
          onDone={(framed) => {
            const slot = framing.slot;
            setFraming(null);
            void upload(framed, slot);
          }}
        />
      ) : null}

      {state ? (
        <p role="status" className={`rounded-lg px-3 py-2 text-xs font-bold ${state.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>
          {text(state.en, state.ne)}
        </p>
      ) : null}

      {sizeWarning ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">⚠ {text(sizeWarning.en, sizeWarning.ne)}</p>
      ) : null}

      {/* Native dialog: the browser handles Escape, the backdrop and focus. */}
      <dialog
        ref={viewRef}
        onClick={(event) => {
          if (event.target === viewRef.current) viewRef.current?.close();
        }}
        className="max-h-[90dvh] max-w-[92vw] rounded-2xl bg-brand-paper p-3 backdrop:bg-black/70"
      >
        {previewable ? (
          // Plain img, not next/image: a one-off full-size look at the file,
          // where optimising it would hide the softness the owner opened it to judge.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={product.name} className="max-h-[74dvh] w-auto rounded-xl object-contain" />
        ) : null}
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm font-black text-brand-green-ink">{product.name}</p>
          <button type="button" onClick={() => viewRef.current?.close()} className="min-h-11 rounded-xl bg-brand-green px-5 text-sm font-black text-white">
            {text("Close", "बन्द गर्ने")}
          </button>
        </div>
      </dialog>
    </article>
  );
}
