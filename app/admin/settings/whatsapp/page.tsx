import type { Metadata } from "next";
import Link from "next/link";
import T from "@/components/T";
import WhatsAppTestForm from "@/app/admin/settings/whatsapp/WhatsAppTestForm";

export const metadata: Metadata = { title: "WhatsApp | KRISHOE Admin" };
export const dynamic = "force-dynamic";

/**
 * WhatsApp messages from the shop (owner's sample 7घ, 2026-10-14).
 *
 * The page was a programmer's setup sheet in English, with an Enable/Disable
 * button that saved nothing — it reset on the next visit. It now says first
 * whether WhatsApp is really connected (the three Twilio settings are read on
 * the server, never shown), then what is sent, and keeps the setup steps
 * folded for whoever sets it up.
 */
export default function WhatsAppSettingsPage() {
  const connected = Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_WHATSAPP_NUMBER?.trim(),
  );

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <Link href="/admin/settings" className="inline-block text-sm font-bold text-brand-green underline underline-offset-4">
        ← <T en="Settings" ne="Settings" />
      </Link>
      <h1 className="mt-3 font-display text-3xl font-black text-brand-green-ink">WhatsApp</h1>

      <div
        className={`mt-4 rounded-2xl border-2 p-4 ${
          connected ? "border-brand-green bg-brand-green-wash text-brand-green-ink" : "border-brand-green-line bg-brand-paper text-brand-green-ink"
        }`}
      >
        <p className="text-lg font-black">
          {connected ? <T en="✅ Connected" ne="✅ जोडिएको छ" /> : <T en="⚪ Not connected yet" ne="⚪ अझै जोडिएको छैन" />}
        </p>
        <p className="mt-1 text-sm leading-6">
          {connected ? (
            <T
              en="The shop can send WhatsApp messages. Send yourself a test below to be sure."
              ne="पसलले WhatsApp सन्देश पठाउन सक्छ। पक्का गर्न तल आफैँलाई परीक्षण पठाउनुहोस्।"
            />
          ) : (
            <T
              en="Nothing is sent on WhatsApp until it is connected. Whoever sets up the app follows the steps at the bottom."
              ne="नजोडिएसम्म WhatsApp मा केही जाँदैन। app मिलाउने मान्छेले तलका चरण पछ्याउनुहुन्छ।"
            />
          )}
        </p>
      </div>

      <section className="mt-5 rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm">
        <h2 className="text-lg font-black text-brand-green-ink"><T en="Send a test" ne="परीक्षण पठाउने" /></h2>
        <div className="mt-3">
          <WhatsAppTestForm connected={connected} />
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-brand-green-line bg-brand-paper-deep p-4">
        <h2 className="text-lg font-black text-brand-green-ink"><T en="What is sent" ne="के-के पठाइन्छ" /></h2>
        <ul className="mt-2 grid gap-3 text-sm text-brand-muted-deep">
          <li>
            <b><T en="New work entered" ne="नयाँ काम टिपियो" /></b> — <T en="when work is added" ne="काम थपिँदा" />
          </li>
          <li>
            <b><T en="Day's summary" ne="दिनको सारांश" /></b> — <T en="at 8 PM each day: pairs, amount, workers" ne="हरेक दिन बेलुका ८ बजे: जोडी, रकम, कामदार" />
          </li>
          <li>
            <b><T en="Payment reminder" ne="भुक्तानी सम्झना" /></b> — <T en="when you send one" ne="तपाईंले पठाउँदा" />
          </li>
        </ul>
      </section>

      {/* For whoever sets the app up; kept, folded (owner's sample 7घ). */}
      <details className="mt-5 rounded-2xl border border-brand-green-line bg-brand-paper p-4">
        <summary className="cursor-pointer text-sm font-black text-brand-green-ink">
          ⓘ <T en="Setup steps (for whoever sets up the app)" ne="जोड्ने चरण (app मिलाउने मान्छेका लागि)" />
        </summary>
        <ol className="mt-3 space-y-2 text-sm text-brand-green">
          <li>
            <strong>1. Twilio:</strong> <T en="create an account at" ne="खाता बनाउने:" />{" "}
            <a href="https://www.twilio.com" target="_blank" rel="noopener noreferrer" className="underline">
              twilio.com
            </a>
          </li>
          <li>
            <strong>2.</strong> <T en="Copy the Account SID, Auth Token and WhatsApp number." ne="Account SID, Auth Token र WhatsApp नम्बर सार्ने।" />
          </li>
          <li>
            <strong>3.</strong>{" "}
            <T
              en="Add them in Vercel as TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_NUMBER, then redeploy."
              ne="Vercel मा TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN र TWILIO_WHATSAPP_NUMBER नामले राखेर फेरि deploy गर्ने।"
            />
          </li>
          <li>
            <strong>4.</strong> <T en="Send a test above." ne="माथिबाट परीक्षण पठाउने।" />
          </li>
        </ol>
      </details>
    </div>
  );
}
