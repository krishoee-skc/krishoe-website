"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SafeImage from "@/components/SafeImage";
import { useLanguage } from "@/components/LanguageProvider";

type ProductGalleryProps = {
  name: string;
  image: string;
  gallery: string[];
};

export default function ProductGallery({ name, image, gallery }: ProductGalleryProps) {
  const { text } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const images = useMemo(() => {
    const seen = new Set<string>();

    return [image, ...gallery].filter((src) => {
      if (!src || seen.has(src)) {
        return false;
      }

      seen.add(src);
      return true;
    });
  }, [gallery, image]);
  const [selectedImage, setSelectedImage] = useState(images[0] ?? image);
  const [zoomed, setZoomed] = useState(false);
  // Magnification inside the big view, and the point it grows around, so a tap
  // on the sole brings the sole closer rather than the middle of the picture.
  const [magnified, setMagnified] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });

  // The browser keeps scrolling the page behind an open dialog, which on a
  // phone reads as the photo sliding away under your finger.
  useEffect(() => {
    if (!zoomed) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [zoomed]);

  function openZoom() {
    setZoomed(true);
    dialogRef.current?.showModal();
  }

  function closeZoom() {
    dialogRef.current?.close();
  }

  function showImage(src: string) {
    setSelectedImage(src);
    // A new photo starts whole; carrying the old magnification over would open
    // it already halfway into a corner.
    setMagnified(false);
    setOrigin({ x: 50, y: 50 });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The photo opens the big view. A shoe is bought on its stitching, its
          sole and the shade of its colour, and none of that is legible in a
          square thumbnail on a phone. */}
      <button
        type="button"
        onClick={openZoom}
        aria-label={text(`See ${name} larger`, `${name} ठूलो पारेर हेर्ने`)}
        className="group relative aspect-square w-full cursor-zoom-in overflow-hidden rounded-lg bg-brand-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2"
      >
        <SafeImage
          src={selectedImage}
          alt={name}
          fill
          preload
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        <span className="pointer-events-none absolute bottom-3 right-3 inline-flex min-h-9 items-center gap-1.5 rounded-full bg-black/60 px-3 text-xs font-bold text-white backdrop-blur-sm">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5">
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="m20 20-3.5-3.5M11 8v6M8 11h6" />
          </svg>
          {text("Tap to enlarge", "ठूलो पार्न थिच्नुहोस्")}
        </span>
      </button>

      {images.length > 1 ? (
        <div className="grid grid-cols-4 gap-3">
          {images.slice(0, 4).map((imgUrl, index) => {
            const isSelected = selectedImage === imgUrl;

            return (
              <button
                key={imgUrl}
                type="button"
                aria-label={`View ${name} image ${index + 1}`}
                aria-pressed={isSelected}
                onClick={() => showImage(imgUrl)}
                className={`relative aspect-square w-full overflow-hidden rounded-lg bg-brand-mist transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 ${
                  isSelected ? "ring-2 ring-brand-green ring-offset-2" : "hover:opacity-85"
                }`}
              >
                <SafeImage
                  src={imgUrl}
                  alt={`${name} image ${index + 1}`}
                  fill
                  sizes="25vw"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      ) : null}

      {/* A native dialog, so Escape closes it and the focus stays inside
          without any of that being written by hand. */}
      <dialog
        ref={dialogRef}
        onClose={() => {
          setZoomed(false);
          setMagnified(false);
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeZoom();
        }}
        className="max-h-none max-w-none bg-transparent p-0 backdrop:bg-black/85"
      >
        {zoomed ? (
          <div className="flex h-dvh w-screen flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="truncate text-sm font-bold text-white">{name}</p>
              <button
                type="button"
                onClick={closeZoom}
                aria-label={text("Close", "बन्द गर्ने")}
                className="grid h-11 w-11 flex-none place-items-center rounded-full bg-white/15 text-xl leading-none text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold"
              >
                ✕
              </button>
            </div>

            {/* object-contain, not cover: the square on the page crops up to
                44% off a wide photo, and the whole point of opening this is to
                see the parts the page cut off.

                Tapping again magnifies around the point tapped, so the stitching
                or the sole can be brought close without relying on pinch, which
                browsers handle inconsistently inside a modal dialog. */}
            <div
              role="button"
              tabIndex={0}
              aria-label={
                magnified
                  ? text("Zoom out", "सानो पार्ने")
                  : text("Zoom in", "नजिक हेर्ने")
              }
              onClick={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                setOrigin({
                  x: ((event.clientX - box.left) / box.width) * 100,
                  y: ((event.clientY - box.top) / box.height) * 100,
                });
                setMagnified((on) => !on);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                setOrigin({ x: 50, y: 50 });
                setMagnified((on) => !on);
              }}
              className={`relative min-h-0 flex-1 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold ${
                magnified ? "cursor-zoom-out" : "cursor-zoom-in"
              }`}
            >
              <SafeImage
                key={selectedImage}
                src={selectedImage}
                alt={name}
                fill
                sizes="100vw"
                quality={90}
                className="object-contain transition-transform duration-300 ease-out"
                style={{
                  transform: magnified ? "scale(2.5)" : "scale(1)",
                  transformOrigin: `${origin.x}% ${origin.y}%`,
                }}
              />
            </div>

            {images.length > 1 ? (
              <div className="flex justify-center gap-2 overflow-x-auto px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {images.map((imgUrl, index) => {
                  const isSelected = selectedImage === imgUrl;

                  return (
                    <button
                      key={imgUrl}
                      type="button"
                      onClick={() => showImage(imgUrl)}
                      aria-label={`${name} ${index + 1}`}
                      aria-pressed={isSelected}
                      className={`relative h-14 w-14 flex-none overflow-hidden rounded-lg bg-white/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold ${
                        isSelected ? "ring-2 ring-white" : "opacity-60 hover:opacity-100"
                      }`}
                    >
                      <SafeImage src={imgUrl} alt="" fill sizes="56px" className="object-cover" />
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* Said in both cases: tapping to magnify is not obvious, and it is
                the reason this view is worth opening. */}
            <p className="px-4 pb-5 text-center text-xs text-white/70">
              {magnified
                ? text("Tap again to fit the whole shoe", "पूरै जुत्ता हेर्न फेरि थिच्नुहोस्")
                : text("Tap the photo to look closer", "नजिकबाट हेर्न फोटो थिच्नुहोस्")}
            </p>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
