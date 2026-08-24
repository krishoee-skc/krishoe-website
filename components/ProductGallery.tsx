"use client";

import { useMemo, useState } from "react";
import SafeImage from "@/components/SafeImage";

type ProductGalleryProps = {
  name: string;
  image: string;
  gallery: string[];
};

export default function ProductGallery({ name, image, gallery }: ProductGalleryProps) {
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

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-brand-mist">
        <SafeImage
          src={selectedImage}
          alt={name}
          fill
          preload
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />
      </div>

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
                onClick={() => setSelectedImage(imgUrl)}
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
    </div>
  );
}
