/**
 * Content-shaped loading placeholders. Instead of a blank space or a lone
 * spinner, a page shows the outline of what is coming — a shimmering bar where
 * a value will be, a card where a card will be — so the wait reads as "filling
 * in" rather than "nothing here yet", the way a paid dashboard loads.
 *
 * Pure presentation, no client code: safe in server components. Shimmer and its
 * reduced-motion handling live in globals (.skeleton).
 */

/** A single shimmering bar. Give it a width/height via className. */
export function SkeletonLine({ className = "h-4 w-full" }: { className?: string }) {
  return <span className={`skeleton block ${className}`} aria-hidden="true" />;
}

/** A stat-tile-shaped placeholder — label bar, big value bar, accent bar. */
export function SkeletonStat() {
  return (
    <div
      className="rounded-2xl border border-brand-green-line bg-brand-paper p-5 shadow-sm"
      aria-hidden="true"
    >
      <span className="skeleton block h-3 w-20 rounded" />
      <span className="skeleton mt-3 block h-7 w-28 rounded" />
      <span className="skeleton mt-3 block h-1.5 w-full rounded-full" />
    </div>
  );
}

/** A row of `count` stat placeholders, matching the dashboard grid. */
export function SkeletonStatRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonStat key={i} />
      ))}
    </div>
  );
}

/** A generic card placeholder — a title bar and a few text lines. */
export function SkeletonCard() {
  return (
    <div
      className="rounded-2xl border border-brand-green-line bg-brand-paper p-5 shadow-sm"
      aria-hidden="true"
    >
      <span className="skeleton block h-4 w-1/3 rounded" />
      <span className="skeleton mt-3 block h-3 w-full rounded" />
      <span className="skeleton mt-2 block h-3 w-5/6 rounded" />
      <span className="skeleton mt-2 block h-3 w-2/3 rounded" />
    </div>
  );
}
