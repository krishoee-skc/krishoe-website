import type { Metadata } from "next";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { listWholesaleEnquiries } from "@/lib/wholesale-enquiries";
import { updateEnquiryStatusAction } from "./actions";
import { formatAdminDate } from "@/lib/format-date";

export const metadata: Metadata = { title: "थोकको सोधपुछ | KRISHOE Admin" };
export const dynamic = "force-dynamic";

const statusTone: Record<string, string> = {
  New: "bg-brand-clay text-white",
  Contacted: "bg-amber-100 text-amber-900",
  Customer: "bg-emerald-100 text-emerald-900",
  Closed: "bg-gray-100 text-gray-500",
};

export default async function WholesaleEnquiriesPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  await requireAdminPermission("customers:read");
  const saved = (await searchParams)?.saved;
  const enquiries = await listWholesaleEnquiries();
  const fresh = enquiries.filter((enquiry) => enquiry.status === "New").length;

  return (
    <section className="p-6 pb-24">
      <div>
        <h1 className="text-2xl font-black text-brand-green-ink">थोकको सोधपुछ</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
          पसलहरूले वेबसाइटबाट पठाएको सोधपुछ। एउटा थोक ग्राहक = ५० जोडी — त्यसैले
          चाँडो फोन गर्नुहोस्।
        </p>
      </div>

      {saved ? (
        <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
          {saved}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 text-sm font-black">
        <span className={`rounded-full px-3 py-1.5 ${fresh > 0 ? "bg-brand-clay text-white" : "bg-gray-100 text-gray-500"}`}>
          {fresh > 0 ? `${fresh} नयाँ — फोन गर्न बाँकी` : "नयाँ सोधपुछ छैन"}
        </span>
        <span className="rounded-full bg-gray-100 px-3 py-1.5 text-gray-600">
          जम्मा {enquiries.length}
        </span>
      </div>

      {enquiries.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm font-semibold text-gray-500">
          अझै कुनै सोधपुछ आएको छैन। पसलहरूलाई{" "}
          <span className="font-mono text-brand-green">krishoe-website.vercel.app/wholesale</span>{" "}
          पठाउनुहोस्।
        </p>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {enquiries.map((enquiry) => (
            <article key={enquiry.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-black text-brand-green-ink">{enquiry.shopName}</h2>
                  <p className="text-sm font-semibold text-gray-600">
                    {enquiry.contactName}
                    {enquiry.location ? ` · ${enquiry.location}` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${statusTone[enquiry.status]}`}>
                  {enquiry.status}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {/* One tap to call, one to WhatsApp. A wholesale deal is settled
                    on the phone, so the phone is the primary action here. */}
                <a
                  href={`tel:${enquiry.phone.replace(/[^\d+]/g, "")}`}
                  className="inline-flex min-h-11 items-center rounded-xl bg-brand-green px-4 text-sm font-black text-white transition hover:bg-brand-green-ink"
                >
                  📞 {enquiry.phone}
                </a>
                <a
                  href={`https://wa.me/${enquiry.phone.replace(/[^\d]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center rounded-xl border border-gray-200 px-4 text-sm font-black text-brand-green-ink transition hover:border-brand-green"
                >
                  WhatsApp
                </a>
              </div>

              <dl className="mt-4 grid gap-2 rounded-xl bg-gray-50 p-3 text-sm sm:grid-cols-2">
                {enquiry.monthlyPairs > 0 ? (
                  <div>
                    <dt className="text-xs font-black uppercase tracking-wider text-gray-400">महिनामा</dt>
                    <dd className="font-bold text-brand-green-ink">{enquiry.monthlyPairs} जोडी</dd>
                  </div>
                ) : null}
                {enquiry.email ? (
                  <div className="min-w-0">
                    <dt className="text-xs font-black uppercase tracking-wider text-gray-400">इमेल</dt>
                    <dd className="truncate font-bold text-brand-green-ink">{enquiry.email}</dd>
                  </div>
                ) : null}
                <div className="sm:col-span-2">
                  <dt className="text-xs font-black uppercase tracking-wider text-gray-400">आयो</dt>
                  <dd className="font-bold text-brand-green-ink">
                    {formatAdminDate(enquiry.createdAt, { time: true })}
                  </dd>
                </div>
              </dl>

              {enquiry.requirement ? (
                <p className="mt-3 whitespace-pre-wrap rounded-xl border border-gray-200 p-3 text-sm leading-6 text-gray-700">
                  {enquiry.requirement}
                </p>
              ) : null}

              <form action={updateEnquiryStatusAction} className="mt-4 grid gap-2 sm:grid-cols-[auto_1fr_auto]">
                <input type="hidden" name="id" value={enquiry.id} />
                <select
                  name="status"
                  defaultValue={enquiry.status}
                  className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-green"
                >
                  <option value="New">New</option>
                  <option value="Contacted">फोन गरेँ</option>
                  <option value="Customer">ग्राहक बने</option>
                  <option value="Closed">बन्द</option>
                </select>
                <input
                  name="note"
                  defaultValue={enquiry.note}
                  maxLength={500}
                  placeholder="के कुरा भयो"
                  className="min-h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-green"
                />
                <button
                  type="submit"
                  className="min-h-11 rounded-xl border border-gray-200 px-4 text-sm font-black text-brand-green-ink transition hover:border-brand-green"
                >
                  सुरक्षित
                </button>
              </form>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
