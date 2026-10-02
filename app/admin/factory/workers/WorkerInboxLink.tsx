import Link from "next/link";
import T from "@/components/T";

/**
 * The way to what workers have sent — photos of their work, and their
 * questions and advance requests — with how many are waiting (owner,
 * 2026-10-02).
 */
export default function WorkerInboxLink({ photos, requests }: { photos: number; requests: number }) {
  const waiting = photos + requests;
  return (
    <div className="px-4 pt-4 sm:px-6">
      <Link
        href="/admin/factory/photos"
        className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-base font-black transition ${
          waiting > 0 ? "border-brand-green bg-brand-green-wash text-brand-green-ink" : "border-brand-green-line bg-brand-paper text-brand-green-ink"
        }`}
      >
        <span>📷 <T en="Workers' photos and requests" ne="कामदारका फोटो र कुरा" /></span>
        <span className="flex items-center gap-2 text-sm">
          {photos > 0 ? <span className="rounded-full bg-brand-green px-2.5 py-0.5 text-white"><T en={`${photos} new photo${photos === 1 ? "" : "s"}`} ne={`${photos} नयाँ फोटो`} /></span> : null}
          {requests > 0 ? <span className="rounded-full bg-brand-gold-bright px-2.5 py-0.5 text-brand-green-ink"><T en={`${requests} to answer`} ne={`${requests} जवाफ दिनु`} /></span> : null}
          <span aria-hidden="true">→</span>
        </span>
      </Link>
    </div>
  );
}
