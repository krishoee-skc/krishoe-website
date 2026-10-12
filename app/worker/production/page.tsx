import Link from "next/link";
import { redirect } from "next/navigation";
import WorkerPortalShell from "@/components/worker/WorkerPortalShell";
import WorkerPortalUnavailable from "@/components/worker/WorkerPortalUnavailable";
import { toBikramSambatNepali } from "@/lib/bikram-sambat";
import { money } from "@/lib/format-money";
import { getCurrentWorkerAccess } from "@/lib/worker-auth";
import { listWorkerPhotos } from "@/lib/worker-portal";
import type { FactoryPortalWorkEntry } from "@/lib/factory-worker-portal";

const WEEKDAYS = ["आइतबार", "सोमबार", "मंगलबार", "बुधबार", "बिहीबार", "शुक्रबार", "शनिबार"];

/** "आइतबार, १८ आश्विन २०८३" — the day a worker knows it by. */
function dayLabel(date: string) {
  const weekday = WEEKDAYS[new Date(`${date}T06:00:00.000Z`).getUTCDay()] ?? "";
  const bs = toBikramSambatNepali(date);
  return [weekday, bs || date].filter(Boolean).join(", ");
}

/** "36, 37, 38, 39, 40" → "36–40". */
function shortSize(size: string) {
  const parts = size.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length > 2 ? `${parts[0]}–${parts[parts.length - 1]}` : parts.join(", ");
}

/**
 * The worker's own work, a card a line and a heading a day (owner, 2026-10-13):
 * the table it was ran 560px wide, so a phone had to slide it sideways to see
 * the pay. Each card says what was made, how many pairs and what it paid.
 */
export default async function WorkerProductionPage() {
  const access = await getCurrentWorkerAccess();
  if (!access.authenticated) redirect("/worker/login");
  if (!access.linked) return <WorkerPortalUnavailable reason={access.reason} closed={"closed" in access && access.closed} />;

  const { detail } = access;
  const totalPairs = detail.work.reduce((total, entry) => total + entry.pairs, 0);
  const totalEarned = detail.work.reduce((total, entry) => total + entry.amountEarned, 0);
  // What they wrote that the owner has not checked yet — not pay until it is.
  const waiting = await listWorkerPhotos({ workerId: detail.worker.id, limit: 40 })
    .then((photos) => photos.filter((photo) => photo.written && photo.status !== "added" && photo.verdict !== "not_work").length)
    .catch(() => 0);

  const days: Array<{ date: string; entries: FactoryPortalWorkEntry[] }> = [];
  for (const entry of detail.work) {
    const last = days[days.length - 1];
    if (last && last.date === entry.date) last.entries.push(entry);
    else days.push({ date: entry.date, entries: [entry] });
  }

  return (
    <WorkerPortalShell workerName={detail.worker.name}>
      <section className="rounded-3xl bg-brand-green-ink p-5 text-white md:p-7">
        <p className="text-base font-bold text-brand-gold-bright">मेरो काम</p>
        <p className="mt-1 text-4xl font-black text-white">{totalPairs.toLocaleString("en-IN")} जोडी</p>
        <p className="mt-1 text-base text-white/85">पछिल्लो काम · कुल कमाइ {money(totalEarned)}</p>
      </section>

      {waiting > 0 ? (
        <Link href="/worker/write" className="mt-3 block rounded-2xl border-2 border-brand-gold bg-brand-cream-soft px-4 py-3 text-lg font-black text-brand-green-ink">
          ⏳ {waiting} वटा लेखेको काम मालिकले हेर्न बाँकी →
        </Link>
      ) : null}

      {days.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-brand-green-line bg-brand-paper p-5 text-lg text-brand-muted">
          अझै कुनै काम टिपिएको छैन। काम टिपिएपछि यहाँ देखिन्छ।
        </p>
      ) : (
        days.map((day) => (
          <section key={day.date} className="mt-5">
            <h2 className="text-base font-black text-brand-muted">{dayLabel(day.date)}</h2>
            <ul className="mt-2 grid gap-2">
              {day.entries.map((entry) => (
                <li key={entry.id} className="rounded-2xl border border-brand-green-line bg-brand-paper px-4 py-3">
                  <p className="flex items-baseline justify-between gap-3 text-lg font-black text-brand-green-ink">
                    <span className="min-w-0">{entry.itemName}{entry.color ? ` · ${entry.color}` : ""}</span>
                    <span className="shrink-0 tabular-nums">{entry.pairs} जोडी</span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-baseline justify-between gap-x-3 text-base text-brand-muted">
                    <span>{[entry.size ? `साइज ${shortSize(entry.size)}` : "", entry.stage].filter(Boolean).join(" · ")}</span>
                    <span className="font-black tabular-nums text-brand-green">{money(entry.amountEarned)}</span>
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </WorkerPortalShell>
  );
}
