import type { Metadata } from "next";
import Link from "next/link";
import { canAdmin, requireAdminPermission } from "@/lib/admin-permissions";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import T from "@/components/T";
import {
  daysWaiting,
  getCustomerVoice,
  getReviewStats,
  getVoiceCounts,
  getVoicePhones,
  type CustomerVoice,
  type VoiceKind,
} from "@/lib/customer-voice";
import { deleteVoiceAction, setPublishedAction, setStatusAction } from "./actions";
import ReviewAskWays from "./ReviewAskWays";
import AskCounterCustomers from "./AskCounterCustomers";
import ReviewRow, { reviewView, showsWhenPublished, type ReviewView, type ShoeOnFile } from "./ReviewRow";
import { publishManyAction } from "./actions";
import { getProducts } from "@/lib/product-store";
import { getPosInvoices } from "@/lib/pos";
import { customersToAsk, type CustomerToAsk } from "@/lib/review-ask-rules";
import { reportError } from "@/lib/report-error";
import { getSiteUrl } from "@/lib/seo";

export const metadata: Metadata = { title: "Customer Voice | KRISHOE Admin" };
export const dynamic = "force-dynamic";

/**
 * Everything a customer said, in one list.
 *
 * It was four screens — Reviews, Feedback, Customer Voice, Messages — reading
 * four different stores, one of whose tables had never been created. Answering
 * a customer meant opening all four and hoping none had been missed.
 *
 * Wholesale keeps its own screen. A shop asking for two hundred pairs a month
 * is a sales pipeline with a shop name, a location and a monthly quantity — not
 * a message, and those fields would be lost in a list of messages.
 *
 * The row carries what answering needs: who, what they said, how long they have
 * waited, and a tap to call or WhatsApp them. A reply that takes four screens
 * to record is a reply nobody records.
 */

const KINDS: Array<{ id: VoiceKind; labelEn: string; labelNe: string; emoji: string }> = [
  { id: "review", labelEn: "Review", labelNe: "राय", emoji: "⭐" },
  { id: "question", labelEn: "Question", labelNe: "सोधपुछ", emoji: "💬" },
  { id: "complaint", labelEn: "Complaint", labelNe: "गुनासो", emoji: "😟" },
  // A note about the shop's own screens, not about a pair of shoes. It used to
  // go to a table with a screen nobody could open; it arrives here now so
  // there is one inbox to read rather than two.
  { id: "app", labelEn: "App", labelNe: "App सुधार", emoji: "🐞" },
];

function kindOf(kind: VoiceKind) {
  return KINDS.find((entry) => entry.id === kind) ?? KINDS[1];
}

