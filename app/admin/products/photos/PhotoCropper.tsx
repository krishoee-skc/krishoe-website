"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Framing a shoe photo before it goes up (owner, 2026-10-02: "the photo
 * bigger, and the shoe in the middle"). The frame is the shop's own — 4:5,
 * what every card and the shoe's page show — and the owner moves the photo
 * under it with a finger and zooms with the slider. What is inside the frame
 * is what customers see; the rest is not uploaded.
 *
 * Zoomed right out, the whole photo fits with the shop's paper colour round
 * it, so nothing is ever lost that the owner did not choose to lose. It opens
 * filled, which is what a shop photo should be.
 */

export const FRAME_W = 1280;
export const FRAME_H = 1600;
const PAPER = "#FDFBF7";

type Placement = { scale: number; x: number; y: number };

/** The zoom that fills the frame, and the one that fits the whole photo in it. */
export function fitScales(imageW: number, imageH: number, frameW: number, frameH: number) {
  const cover = Math.max(frameW / imageW, frameH / imageH);
  const contain = Math.min(frameW / imageW, frameH / imageH);
  return { cover, contain };
}

/** Keeps a filled frame filled: the photo may not be dragged off an edge it covers. */
export function clampPlacement(p: Placement, imageW: number, imageH: number, frameW: number, frameH: number): Placement {
  const w = imageW * p.scale;
  const h = imageH * p.scale;
  const clampAxis = (offset: number, size: number, frame: number) =>
    size >= frame ? Math.min(0, Math.max(frame - size, offset)) : (frame - size) / 2;
  return { scale: p.scale, x: clampAxis(p.x, w, frameW), y: clampAxis(p.y, h, frameH) };
}

export default function PhotoCropper({
  file,
  onDone,
  onCancel,
}: {
  file: File;
  onDone: (framed: File) => void;
  onCancel: () => void;
}) {
  const { text } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [url] = useState(() => URL.createObjectURL(file));
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [frameSize, setFrameSize] = useState({ w: 320, h: 400 });
  const [zoom, setZoom] = useState(1);
  const [place, setPlace] = useState<Placement>({ scale: 1, x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
    return () => URL.revokeObjectURL(url);
  }, [url]);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const measure = () => setFrameSize({ w: element.clientWidth, h: element.clientHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // The frame is measured once the dialog is open; a photo placed before that
  // is placed again, filled, in the frame it is really drawn in.
  const [placedFor, setPlacedFor] = useState("");
  const sizeKey = `${frameSize.w}x${frameSize.h}`;
  if (natural && placedFor !== sizeKey) {
    const s = fitScales(natural.w, natural.h, frameSize.w, frameSize.h);
    setPlacedFor(sizeKey);
    setZoom((s.cover - s.contain) / (s.cover * 3 - s.contain || 1));
    setPlace(
      clampPlacement(
        { scale: s.cover, x: (frameSize.w - natural.w * s.cover) / 2, y: (frameSize.h - natural.h * s.cover) / 2 },
        natural.w,
        natural.h,
        frameSize.w,
        frameSize.h,
      ),
    );
  }

  const scales = natural ? fitScales(natural.w, natural.h, frameSize.w, frameSize.h) : null;
  // Slider 0..1 runs from "whole photo" (contain) to three times "filled".
  const scaleFor = (z: number) => (scales ? scales.contain + (scales.cover * 3 - scales.contain) * z : 1);

  function placeAt(z: number, around?: Placement) {
    if (!natural || !scales) return;
    const scale = scaleFor(z);
    const base = around ?? place;
    // Zoom about the frame's centre.
    const cx = frameSize.w / 2;
    const cy = frameSize.h / 2;
    const ratio = scale / (base.scale || scale);
    const next = { scale, x: cx - (cx - base.x) * ratio, y: cy - (cy - base.y) * ratio };
    setPlace(clampPlacement(next, natural.w, natural.h, frameSize.w, frameSize.h));
  }

  function onLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    setNatural({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight });
  }

  async function save() {
    if (!natural) return;
    setBusy(true);
    const image = new window.Image();
    image.src = url;
    await image.decode().catch(() => undefined);
    const canvas = document.createElement("canvas");
    canvas.width = FRAME_W;
    canvas.height = FRAME_H;
    const context = canvas.getContext("2d");
    if (!context) {
      onDone(file);
      return;
    }
    context.fillStyle = PAPER;
    context.fillRect(0, 0, FRAME_W, FRAME_H);
    const k = FRAME_W / frameSize.w;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, place.x * k, place.y * k, natural.w * place.scale * k, natural.h * place.scale * k);
    canvas.toBlob(
      (blob) => {
        const name = file.name.replace(/\.[^.]+$/, "") || "photo";
        onDone(blob ? new File([blob], `${name}.jpg`, { type: "image/jpeg" }) : file);
      },
      "image/jpeg",
      0.92,
    );
  }

  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="w-[min(94vw,26rem)] rounded-2xl bg-brand-paper p-0 backdrop:bg-black/70"
    >
      <div className="grid gap-3 p-4">
        <p className="text-lg font-black text-brand-green-ink">{text("Put the shoe in the frame", "जुत्तालाई फ्रेमभित्र मिलाउनुहोस्")}</p>
        <p className="-mt-2 text-sm text-brand-muted">
          {text("Drag the photo; the slider zooms. The frame is what customers see.", "फोटो औँलाले सार्नुहोस्, slider ले ठूलो-सानो गर्छ। फ्रेमभित्रको भाग ग्राहकले देख्छन्।")}
        </p>
        <div
          ref={frame}
          className="relative mx-auto aspect-[4/5] w-full max-w-[20rem] cursor-grab touch-none select-none overflow-hidden rounded-xl"
          style={{ background: PAPER }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { px: event.clientX, py: event.clientY, x: place.x, y: place.y };
          }}
          onPointerMove={(event) => {
            if (!drag.current || !natural) return;
            setPlace(
              clampPlacement(
                { scale: place.scale, x: drag.current.x + event.clientX - drag.current.px, y: drag.current.y + event.clientY - drag.current.py },
                natural.w,
                natural.h,
                frameSize.w,
                frameSize.h,
              ),
            );
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            onLoad={onLoad}
            draggable={false}
            className="pointer-events-none absolute left-0 top-0 max-w-none origin-top-left"
            style={natural ? { width: natural.w * place.scale, height: natural.h * place.scale, transform: `translate(${place.x}px, ${place.y}px)` } : { opacity: 0 }}
          />
          {/* Thirds, to centre the shoe by eye. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent_33%,rgba(255,255,255,.45)_33.3%,transparent_33.7%,transparent_66.3%,rgba(255,255,255,.45)_66.6%,transparent_67%),linear-gradient(90deg,transparent_33%,rgba(255,255,255,.45)_33.3%,transparent_33.7%,transparent_66.3%,rgba(255,255,255,.45)_66.6%,transparent_67%)]"
          />
        </div>
        <label className="grid gap-1 text-sm font-bold text-brand-muted">
          {text("Zoom", "ठूलो-सानो")}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={zoom}
            onChange={(event) => {
              const z = Number(event.target.value);
              setZoom(z);
              placeAt(z);
            }}
            className="w-full accent-[#12634A]"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className="min-h-12 rounded-xl border border-brand-green-line text-base font-black text-brand-green-ink">
            {text("Cancel", "रद्द")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!natural || busy}
            className="min-h-12 rounded-xl bg-brand-green-ink text-base font-black text-white disabled:opacity-60"
          >
            {busy ? text("Saving…", "सेभ हुँदै…") : text("✓ Use this", "✓ यही राख्ने")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
