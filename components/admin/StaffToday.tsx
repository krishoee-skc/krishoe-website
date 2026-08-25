import Link from "next/link";
import { ArrowRightIcon, PlusIcon } from "@/components/Icons";

/**
 * The counter's own screen, for the people who are not the owner.
 *
 * Everyone signing in met the same page: "Owner control room", production
 * figures, payroll queues, launch readiness. The menu beside it was already
 * filtered by role, so a salesperson looked at a room full of numbers they
 * could not act on and could not reach — which teaches someone that the app is
 * not for them, and they go back to the paper notebook.
 *
 * This says three things instead: who you are, what you have done today, and
 * the one button you came here to press. What is not yours is not greyed out
 * and not explained away — it is simply not here, and the last line says where
 * it is, so nobody spends the morning hunting for a screen they will never be
 * given.
 */
export default function StaffToday({
  name,
  role,
  billsToday,
  soldToday,
  creditToday,
  ordersToSend,
}: {
  name: string;
  role: string;
  billsToday: number;
  soldToday: number;
  creditToday: number;
  ordersToSend: number;
}) {
  const money = (value: number) => `रु. ${Math.round(value).toLocaleString("en-IN")}`;
  const firstName = name.trim().split(" ")[0];

  return (
    <section className="rounded-2xl border border-brand-green-line bg-brand-paper p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-gold-deep">
            {role}
          </p>
          <h1 className="mt-2 font-display text-3xl font-black leading-tight text-brand-green-ink">
            नमस्कार{firstName ? ` ${firstName}` : ""}
          </h1>
          <p className="mt-2 text-sm text-brand-muted">
            {billsToday > 0
              ? `तपाईंको काउन्टरबाट आज ${billsToday} बिल कटेको छ।`
              : "आज अझै बिल कटेको छैन।"}
          </p>
        </div>

        <Link
          href="/admin/pos"
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-green px-6 text-sm font-black text-white transition hover:bg-brand-green-ink"
        >
          <PlusIcon className="h-4 w-4" />
          नयाँ बिल
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-brand-green-line bg-brand-paper/60 p-4">
          <p className="text-sm font-semibold text-brand-muted">आज काटेको</p>
          <p className="mt-2 font-display text-2xl font-black text-brand-green-ink">
            {money(soldToday)}
          </p>
        </div>
        {/* Credit gets its own tile and the clay colour rather than being
            folded into the total: it is money the shop has not got yet, and a
            counter that cannot see it will keep giving it. */}
        <div className="rounded-xl border border-brand-green-line bg-brand-paper/60 p-4">
          <p className="text-sm font-semibold text-brand-muted">उधारो बाँकी</p>
          <p
            className={`mt-2 font-display text-2xl font-black ${
              creditToday > 0 ? "text-brand-clay" : "text-brand-green-ink"
            }`}
          >
            {money(creditToday)}
          </p>
        </div>
        <div className="rounded-xl border border-brand-green-line bg-brand-paper/60 p-4">
          <p className="text-sm font-semibold text-brand-muted">पठाउन बाँकी अर्डर</p>
          <p className="mt-2 font-display text-2xl font-black text-brand-green-ink">
            {ordersToSend}
          </p>
        </div>
      </div>

      <p className="mt-5 flex flex-wrap items-center gap-1.5 text-xs leading-5 text-brand-muted">
        तलब, कारखाना र सेटिङ मालिकको मात्र हो — त्यसैले यहाँ देखिँदैन।
        <Link href="/admin/orders" className="inline-flex items-center gap-1 font-bold text-brand-green">
          अर्डर हेर्ने
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </Link>
      </p>
    </section>
  );
}
