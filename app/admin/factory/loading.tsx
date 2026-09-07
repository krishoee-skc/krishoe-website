/**
 * Held while any factory screen arrives.
 *
 * `loading.tsx` wraps this segment's page *and every screen below it*, so this
 * is what shows on the way to the board, the ledger, the payroll, the team and
 * the item list alike. An earlier version drew the board's own four tiles and
 * its two panels, which meant opening the ledger promised a dashboard and then
 * delivered something else — a flicker that reads as the app changing its mind.
 *
 * So it is deliberately generic: a heading, a row of cards, a block of rows.
 * True of every factory screen, a lie about none of them.
 */
export default function FactoryLoading() {
  return (
    <div className="flex min-h-screen flex-col space-y-3 p-3 sm:p-5 lg:p-6">
      <div className="mb-1 space-y-2">
        <div className="h-7 w-48 max-w-full animate-pulse rounded bg-black/10" />
        <div className="h-4 w-64 max-w-full animate-pulse rounded bg-black/10" />
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-brand-green-line bg-brand-paper p-5 shadow-sm"
          >
            <div className="h-3 w-20 animate-pulse rounded bg-black/10" />
            <div className="mt-2 h-7 w-24 animate-pulse rounded bg-black/10" />
            <div className="mt-3 h-1.5 w-full animate-pulse rounded-full bg-black/10" />
          </div>
        ))}
      </div>

      <div className="flex-1 rounded-2xl border border-brand-green-line bg-brand-paper p-3 sm:p-4">
        <div className="mb-3 h-4 w-32 animate-pulse rounded bg-black/10" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded bg-black/5" />
          ))}
        </div>
      </div>
    </div>
  );
}
