export default function ShopLoading() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-5 py-16 md:px-8">
        <div className="h-4 w-32 animate-pulse rounded-full bg-black/10" />
        <div className="mt-4 h-10 w-72 max-w-full animate-pulse rounded bg-black/10" />
        <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-black/10" />

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-lg border border-black/10 bg-white">
              <div className="aspect-[4/3] w-full animate-pulse bg-black/10" />
              <div className="space-y-3 p-5">
                <div className="h-3 w-20 animate-pulse rounded-full bg-black/10" />
                <div className="h-5 w-40 max-w-full animate-pulse rounded bg-black/10" />
                <div className="h-4 w-full animate-pulse rounded bg-black/10" />
                <div className="flex items-center justify-between pt-3">
                  <div className="h-7 w-24 animate-pulse rounded bg-black/10" />
                  <div className="h-9 w-20 animate-pulse rounded-full bg-black/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
