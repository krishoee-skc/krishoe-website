"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useState } from "react";

const DEFAULT_FALLBACK = "/images/product-placeholder.svg";

// next/image with a broken or missing src leaves a torn-image box on the
// customer's screen — the kind of thing that reads as "this shop isn't real."
// This swaps to a branded KRISHOE placeholder the moment the real image fails,
// so a bad upload path never shows a broken picture to a shopper.
type SafeImageProps = ImageProps & { fallbackSrc?: string };

export default function SafeImage({ src, fallbackSrc = DEFAULT_FALLBACK, alt, ...rest }: SafeImageProps) {
  const [current, setCurrent] = useState(src);

  // If the product's image is edited (e.g. a photo is finally uploaded), move
  // off the placeholder and try the new source.
  useEffect(() => {
    setCurrent(src);
  }, [src]);

  const showingFallback = current === fallbackSrc;

  return (
    <Image
      {...rest}
      src={current}
      alt={alt}
      // The placeholder is an SVG; the image optimizer rejects SVG by default
      // (no dangerouslyAllowSVG), which would make the fallback itself 404. Serve
      // it straight from /public instead so it always renders.
      unoptimized={showingFallback || rest.unoptimized}
      onError={() => {
        if (current !== fallbackSrc) {
          setCurrent(fallbackSrc);
        }
      }}
    />
  );
}
