/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import T from "@/components/T";
import Link from "next/link";
import PrintButton from "@/components/admin/PrintButton";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = { title: "Open on phone | KRISHOE Admin" };
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
    titleNe: "यो तपाईंको",
    titleEn: "This one is yours",
    kicker: "Office · Admin",
    path: "/admin/login",
    whoNe: "तपाईं, Manager, Accountant — सबै यहीँबाट",
    whoEn: "You, Manager, Accountant — all through this one",
    opens: "KRISHOE control room",
    guardNe: "password + Gmail मा आउने ६ अंकको कोड",
    guardEn: "password + the six-digit code sent to Gmail",
    print: false,
  },
  {
    key: "worker",
    titleNe: "यो कामदारको",
    titleEn: "This one is for the workers",
    kicker: "Factory · Workers",
    path: "/worker/login",
    whoNe: "२५ जनालाई एउटै कागज — कसैको नाम छैन",
    whoEn: "One sheet for all twenty-five — nobody's name on it",
    opens: "KRISHOE worker portal",
    guardNe: "मोबाइल नम्बर + password (पहिलो पटकमै फेर्नैपर्ने)",
    guardEn: "mobile number + password (must be changed on first use)",
    print: true,
  },
];

/**
 * One QR per person, which is what was asked for — but not one door per person.
 *
 * Owner, Manager, Accountant and Viewer all sign in at the same address with
 * the same password and the same emailed code. Five QR codes that merely looked
 * different would be a lie: someone would scan "the Accountant one" and expect
 * to arrive as the Accountant, and their account's role would decide otherwise.
 *
 * So these differ in the only way they honestly can — where each person lands
 * after signing in. It saves the daily navigation, which is the real benefit,
 * and the caption on each card says plainly that the door is shared.
 */
const roleCodes = [
  {
    key: "owner",
    roleNe: "Owner · मालिक",
    roleEn: "Owner",
    landsNe: "मुख्य पाना",
    landsEn: "The main screen",
    path: "/admin",
    whyNe: "सबै कुरा एकै ठाउँबाट",
    whyEn: "Everything from one place",
  },
  {
    key: "manager",
    roleNe: "Manager",
    roleEn: "Manager",
    landsNe: "अर्डर",
    landsEn: "Orders",
    path: "/admin/orders",
    whyNe: "दिनभरि अर्डर हेर्ने-पठाउने",
    whyEn: "Watching and sending orders all day",
  },
  {
    key: "accountant",
    roleNe: "Accountant",
    roleEn: "Accountant",
    landsNe: "भुक्तानी",
    landsEn: "Payments",
    path: "/admin/payments",
    whyNe: "पैसाको हिसाब",
    whyEn: "The money side",
  },
  {
    key: "viewer",
    roleNe: "Viewer",
    roleEn: "Viewer",
    landsNe: "हिसाब र नाफा",
    landsEn: "Reports and profit",
    path: "/admin/analytics",
    whyNe: "हेर्ने मात्र — बदल्न पाउँदैन",
    whyEn: "Reading only — cannot change anything",
  },
  {
    key: "factory",
    roleNe: "Factory / Staff",
    roleEn: "Factory / Staff",
    landsNe: "कारखाना",
    landsEn: "The factory",
    path: "/admin/factory",
    whyNe: "काम, कामदार, तलब",
    whyEn: "Work, workers, wages",
  },
];

