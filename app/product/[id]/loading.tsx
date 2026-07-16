export default function ProductLoading() {
  return (
    <main className="min-h-screen bg-brand-mist">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 md:px-8 lg:grid-cols-2">
        <div className="aspect-[4/3] animate-pulse rounded-lg bg-black/10" />
        <div className="space-y-5">
          <div className="h-4 w-36 animate-pulse rounded-full bg-black/10" />
          <div className="h-16 w-full animate-pulse rounded bg-black/10" />
          <div className="h-24 w-full animate-pulse rounded bg-black/10" />
          <div className="h-64 w-full animate-pulse rounded-lg bg-black/10" />
        </div>
      </div>
    </main>
  );
}
