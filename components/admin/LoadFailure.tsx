import Link from "next/link";

type LoadFailureProps = {
  /** What could not be loaded, in the owner's words: "the purchase bills". */
  what: string;
  /** Why, already made readable by saveFailureMessage. */
  message: string;
  /** Where "Try again" goes — the same page, normally. */
  retryHref: string;
};

/**
 * Shown when an admin page cannot load its data.
 *
 * Next replaces server error messages with a bare digest in production, so
 * letting the failure throw means the owner sees the storefront's retry screen
 * and the reason never reaches them — the same screen whether the database
 * blinked or something is genuinely broken. Three reports of "it says quick
 * retry again" could not be told apart because of it.
 *
 * Catching in the page and rendering the reason as data is what keeps it
 * readable.
 */
export default function LoadFailure({ what, message, retryHref }: LoadFailureProps) {
  return (
    <section className="p-6">
      <div className="max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-black text-red-900">Could not load {what}.</h1>
        <p className="mt-2 text-sm leading-6 text-red-900">{message}</p>
        <p className="mt-2 text-sm leading-6 text-red-800">
          Nothing was changed. This is a read that failed, not a save.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={retryHref}
            className="inline-flex h-11 items-center rounded-full bg-brand-green px-5 text-sm font-bold text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
          >
            Try again
          </Link>
          <Link
            href="/admin"
            className="inline-flex h-11 items-center rounded-full border border-black/10 px-5 text-sm font-bold text-brand-green transition hover:bg-brand-mist"
          >
            Admin home
          </Link>
        </div>
      </div>
    </section>
  );
}
