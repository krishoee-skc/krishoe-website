export default function CartLoading() {
  return (
    <main className="min-h-screen bg-brand-mist">
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="h-4 w-28 animate-pulse rounded-full bg-black/10" />
        <div className="mt-3 h-12 w-80 max-w-full animate-pulse rounded bg-black/10" />

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="flex gap-4 rounded-lg border border-black/10 bg-white p-4"
              >
                <div className="h-24 w-24 shrink-0 animate-pulse rounded bg-black/10" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 w-48 max-w-full animate-pulse rounded bg-black/10" />
                  <div className="h-3 w-24 animate-pulse rounded-full bg-black/10" />
                  <div className="flex items-center justify-between pt-2">
                    <div className="h-9 w-28 animate-pulse rounded-full bg-black/10" />
                    <div className="h-6 w-20 animate-pulse rounded bg-black/10" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="h-fit rounded-lg border border-black/10 bg-white p-5">
            <div className="h-5 w-32 animate-pulse rounded bg-black/10" />
            <div className="mt-5 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="h-4 w-24 animate-pulse rounded bg-black/10" />
                  <div className="h-4 w-16 animate-pulse rounded bg-black/10" />
                </div>
              ))}
            </div>
            <div className="mt-6 h-11 w-full animate-pulse rounded-full bg-black/10" />
          </div>
        </div>
      </div>
    </main>
  );
}
