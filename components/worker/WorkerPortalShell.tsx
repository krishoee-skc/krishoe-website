import Link from "next/link";
import LanguageSwitch from "@/components/LanguageSwitch";
import { logoutWorkerAction } from "@/app/worker/actions";
import { WorkerTabs, WorkerTextSize } from "@/components/worker/WorkerChrome";

/**
 * The worker app's frame (owner, 2026-10-02: bigger, easier). A short header —
 * the name, the text size, sign out — and four big tabs along the bottom:
 * Home, Work, Photo, Pay. No attendance tab: the factory records pairs handed
 * over, not clock-in times.
 */
export default function WorkerPortalShell({
  workerName,
  children,
}: {
  workerName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-brand-paper-deep text-brand-green-ink">
      <header className="border-b border-brand-green-line bg-brand-paper print:hidden">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/worker/dashboard" className="min-w-0">
            <span className="block text-base font-black text-brand-green-ink">KRISHOE</span>
            <span className="block truncate text-sm text-brand-muted">{workerName}</span>
          </Link>
          <div className="flex items-center gap-2">
            <WorkerTextSize />
            <LanguageSwitch />
            <form action={logoutWorkerAction}>
              <button
                type="submit"
                className="inline-flex h-10 items-center rounded-xl border border-brand-green-line px-3 text-sm font-bold text-brand-green-ink"
              >
                बाहिर · Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-32 pt-5 text-base">{children}</main>
      <WorkerTabs />
    </div>
  );
}
