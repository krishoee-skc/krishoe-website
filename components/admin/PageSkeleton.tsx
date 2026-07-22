// A shared loading skeleton for admin pages. Most admin routes are
// force-dynamic and wait on the database, so without this they flash a blank
// screen while the data loads. One component keeps every page's wait looking
// the same — a title, a row of summary cards, and a table — instead of each
// page hand-rolling (or skipping) its own.
type PageSkeletonProps = {
  cards?: number;
  rows?: number;
};

const bar = "animate-pulse rounded bg-black/10";
const pill = "animate-pulse rounded-full bg-black/10";

export default function PageSkeleton({ cards = 4, rows = 6 }: PageSkeletonProps) {
  return (
    <section className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className={`h-7 w-64 max-w-full ${bar}`} />
          <div className={`h-4 w-80 max-w-full ${bar}`} />
        </div>
        <div className={`h-9 w-28 ${pill}`} />
      </div>

      {cards > 0 ? (
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {Array.from({ length: cards }).map((_, index) => (
            <div key={index} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className={`h-4 w-24 ${bar}`} />
              <div className={`mt-2 h-7 w-28 ${bar}`} />
              <div className={`mt-2 h-3 w-20 ${pill}`} />
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className={`h-5 w-40 ${bar}`} />
        <div className={`mt-1 h-3 w-56 max-w-full ${pill}`} />
        <div className="mt-5 divide-y">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-3 py-3">
              <div className={`h-4 w-28 ${bar}`} />
              <div className={`h-4 w-24 ${bar}`} />
              <div className={`h-6 w-20 ${pill}`} />
              <div className={`h-4 w-16 ${bar}`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
