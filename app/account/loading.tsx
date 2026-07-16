export default function AccountLoading() {
  return (
    <main className="min-h-screen bg-brand-mist">
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="h-4 w-28 animate-pulse rounded-full bg-black/10" />
        <div className="mt-3 h-12 w-72 max-w-full animate-pulse rounded bg-black/10" />

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-lg border border-black/10 bg-white p-5">
              <div className="h-4 w-24 animate-pulse rounded bg-black/10" />
              <div className="mt-2 h-8 w-20 animate-pulse rounded bg-black/10" />
              <div className="mt-2 h-3 w-28 animate-pulse rounded-full bg-black/10" />
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-black/10 bg-white p-5">
            <div className="h-5 w-32 animate-pulse rounded bg-black/10" />
            <div className="mt-5 divide-y divide-black/10">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between gap-3 py-4">
                  <div className="space-y-2">
                    <div className="h-4 w-28 animate-pulse rounded bg-black/10" />
                    <div className="h-3 w-40 max-w-full animate-pulse rounded-full bg-black/10" />
                  </div>
                  <div className="h-6 w-20 animate-pulse rounded-full bg-black/10" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-black/10 bg-white p-5">
                <div className="h-5 w-36 animate-pulse rounded bg-black/10" />
                <div className="mt-5 space-y-4">
                  {Array.from({ length: 3 }).map((__, fieldIndex) => (
                    <div key={fieldIndex} className="space-y-2">
                      <div className="h-3 w-20 animate-pulse rounded-full bg-black/10" />
                      <div className="h-11 w-full animate-pulse rounded bg-black/10" />
                    </div>
                  ))}
                  <div className="h-11 w-32 animate-pulse rounded-full bg-black/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
