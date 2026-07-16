export default function AdminCostingLoading() {
  return (
    <section className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-64 max-w-full animate-pulse rounded bg-black/10" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-black/10" />
        </div>
        <div className="h-9 w-28 animate-pulse rounded-full bg-black/10" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-24 animate-pulse rounded bg-black/10" />
            <div className="mt-2 h-7 w-28 animate-pulse rounded bg-black/10" />
            <div className="mt-2 h-3 w-20 animate-pulse rounded-full bg-black/10" />
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="h-5 w-48 animate-pulse rounded bg-black/10" />
        <div className="mt-5 grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <div className="grid gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-3 w-28 animate-pulse rounded-full bg-black/10" />
                <div className="h-10 w-full animate-pulse rounded bg-black/10" />
              </div>
            ))}
          </div>
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="h-3 w-24 animate-pulse rounded-full bg-black/10" />
                <div className="mt-1 h-5 w-24 animate-pulse rounded bg-black/10" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="h-5 w-40 animate-pulse rounded bg-black/10" />
          <div className="mt-1 h-3 w-52 max-w-full animate-pulse rounded-full bg-black/10" />
          <div className="mt-4 grid gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="h-3 w-24 animate-pulse rounded-full bg-black/10" />
                <div className="mt-1 h-5 w-20 animate-pulse rounded bg-black/10" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="h-5 w-44 animate-pulse rounded bg-black/10" />
          <div className="mt-1 h-3 w-64 max-w-full animate-pulse rounded-full bg-black/10" />
          <div className="mt-5 divide-y">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-3 py-3">
                <div className="h-4 w-32 animate-pulse rounded bg-black/10" />
                <div className="h-4 w-20 animate-pulse rounded bg-black/10" />
                <div className="h-4 w-20 animate-pulse rounded bg-black/10" />
                <div className="h-6 w-16 animate-pulse rounded-full bg-black/10" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
