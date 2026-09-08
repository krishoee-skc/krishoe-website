import type { ReactNode } from "react";
import Link from "next/link";

/**
 * A panel with nothing in it yet.
 *
 * Screens across the admin said "No entries yet" in small grey type and left it
 * there. That is accurate and useless: the owner is looking at an empty table
 * wondering whether the shop is quiet, the filter is wrong, or the page is
 * broken — and if something ought to be done, nothing says what.
 *
 * So an empty panel says three things instead of one: a mark to rest the eye
 * on, a line explaining why it is empty, and — where there is something to do —
 * the button that does it. The same shape everywhere, so an empty screen reads
 * as a state of the shop rather than as a page that failed.
 */
export default function EmptyState({
  icon = "📋",
  title,
  detail,
  action,
}: {
  /** One emoji. Quiet and specific: a shoe, a bill, a spanner. */
  icon?: string;
  title: ReactNode;
  /** Why it is empty, in a sentence. */
  detail?: ReactNode;
  /** The one thing worth doing from here, when there is one. */
  action?: { href: string; label: ReactNode };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-brand-green-line bg-brand-paper-deep/40 px-6 py-10 text-center">
      <span aria-hidden="true" className="block text-3xl opacity-60">
        {icon}
      </span>
      <p className="mt-3 font-display text-lg font-black text-brand-green-ink">{title}</p>
      {detail ? (
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-brand-muted">{detail}</p>
      ) : null}
      {action ? (
        <Link
          href={action.href}
          className="press-dip mt-5 inline-flex min-h-11 items-center rounded-full bg-brand-green px-5 text-sm font-black text-white transition hover:bg-brand-green-ink"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
