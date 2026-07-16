export default function AdminPurchasingLoading() {
  return (
    <section className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-80 max-w-full animate-pulse rounded bg-black/10" />
          <div className="h-4 w-96 max-w-full animate-pulse rounded bg-black/10" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-full bg-black/10" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-20 animate-pulse rounded bg-black/10" />
            <div className="mt-2 h-7 w-24 animate-pulse rounded bg-black/10" />
            <div className="mt-2 h-3 w-16 animate-pulse rounded-full bg-black/10" />
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="h-5 w-44 animate-pulse rounded bg-black/10" />
          <div className="mt-1 h-3 w-64 max-w-full animate-pulse rounded-full bg-black/10" />
          <div className="mt-5 divide-y">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-3 py-3">
                <div className="space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-black/10" />
                  <div className="h-3 w-24 animate-pulse rounded-full bg-black/10" />
                </div>
                <div className="h-4 w-20 animate-pulse rounded bg-black/10" />
                <div className="h-6 w-16 animate-pulse rounded-full bg-black/10" />
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="h-5 w-40 animate-pulse rounded bg-black/10" />
          <div className="mt-1 h-3 w-52 max-w-full animate-pulse rounded-full bg-black/10" />
          <div className="mt-4 grid gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <div className="h-3 w-24 animate-pulse rounded-full bg-black/10" />
                <div className="mt-1 h-5 w-20 animate-pulse rounded bg-black/10" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
