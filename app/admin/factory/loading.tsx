/**
 * The shape of the factory board, held while the screen arrives.
 *
 * Every factory screen fetches its own data in the browser, so moving here from
 * another admin page used to show nothing at all until the first fetch came
 * back — a blank panel under the factory menu. The POS and purchase screens
 * have held their shape this way for a while; this gives the factory the same
 * courtesy, and the tiles land where the real ones will.
 */
export default function FactoryLoading() {
  return (
    <div className="flex min-h-screen flex-col space-y-3 p-3 sm:p-5 lg:p-6">
      <div className="mb-1 space-y-2">
        <div className="h-7 w-48 max-w-full animate-pulse rounded bg-black/10" />
        <div className="h-4 w-40 max-w-full animate-pulse rounded bg-black/10" />
      </div>

      {/* The four tiles of the day */}
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-brand-green-line bg-brand-paper p-5 shadow-sm"
          >
            <div className="h-3 w-20 animate-pulse rounded bg-black/10" />
            <div className="mt-2 h-7 w-24 animate-pulse rounded bg-black/10" />
            <div className="mt-2 h-3 w-12 animate-pulse rounded bg-black/10" />
            <div className="mt-3 h-1.5 w-full animate-pulse rounded-full bg-black/10" />
          </div>
        ))}
      </div>

      {/* Owed to the team */}
      <div className="flex items-center justify-between rounded-2xl border border-brand-gold/40 bg-brand-gold/10 p-3 sm:p-4">
        <div className="space-y-2">
          <div className="h-3 w-28 animate-pulse rounded bg-black/10" />
          <div className="h-6 w-32 animate-pulse rounded bg-black/10" />
        </div>
        <div className="space-y-2">
          <div className="h-5 w-8 animate-pulse rounded bg-black/10" />
          <div className="h-3 w-20 animate-pulse rounded bg-black/10" />
        </div>
      </div>

      {/* Top of the team, and today's products */}
      <div className="grid flex-1 grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, panel) => (
          <div
            key={panel}
            className="flex flex-col rounded-2xl border border-brand-green-line bg-brand-paper p-3 sm:p-4"
          >
            <div className="mb-2 h-4 w-28 animate-pulse rounded bg-black/10" />
            <div className="space-y-1">
              {Array.from({ length: 4 }).map((_, row) => (
                <div key={row} className="h-10 animate-pulse rounded bg-black/5" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Quality today */}
      <div className="rounded-2xl border border-brand-green-line bg-brand-paper p-3 sm:p-4">
        <div className="mb-2 h-4 w-36 animate-pulse rounded bg-black/10" />
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded bg-black/5" />
          ))}
        </div>
      </div>
    </div>
  );
}
