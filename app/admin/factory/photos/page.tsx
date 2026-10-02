import type { Metadata } from "next";
import Link from "next/link";
import T from "@/components/T";
import { getAdminSession } from "@/lib/admin-auth";
import { canAdmin, getSessionAdminRole } from "@/lib/admin-role-permissions";
import { listWorkerPhotos, listWorkerRequests } from "@/lib/worker-portal";
import { photoDraftReady, workerPortalDatabaseStatus } from "@/lib/worker-portal-db";
import { getFactoryItems } from "@/lib/factory-board-data";
import WorkerInbox from "./WorkerInbox";

export const metadata: Metadata = { title: "Workers' photos | KRISHOE Admin" };
export const dynamic = "force-dynamic";

/** What the factory's workers have sent from their app (owner, 2026-10-02). */
export default async function WorkerPhotosAdminPage() {
  const [status, photos, requests, session, draftsOn, items] = await Promise.all([
    workerPortalDatabaseStatus().catch(() => ({ ready: false, pending: [] })),
    listWorkerPhotos({ limit: 90 }).catch(() => []),
    listWorkerRequests({ limit: 60 }).catch(() => []),
    getAdminSession(),
    photoDraftReady(),
    getFactoryItems()
      .then((loaded) => loaded.items.map((item) => ({ id: item.id, name: item.name })))
      .catch(() => [] as Array<{ id: string; name: string }>),
  ]);
  const canAnswer = Boolean(session && canAdmin(getSessionAdminRole(session), "wages:write"));

  return (
    <section className="p-4 pb-28 sm:p-6 sm:pb-10">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">
        <T en="Factory" ne="कारखाना" />
      </p>
      <h1 className="mt-2 font-display text-2xl font-black text-brand-green-ink sm:text-3xl">
        <T en="Workers' photos and requests" ne="कामदारका फोटो र कुरा" />
      </h1>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-brand-muted">
        <T
          en="What workers send from their app. Proof only: the books change when you add the work or record a payment."
          ne="कामदारले app बाट पठाएका। प्रमाण मात्र: काम थपेपछि वा भुक्तानी लेखेपछि मात्र हिसाब बदलिन्छ।"
        />{" "}
        <Link href="/admin/factory/workers" className="font-bold text-brand-green underline underline-offset-4">
          <T en="← Workers" ne="← कामदार" />
        </Link>
      </p>

      {status.pending.length > 0 ? (
        <p className="mt-4 rounded-2xl border border-brand-gold bg-brand-cream-soft px-4 py-3 text-sm font-bold text-brand-green-ink">
          <T
            en="Switch this on first: Settings → “Worker app — photos and requests” → OK."
            ne="पहिले खोल्नुहोस्: Settings → “कामदारको app — फोटो र कुरा” → OK।"
          />{" "}
          <Link href="/admin/settings#worker-app-database" className="underline underline-offset-4">
            <T en="Open Settings →" ne="Settings खोल्ने →" />
          </Link>
        </p>
      ) : null}

      <div className="mt-6">
        <WorkerInbox photos={photos} requests={requests} canAnswer={canAnswer} items={items} draftsOn={draftsOn} />
      </div>
    </section>
  );
}
