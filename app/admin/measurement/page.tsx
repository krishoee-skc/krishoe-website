import type { Metadata } from "next";
import { requireAdminPermission } from "@/lib/admin-permissions";

export const metadata: Metadata = { title: "मापन सेटअप | KRISHOE Admin" };
export const dynamic = "force-dynamic";

/**
 * Whether the shop can see anything, and how to switch it on.
 *
 * The tracking code for Meta, TikTok and Google is written and shipped; the
 * three ids that turn it on are blank, so the shop currently measures nothing.
 * Until they are set, an advertising rupee cannot be told from a wasted one —
 * which makes this the highest-value thirty minutes available to the owner and
 * the only one I cannot do for them.
 *
 * So this page does the next best thing: says plainly which are on, and gives
 * the exact steps for the ones that are not.
 */
const trackers = [
  {
    key: "NEXT_PUBLIC_META_PIXEL_ID",
    value: process.env.NEXT_PUBLIC_META_PIXEL_ID,
    name: "Meta Pixel",
    nepali: "Facebook र Instagram",
    why: "Facebook/Instagram मा विज्ञापन चलाउँदा कुन विज्ञापनले बिक्री ल्यायो थाहा हुन्छ। यो बिना ad चलाउनु आँखा चिम्लेर पैसा फ्याँक्नु हो।",
    looksLike: "१५ अंकको नम्बर — जस्तै 1234567890123456",
    link: "https://business.facebook.com/events_manager2",
    linkLabel: "Meta Events Manager खोल्ने",
    steps: [
      "business.facebook.com खोल्नुहोस्",
      "बायाँ मेनुबाट Events Manager",
      "Connect data sources → Web → Connect",
      "Pixel को नाम राख्नुहोस् (KRISHOE) → Create",
      "माथि देखिने Pixel ID copy गर्नुहोस्",
    ],
    // Was blocked on there being no Page — a pixel cannot attach to a personal
    // profile. The Page now exists, so this says where to find it instead of
    // what is missing.
    blocker: "✅ KRISHOE Page बनिसक्यो — Events Manager मा त्यही Page छान्नुहोस्।",
  },
  {
    key: "NEXT_PUBLIC_TIKTOK_PIXEL_ID",
    value: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID,
    name: "TikTok Pixel",
    nepali: "TikTok",
    why: "नेपालमा अहिले TikTok ले सबैभन्दा बढी बिक्री गराउँछ। कारखानाको भिडियोले ल्याएको ग्राहक यहीँ गनिन्छ।",
    looksLike: "अक्षर र अंक मिसिएको — जस्तै C4A2B8QRSTUV",
    link: "https://ads.tiktok.com/i18n/events_manager",
    linkLabel: "TikTok Events Manager खोल्ने",
    steps: [
      "ads.tiktok.com मा खाता खोल्नुहोस्",
      "Assets → Events → Web Events → Set Up Web Events",
      "TikTok Pixel → Manual Setup छान्नुहोस्",
      "नाम राख्नुहोस् (KRISHOE) → Pixel ID copy गर्नुहोस्",
    ],
    blocker: "",
  },
  {
    key: "NEXT_PUBLIC_GA4_ID",
    value: process.env.NEXT_PUBLIC_GA4_ID,
    name: "Google Analytics 4",
    nepali: "Google",
    why: "कति मान्छे आए, कुन जुत्ता धेरै हेरे, कहाँबाट आए — सबै यहीँ देखिन्छ। निःशुल्क।",
    looksLike: "G- ले सुरु हुने — जस्तै G-XXXXXXXXXX",
    link: "https://analytics.google.com",
    linkLabel: "Google Analytics खोल्ने",
    steps: [
      "analytics.google.com खोल्नुहोस्",
      "Admin → Create → Property → नाम KRISHOE",
      "Data streams → Web → वेबसाइटको ठेगाना हाल्नुहोस्",
      "देखिने Measurement ID (G- बाट सुरु) copy गर्नुहोस्",
    ],
    blocker: "",
  },
];

