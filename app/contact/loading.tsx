export default function ContactLoading() {
  return (
    <main className="min-h-screen bg-brand-mist">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-[0.9fr_1.1fr] md:px-8">
        <div>
          <div className="h-4 w-20 animate-pulse rounded-full bg-black/10" />
          <div className="mt-3 h-12 w-full max-w-md animate-pulse rounded bg-black/10" />
          <div className="mt-5 space-y-3">
            <div className="h-4 w-full animate-pulse rounded bg-black/10" />
            <div className="h-4 w-full animate-pulse rounded bg-black/10" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-black/10" />
          </div>

          <div className="mt-8 grid gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-black/10 bg-white p-5">
                <div className="h-3 w-24 animate-pulse rounded-full bg-black/10" />
                <div className="mt-2 h-6 w-44 max-w-full animate-pulse rounded bg-black/10" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-black/10 bg-white p-6">
          <div className="h-5 w-40 animate-pulse rounded bg-black/10" />
          <div className="mt-6 grid gap-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-3 w-24 animate-pulse rounded-full bg-black/10" />
                <div className="h-11 w-full animate-pulse rounded bg-black/10" />
              </div>
            ))}
            <div className="space-y-2">
              <div className="h-3 w-24 animate-pulse rounded-full bg-black/10" />
              <div className="h-32 w-full animate-pulse rounded bg-black/10" />
            </div>
            <div className="h-11 w-40 animate-pulse rounded-full bg-black/10" />
          </div>
        </div>
      </div>
    </main>
  );
}
