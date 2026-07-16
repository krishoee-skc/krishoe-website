export default function AccountRegisterLoading() {
  return (
    <main className="min-h-screen bg-brand-mist">
      <div className="mx-auto max-w-md px-5 py-20 md:px-8">
        <div className="rounded-lg border border-black/10 bg-white p-6">
          <div className="h-4 w-24 animate-pulse rounded-full bg-black/10" />
          <div className="mt-3 h-9 w-52 max-w-full animate-pulse rounded bg-black/10" />

          <div className="mt-8 space-y-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-3 w-20 animate-pulse rounded-full bg-black/10" />
                <div className="h-11 w-full animate-pulse rounded bg-black/10" />
              </div>
            ))}
            <div className="h-11 w-full animate-pulse rounded-full bg-black/10" />
            <div className="h-3 w-40 max-w-full animate-pulse rounded-full bg-black/10" />
          </div>
        </div>
      </div>
    </main>
  );
}
