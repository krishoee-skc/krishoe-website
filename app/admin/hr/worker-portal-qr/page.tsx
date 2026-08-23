/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import PrintButton from "@/components/admin/PrintButton";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Worker portal poster | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

// Steps are written in Nepali first because the people reading the printed
// sheet are the workers, not the office. English sits underneath so an admin
// checking the poster can follow it too.
const steps = [
  {
    ne: "फोनको क्यामेरा खोलेर माथिको QR मा तेर्साउनुहोस्",
    en: "Open the phone camera and point it at the QR above",
  },
  {
    ne: "देखिएको लिंक थिच्नुहोस् — KRISHOE को पाना खुल्छ",
    en: "Tap the link that appears — the KRISHOE page opens",
  },
  {
    ne: "आफ्नो मोबाइल नम्बर र पासवर्ड हालेर भित्र जानुहोस्",
    en: "Sign in with your mobile number and the password the Owner gave you",
  },
  {
    ne: "मेनुबाट «Add to Home screen» थिच्नुहोस् — फोनमै icon बस्छ",
    en: "Choose “Add to Home screen” so an icon stays on the phone",
  },
];

export default async function WorkerPortalQrPage() {
  await requireAdminPermission("production:entry");
  const loginUrl = absoluteUrl("/worker/login");

  return (
    <main className="mx-auto max-w-3xl px-5 py-8 print:px-0 print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-brand-green-ink">Worker portal poster</h1>
          <p className="mt-1 text-sm text-gray-600">
            Print this and put it where workers gather. One sheet works for everyone — the QR
            carries no password and no worker identity.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/hr"
            className="inline-flex h-11 items-center rounded-full border border-gray-300 px-5 text-sm font-bold text-brand-green-ink"
          >
            Back to HR
          </Link>
          <PrintButton className="inline-flex h-11 items-center rounded-full bg-brand-green px-6 text-sm font-bold text-white">
            Print poster
          </PrintButton>
        </div>
      </div>

      <article className="mt-6 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm print:mt-0 print:rounded-none print:border-0 print:shadow-none">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-brand-gold-deep">KRISHOE</p>
        <h2 className="mt-3 text-4xl font-black leading-tight text-brand-green-ink">
          आफ्नो काम र तलब
          <span className="mt-1 block">आफैं हेर्नुहोस्</span>
        </h2>
        <p className="mt-3 text-base font-semibold text-gray-600">
          Check your own work and pay
        </p>

        <img
          src="/api/admin/hr/worker-portal-qr"
          alt={`QR code that opens ${loginUrl}`}
          className="mx-auto mt-7 h-64 w-64"
        />

        <p className="mt-4 break-all font-mono text-sm text-gray-500">{loginUrl}</p>

        <ol className="mx-auto mt-8 grid max-w-xl gap-3 text-left">
          {steps.map((step, index) => (
            <li
              key={step.en}
              className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4 print:bg-white"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-green text-sm font-black text-white">
                {index + 1}
              </span>
              <span>
                <span className="block text-base font-bold text-brand-green-ink">{step.ne}</span>
                <span className="mt-0.5 block text-sm text-gray-500">{step.en}</span>
              </span>
            </li>
          ))}
        </ol>

        <p className="mt-7 rounded-xl bg-brand-mist px-4 py-3 text-sm font-semibold leading-6 text-brand-green-ink print:bg-white">
पहिलो पटक पस्दा नयाँ पासवर्ड राख्नुहोस् — पुरानो त्यहीँ मर्छ। आफ्नो पासवर्ड कसैलाई नदिनुहोस्।
          <span className="mt-1 block text-xs font-normal text-gray-500">
Ask the Owner for your mobile sign-in. Change the password on first use, and never share it.
          </span>
        </p>
      </article>
    </main>
  );
}
