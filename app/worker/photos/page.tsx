import type { Metadata } from "next";
import { redirect } from "next/navigation";
import WorkerPortalShell from "@/components/worker/WorkerPortalShell";
import WorkerPortalUnavailable from "@/components/worker/WorkerPortalUnavailable";
import { getCurrentWorkerAccess } from "@/lib/worker-auth";
import { isWorkerOnLeave, listWorkerPhotos, PHOTO_KINDS } from "@/lib/worker-portal";
import { photoDraftReady, workerTableReady } from "@/lib/worker-portal-db";
import { getFactoryItems } from "@/lib/factory-board-data";
import WorkerPhotoForm from "./WorkerPhotoForm";

export const metadata: Metadata = { title: "कामको फोटो | KRISHOE" };
export const dynamic = "force-dynamic";

const statusWords = { new: "पठाइयो", seen: "मालिकले देख्नुभयो ✓", added: "हिसाबमा थपियो ✓" } as const;

/** The worker's photos of their work: send one, and see what became of the last ones. */
export default async function WorkerPhotosPage() {
  const access = await getCurrentWorkerAccess();
  if (!access.authenticated) redirect("/worker/login");
  if (!access.linked) return <WorkerPortalUnavailable reason={access.reason} closed={"closed" in access && access.closed} />;
  const { detail } = access;

  const [ready, onLeave, mine, draft, items] = await Promise.all([
    workerTableReady("factory_worker_photos"),
    isWorkerOnLeave(detail.worker.id).catch(() => false),
    listWorkerPhotos({ workerId: detail.worker.id, limit: 12 }).catch(() => []),
    photoDraftReady(),
    getFactoryItems()
      .then((loaded) => loaded.items.map((item) => ({ id: item.id, name: item.name })))
      .catch(() => [] as Array<{ id: string; name: string }>),
  ]);
  const disabledReason = !ready
    ? "फोटो पठाउने सुविधा अझै खुलेको छैन — मालिकलाई भन्नुहोस्।"
    : onLeave
      ? "तपाईं बिदामा हुनुहुन्छ — अहिले फोटो पठाउन मिल्दैन।"
      : undefined;

  return (
    <WorkerPortalShell workerName={detail.worker.name}>
      <h1 className="text-2xl font-black text-brand-green-ink">📷 कामको फोटो पठाउने</h1>
      <p className="mt-1 text-base text-brand-muted">मालिकले हेरेर हिसाबमा थप्नुहुन्छ। एक दिनमा १० फोटोसम्म।</p>
      <div className="mt-4">
        <WorkerPhotoForm disabledReason={disabledReason} items={draft && detail.worker.workerType === "piece_rate" ? items : []} />
      </div>

      {mine.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-xl font-black">पछिल्ला फोटो</h2>
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {mine.map((photo) => (
              <li key={photo.id} className="overflow-hidden rounded-2xl border border-brand-green-line bg-brand-paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.imageUrl} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                <div className="p-2 text-sm">
                  <p className="font-black">
                    {PHOTO_KINDS.find((kind) => kind.value === photo.kind)?.icon} {PHOTO_KINDS.find((kind) => kind.value === photo.kind)?.ne}
                    {photo.pairs ? ` · ${photo.pairs} जोडी` : ""}
                    {photo.itemName ? ` · ${photo.itemName}` : ""}
                  </p>
                  <p className={photo.status === "new" ? "text-brand-muted" : "font-bold text-brand-green"}>{statusWords[photo.status]}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </WorkerPortalShell>
  );
}
