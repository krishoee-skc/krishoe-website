export default function OrderStatusLoading() {
  return (
    <main className="min-h-screen bg-brand-mist">
      <div className="mx-auto max-w-5xl px-5 py-16 md:px-8">
        <div className="h-4 w-32 animate-pulse rounded-full bg-black/10" />
        <div className="mt-3 h-12 w-80 max-w-full animate-pulse rounded bg-black/10" />
        <div className="mt-4 h-4 w-64 max-w-full animate-pulse rounded bg-black/10" />

        <div className="mt-10 rounded-lg border border-black/10 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-2">
              <div className="h-3 w-24 animate-pulse rounded-full bg-black/10" />
              <div className="h-6 w-40 animate-pulse rounded bg-black/10" />
            </div>
            <div className="h-7 w-24 animate-pulse rounded-full bg-black/10" />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-black/10 p-4">
                <div className="h-3 w-20 animate-pulse rounded-full bg-black/10" />
                <div className="mt-2 h-5 w-28 max-w-full animate-pulse rounded bg-black/10" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-black/10 bg-white p-6">
          <div className="h-5 w-32 animate-pulse rounded bg-black/10" />
          <div className="mt-5 divide-y divide-black/10">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-3 py-4">
                <div className="space-y-2">
                  <div className="h-4 w-44 max-w-full animate-pulse rounded bg-black/10" />
                  <div className="h-3 w-24 animate-pulse rounded-full bg-black/10" />
                </div>
                <div className="h-5 w-20 animate-pulse rounded bg-black/10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
