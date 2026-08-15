"use client";

import Image from "next/image";
import { useRef, useState } from "react";
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
export default function PhotoCard({ product }: { product: PhotoProduct }) {
  const [image, setImage] = useState(product.image);
  const [state, setState] = useState<PhotoActionState | null>(null);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null, slot: "main" | "gallery") {
    const file = files?.[0];
    if (!file) return;

    setBusy(true);
    setState(null);

    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/admin/upload", { method: "POST", body });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `फोटो चढेन (${response.status})।`);
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
      setState({
        ok: false,
        message: error instanceof Error ? error.message : "फोटो चढेन।",
      });
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  const previewable = image.startsWith("/") || image.startsWith("http");

  return (
    <article className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-brand-mist">
        {previewable ? (
          <Image src={image} alt={product.name} fill sizes="(max-width: 640px) 45vw, 220px" className="object-cover" />
        ) : null}
        {!product.hasRealPhoto ? (
          <span className="absolute left-2 top-2 rounded-full bg-brand-clay px-2.5 py-1 text-[11px] font-black text-white">
            फोटो छैन
          </span>
        ) : null}
        {busy ? (
          <span className="absolute inset-0 grid place-items-center bg-white/75 text-sm font-black text-brand-green-ink">
            चढ्दै…
          </span>
        ) : null}
      </div>

      <div>
        <h3 className="truncate font-black text-brand-green-ink">{product.name}</h3>
        <p className="truncate font-mono text-[11px] text-gray-400">
          {product.sku} · {product.galleryCount} फोटो
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => cameraRef.current?.click()}
          className="min-h-11 rounded-xl bg-brand-green px-2 text-sm font-black text-white transition hover:bg-brand-green-ink disabled:opacity-60"
        >
          📷 खिच्ने
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
          className="min-h-11 rounded-xl border border-gray-200 px-2 text-sm font-black text-brand-green-ink transition hover:border-brand-green disabled:opacity-60"
        >
          🖼️ फाइलबाट
        </button>
      </div>

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
          {state.message}
        </p>
      ) : null}
    </article>
  );
}
