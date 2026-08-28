import type { Metadata } from "next";
import T from "@/components/T";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { configuredTrackingIds } from "@/lib/tracking-ids";

// The same source the shop's tags read, so this page cannot report a tracker as
// missing while it is live — the one lie that would make this page worse than
// having no page. `configured` rather than `active`: the owner is asking what
// production does, not what this particular machine does.
const trackingIds = configuredTrackingIds();

export const metadata: Metadata = { title: "Measurement setup | KRISHOE Admin" };
export const dynamic = "force-dynamic";

/**
 * Whether the shop can see anything, and how to switch it on.
 *
 * The tracking code for Meta, TikTok and Google is written and shipped. Until
 * an id is set, that tracker measures nothing, and an advertising rupee cannot
 * be told from a wasted one — which makes filling these in the highest-value
 * half hour available to the owner, and the one thing here I cannot do for
 * them.
 *
 * So this page says plainly which are on, and gives the exact steps for the
 * ones that are not. The counts below are read from the ids themselves rather
 * than written into the copy, because prose that says "three remaining" outlives
 * being true and then quietly misleads the person acting on it.
 */
const trackers = [
  {
    key: "NEXT_PUBLIC_META_PIXEL_ID",
    value: trackingIds.meta,
    name: "Meta Pixel",
    nepali: "Facebook र Instagram",
    nepaliEn: "Facebook and Instagram",
    // How it reads inside a list of several. The long form above says what Meta
    // covers and belongs on the card; in a sentence it turns every list into
    // "Facebook and Instagram and Google".
    shortNe: "Facebook",
    shortEn: "Facebook",
    whyNe: "Facebook/Instagram मा विज्ञापन चलाउँदा कुन विज्ञापनले बिक्री ल्यायो थाहा हुन्छ। यो बिना ad चलाउनु आँखा चिम्लेर पैसा फ्याँक्नु हो।",
    whyEn: "Running ads on Facebook or Instagram, this is what tells you which advert brought the sale. Without it, advertising is throwing money with your eyes shut.",
    looksLikeNe: "१५ अंकको नम्बर — जस्तै 1234567890123456",
    looksLikeEn: "A 15-digit number — like 1234567890123456",
    link: "https://business.facebook.com/events_manager2",
    linkLabelNe: "Meta Events Manager खोल्ने",
    linkLabelEn: "Open Meta Events Manager",
    stepsNe: [
      "business.facebook.com खोल्नुहोस्",
      "बायाँ मेनुबाट Events Manager",
      "Connect data sources → Web → Connect",
      "Pixel को नाम राख्नुहोस् (KRISHOE) → Create",
      "माथि देखिने Pixel ID copy गर्नुहोस्",
    ],
    stepsEn: [
      "Open business.facebook.com",
      "Events Manager, from the left-hand menu",
      "Connect data sources → Web → Connect",
      "Name the Pixel (KRISHOE) → Create",
      "Copy the Pixel ID shown at the top",
    ],
    // Was blocked on there being no Page — a pixel cannot attach to a personal
    // profile. The Page now exists, so this says where to find it instead of
    // what is missing.
    blockerNe: "✅ KRISHOE Page बनिसक्यो — Events Manager मा त्यही Page छान्नुहोस्।",
    blockerEn: "✅ The KRISHOE Page exists — pick that Page in Events Manager.",
  },
  {
    key: "NEXT_PUBLIC_TIKTOK_PIXEL_ID",
    value: trackingIds.tiktok,
    name: "TikTok Pixel",
    nepali: "TikTok",
    nepaliEn: "TikTok",
    shortNe: "TikTok",
    shortEn: "TikTok",
    whyNe: "नेपालमा अहिले TikTok ले सबैभन्दा बढी बिक्री गराउँछ। कारखानाको भिडियोले ल्याएको ग्राहक यहीँ गनिन्छ।",
    whyEn: "TikTok sells more than anything else in Nepal right now. A customer who came from a video of the factory is counted here.",
    looksLikeNe: "अक्षर र अंक मिसिएको — जस्तै C4A2B8QRSTUV",
    looksLikeEn: "Letters and digits mixed — like C4A2B8QRSTUV",
    link: "https://ads.tiktok.com/i18n/events_manager",
    linkLabelNe: "TikTok Events Manager खोल्ने",
    linkLabelEn: "Open TikTok Events Manager",
    stepsNe: [
      "ads.tiktok.com मा खाता खोल्न प्रयास गर्नुहोस्",
      "Assets → Events → Web Events → Set Up Web Events",
      "TikTok Pixel → Manual Setup छान्नुहोस्",
      "नाम राख्नुहोस् (KRISHOE) → Pixel ID copy गर्नुहोस्",
    ],
    stepsEn: [
      "Try to open an account at ads.tiktok.com",
      "Assets → Events → Web Events → Set Up Web Events",
      "TikTok Pixel → choose Manual Setup",
      "Name it (KRISHOE) → copy the Pixel ID",
    ],
    // Tried on 2026-08-16: the country list in TikTok Ads Manager's sign-up has
    // no Nepal. Searching "ne" returned Indonesia, Netherlands, New Zealand,
    // Philippines and Ukraine. Left in the list rather than removed, because the
    // organic TikTok account still sells and the day this opens is worth
    // catching — but the steps above should not read as though they will work.
    blockerNe:
      "⚠️ TikTok Ads Manager मा अहिले नेपाल छैन — खाता खोल्न मिल्दैन। अर्को देश छानेर खोल्न नखोज्नुहोस्: PAN र व्यापारको नाम नमिलेर पछि खाता बन्द हुन्छ। TikTok मा भिडियो हाल्न भने केही रोक छैन।",
    blockerEn:
      "⚠️ TikTok Ads Manager has no Nepal in its country list — an account cannot be opened. Do not pick another country to get around it: the PAN and business name will not match and the account is closed later. Posting videos on TikTok is unaffected.",
  },
  {
    key: "NEXT_PUBLIC_GA4_ID",
    value: trackingIds.ga4,
    name: "Google Analytics 4",
    nepali: "Google",
    nepaliEn: "Google",
    shortNe: "Google",
    shortEn: "Google",
    whyNe: "कति मान्छे आए, कुन जुत्ता धेरै हेरे, कहाँबाट आए — सबै यहीँ देखिन्छ। निःशुल्क।",
    whyEn: "How many came, which shoes they looked at most, where they came from — all of it, and free.",
    looksLikeNe: "G- ले सुरु हुने — जस्तै G-XXXXXXXXXX",
    looksLikeEn: "Starts with G- — like G-XXXXXXXXXX",
    link: "https://analytics.google.com",
    linkLabelNe: "Google Analytics खोल्ने",
    linkLabelEn: "Open Google Analytics",
    stepsNe: [
      "analytics.google.com खोल्नुहोस्",
      "Admin → Create → Property → नाम KRISHOE",
      "Data streams → Web → वेबसाइटको ठेगाना हाल्नुहोस्",
      "देखिने Measurement ID (G- बाट सुरु) copy गर्नुहोस्",
    ],
    stepsEn: [
      "Open analytics.google.com",
      "Admin → Create → Property → name it KRISHOE",
      "Data streams → Web → put in the website address",
      "Copy the Measurement ID shown (it starts with G-)",
    ],
    blockerNe: "",
    blockerEn: "",
  },
];



