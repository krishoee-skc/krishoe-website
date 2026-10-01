import T from "@/components/T";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import type { CustomerVoice } from "@/lib/customer-voice";
import { deleteVoiceAction, keepHiddenAction, moveReviewAction, setPublishedAction } from "./actions";
import ThankOnWhatsApp from "./ThankOnWhatsApp";

/**
 * A review in Customer Voice, laid out to be decided (owner, 2026-10-01):
 * where it will show and how it will read there, Publish beside a WhatsApp
 * thank-you, and everything rarer — keep hidden, move to another shoe,
 * delete — folded under "⋯", the delete asking first.
 */

export type ShoeOnFile = { id: string; name: string; active: boolean };

export type ReviewView = "decide" | "live" | "hidden";

/** Where a review stands: live in the shop, put aside, or still to decide. */
export function reviewView(voice: Pick<CustomerVoice, "published" | "status">): ReviewView {
  if (voice.published) return "live";
  return voice.status === "closed" ? "hidden" : "decide";
}

/** Where a published review appears — and why it would not. */
export function reviewWhere(voice: Pick<CustomerVoice, "productId" | "productName">, shoes: Map<string, ShoeOnFile>) {
  if (!voice.productId) return { tone: "home" as const, shoe: null };
  const shoe = shoes.get(voice.productId);
  if (!shoe) return { tone: "gone" as const, shoe: null };
  return { tone: shoe.active ? ("shoe" as const) : ("draft" as const), shoe };
}

/** Whether publishing it now would put it somewhere a customer sees. */
export function showsWhenPublished(voice: Pick<CustomerVoice, "productId" | "productName">, shoes: Map<string, ShoeOnFile>) {
  const where = reviewWhere(voice, shoes).tone;
  return where === "shoe" || where === "home";
}

const OLD_APP = "Brought from the old database";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-lg tracking-wide text-amber-500" aria-label={`${rating} stars`}>
      {"★".repeat(Math.max(0, Math.min(5, rating)))}
      <span className="text-brand-muted-soft">{"★".repeat(Math.max(0, 5 - rating))}</span>
    </span>
  );
}

