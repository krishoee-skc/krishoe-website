import type { Metadata } from "next";
import { redirect } from "next/navigation";
import WorkerPortalShell from "@/components/worker/WorkerPortalShell";
import WorkerPortalUnavailable from "@/components/worker/WorkerPortalUnavailable";
import { getCurrentWorkerAccess } from "@/lib/worker-auth";
import { factoryItemHistory, isWorkerOnLeave, listWorkerPhotos } from "@/lib/worker-portal";
import { workerWritesReady } from "@/lib/worker-portal-db";
import { getFactoryItems } from "@/lib/factory-board-data";
import { money } from "@/lib/format-money";
import WorkerWriteForm, { type LastWritten, type WriteItem } from "./WorkerWriteForm";

export const metadata: Metadata = { title: "काम लेख्ने | KRISHOE" };
export const dynamic = "force-dynamic";

/**
 * The worker writes the day's work (owner, 2026-10-13, "क"), and sees what
 * became of what they wrote: waiting for the owner, on the books, or not.
 */
export default async function WorkerWritePage() {
  const access = await getCurrentWorkerAccess();
  if (!access.authenticated) redirect("/worker/login");
  if (!access.linked) return <WorkerPortalUnavailable reason={access.reason} closed={"closed" in access && access.closed} />;
  const { detail } = access;

  const [ready, onLeave, mine, items, history] = await Promise.all([
    workerWritesReady(),
    isWorkerOnLeave(detail.worker.id).catch(() => false),
    listWorkerPhotos({ workerId: detail.worker.id, limit: 40 })
      .then((photos) => photos.filter((photo) => photo.written).slice(0, 12))
      .catch(() => []),
    getFactoryItems()
      .then((loaded) => loaded.items.map((item) => ({ id: item.id, name: item.name })))
      .catch(() => [] as Array<{ id: string; name: string }>),
    factoryItemHistory().catch(() => ({}) as Awaited<ReturnType<typeof factoryItemHistory>>),
  ]);

  const disabledReason = !ready
    ? "काम लेख्ने सुविधा अझै खुलेको छैन — मालिकलाई भन्नुहोस्।"
    : detail.worker.workerType !== "piece_rate"
      ? "जोडी अनुसार ज्याला पाउनेले मात्र यहाँ काम लेख्छन्।"
      : onLeave
        ? "तपाईं बिदामा हुनुहुन्छ — अहिले लेख्न मिल्दैन।"
        : "";

  const writeItems: WriteItem[] = items.map((item) => ({
    ...item,
    colors: history[item.id]?.colors ?? [],
    lastSize: history[item.id]?.size ?? "",
  }));
  const newest = mine[0];
  const last: LastWritten = newest ? { itemId: newest.itemId, color: newest.color, size: newest.size, pairs: newest.pairs ?? 0 } : null;

  return (
    <WorkerPortalShell workerName={detail.worker.name}>
      <h1 className="text-2xl font-black text-brand-green-ink">✍️ आजको काम लेख्ने</h1>
      <p className="mt-1 text-base text-brand-muted">जुत्ता, रङ, साइज र जोडी छानेर मालिकलाई पठाउनुहोस्। फोटो चाहिँदैन।</p>

      <div className="mt-4">
        {disabledReason ? (
          <p className="rounded-2xl bg-brand-cream-soft px-4 py-4 text-lg font-bold text-brand-green-ink">{disabledReason}</p>
        ) : (
          <WorkerWriteForm items={writeItems} last={last} />
        )}
      </div>

      {mine.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xl font-black">मैले लेखेको</h2>
          <ul className="mt-3 grid gap-3">
            {mine.map((entry) => (
              <li key={entry.id} className="rounded-2xl border border-brand-green-line bg-brand-paper px-4 py-3">
                <p className="flex flex-wrap items-baseline justify-between gap-2 text-lg font-black">
                  <span>{entry.itemName || "जुत्ता"}{entry.color ? ` · ${entry.color}` : ""}</span>
                  <span className="tabular-nums">{entry.pairs ?? 0} जोडी</span>
                </p>
                <p className="text-base text-brand-muted">
                  {entry.size ? `साइज ${entry.size}` : ""}
                  {entry.workDate ? ` · ${entry.workDate}` : ""}
                </p>
                {entry.status === "added" ? (
                  <p className="mt-1 font-black text-brand-green">✓ हिसाबमा थपियो{entry.amountEarned !== null ? ` · ${money(entry.amountEarned)}` : ""}</p>
                ) : entry.verdict === "not_work" ? (
                  <p className="mt-1 font-black text-red-800">✖ मिलेन{entry.reply ? `: ${entry.reply}` : ""}</p>
                ) : (
                  <p className="mt-1 font-bold text-brand-gold-deep">⏳ मालिकले हेर्न बाँकी</p>
                )}
                {entry.status === "added" && entry.reply ? <p className="text-base text-brand-muted">मालिक: {entry.reply}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </WorkerPortalShell>
  );
}
