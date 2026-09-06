"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts a number up from zero to its value the first time it scrolls into view,
 * so a figure like Rs. 4,920 rolls into place instead of snapping — the small
 * bit of life a paid dashboard has. Respects reduced-motion and never changes
 * the value itself: it only animates how the final number arrives, and shows the
 * exact value immediately when motion is off or scripting hasn't kicked in.
 *
 * `format` renders the animated number; keep it pure (e.g. a thousands
 * separator) so every frame reads correctly.
 */
export default function CountUp({
  value,
  durationMs = 900,
  format = (n) => String(n),
  className,
}: {
  value: number;
  durationMs?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // display already starts at the exact value (useState above), so when
    // motion is off or the value is zero there is nothing to animate.
    if (reduce || value === 0) return;

    const run = () => {
      if (started.current) return;
      started.current = true;
      const start = performance.now();
      const from = 0;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        // Ease-out so it decelerates into the final figure.
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(Math.round(from + (value - from) * eased));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // Animate once for the value it mounts with; a later value change just shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the value prop changes after the intro, reflect it exactly.
  useEffect(() => {
    if (started.current) setDisplay(value);
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {format(display)}
    </span>
  );
}