export default async function MeasurementPage() {
  await requireAdminPermission("settings:write");

  const live = trackers.filter((tracker) => Boolean(tracker.value));
  const missing = trackers.filter((tracker) => !tracker.value);

  return (
    <section className="p-6 pb-24">
      <div>
        <h1 className="text-2xl font-black text-brand-green-ink">मापन सेटअप</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
          कति मान्छे आए, के हेरे, किन नकिनी गए — यी नराखेसम्म केही थाहा हुँदैन।
          कोड तयारै छ, तीनवटा ID मात्र हाल्न बाँकी।
        </p>
      </div>

      <div
        className={`mt-5 rounded-2xl border-2 p-5 ${
          missing.length === 0
            ? "border-emerald-300 bg-emerald-50"
            : "border-brand-clay/40 bg-brand-clay/5"
        }`}
      >
        <p className="text-lg font-black text-brand-green-ink">
          {missing.length === 0
            ? "✅ तीनै चालु छन् — app ले देख्दैछ"
            : `🔴 ${missing.length} वटा बाँकी — अहिले app ${live.length === 0 ? "पूरै अन्धो" : "आधा अन्धो"} छ`}
        </p>
        {missing.length > 0 ? (
          <p className="mt-2 text-sm leading-6 text-gray-700">
            <strong className="text-brand-green-ink">खर्च रु ०। समय ~३० मिनेट।</strong>{" "}
            यो नगरी विज्ञापनमा एक रुपैयाँ पनि नहाल्नुहोस् — कुन काम लाग्यो थाहै हुँदैन।
          </p>
        ) : null}
      </div>

      <div className="mt-6 grid gap-5">
        {trackers.map((tracker) => {
          const on = Boolean(tracker.value);
          return (
            <article
              key={tracker.key}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${
                on ? "border-emerald-200" : "border-gray-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-brand-green-ink">
                    {tracker.name} <span className="font-bold text-gray-500">· {tracker.nepali}</span>
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">{tracker.why}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    on ? "bg-emerald-100 text-emerald-900" : "bg-brand-clay text-white"
                  }`}
                >
                  {on ? "चालु" : "बाँकी"}
                </span>
              </div>

              {on ? (
                <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 font-mono text-xs text-emerald-900">
                  {/* Only the tail. The id is not a secret — it ships in the page
                      — but a full one on screen invites it being pasted into the
                      wrong shop's settings. */}
                  …{String(tracker.value).slice(-6)} · चलिरहेको छ
                </p>
              ) : (
                <>
                  <ol className="mt-4 grid gap-2 text-sm leading-6 text-gray-700">
                    {tracker.steps.map((step, index) => (
                      <li key={step} className="flex gap-3 rounded-xl bg-gray-50 px-3 py-2">
                        <span className="font-black text-brand-green">{index + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>

                  {tracker.blocker ? (
                    <p className="mt-3 rounded-xl bg-brand-clay/10 px-3 py-2 text-sm font-bold text-brand-clay">
                      {tracker.blocker}
                    </p>
                  ) : null}

                  <p className="mt-3 text-xs leading-5 text-gray-500">
                    कस्तो देखिन्छ: <span className="font-mono text-brand-green-ink">{tracker.looksLike}</span>
                  </p>

                  {/* The steps name a website; this opens it. Typing
                      "business.facebook.com/events_manager2" from a screen is a
                      step that fails silently — one wrong character and the
                      owner lands on a login page they cannot tell apart from
                      the right one. */}
                  <a
                    href={tracker.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand-green px-5 text-sm font-black text-white transition hover:bg-brand-green-ink"
                  >
                    {tracker.linkLabel} ↗
                  </a>
                </>
              )}
            </article>
          );
        })}
      </div>

      <section className="mt-8 rounded-2xl border-2 border-brand-green/25 bg-brand-green-wash/40 p-5">
        <h2 className="text-lg font-black text-brand-green-ink">ID पाएपछि कहाँ हाल्ने</h2>
        <ol className="mt-3 grid gap-2 text-sm leading-6 text-gray-700">
          <li className="rounded-xl bg-white px-3 py-2">
            <strong className="text-brand-green-ink">१.</strong> तलको बटनले सिधै{" "}
            <strong>Environment Variables</strong> मै पुर्‍याउँछ
            {/* Straight to the Environment Variables screen. The account slug
                came from the owner; without it this could only point at the
                dashboard and leave three more clicks to be described. */}
            <a
              href="https://vercel.com/krishoee-5610s-projects/krishoe-website/settings/environment-variables"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-brand-green-ink px-5 text-sm font-black text-white transition hover:bg-brand-green"
            >
              Vercel — Environment Variables खोल्ने ↗
            </a>
          </li>
          {/* Only the missing ones. Listing a key that is already live invites
              it being pasted a second time, and a duplicate there overwrites a
              working value with whatever was on the clipboard. */}
          <li className="rounded-xl bg-white px-3 py-2">
            <strong className="text-brand-green-ink">२.</strong> Key र Value हालेर{" "}
            <strong>Save</strong> — यी{" "}
            {missing.length === trackers.length ? "तीन" : `${missing.length}`} वटा बाँकी छन्:
            <div className="mt-2 grid gap-1 font-mono text-xs text-brand-green">
              {(missing.length > 0 ? missing : trackers).map((tracker) => (
                <span key={tracker.key}>{tracker.key}</span>
              ))}
            </div>
          </li>
          <li className="rounded-xl bg-white px-3 py-2">
            <strong className="text-brand-green-ink">३.</strong> माथि{" "}
            <strong>Deployments</strong> → पछिल्लोमा <strong>⋯</strong> →{" "}
            <strong>Redeploy</strong>
            <span className="mt-1 block text-xs font-bold text-brand-clay">
              ⚠️ यो नथिचेसम्म ID हालेको काम लाग्दैन — सबैले यहीँ चुक्छन्।
            </span>
          </li>
          <li className="rounded-xl bg-white px-3 py-2">
            <strong className="text-brand-green-ink">४.</strong> यही पाना फेरि खोल्नुहोस् —
            हरियो <strong>चालु</strong> देखियो भने भयो
          </li>
        </ol>
        <p className="mt-3 text-xs leading-5 text-gray-600">
          ⚠️ नाम ठ्याक्कै माथिकै जस्तो हुनुपर्छ — एउटा अक्षर फरक परे चल्दैन।
        </p>
      </section>
    </section>
  );
}
