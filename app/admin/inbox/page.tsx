import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { DateDisplayAdmin } from "@/components/DateDisplay";
import {
  daysWaiting,
  getCustomerVoice,
  getVoiceCounts,
  type CustomerVoice,
  type VoiceKind,
} from "@/lib/customer-voice";
import { setPublishedAction, setStatusAction } from "./actions";

export const metadata: Metadata = { title: "ग्राहकको आवाज | KRISHOE Admin" };
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

const KINDS: Array<{ id: VoiceKind; label: string; emoji: string }> = [
  { id: "review", label: "राय", emoji: "⭐" },
  { id: "question", label: "सोधपुछ", emoji: "💬" },
  { id: "complaint", label: "गुनासो", emoji: "😟" },
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
    <span className="text-amber-500" aria-label={`${rating} तारा`}>
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
        🔴 {waited} दिन भयो!
      </span>
    );
  }
  if (voice.status === "new") {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
        जवाफ बाँकी
      </span>
    );
  }
  if (voice.status === "answered") {
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900">
        ✓ जवाफ दिइयो
      </span>
    );
  }
  return (
    <span className="rounded-full bg-brand-mist px-2.5 py-1 text-xs font-bold text-brand-muted">
      सकियो
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
          {kind.emoji} {kind.label}
        </span>
        <span className="text-sm font-semibold text-brand-green-ink">
          {voice.customerName || "नाम छैन"}
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
            {" · जवाफ "}
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
              📞 फोन
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
              ✓ जवाफ दिएँ
            </button>
          </form>
        ) : voice.status === "answered" ? (
          <form action={setStatusAction}>
            <input type="hidden" name="id" value={voice.id} />
            <input type="hidden" name="status" value="closed" />
            <button className="rounded-lg border border-brand-green-line px-3 py-1.5 text-xs font-bold text-brand-muted-deep hover:bg-brand-paper">
              सकियो भन्ने
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
              {voice.published ? "👁 पसलमा देखिँदैछ" : "पसलमा राख्ने"}
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams?: Promise<{ kind?: string; status?: string }>;
}) {
  await requireAdminPermission("feedback:read");

  const params = (await searchParams) ?? {};
  const kind = KINDS.find((entry) => entry.id === params.kind)?.id;
  const status = params.status === "new" ? ("new" as const) : undefined;

  const [voices, counts] = await Promise.all([
    getCustomerVoice({ kind, status }),
    getVoiceCounts(),
  ]);

  const tab = (href: string, label: string, active: boolean) => (
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
        <h1 className="text-2xl font-black text-brand-green-ink">📬 ग्राहकको आवाज</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-brand-muted">
          राय, सोधपुछ र गुनासो — ग्राहकले भनेको सबै कुरा एउटै ठाउँमा।
          {counts.waiting > 0 ? (
            <strong className="text-brand-clay"> {counts.waiting} वटा जवाफ बाँकी छ।</strong>
          ) : null}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {tab("/admin/inbox", `सबै ${counts.total}`, !kind && !status)}
        {tab("/admin/inbox?status=new", `🔴 जवाफ बाँकी ${counts.waiting}`, status === "new")}
        {KINDS.map((entry) =>
          tab(
            `/admin/inbox?kind=${entry.id}`,
            `${entry.emoji} ${entry.label} ${counts.byKind[entry.id]}`,
            kind === entry.id,
          ),
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-brand-green-line bg-brand-paper">
        {voices.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-brand-muted">
            {counts.total === 0
              ? "अझै कुनै ग्राहकले केही भनेका छैनन् — आएपछि यहीँ देखिन्छ।"
              : "यो छनोटमा केही छैन।"}
          </p>
        ) : (
          voices.map((voice) => <Row key={voice.id} voice={voice} />)
        )}
      </div>
    </section>
  );
}