export default async function OpenOnPhonePage() {
  await requireAdminPermission("dashboard:read");

  return (
    <main className="p-6 pb-24 print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-brand-green-ink">
            <T en="Open it on a phone" ne="फोनमा खोल्ने" />
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-brand-muted">
            <T
              en="Point a phone camera at these — no address to type. They can be printed and stuck on a wall too."
              ne="फोनको camera यी QR मा तेर्साउनुहोस् — ठेगाना टाइप गर्नु पर्दैन। छापेर भित्तामा पनि टाँस्न मिल्छ।"
            />
          </p>
        </div>
        <PrintButton className="inline-flex h-11 items-center rounded-full bg-brand-green px-6 text-sm font-bold text-white">
          <T en="Print" ne="छाप्ने" />
        </PrintButton>
      </div>

      {/* Said once, at the top, because it is the question the owner asked:
          what happens if someone else scans this. */}
      <section className="mt-5 rounded-2xl border-2 border-brand-green/25 bg-brand-green-wash/40 p-5 print:border print:bg-brand-paper">
        <h2 className="text-lg font-black text-brand-green-ink">
          🔑 <T en="A QR is an address, not a key" ne="QR भनेको ठेगाना हो — साँचो होइन" />
        </h2>
        <div className="mt-3 grid gap-2 text-sm leading-6 text-brand-muted-deep">
          <p>
            <T
              en="There is no password in these, no token, and nobody's name. Somebody who scans one arrives at the sign-in page — which is already open to everybody on the internet."
              ne="यी QR मा password छैन, token छैन, कसैको नाम छैन। कसैले खिच्यो भने उसले पाउने भनेको login पाना मात्र हो — जुन पहिले नै इन्टरनेटमा सबैलाई खुलै छ।"
            />
          </p>
          <p>
            <T
              en="Getting in needs a password, and for the owner and staff the code that arrives in Gmail as well. Neither is in the QR, so losing one costs nothing."
              ne="भित्र पस्न password चाहिन्छ, र मालिक-staff लाई Gmail मा आउने कोड पनि। ती QR मा हुँदैनन्, त्यसैले QR हराए पनि केही जाँदैन।"
            />
          </p>
          <p className="rounded-lg bg-brand-paper px-3 py-2 text-xs font-bold text-brand-clay print:bg-brand-paper">
            ⚠️{" "}
            <T
              en="Never write a password beside a QR. Lose that paper and the account goes with it."
              ne="QR सँगै password चाहिँ कहिल्यै नलेख्नुहोस्। कागज हराए खाता जान्छ।"
            />
          </p>
          <p className="rounded-lg bg-brand-paper px-3 py-2 text-xs leading-5 text-brand-muted print:bg-brand-paper">
            <T
              en="There are only two doors. Owner, Manager and Accountant all come through the same one (the first QR). The workers have their own (the second). There is no other sign-in anywhere."
              ne="ढोका दुई मात्र छन्। मालिक, Manager र Accountant — तीनै जना एउटै ढोकाबाट पस्छन् (पहिलो QR)। कामदारको ढोका अर्को हो (दोस्रो QR)। यसबाहेक अरू कुनै login छैन।"
            />
          </p>
        </div>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {codes.map((code) => (
          <article
            key={code.key}
            className="rounded-2xl border border-brand-green-line bg-brand-paper p-6 text-center shadow-sm print:border print:shadow-none"
          >
            <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-gold-deep">
              {code.kicker}
            </p>
            <h2 className="mt-2 text-2xl font-black text-brand-green-ink">
              <T en={code.titleEn} ne={code.titleNe} />
            </h2>
            {code.print ? (
              <p className="text-sm font-semibold text-brand-muted">
                <T en="Print it and stick it on the wall" ne="छापेर भित्तामा टाँस्नुहोस्" />
              </p>
            ) : (
              <p className="text-sm font-semibold text-brand-muted">
                <T en="Keep this one on your own phone" ne="आफ्नै फोनमा राख्नुहोस्" />
              </p>
            )}

            <img
              src={`/api/admin/open-on-phone?to=${code.key}`}
              alt={`QR code for ${absoluteUrl(code.path)}`}
              className="mx-auto mt-5 h-56 w-56"
            />

            <p className="mt-3 break-all font-mono text-xs text-brand-muted">
              {absoluteUrl(code.path)}
            </p>

            <dl className="mt-5 grid gap-2 text-left text-sm">
              {/* The heading printed on the page this opens. Scan it, look at
                  the top of the phone, and it either matches or it does not —
                  which is the check the owner had no way to make. */}
              <div className="rounded-xl border border-brand-green/25 bg-brand-green-wash/50 p-3 print:border print:bg-brand-paper">
                <dt className="text-xs font-black uppercase tracking-wider text-brand-green">
                  <T en="The phone should show this" ne="फोनमा यही लेखेको आउनुपर्छ" />
                </dt>
                <dd className="mt-0.5 font-black text-brand-green-ink">“{code.opens}”</dd>
              </div>
              <div className="rounded-xl bg-brand-paper-deep p-3 print:bg-brand-paper">
                <dt className="text-xs font-black uppercase tracking-wider text-brand-muted-soft">
                  <T en="Who it is for" ne="कसका लागि" />
                </dt>
                <dd className="mt-0.5 font-semibold text-brand-green-ink">
                  <T en={code.whoEn} ne={code.whoNe} />
                </dd>
              </div>
              <div className="rounded-xl bg-brand-paper-deep p-3 print:bg-brand-paper">
                <dt className="text-xs font-black uppercase tracking-wider text-brand-muted-soft">
                  <T en="What getting in needs" ne="भित्र पस्न चाहिने" />
                </dt>
                <dd className="mt-0.5 font-semibold text-brand-green-ink">
                  <T en={code.guardEn} ne={code.guardNe} />
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-black text-brand-green-ink">
          <T en="A QR for each person" ne="हरेक जनाको आफ्नै QR" />
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted">
          <T
            en="The same door as above — but once they are in, it lands them straight on the screen they work from, instead of the menu every time."
            ne="माथिकै ढोका हो — तर खिच्ने मान्छे भित्र पसेपछि सिधै आफ्नो कामको पानामा पुग्छ। हरेक पटक मेनु खोज्नु पर्दैन।"
          />
        </p>
        <p className="mt-2 max-w-3xl rounded-xl bg-brand-clay/10 px-3 py-2 text-sm font-bold leading-6 text-brand-clay">
          ⚠️{" "}
          <T
            en="A QR grants nothing. Scanning the Accountant's does not make anybody the Accountant — what a person may do is decided by the role on their account, from Settings. These only shorten the walk."
            ne="QR ले अधिकार दिँदैन। Accountant को QR खिच्दैमा कोही Accountant बन्दैन — कसले के गर्न पाउने भन्ने कुरा खातालाई दिइएको role ले तय गर्छ, सेटिङबाट। यी QR ले खालि बाटो छोट्याउँछन्।"
          />
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roleCodes.map((code) => (
            <article
              key={code.key}
              className="rounded-2xl border border-brand-green-line bg-brand-paper p-5 text-center shadow-sm print:border print:shadow-none"
            >
              <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-gold-deep">
                <T en={code.roleEn} ne={code.roleNe} />
              </p>

              <img
                src={`/api/admin/open-on-phone?to=${code.key}`}
                alt={`QR code opening ${code.path}`}
                className="mx-auto mt-4 h-40 w-40"
              />

              <div className="mt-4 rounded-xl border border-brand-green/25 bg-brand-green-wash/50 p-3 print:border print:bg-brand-paper">
                <p className="text-xs font-black uppercase tracking-wider text-brand-green">
                  <T en="Where it lands" ne="पुग्ने ठाउँ" />
                </p>
                <p className="mt-0.5 font-black text-brand-green-ink">
                  <T en={code.landsEn} ne={code.landsNe} />
                </p>
              </div>

              <p className="mt-3 text-sm leading-6 text-brand-muted">
                <T en={code.whyEn} ne={code.whyNe} />
              </p>
              <p className="mt-2 break-all font-mono text-[11px] text-brand-muted-soft">{code.path}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-brand-green-line bg-brand-paper p-5 print:hidden">
        <h2 className="text-lg font-black text-brand-green-ink">
          <T en="Make it behave like an app" ne="फोनमा app जस्तै बनाउने" />
        </h2>
        <ol className="mt-3 grid gap-2 text-sm leading-6 text-brand-muted-deep">
          <li>
            <strong className="text-brand-green-ink">१.</strong>{" "}
            <T
              en="Scanning the QR opens it in Chrome — not the browser inside Facebook or WhatsApp."
              ne="QR स्क्यान गरेपछि Chrome मा खुल्छ (Facebook वा WhatsApp भित्रको browser मा होइन)।"
            />
          </li>
          <li>
            <strong className="text-brand-green-ink">२.</strong>{" "}
            <T
              en={"Top right ⋮ → “Add to Home screen”. On an iPhone, the ⬆️ at the bottom → “Add to Home Screen”."}
              ne={"माथि दायाँ ⋮ → “Add to Home screen” थिच्नुहोस्। iPhone मा तलको ⬆️ → “Add to Home Screen”।"}
            />
          </li>
          <li>
            <strong className="text-brand-green-ink">३.</strong>{" "}
            <T
              en="A KRISHOE icon now sits on the home screen — it opens without an address bar, like an app."
              ne="अब home screen मा KRISHOE icon बस्छ — address bar बिना, app जस्तै खुल्छ।"
            />
          </li>
        </ol>
        <Link
          href="/admin/settings"
          className="mt-4 inline-flex h-11 items-center rounded-full border border-brand-green-line px-5 text-sm font-bold text-brand-green-ink transition hover:border-brand-green"
        >
          <T en="Open a worker's account → Settings" ne="कामदारको खाता खोल्ने → Settings" />
        </Link>
      </section>
    </main>
  );
}
