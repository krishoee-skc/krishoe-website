import { SkeletonLine } from "@/components/admin/Skeleton";

/**
 * Held while the work-entry screen arrives.
 *
 * This is the screen the factory opens fifty times a morning, and it waits on
 * four reads before it draws: the team, the item list, the rate book, and how
 * many uppers are waiting per shoe. Until now that wait was a blank screen —
 * on a phone held in a workshop, indistinguishable from an app that has hung.
 *
 * Shaped as the form itself rather than as the shared page skeleton: this
 * screen has no summary tiles and no table, and showing either would make the
 * page jump when the real one lands. What it has is a row of three choosers,
 * the big pair-count stepper, and the colour and size fields beneath.
 */
export default function FactoryAddWorkLoading() {
  return (
    <section className="p-4 sm:p-6">
      {/* Title and the line under it */}
      <div className="space-y-2">
        <SkeletonLine className="h-7 w-64 max-w-full rounded" />
        <SkeletonLine className="h-4 w-80 max-w-full rounded" />
      </div>

      <div className="mt-5 rounded-lg border border-brand-green-line bg-brand-paper p-4 sm:p-6">
        {/* Date, worker, product */}
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              <SkeletonLine className="h-3 w-24 rounded" />
              <SkeletonLine className="mt-2 h-12 w-full rounded-lg" />
            </div>
          ))}
        </div>

        {/* Pairs and the wage beside it — the row they now share. */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <SkeletonLine className="h-3 w-28 rounded" />
            <div className="mt-2 flex items-stretch gap-2">
              <SkeletonLine className="h-14 w-14 shrink-0 rounded-lg" />
              <SkeletonLine className="h-14 w-full rounded-lg" />
              <SkeletonLine className="h-14 w-14 shrink-0 rounded-lg" />
            </div>
          </div>
          <div>
            <SkeletonLine className="h-3 w-20 rounded" />
            <SkeletonLine className="mt-2 h-14 w-full rounded-lg" />
          </div>
        </div>

        {/* Colour and size, each a row of chips over a field. */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <SkeletonLine className="h-3 w-20 rounded" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Array.from({ length: 5 }).map((_, chip) => (
                  <SkeletonLine key={chip} className="h-9 w-16 rounded-full" />
                ))}
              </div>
              <SkeletonLine className="mt-2 h-12 w-full rounded-lg" />
            </div>
          ))}
        </div>

        {/* Save */}
        <SkeletonLine className="mt-6 h-12 w-full rounded-lg" />
      </div>
    </section>
  );
}
