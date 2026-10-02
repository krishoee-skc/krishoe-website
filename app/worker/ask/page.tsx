import type { Metadata } from "next";
import { redirect } from "next/navigation";
import WorkerPortalShell from "@/components/worker/WorkerPortalShell";
import WorkerPortalUnavailable from "@/components/worker/WorkerPortalUnavailable";
import { money } from "@/lib/format-money";
import { getCurrentWorkerAccess } from "@/lib/worker-auth";
import { listWorkerRequests } from "@/lib/worker-portal";
import { workerTableReady } from "@/lib/worker-portal-db";
import AskForm from "./AskForm";

export const metadata: Metadata = { title: "मालिकलाई भन्ने | KRISHOE" };
export const dynamic = "force-dynamic";

const statusWords = { open: "⏳ मालिकले हेर्न बाँकी", done: "✅ मालिकले हेर्नुभयो", declined: "✖ अहिले मिलेन" } as const;

/** "The sum is wrong" and "an advance, please" — and the owner's answers. */
export default async function WorkerAskPage({ searchParams }: { searchParams?: Promise<{ about?: string }> }) {
  const access = await getCurrentWorkerAccess();
  if (!access.authenticated) redirect("/worker/login");
  if (!access.linked) return <WorkerPortalUnavailable reason={access.reason} closed={"closed" in access && access.closed} />;
  const { detail } = access;
  const about = ((await searchParams) ?? {}).about === "advance" ? "advance" : "hisab";
  const [ready, mine] = await Promise.all([
    workerTableReady("factory_worker_requests"),
    listWorkerRequests({ workerId: detail.worker.id, limit: 20 }).catch(() => []),
  ]);

  return (
    <WorkerPortalShell workerName={detail.worker.name}>
      <h1 className="text-2xl font-black text-brand-green-ink">मालिकलाई भन्ने</h1>
      <p className="mt-1 text-base text-brand-muted">हिसाब नमिलेको भए वा पेस्की चाहिए यहाँबाट भन्नुहोस्। जवाफ यहीँ आउँछ।</p>
      <div className="mt-4">
        {ready ? <AskForm start={about} /> : <p className="rounded-2xl bg-brand-cream-soft px-4 py-4 text-lg font-bold">यो सुविधा अझै खुलेको छैन — मालिकलाई भन्नुहोस्।</p>}
      </div>

      {mine.length > 0 ? (
        <section className="mt-6 grid gap-3">
          <h2 className="text-xl font-black">मैले भनेका कुरा</h2>
          {mine.map((item) => (
            <article key={item.id} className="rounded-2xl border border-brand-green-line bg-brand-paper p-4">
              <p className="text-lg font-black">
                {item.kind === "advance" ? `💵 पेस्की ${item.amount ? money(item.amount) : ""}` : "⚖️ हिसाब मिलेन"}
                {item.aboutDate ? ` · ${item.aboutDate}` : ""}
              </p>
              {item.message ? <p className="mt-1 text-base text-brand-muted">{item.message}</p> : null}
              <p className="mt-2 text-base font-bold text-brand-green">{statusWords[item.status]}</p>
              {item.reply ? <p className="mt-1 rounded-xl bg-brand-mist px-3 py-2 text-base">मालिक: {item.reply}</p> : null}
            </article>
          ))}
        </section>
      ) : null}
    </WorkerPortalShell>
  );
}