/**
 * A list of names as a sentence would say it.
 *
 * "Facebook and Instagram and Google" is what join(" and ") gives you, and it
 * reads like a child counting. English puts commas between all but the last
 * pair; Nepali puts "र" before the last and nothing before the others.
 */
function asSentence(names: string[], language: "en" | "ne") {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];

  const last = names[names.length - 1];
  const rest = names.slice(0, -1);

  return language === "en"
    ? `${rest.join(", ")} and ${last}`
    : `${rest.join(", ")} र ${last}`;
}

export default async function MeasurementPage() {
  await requireAdminPermission("settings:write");

  const live = trackers.filter((tracker) => Boolean(tracker.value));
  const missing = trackers.filter((tracker) => !tracker.value);

  return (
    <section className="p-6 pb-24">
      <div>
        <h1 className="font-display text-3xl font-black leading-tight text-brand-green-ink">
          <T en="Measurement setup" ne="मापन सेटअप" />
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-brand-muted">
          <T
            en="How many came, what they looked at, why they left without buying — none of it is known until these are filled in. The code is already here."
            ne="कति मान्छे आए, के हेरे, किन नकिनी गए — यी नराखेसम्म केही थाहा हुँदैन। कोड तयारै छ।"
          />{" "}
          {missing.length === 0 ? (
            <T en="Every ID is in." ne="सबै ID हालिसकिए।" />
          ) : (
            <T
              en={`${missing.length} still to add.`}
              ne={`${missing.length} वटा ID हाल्न बाँकी।`}
            />
          )}
        </p>
      </div>

      {/* Three states, not two.
          "Nothing is on" and "one of three is missing" are different situations
          and deserve different advice. This banner used to tell the owner not
          to spend a rupee on advertising whenever anything was missing — which,
          once Meta and Google were live, would have held them back from the
          Facebook campaign those two exist to measure. The warning is kept for
          the case it was written for: no measurement at all. */}
      <div
        className={`mt-5 rounded-2xl border-2 p-5 ${
          missing.length === 0
            ? "border-emerald-300 bg-emerald-50"
            : live.length === 0
              ? "border-brand-clay/40 bg-brand-clay/5"
              : "border-amber-300 bg-amber-50"
        }`}
      >
        <p className="text-lg font-black text-brand-green-ink">
          {missing.length === 0 ? (
            <T
              en="✅ All three are on — the app can see"
              ne="✅ तीनै चालु छन् — app ले देख्दैछ"
            />
          ) : live.length === 0 ? (
            <T
              en="🔴 The app is blind right now — nothing at all is counted"
              ne="🔴 अहिले app पूरै अन्धो छ — केही पनि गनिँदैन"
            />
          ) : (
            <T
              en={`🟡 ${asSentence(live.map((t) => t.shortEn), "en")} measured — ${asSentence(
                missing.map((t) => t.shortEn),
                "en",
              )} not`}
              ne={`🟡 ${asSentence(live.map((t) => t.shortNe), "ne")} नापिन्छ — ${asSentence(
                missing.map((t) => t.shortNe),
                "ne",
              )} नापिँदैन`}
            />
          )}
        </p>

        {live.length === 0 ? (
          <p className="mt-2 text-sm leading-6 text-brand-muted-deep">
            <strong className="text-brand-green-ink">
              <T
                en="Costs nothing. Takes about 30 minutes."
                ne="खर्च रु ०। समय ~३० मिनेट।"
              />
            </strong>{" "}
            <T
              en="Do not spend a rupee on advertising before this — there is no way to tell what worked."
              ne="यो नगरी विज्ञापनमा एक रुपैयाँ पनि नहाल्नुहोस् — कुन काम लाग्यो थाहै हुँदैन।"
            />
          </p>
        ) : missing.length > 0 ? (
          <p className="mt-2 text-sm leading-6 text-brand-muted-deep">
            <strong className="text-brand-green-ink">
              <T
                en={`Advertise on ${asSentence(live.map((t) => t.shortEn), "en")} with confidence`}
                ne={`${asSentence(live.map((t) => t.shortNe), "ne")} मा विज्ञापन चलाउन ढुक्क हुनुहोस्`}
              />
            </strong>{" "}
            <T
              en={`— you can see exactly which advert brought the sale. But hold off on ${asSentence(
                missing.map((t) => t.shortEn),
                "en",
              )} for now; there is no counting it yet.`}
              ne={`— कुन विज्ञापनले बिक्री ल्यायो ठ्याक्कै देखिन्छ। तर ${asSentence(
                missing.map((t) => t.shortNe),
                "ne",
              )} मा भने अहिले नहाल्नुहोस्, त्यहाँको हिसाब थाहा हुँदैन।`}
            />
          </p>
        ) : null}
      </div>

      <div className="mt-6 grid gap-5">
        {trackers.map((tracker) => {
          const on = Boolean(tracker.value);
          return (
            <article
              key={tracker.key}
              className={`rounded-2xl border bg-brand-paper p-5 shadow-sm ${
                on ? "border-emerald-200" : "border-brand-green-line"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-brand-green-ink">
                    {tracker.name}{" "}
                    <span className="font-bold text-brand-muted">
                      · <T en={tracker.nepaliEn} ne={tracker.nepali} />
                    </span>
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-brand-muted">
                    <T en={tracker.whyEn} ne={tracker.whyNe} />
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    on ? "bg-emerald-100 text-emerald-900" : "bg-brand-clay text-white"
                  }`}
                >
                  <T en={on ? "On" : "To do"} ne={on ? "चालु" : "बाँकी"} />
                </span>
              </div>

              {on ? (
                <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 font-mono text-xs text-emerald-900">
                  {/* Only the tail. The id is not a secret — it ships in the page
                      — but a full one on screen invites it being pasted into the
                      wrong shop's settings. */}
                  …{String(tracker.value).slice(-6)} ·{" "}
                  <T en="working" ne="चलिरहेको छ" />
                </p>
              ) : (
                <>
                  <ol className="mt-4 grid gap-2 text-sm leading-6 text-brand-muted-deep">
                    {tracker.stepsNe.map((step, index) => (
                      <li key={step} className="flex gap-3 rounded-xl bg-brand-paper-deep px-3 py-2">
                        <span className="font-black text-brand-green">{index + 1}.</span>
                        <span>
                          <T en={tracker.stepsEn[index] ?? step} ne={step} />
                        </span>
                      </li>
                    ))}
                  </ol>

                  {tracker.blockerNe ? (
                    <p className="mt-3 rounded-xl bg-brand-clay/10 px-3 py-2 text-sm font-bold text-brand-clay">
                      <T en={tracker.blockerEn} ne={tracker.blockerNe} />
                    </p>
                  ) : null}

                  <p className="mt-3 text-xs leading-5 text-brand-muted">
                    <T en="Looks like:" ne="कस्तो देखिन्छ:" />{" "}
                    <span className="font-mono text-brand-green-ink">
                      <T en={tracker.looksLikeEn} ne={tracker.looksLikeNe} />
                    </span>
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
                    <T en={tracker.linkLabelEn} ne={tracker.linkLabelNe} /> ↗
                  </a>
                </>
              )}
            </article>
          );
        })}
      </div>

      <section className="mt-8 rounded-2xl border-2 border-brand-green/25 bg-brand-green-wash/40 p-5">
        <h2 className="text-lg font-black text-brand-green-ink">
          <T en="Where the ID goes once you have it" ne="ID पाएपछि कहाँ हाल्ने" />
        </h2>
        <ol className="mt-3 grid gap-2 text-sm leading-6 text-brand-muted-deep">
          <li className="rounded-xl bg-brand-paper px-3 py-2">
            <strong className="text-brand-green-ink"><T en="1." ne="१." /></strong>{" "}
            <T
              en="The button below goes straight to Environment Variables"
              ne="तलको बटनले सिधै Environment Variables मै पुर्‍याउँछ"
            />
            {/* Straight to the Environment Variables screen. The account slug
                came from the owner; without it this could only point at the
                dashboard and leave three more clicks to be described. */}
            <a
              href="https://vercel.com/krishoee-5610s-projects/krishoe-website/settings/environment-variables"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-brand-green-ink px-5 text-sm font-black text-white transition hover:bg-brand-green"
            >
              <T en="Vercel — open Environment Variables" ne="Vercel — Environment Variables खोल्ने" /> ↗
            </a>
          </li>
          {/* Only the missing ones. Listing a key that is already live invites
              it being pasted a second time, and a duplicate there overwrites a
              working value with whatever was on the clipboard. */}
          <li className="rounded-xl bg-brand-paper px-3 py-2">
            <strong className="text-brand-green-ink"><T en="2." ne="२." /></strong>{" "}
            <T
              en={`Put in the Key and Value, then Save — ${missing.length} still to go:`}
              ne={`Key र Value हालेर Save — यी ${
                missing.length === trackers.length ? "तीन" : missing.length
              } वटा बाँकी छन्:`}
            />
            <div className="mt-2 grid gap-1 font-mono text-xs text-brand-green">
              {(missing.length > 0 ? missing : trackers).map((tracker) => (
                <span key={tracker.key}>{tracker.key}</span>
              ))}
            </div>
          </li>
          <li className="rounded-xl bg-brand-paper px-3 py-2">
            <strong className="text-brand-green-ink"><T en="3." ne="३." /></strong>{" "}
            <T
              en="Then Deployments at the top → ⋯ on the newest one →"
              ne="माथि Deployments → पछिल्लोमा ⋯ →"
            />{" "}
            <strong>Redeploy</strong>
            <span className="mt-1 block text-xs font-bold text-brand-clay">
              ⚠️{" "}
            <T
              en="Until this is pressed the ID does nothing — this is where everybody gets caught."
              ne="यो नथिचेसम्म ID हालेको काम लाग्दैन — सबैले यहीँ चुक्छन्।"
            />
            </span>
          </li>
          <li className="rounded-xl bg-brand-paper px-3 py-2">
            <strong className="text-brand-green-ink"><T en="4." ne="४." /></strong>{" "}
            <T
              en="Open this page again — a green On means it is done"
              ne="यही पाना फेरि खोल्नुहोस् — हरियो चालु देखियो भने भयो"
            />
          </li>
        </ol>
        <p className="mt-3 text-xs leading-5 text-brand-muted">
          ⚠️{" "}
          <T
            en="The name has to match exactly — one letter different and it will not work."
            ne="नाम ठ्याक्कै माथिकै जस्तो हुनुपर्छ — एउटा अक्षर फरक परे चल्दैन।"
          />
        </p>
      </section>
    </section>
  );
}
