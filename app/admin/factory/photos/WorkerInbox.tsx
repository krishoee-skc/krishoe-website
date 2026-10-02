"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import type { WorkerPhoto, WorkerRequest } from "@/lib/worker-portal";
import { formatAdminDate } from "@/lib/format-date";
import { answerWorkerRequestAction, bookPhotoWorkAction, markWorkerPhotoAction, type InboxReply } from "./actions";

const KIND_WORDS: Record<WorkerPhoto["kind"], { en: string; ne: string; icon: string }> = {
  done: { en: "Work done", ne: "काम सकियो", icon: "✅" },
  upper: { en: "Upper part", ne: "माथिल्लो भाग", icon: "🧵" },
  ready: { en: "Ready pairs", ne: "तयार जोडी", icon: "👟" },
  problem: { en: "Problem", ne: "समस्या", icon: "⚠️" },
};

/** The English date with the Bikram Sambat after it, and the time — the admin's one way of writing a date. */
function when(iso: string) {
  return formatAdminDate(iso, { time: true });
}

/**
 * What workers have sent (owner, 2026-10-02): their photos, problems first,
 * and their questions and advance requests, unanswered first. Nothing here
 * changes the books by itself — "Add to the books" opens the work form, and
 * an advance is paid on the ledger as always.
 */
/** A photo that can go on the books with one press: work, by the pair, not yet booked. */
function isDraft(photo: WorkerPhoto) {
  return photo.status === "new" && photo.kind !== "problem" && photo.workerType === "piece_rate";
}

