/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import PrintButton from "@/components/admin/PrintButton";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = { title: "फोनमा खोल्ने | KRISHOE Admin" };
export const dynamic = "force-dynamic";

/**
 * Two doors, and the labels say which is which.
 *
 * "Owner & staff" read as two kinds of sign-in, and the owner could not tell
 * which one their phone had opened. There is only one office door — Owner,
 * Manager and Accountant all sign in at /admin/login — and one factory door.
 * Each card now names the heading that appears on the page it opens, so the
 * phone can be checked against the card.
 */
const codes = [
  {
    key: "admin",
    title: "यो तपाईंको",
    english: "Office · Admin",
    path: "/admin/login",
    who: "तपाईं, Manager, Accountant — सबै यहीँबाट",
    opens: "KRISHOE control room",
    guard: "password + Gmail मा आउने ६ अंकको कोड",
    print: false,
  },
  {
    key: "worker",
    title: "यो कामदारको",
    english: "Factory · Workers",
    path: "/worker/login",
    who: "२५ जनालाई एउटै कागज — कसैको नाम छैन",
    opens: "KRISHOE worker portal",
    guard: "मोबाइल नम्बर + password (पहिलो पटकमै फेर्नैपर्ने)",
    print: true,
  },
];

export default async function OpenOnPhonePage() {
  await requireAdminPermission("dashboard:read");

  return (
    <main className="p-6 pb-24 print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-brand-green-ink">फोनमा खोल्ने</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
            फोनको camera यी QR मा तेर्साउनुहोस् — ठेगाना टाइप गर्नु पर्दैन।
            छापेर भित्तामा पनि टाँस्न मिल्छ।
          </p>
        </div>
        <PrintButton className="inline-flex h-11 items-center rounded-full bg-brand-green px-6 text-sm font-bold text-white">
          छाप्ने
        </PrintButton>
      </div>

      {/* Said once, at the top, because it is the question the owner asked:
          what happens if someone else scans this. */}
      <section className="mt-5 rounded-2xl border-2 border-brand-green/25 bg-brand-green-wash/40 p-5 print:border print:bg-white">
        <h2 className="text-lg font-black text-brand-green-ink">
          🔑 QR भनेको ठेगाना हो — साँचो होइन
        </h2>
        <div className="mt-3 grid gap-2 text-sm leading-6 text-gray-700">
          <p>
            <strong className="text-brand-green-ink">यी QR मा password छैन, token छैन, कसैको नाम छैन।</strong>{" "}
            कसैले खिच्यो भने उसले पाउने भनेको login पाना मात्र हो — जुन पहिले नै
            इन्टरनेटमा सबैलाई खुलै छ।
          </p>
          <p>
            भित्र पस्न <strong className="text-brand-green-ink">password</strong> चाहिन्छ, र
            मालिक-staff लाई <strong className="text-brand-green-ink">Gmail मा आउने कोड</strong> पनि।
            ती QR मा हुँदैनन्, त्यसैले QR हराए पनि केही जाँदैन।
          </p>
          <p className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-brand-clay print:bg-white">
            ⚠️ QR सँगै password चाहिँ कहिल्यै नलेख्नुहोस्। कागज हराए खाता जान्छ।
          </p>
          <p className="rounded-lg bg-white px-3 py-2 text-xs leading-5 text-gray-600 print:bg-white">
            <strong className="text-brand-green-ink">ढोका दुई मात्र छन्।</strong> मालिक, Manager र
            Accountant — तीनै जना <strong>एउटै</strong> ढोकाबाट पस्छन् (पहिलो QR)। कामदारको ढोका
            अर्को हो (दोस्रो QR)। यसबाहेक अरू कुनै login छैन।
          </p>
        </div>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {codes.map((code) => (
          <article
            key={code.key}
            className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm print:border print:shadow-none"
          >
            <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-gold-deep">
              {code.english}
            </p>
            <h2 className="mt-2 text-2xl font-black text-brand-green-ink">{code.title}</h2>
            {code.print ? (
              <p className="text-sm font-semibold text-gray-500">छापेर भित्तामा टाँस्नुहोस्</p>
            ) : (
              <p className="text-sm font-semibold text-gray-500">आफ्नै फोनमा राख्नुहोस्</p>
            )}

            <img
              src={`/api/admin/open-on-phone?to=${code.key}`}
              alt={`QR code for ${absoluteUrl(code.path)}`}
              className="mx-auto mt-5 h-56 w-56"
            />

            <p className="mt-3 break-all font-mono text-xs text-gray-500">
              {absoluteUrl(code.path)}
            </p>

            <dl className="mt-5 grid gap-2 text-left text-sm">
              {/* The heading printed on the page this opens. Scan it, look at
                  the top of the phone, and it either matches or it does not —
                  which is the check the owner had no way to make. */}
              <div className="rounded-xl border border-brand-green/25 bg-brand-green-wash/50 p-3 print:border print:bg-white">
                <dt className="text-xs font-black uppercase tracking-wider text-brand-green">
                  फोनमा यही लेखेको आउनुपर्छ
                </dt>
                <dd className="mt-0.5 font-black text-brand-green-ink">“{code.opens}”</dd>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 print:bg-white">
                <dt className="text-xs font-black uppercase tracking-wider text-gray-400">कसका लागि</dt>
                <dd className="mt-0.5 font-semibold text-brand-green-ink">{code.who}</dd>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 print:bg-white">
                <dt className="text-xs font-black uppercase tracking-wider text-gray-400">भित्र पस्न चाहिने</dt>
                <dd className="mt-0.5 font-semibold text-brand-green-ink">{code.guard}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 print:hidden">
        <h2 className="text-lg font-black text-brand-green-ink">फोनमा app जस्तै बनाउने</h2>
        <ol className="mt-3 grid gap-2 text-sm leading-6 text-gray-700">
          <li>
            <strong className="text-brand-green-ink">१.</strong> QR स्क्यान गरेपछि{" "}
            <strong>Chrome</strong> मा खुल्छ (Facebook वा WhatsApp भित्रको browser मा होइन)।
          </li>
          <li>
            <strong className="text-brand-green-ink">२.</strong> माथि दायाँ{" "}
            <strong>⋮</strong> → <strong>&ldquo;Add to Home screen&rdquo;</strong> थिच्नुहोस्।
            iPhone मा तलको <strong>⬆️</strong> → <strong>&ldquo;Add to Home Screen&rdquo;</strong>।
          </li>
          <li>
            <strong className="text-brand-green-ink">३.</strong> अब home screen मा{" "}
            <strong>KRISHOE</strong> icon बस्छ — address bar बिना, app जस्तै खुल्छ।
          </li>
        </ol>
        <Link
          href="/admin/settings"
          className="mt-4 inline-flex h-11 items-center rounded-full border border-gray-200 px-5 text-sm font-bold text-brand-green-ink transition hover:border-brand-green"
        >
          कामदारको खाता खोल्ने → Settings
        </Link>
      </section>
    </main>
  );
}