export default function ReviewRow({ voice, shoes }: { voice: CustomerVoice; shoes: Map<string, ShoeOnFile> }) {
  const view = reviewView(voice);
  const where = reviewWhere(voice, shoes);
  const fromOldApp = voice.replyNote.startsWith(OLD_APP);
  const shoeName = where.shoe?.name ?? voice.productName;
  const firstName = voice.customerName.trim().split(/\s+/)[0] ?? "";
  const lastInitial = voice.customerName.trim().split(/\s+/)[1]?.[0] ?? "";

  const field = "min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-base text-brand-green-ink";

  return (
    <article className="grid gap-3 border-b border-brand-green-line px-4 py-5 last:border-b-0" data-review-row={view}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-full bg-brand-green-wash text-lg font-black text-brand-green">
            {(voice.customerName.trim()[0] ?? "★").toUpperCase()}
          </span>
          <div>
            <p className="text-lg font-black text-brand-green-ink">{voice.customerName || <T en="No name" ne="नाम छैन" />}</p>
            <p className="text-sm text-brand-muted">
              <Stars rating={voice.rating} /> · {shoeName || <T en="the shop" ne="पसल" />} · <DateDisplayAdmin date={voice.createdAt} />
            </p>
          </div>
        </div>
        <span className="flex flex-wrap gap-1.5">
          {view === "live" ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-900">
              👁 <T en="Live in the shop" ne="पसलमा देखिँदैछ" />
            </span>
          ) : view === "hidden" ? (
            <span className="rounded-full bg-brand-mist px-3 py-1 text-sm font-black text-brand-muted">
              <T en="Kept hidden" ne="लुकाइएको" />
            </span>
          ) : null}
          {fromOldApp ? (
            <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-black text-sky-900">
              <T en="from the old app" ne="पुरानो app बाट" />
            </span>
          ) : null}
        </span>
      </div>

      {voice.message ? <p className="whitespace-pre-wrap text-base leading-7 text-brand-green-ink">{voice.message}</p> : null}

      <p
        className={`rounded-xl px-3 py-2 text-base font-bold ${
          where.tone === "shoe"
            ? "bg-brand-green-wash text-brand-green"
            : where.tone === "home"
              ? "bg-sky-100 text-sky-900"
              : "bg-brand-cream-soft text-brand-gold-deep"
        }`}
        data-review-where={where.tone}
      >
        {where.tone === "shoe" ? (
          <T en={`📍 Shows on: the ${shoeName} page, the home page and Reviews`} ne={`📍 देखिने ठाउँ: ${shoeName} को पेज, होम पेज र Reviews`} />
        ) : where.tone === "home" ? (
          <T en="🏠 Shows on: the home page and Reviews, as a review of the shop" ne="🏠 देखिने ठाउँ: होम पेज र Reviews, पसलको राय भएर" />
        ) : where.tone === "draft" ? (
          <T en={`⚠ ${shoeName} is a Draft — this shows once the shoe is Active`} ne={`⚠ ${shoeName} Draft मा छ — जुत्ता Active भएपछि मात्र देखिन्छ`} />
        ) : (
          <T en="⚠ Its shoe is no longer in the shop — move it to a shoe, or to the shop" ne="⚠ यसको जुत्ता अब पसलमा छैन — अर्को जुत्तामा वा पसलमा सार्नुहोस्" />
        )}
      </p>

      {view !== "live" && voice.message ? (
        <p className="rounded-xl border border-dashed border-brand-green-line bg-brand-paper px-3 py-2 text-sm text-brand-muted">
          👀 <T en="In the shop:" ne="पसलमा यस्तो देखिन्छ:" /> <Stars rating={voice.rating} /> “{voice.message.slice(0, 140)}” — {firstName}
          {lastInitial ? ` ${lastInitial}.` : ""}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <form action={setPublishedAction}>
          <input type="hidden" name="id" value={voice.id} />
          <input type="hidden" name="published" value={voice.published ? "false" : "true"} />
          <button
            className={`min-h-11 rounded-xl px-5 text-base font-black ${
              voice.published ? "border border-brand-green-line text-brand-muted-deep" : "bg-brand-green-ink text-white"
            }`}
          >
            {voice.published ? <T en="Take off the shop" ne="पसलबाट हटाउने" /> : <T en="✓ Publish" ne="✓ पसलमा राख्ने" />}
          </button>
        </form>
        <ThankOnWhatsApp name={voice.customerName} phone={voice.phone} shoe={shoeName} />
        <details className="relative">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-xl border border-dashed border-brand-green-line px-4 text-base font-black text-brand-muted">
            ⋯ <T en="More" ne="अरू" />
          </summary>
          <div className="mt-2 grid w-[min(92vw,26rem)] gap-3 rounded-2xl border border-brand-green-line bg-brand-paper p-3 shadow-lg">
            {view !== "hidden" ? (
              <form action={keepHiddenAction}>
                <input type="hidden" name="id" value={voice.id} />
                <button className="min-h-11 w-full rounded-xl border border-brand-green-line px-4 text-left text-base font-bold text-brand-green-ink">
                  <T en="Keep hidden — not for the shop" ne="लुकाएर राख्ने — पसलका लागि होइन" />
                </button>
              </form>
            ) : null}
            <form action={moveReviewAction} className="grid gap-2">
              <input type="hidden" name="id" value={voice.id} />
              <label className="grid gap-1 text-sm font-bold text-brand-muted">
                <T en="Move to another shoe" ne="अर्को जुत्तामा सार्ने" />
                <select name="productId" defaultValue={where.shoe?.id ?? ""} className={field}>
                  <option value="">🏪 The shop (no shoe)</option>
                  {[...shoes.values()].map((shoe) => (
                    <option key={shoe.id} value={shoe.id}>
                      {shoe.name}
                      {shoe.active ? "" : " (Draft)"}
                    </option>
                  ))}
                </select>
              </label>
              <button className="min-h-11 rounded-xl bg-brand-green-ink px-4 text-base font-black text-white">
                <T en="Move" ne="सार्ने" />
              </button>
            </form>
            <form action={deleteVoiceAction} className="grid gap-2 border-t border-brand-green-line pt-3">
              <input type="hidden" name="id" value={voice.id} />
              <input type="hidden" name="confirmAsked" value="1" />
              <label className="flex items-start gap-2 text-sm font-bold text-brand-clay">
                <input type="checkbox" name="confirm" value="yes" required className="mt-0.5 h-5 w-5" />
                <T en="Yes — delete it for good (spam, not a real customer)" ne="हो — सधैँका लागि मेट्ने (spam, साँचो ग्राहक होइन)" />
              </label>
              <button className="min-h-11 rounded-xl border border-brand-clay/50 px-4 text-base font-black text-brand-clay">
                🗑 <T en="Delete" ne="मेट्ने" />
              </button>
            </form>
          </div>
        </details>
      </div>
    </article>
  );
}