export default function WorkerInbox({
  photos,
  requests,
  canAnswer,
  items = [],
  draftsOn = false,
}: {
  photos: WorkerPhoto[];
  requests: WorkerRequest[];
  canAnswer: boolean;
  /** The factory's shoes, for correcting a draft. */
  items?: Array<{ id: string; name: string }>;
  /** Whether a photo can carry its shoe and be booked — Settings → OK. */
  draftsOn?: boolean;
}) {
  const { text } = useLanguage();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<InboxReply | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});
  // The owner's corrections to a draft before ✓: the shoe and the pairs.
  const [fix, setFix] = useState<Record<string, { itemId: string; pairs: string }>>({});
  const draftOf = (photo: WorkerPhoto) => fix[photo.id] ?? { itemId: photo.itemId, pairs: photo.pairs ? String(photo.pairs) : "" };
  const complete = (photo: WorkerPhoto) => Boolean(draftOf(photo).itemId) && Number(draftOf(photo).pairs) > 0;
  const readyDrafts = draftsOn ? photos.filter((photo) => isDraft(photo) && complete(photo)) : [];

  /** ✓ every complete draft, one after another; stops at the first that is refused. */
  const bookAll = () =>
    start(async () => {
      let booked = 0;
      let total = 0;
      for (const photo of readyDrafts) {
        const draft = draftOf(photo);
        const reply = await bookPhotoWorkAction(photo.id, draft.itemId, Number(draft.pairs));
        if (!reply.ok) {
          setNotice(reply);
          router.refresh();
          return;
        }
        booked += 1;
        total += reply.amount ?? 0;
      }
      setNotice({ ok: true, en: `${booked} on the books — Rs. ${total.toLocaleString("en-IN")} in all`, ne: `${booked} वटा हिसाबमा — जम्मा Rs. ${total.toLocaleString("en-IN")}` });
      router.refresh();
    });

  const run = (action: () => Promise<InboxReply>) =>
    start(async () => {
      const reply = await action();
      setNotice(reply);
      if (reply.ok) router.refresh();
    });

  const ordered = [...photos].sort((a, b) => Number(b.kind === "problem" && b.status === "new") - Number(a.kind === "problem" && a.status === "new"));

  return (
    <div className="grid gap-8">
      {notice ? (
        <p role="status" className={`rounded-xl px-4 py-3 text-sm font-bold ${notice.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>{text(notice.en, notice.ne)}</p>
      ) : null}

      <section>
        <h2 className="text-xl font-black text-brand-green-ink">{text("Questions and advances", "हिसाबका प्रश्न र पेस्की")}</h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-brand-muted">{text("Nothing yet.", "अहिलेसम्म केही छैन।")}</p>
        ) : (
          <ul className="mt-3 grid gap-3 lg:grid-cols-2">
            {requests.map((item) => (
              <li key={item.id} className={`rounded-2xl border p-4 ${item.status === "open" ? "border-brand-gold bg-brand-cream-soft" : "border-brand-green-line bg-brand-paper"}`}>
                <p className="text-base font-black text-brand-green-ink">
                  {item.kind === "advance" ? `💵 ${text("Advance", "पेस्की")} Rs. ${(item.amount ?? 0).toLocaleString("en-IN")}` : `⚖️ ${text("Sum does not add up", "हिसाब मिलेन")}`} · {item.workerName}
                </p>
                <p className="text-xs text-brand-muted">{when(item.createdAt)}{item.aboutDate ? ` · ${text("about", "मिति")} ${item.aboutDate}` : ""}</p>
                {item.message ? <p className="mt-2 text-sm text-brand-green-ink">“{item.message}”</p> : null}
                {item.status === "open" && canAnswer ? (
                  <div className="mt-3 grid gap-2">
                    <input
                      value={replies[item.id] ?? ""}
                      onChange={(event) => setReplies((current) => ({ ...current, [item.id]: event.target.value }))}
                      placeholder={text("A word back (they will see it)", "जवाफ (कामदारले देख्छ)")}
                      aria-label={text(`Answer to ${item.workerName}`, `${item.workerName} लाई जवाफ`)}
                      className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-3 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={pending} onClick={() => run(() => answerWorkerRequestAction(item.id, "done", replies[item.id] ?? ""))} className="min-h-11 rounded-xl bg-brand-green px-4 text-sm font-black text-white disabled:opacity-60">
                        {item.kind === "advance" ? text("Give it", "दिने") : text("Checked — answer", "हेरेँ — जवाफ दिने")}
                      </button>
                      <button type="button" disabled={pending} onClick={() => run(() => answerWorkerRequestAction(item.id, "declined", replies[item.id] ?? ""))} className="min-h-11 rounded-xl border border-brand-green-line px-4 text-sm font-black text-brand-muted disabled:opacity-60">
                        {item.kind === "advance" ? text("Not now", "अहिले होइन") : text("It is right", "हिसाब ठीक छ")}
                      </button>
                      <Link href={`/admin/factory/ledger?workerId=${item.workerId}`} className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-bold text-brand-green underline underline-offset-4">
                        {text("Open their ledger →", "उसको खाता हेर्ने →")}
                      </Link>
                    </div>
                    {item.kind === "advance" ? (
                      <p className="text-xs text-brand-muted">{text("\"Give it\" answers them; record the payment on their ledger as usual.", "\"दिने\" ले जवाफ मात्र दिन्छ; रकम सधैँझैँ उसको खातामा भुक्तानी भनेर लेख्नुहोस्।")}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-sm font-bold text-brand-green">
                    {item.status === "done" ? text("Answered ✓", "जवाफ दिइयो ✓") : item.status === "declined" ? text("Declined", "मिलेन") : text("Waiting for the owner", "मालिकले हेर्न बाँकी")}
                    {item.reply ? ` · “${item.reply}”` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black text-brand-green-ink">{text("Work photos", "कामका फोटो")}</h2>
          {readyDrafts.length > 1 ? (
            <button type="button" disabled={pending} onClick={bookAll} className="min-h-11 rounded-xl bg-brand-green px-4 text-sm font-black text-white disabled:opacity-60">
              {text(`✓ All ${readyDrafts.length} right — put on the books`, `✓ सबै ${readyDrafts.length} ठीक — हिसाबमा थप्ने`)}
            </button>
          ) : null}
        </div>
        {ordered.length === 0 ? (
          <p className="mt-2 text-sm text-brand-muted">{text("No photos yet.", "अहिलेसम्म फोटो छैन।")}</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ordered.map((photo) => (
              <li key={photo.id} className={`overflow-hidden rounded-2xl border ${photo.kind === "problem" && photo.status === "new" ? "border-red-400" : "border-brand-green-line"} bg-brand-paper`}>
                <a href={photo.imageUrl} target="_blank" rel="noreferrer">
                  <img src={photo.imageUrl} alt={`${photo.workerName} — ${KIND_WORDS[photo.kind].en}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                </a>
                <div className="grid gap-2 p-3">
                  <p className="text-sm font-black text-brand-green-ink">
                    {KIND_WORDS[photo.kind].icon} {photo.workerName} · {text(KIND_WORDS[photo.kind].en, KIND_WORDS[photo.kind].ne)}
                    {photo.pairs ? ` · ${photo.pairs} ${text("pairs", "जोडी")}` : ""}
                  </p>
                  <p className="text-xs text-brand-muted">{when(photo.createdAt)}</p>
                  {photo.note ? <p className="text-sm text-brand-green-ink">“{photo.note}”</p> : null}
                  {draftsOn && isDraft(photo) ? (
                    <div className="grid gap-2 rounded-xl bg-brand-mist p-2">
                      <p className="text-xs font-black uppercase tracking-[0.1em] text-brand-muted">
                        {text(`Draft · ${photo.workerCategory}`, `मस्यौदा · ${photo.workerCategory}`)}
                      </p>
                      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
                        <select
                          value={draftOf(photo).itemId}
                          onChange={(event) => setFix((current) => ({ ...current, [photo.id]: { ...draftOf(photo), itemId: event.target.value } }))}
                          aria-label={text(`Shoe for ${photo.workerName}'s photo`, `${photo.workerName} को फोटोको जुत्ता`)}
                          className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-2 text-sm"
                        >
                          <option value="">{text("— the shoe —", "— जुत्ता —")}</option>
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                          ))}
                        </select>
                        <input
                          value={draftOf(photo).pairs}
                          onChange={(event) => setFix((current) => ({ ...current, [photo.id]: { ...draftOf(photo), pairs: event.target.value } }))}
                          inputMode="numeric"
                          aria-label={text(`Pairs in ${photo.workerName}'s photo`, `${photo.workerName} को फोटोका जोडी`)}
                          className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-2 text-sm"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={pending || !complete(photo)}
                          onClick={() => run(() => bookPhotoWorkAction(photo.id, draftOf(photo).itemId, Number(draftOf(photo).pairs)))}
                          className="min-h-11 rounded-xl bg-brand-green px-3 text-sm font-black text-white disabled:opacity-50"
                        >
                          {text("✓ Right — put on the books", "✓ ठीक छ — हिसाबमा")}
                        </button>
                        <button type="button" disabled={pending} onClick={() => run(() => markWorkerPhotoAction(photo.id, "seen"))} className="min-h-11 rounded-xl border border-brand-green-line px-3 text-sm font-bold text-brand-muted disabled:opacity-60">
                          {text("Not this — seen", "होइन — देखेँ मात्र")}
                        </button>
                      </div>
                    </div>
                  ) : photo.status === "new" ? (
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href="/admin/factory/add-work"
                        onClick={() => run(() => markWorkerPhotoAction(photo.id, "added"))}
                        className="inline-flex min-h-10 items-center rounded-xl bg-brand-green px-3 text-sm font-black text-white"
                      >
                        {text("Add to the books →", "हिसाबमा थप्ने →")}
                      </Link>
                      <button type="button" disabled={pending} onClick={() => run(() => markWorkerPhotoAction(photo.id, "seen"))} className="min-h-10 rounded-xl border border-brand-green px-3 text-sm font-black text-brand-green disabled:opacity-60">
                        {text("Seen ✓", "देखेँ ✓")}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-brand-green">{photo.status === "added" ? text("Added to the books ✓", "हिसाबमा थपियो ✓") : text("Seen ✓", "देखेँ ✓")}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
