export default function ProductLoading() {
  return (
    <main className="min-h-screen bg-brand-mist">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-10 md:px-8 md:py-16 lg:grid-cols-2">
        <div className="grid gap-4">
          <div className="aspect-square animate-pulse rounded-lg bg-black/10" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="aspect-square animate-pulse rounded-lg bg-black/10" />
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <div className="h-4 w-36 animate-pulse rounded-full bg-black/10" />
          <div className="h-16 w-full animate-pulse rounded bg-black/10" />
          <div className="grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-lg bg-black/10" />
            ))}
          </div>
          <div className="h-24 w-full animate-pulse rounded bg-black/10" />
          <div className="h-64 w-full animate-pulse rounded-lg bg-black/10" />
        </div>
      </div>
    </main>
  );
}