/** Digits only — what tel: and wa.me both want, and what a pasted number is not. */
function dialable(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

/** Nepali mobile numbers are stored as ten digits; wa.me needs the country code. */
function whatsappNumber(digits: string) {
  return digits.length === 10 ? `977${digits}` : digits;
}

function Stars({ rating }: { rating: number }) {
  if (rating < 1) return null;
  return (
    <span className="text-amber-500" aria-label={`${rating} stars`}>
      {"★".repeat(rating)}
      <span className="text-brand-muted-soft">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function StatusBadge({ voice }: { voice: CustomerVoice }) {
  const waited = daysWaiting(voice);

  // Three days is where a question stops being a question and becomes a
  // customer who bought the pair somewhere else.
  if (voice.status === "new" && waited >= 3) {
    return (
      <span className="rounded-full bg-brand-clay px-2.5 py-1 text-xs font-black text-white">
        🔴 <T en={`${waited} days waiting!`} ne={`${waited} दिन भयो!`} />
      </span>
    );
  }
  if (voice.status === "new") {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
        <T en="Reply due" ne="जवाफ बाँकी" />
      </span>
    );
  }
  if (voice.status === "answered") {
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900">
        ✓ <T en="Replied" ne="जवाफ दिइयो" />
      </span>
    );
  }
  return (
    <span className="rounded-full bg-brand-mist px-2.5 py-1 text-xs font-bold text-brand-muted">
      <T en="Done" ne="सकियो" />
    </span>
  );
}

function Row({ voice }: { voice: CustomerVoice }) {
  const kind = kindOf(voice.kind);
  const phone = dialable(voice.phone);

  return (
    <article className="border-b border-brand-green-line px-4 py-4 last:border-b-0 hover:bg-brand-paper-deep">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-bold text-brand-green-ink">
          {kind.emoji} <T en={kind.labelEn} ne={kind.labelNe} />
        </span>
        <span className="text-sm font-semibold text-brand-green-ink">
          {voice.customerName || <T en="No name" ne="नाम छैन" />}
        </span>
        {voice.phone ? <span className="text-xs text-brand-muted">{voice.phone}</span> : null}
        <span className="ml-auto">
          <StatusBadge voice={voice} />
        </span>
      </div>

      {voice.productName ? (
        <p className="mt-1 text-xs text-brand-muted">
          {voice.productName} <Stars rating={voice.rating} />
        </p>
      ) : (
        <Stars rating={voice.rating} />
      )}

      {voice.message ? (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-brand-green-ink">
          {voice.message}
        </p>
      ) : null}

      <p className="mt-2 text-xs text-brand-muted">
        <DateDisplayAdmin date={voice.createdAt} />
        {voice.repliedAt ? (
          <>
            {" · "}
            <T en="replied " ne="जवाफ " />
            <DateDisplayAdmin date={voice.repliedAt} />
          </>
        ) : null}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {phone ? (
          <>
            <a
              href={`tel:${phone}`}
              className="rounded-lg border border-brand-green-line px-3 py-1.5 text-xs font-bold text-brand-green-ink hover:bg-brand-paper"
            >
              📞 <T en="Call" ne="फोन" />
            </a>
            <a
              href={`https://wa.me/${whatsappNumber(phone)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-brand-green-line px-3 py-1.5 text-xs font-bold text-brand-green-ink hover:bg-brand-paper"
            >
              💬 WhatsApp
            </a>
          </>
        ) : null}

        {voice.status === "new" ? (
          <form action={setStatusAction}>
            <input type="hidden" name="id" value={voice.id} />
            <input type="hidden" name="status" value="answered" />
            <button className="rounded-lg bg-brand-green-ink px-3 py-1.5 text-xs font-bold text-white hover:opacity-90">
              ✓ <T en="Replied" ne="जवाफ दिएँ" />
            </button>
          </form>
        ) : voice.status === "answered" ? (
          <form action={setStatusAction}>
            <input type="hidden" name="id" value={voice.id} />
            <input type="hidden" name="status" value="closed" />
            <button className="rounded-lg border border-brand-green-line px-3 py-1.5 text-xs font-bold text-brand-muted-deep hover:bg-brand-paper">
              <T en="Mark done" ne="सकियो भन्ने" />
            </button>
          </form>
        ) : null}

        {voice.kind === "review" ? (
          <form action={setPublishedAction}>
            <input type="hidden" name="id" value={voice.id} />
            <input type="hidden" name="published" value={voice.published ? "false" : "true"} />
            <button
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                voice.published
                  ? "bg-emerald-100 text-emerald-900"
                  : "border border-brand-green-line text-brand-muted-deep hover:bg-brand-paper"
              }`}
            >
              {voice.published ? (
                <>👁 <T en="Live in shop" ne="पसलमा देखिँदैछ" /></>
              ) : (
                <T en="Publish to shop" ne="पसलमा राख्ने" />
              )}
            </button>
          </form>
        ) : null}

        {/* Delete — for spam and cold sales pitches that are not a real
            customer. Sits to the right, away from the everyday buttons. Deleting
            a published review also takes it off the shop. */}
        <form action={deleteVoiceAction} className="ml-auto">
          <input type="hidden" name="id" value={voice.id} />
          <button
            type="submit"
            className="rounded-lg border border-brand-clay/40 px-3 py-1.5 text-xs font-bold text-brand-clay hover:bg-red-50"
          >
            🗑 <T en="Delete" ne="मेट्ने" />
          </button>
        </form>
      </div>
    </article>
  );
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams?: Promise<{ kind?: string; status?: string; view?: string }>;
}) {
  const { role } = await requireAdminPermission("feedback:read");

  const params = (await searchParams) ?? {};
  const kind = KINDS.find((entry) => entry.id === params.kind)?.id;
  const status = params.status === "new" ? ("new" as const) : undefined;

  const reviewUrl = `${getSiteUrl().replace(/[/]$/, "")}/review`;
  const [voices, counts, stats, toAsk, allReviews, shoeList] = await Promise.all([
    getCustomerVoice({ kind, status }),
    getVoiceCounts(),
    getReviewStats().catch(() => ({ reviews: 0, average: 0, live: 0 })),
    // Customers' phones come from the bills, so only for whoever may read the
    // bills; and a list that fails to load must not take the inbox with it.
    canAdmin(role, "pos:read")
      ? Promise.all([getPosInvoices(), getVoicePhones()])
          .then(([bills, heard]) => customersToAsk(bills, heard, new Date()))
          .catch((error): CustomerToAsk[] => {
            reportError("list counter customers to ask for a review", error);
            return [];
          })
      : Promise.resolve<CustomerToAsk[]>([]),
    getCustomerVoice({ kind: "review", limit: 500 }),
    getProducts({ includeDrafts: true }).catch((error) => {
      reportError("list shoes for the review cards", error);
      return [];
    }),
  ]);

  // The shoes a review can belong to, Active or Draft — where it will show.
  const shoes = new Map<string, ShoeOnFile>(
    shoeList.map((product) => [product.id, { id: product.id, name: product.name, active: product.status === "Active" }]),
  );
  // Reviews to decide, live, kept hidden (owner, 2026-10-01).
  const toDecide = allReviews.filter((voice) => reviewView(voice) === "decide");
  const readyToShow = toDecide.filter((voice) => showsWhenPublished(voice, shoes));
  const view: ReviewView | undefined =
    kind === "review" && (params.view === "decide" || params.view === "live" || params.view === "hidden") ? params.view : undefined;
  const listed = view ? voices.filter((voice) => reviewView(voice) === view) : voices;
  const canPublish = canAdmin(role, "reviews:write");

  const tab = (href: string, label: React.ReactNode, active: boolean) => (
    <Link
      key={href}
      href={href}
      className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${
        active
          ? "bg-brand-green-ink text-white"
          : "border border-brand-green-line text-brand-muted-deep hover:bg-brand-paper"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <section className="p-6 pb-24">
      <div>
        <h1 className="font-display text-3xl font-black text-brand-green-ink">
          <T en="Customer Voice" ne="ग्राहकको आवाज" />
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-brand-muted">
          <T
            en="Reviews, questions and complaints — everything a customer said, in one place."
            ne="राय, सोधपुछ र गुनासो — ग्राहकले भनेको सबै कुरा एउटै ठाउँमा।"
          />
          {counts.waiting > 0 ? (
            <strong className="text-brand-clay">
              {" "}
              <T en={`${counts.waiting} still to reply.`} ne={`${counts.waiting} वटा जवाफ बाँकी छ।`} />
            </strong>
          ) : null}
        </p>
      </div>

      {/* Where reviews show up, and the three counts (owner, 2026-10-01: "where
          do I see the reviews?" — on an empty page nothing said they arrive
          here). */}
      <div className="mt-5 grid gap-3">
        <div className="grid grid-cols-2 gap-2 sm:max-w-2xl sm:grid-cols-4" data-review-stats>
          <div className="rounded-xl border border-brand-green-line bg-brand-paper px-3 py-2">
            <b className="block font-display text-xl text-brand-green-ink">
              {stats.reviews > 0 ? `★ ${stats.average.toFixed(1)}` : "0"}
            </b>
            <span className="text-xs text-brand-muted">
              {stats.reviews > 0 ? (
                <T en={`average · ${stats.reviews} reviews`} ne={`औसत · ${stats.reviews} राय`} />
              ) : (
                <T en="reviews so far" ne="अहिलेसम्म राय" />
              )}
            </span>
          </div>
          <div className="rounded-xl border border-brand-green-line bg-brand-paper px-3 py-2">
            <b className="block font-display text-xl text-brand-green-ink">{stats.live}</b>
            <span className="text-xs text-brand-muted"><T en="live in the shop" ne="पसलमा देखिने" /></span>
          </div>
          <Link href="/admin/inbox?kind=review&view=decide" className="rounded-xl border border-brand-green-line bg-brand-paper px-3 py-2">
            <b className={`block font-display text-xl ${toDecide.length > 0 ? "text-brand-gold-deep" : "text-brand-green-ink"}`}>{toDecide.length}</b>
            <span className="text-xs text-brand-muted"><T en="reviews to decide" ne="छान्न बाँकी राय" /></span>
          </Link>
          <div className="rounded-xl border border-brand-green-line bg-brand-paper px-3 py-2">
            <b className={`block font-display text-xl ${counts.waiting > 0 ? "text-brand-clay" : "text-brand-green-ink"}`}>{counts.waiting}</b>
            <span className="text-xs text-brand-muted"><T en="to reply" ne="जवाफ बाँकी" /></span>
          </div>
        </div>
        <p className="rounded-xl border border-dashed border-brand-green bg-brand-green-wash px-3 py-2 text-sm text-brand-green-ink" data-review-where>
          <T
            en="📍 Where reviews show up: right here, in the list below, the moment a customer sends one — and your phone is told. A review you publish shows with its stars on the shoe's page."
            ne="📍 राय कहाँ आउँछ: ग्राहकले पठाउनेबित्तिकै यहीँ तलको सूचीमा आउँछ, र तपाईंको फोनमा सूचना पनि आउँछ। तपाईंले “पसलमा राख्ने” थिचेको राय जुत्ताको पेजमा तारासहित देखिन्छ।"
          />
        </p>
        <AskCounterCustomers customers={toAsk} reviewUrl={reviewUrl} />
      </div>

      {/* Six "0" tabs say nothing on an empty inbox; they appear with the
          first thing a customer says. */}
      {counts.total > 0 ? (
      <div className="mt-5 flex flex-wrap gap-2">
        {tab(
          "/admin/inbox",
          <T en={`All ${counts.total}`} ne={`सबै ${counts.total}`} />,
          !kind && !status,
        )}
        {tab(
          "/admin/inbox?status=new",
          <T en={`🔴 Reply due ${counts.waiting}`} ne={`🔴 जवाफ बाँकी ${counts.waiting}`} />,
          status === "new",
        )}
        {KINDS.map((entry) =>
          tab(
            `/admin/inbox?kind=${entry.id}`,
            <>
              {entry.emoji}{" "}
              <T
                en={`${entry.labelEn} ${counts.byKind[entry.id]}`}
                ne={`${entry.labelNe} ${counts.byKind[entry.id]}`}
              />
            </>,
            kind === entry.id,
          ),
        )}
      </div>
      ) : null}

      {kind === "review" ? (
        <div className="mt-3 flex flex-wrap gap-2" data-review-views>
          {tab("/admin/inbox?kind=review", <T en="All reviews" ne="सबै राय" />, !view)}
          {tab("/admin/inbox?kind=review&view=decide", <T en={`To decide ${toDecide.length}`} ne={`छान्न बाँकी ${toDecide.length}`} />, view === "decide")}
          {tab("/admin/inbox?kind=review&view=live", <T en={`Live ${stats.live}`} ne={`पसलमा ${stats.live}`} />, view === "live")}
          {tab(
            "/admin/inbox?kind=review&view=hidden",
            <T en={`Hidden ${allReviews.filter((voice) => reviewView(voice) === "hidden").length}`} ne={`लुकाइएको ${allReviews.filter((voice) => reviewView(voice) === "hidden").length}`} />,
            view === "hidden",
          )}
        </div>
      ) : null}

      {canPublish && readyToShow.length > 0 ? (
        <form action={publishManyAction} className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-green-ink px-4 py-3 text-white" data-publish-many>
          {readyToShow.map((voice) => (
            <input key={voice.id} type="hidden" name="id" value={voice.id} />
          ))}
          <span className="text-base font-black">
            <T
              en={`${readyToShow.length} review${readyToShow.length === 1 ? "" : "s"} will show in the shop once published`}
              ne={`${readyToShow.length} राय पसलमा राख्न तयार छन्`}
            />
          </span>
          <button className="min-h-11 rounded-xl bg-brand-paper px-5 text-base font-black text-brand-green-ink">
            <T en={`✓ Publish these ${readyToShow.length}`} ne={`✓ यी ${readyToShow.length} पसलमा राख्ने`} />
          </button>
        </form>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-lg border border-brand-green-line bg-brand-paper">
        {counts.total === 0 ? (
          <ReviewAskWays reviewUrl={reviewUrl} />
        ) : listed.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-brand-muted">
            <T en="Nothing in this filter." ne="यो छनोटमा केही छैन।" />
          </p>
        ) : (
          listed.map((voice) =>
            voice.kind === "review" && canPublish ? (
              <ReviewRow key={voice.id} voice={voice} shoes={shoes} />
            ) : (
              <Row key={voice.id} voice={voice} />
            ),
          )
        )}
      </div>
    </section>
  );
}
