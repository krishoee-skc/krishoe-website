import Link from "next/link";
import { logoutWorkerAction } from "@/app/worker/actions";

// No attendance tab: the factory records pairs handed over, not clock-in times.
const navigation = [
  { href: "/worker/dashboard", label: "गृह · Home" },
  { href: "/worker/production", label: "मेरो काम · Work" },
  { href: "/worker/payslip", label: "मेरो तलब · Pay" },
] as const;

export default function WorkerPortalShell({
  workerName,
  children,
}: {
  workerName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <Link href="/worker/dashboard" className="text-lg font-black text-brand-green-ink">
              KRISHOE Worker Portal
            </Link>
            <p className="text-xs text-gray-500">Signed in as {workerName}</p>
          </div>
          <form action={logoutWorkerAction}>
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-full border border-gray-200 px-4 text-sm font-bold text-brand-green-ink"
            >
              Sign out
            </button>
          </form>
        </div>
        <nav aria-label="Worker portal" className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-4 sm:px-6">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full bg-brand-mist px-4 py-2 text-sm font-bold text-brand-green-ink transition hover:bg-brand-green hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
