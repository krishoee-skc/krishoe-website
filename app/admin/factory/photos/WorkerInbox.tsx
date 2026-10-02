"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import type { WorkerPhoto, WorkerRequest } from "@/lib/worker-portal";
import { formatAdminDate } from "@/lib/format-date";
import { quoteWork, type FactoryRate } from "@/lib/factory-rate-book";
import { productionStageForFactoryCategory } from "@/lib/factory-stage";
import { FACTORY_WORKER_CATEGORIES, factoryCategoryLabel } from "@/lib/factory-worker-options";
import {
  answerWorkerRequestAction,
  bookPhotoWorkAction,
  deletePhotoAction,
  hidePhotoAction,
  notWorkPhotoAction,
  takeBackPhotoWorkAction,
  type InboxReply,
} from "./actions";

const KIND_WORDS: Record<WorkerPhoto["kind"], { en: string; ne: string; icon: string }> = {
  done: { en: "Work done", ne: "काम सकियो", icon: "✅" },
  upper: { en: "Upper part", ne: "माथिल्लो भाग", icon: "🧵" },
  ready: { en: "Ready pairs", ne: "तयार जोडी", icon: "👟" },
  problem: { en: "Problem", ne: "समस्या", icon: "⚠️" },
};

/** The reasons a photo is not work, as the worker will read them. */
const NOT_WORK_REASONS = [
  { en: "Send the shoe and the pairs", ne: "जुत्ता र जोडी लेखेर फेरि पठाउनुहोस्" },
  { en: "The photo is not clear — send again", ne: "फोटो प्रस्ट भएन — फेरि पठाउनुहोस्" },
  { en: "Already on the books", ne: "यो काम पहिले नै हिसाबमा छ" },
  { en: "Not our work", ne: "यो हाम्रो काम होइन" },
] as const;

const STAGES = FACTORY_WORKER_CATEGORIES.filter((stage) => stage !== "Staff");

type Tab = "check" | "books" | "notwork" | "problems" | "hidden";

/** The admin's one way of writing a date: the English date, the Bikram Sambat after it, and the time. */
function when(iso: string) {
  return formatAdminDate(iso, { time: true });
}

function nepalDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function tabOf(photo: WorkerPhoto): Tab {
  if (photo.hidden) return "hidden";
  if (photo.kind === "problem") return "problems";
  if (photo.status === "added") return "books";
  if (photo.verdict === "not_work") return "notwork";
  return "check";
}

type Draft = { work: boolean; stage: string; itemId: string; pairs: string; workDate: string; rejects: string; reason: string; message: string };

/**
 * What workers have sent (owner, 2026-10-02/03), and the check of each photo:
 * work or not, the stage, the shoe, the pairs, the day and damaged pairs — and
 * then on the books, or back off them. Problems and proof are hidden, never
 * deleted; a photo that is neither may be deleted by the owner.
 */
export default function WorkerInbox({
  photos,
  requests,
  canAnswer,
  items = [],
  rates = [],
  draftsOn = false,
  reviewOn = false,
}: {
  photos: WorkerPhoto[];
  requests: WorkerRequest[];
  /** Owner and Admin: answer requests, take work back, delete. */
  canAnswer: boolean;
  items?: Array<{ id: string; name: string }>;
  rates?: FactoryRate[];
  draftsOn?: boolean;
  reviewOn?: boolean;
}) {
  const { text, language } = useLanguage();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<InboxReply | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>("check");
  const [who, setWho] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const run = (action: () => Promise<InboxReply>, after?: () => void) =>
    start(async () => {
      const reply = await action();
      setNotice(reply);
      if (reply.ok) {
        after?.();
        router.refresh();
      }
    });

  const draftOf = (photo: WorkerPhoto): Draft =>
    drafts[photo.id] ?? {
      work: photo.verdict !== "not_work",
      stage: photo.stage || photo.workerCategory,
      itemId: photo.itemId,
      pairs: photo.pairs ? String(photo.pairs) : "",
      workDate: photo.workDate || nepalDay(photo.createdAt),
      rejects: photo.rejectPairs ? String(photo.rejectPairs) : "0",
      reason: NOT_WORK_REASONS[0].ne,
      message: "",
    };
  const change = (photo: WorkerPhoto, patch: Partial<Draft>) => setDrafts((current) => ({ ...current, [photo.id]: { ...draftOf(photo), ...patch } }));

  /** What the books would pay, from the same rate book Add work uses. */
  const quote = (photo: WorkerPhoto) => {
    const draft = draftOf(photo);
    const pairs = Number(draft.pairs) || 0;
    if (!draft.itemId || pairs <= 0) return null;
    return quoteWork(
      rates,
      { itemId: draft.itemId, workerId: photo.workerId, stage: productionStageForFactoryCategory(draft.stage || photo.workerCategory) ?? "", workerCategory: photo.workerCategory, onDate: draft.workDate },
      pairs,
    );
  };

  const workers = useMemo(() => [...new Set(photos.map((photo) => photo.workerName))].sort(), [photos]);
  const counts = useMemo(() => {
    const result: Record<Tab, number> = { check: 0, books: 0, notwork: 0, problems: 0, hidden: 0 };
    for (const photo of photos) if (!who || photo.workerName === who) result[tabOf(photo)] += 1;
    return result;
  }, [photos, who]);
  const shown = photos.filter((photo) => tabOf(photo) === tab && (!who || photo.workerName === who));
  const bookable = (photo: WorkerPhoto) => draftsOn && photo.workerType === "piece_rate" && photo.kind !== "problem" && photo.status !== "added";
  const readyToBook = shown.filter((photo) => tab === "check" && bookable(photo) && Boolean(draftOf(photo).itemId) && Number(draftOf(photo).pairs) > 0);

  const book = (photo: WorkerPhoto) => {
    const draft = draftOf(photo);
    return bookPhotoWorkAction(photo.id, {
      itemId: draft.itemId,
      pairs: Number(draft.pairs),
      stage: draft.stage,
      workDate: draft.workDate,
      rejectPairs: Number(draft.rejects) || 0,
      reply: draft.message,
    });
  };

  /** ✓ every ready draft on this tab, one after another; stops at the first refusal. */
  const bookAll = () =>
    start(async () => {
      let booked = 0;
      let total = 0;
      for (const photo of readyToBook) {
        const reply = await book(photo);
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

  const tabs: Array<{ key: Tab; en: string; ne: string }> = [
    { key: "check", en: "To check", ne: "जाँच्न बाँकी" },
    { key: "books", en: "On the books", ne: "हिसाबमा" },
    { key: "notwork", en: "Not work", ne: "काम होइन" },
    { key: "problems", en: "⚠️ Problems", ne: "⚠️ समस्या" },
    { key: "hidden", en: "Hidden", ne: "लुकाइएका" },
  ];

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

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black text-brand-green-ink">{text("Work photos", "कामका फोटो")}</h2>
          {readyToBook.length > 1 ? (
            <button type="button" disabled={pending} onClick={bookAll} className="min-h-11 rounded-xl bg-brand-green px-4 text-sm font-black text-white disabled:opacity-60">
              {text(`✓ All ${readyToBook.length} ready — put on the books`, `✓ तयार सबै ${readyToBook.length} — हिसाबमा थप्ने`)}
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label={text("Photos by state", "फोटो अवस्था अनुसार")}>
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={`min-h-10 rounded-full border px-3 text-sm font-black ${tab === item.key ? "border-brand-green-ink bg-brand-green-ink text-white" : "border-brand-green-line bg-brand-paper text-brand-green-ink"}`}
            >
              {text(item.en, item.ne)} {counts[item.key]}
            </button>
          ))}
          <select value={who} onChange={(event) => setWho(event.target.value)} aria-label={text("Worker", "कामदार")} className="min-h-10 rounded-full border border-brand-green-line bg-brand-paper px-3 text-sm font-bold">
            <option value="">{text("All workers", "सबै कामदार")}</option>
            {workers.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        {!reviewOn ? (
          <p className="rounded-xl bg-brand-cream-soft px-3 py-2 text-sm font-bold text-brand-green-ink">
            {text("To check photos in full — work or not, stage, day, take back — press OK in Settings → Worker app.", "फोटो पूरा जाँच्न (काम हो कि होइन, चरण, दिन, फिर्ता) Settings → कामदारको app मा OK थिच्नुहोस्।")}
          </p>
        ) : null}

        {shown.length === 0 ? (
          <p className="text-sm text-brand-muted">{text("Nothing here.", "यहाँ केही छैन।")}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((photo) => {
              const draft = draftOf(photo);
              const price = quote(photo);
              const isOpen = open === photo.id;
              return (
                <li key={photo.id} className={`overflow-hidden rounded-2xl border ${photo.kind === "problem" ? "border-red-400" : "border-brand-green-line"} bg-brand-paper ${isOpen ? "sm:col-span-2 lg:col-span-3" : ""}`}>
                  <div className={isOpen ? "grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]" : ""}>
                    <a href={photo.imageUrl} target="_blank" rel="noreferrer" className="block" aria-label={text("Open the photo full size", "फोटो ठूलो खोल्ने")}>
                      <img src={photo.imageUrl} alt={`${photo.workerName} — ${KIND_WORDS[photo.kind].en}`} loading="lazy" className={`w-full object-cover ${isOpen ? "max-h-[32rem] object-contain" : "aspect-[4/3]"}`} />
                    </a>
                    <div className="grid content-start gap-2 p-3">
                      <p className="text-sm font-black text-brand-green-ink">
                        {KIND_WORDS[photo.kind].icon} {photo.workerName} · {factoryCategoryLabel(photo.workerCategory, language === "ne")} · {text(KIND_WORDS[photo.kind].en, KIND_WORDS[photo.kind].ne)}
                      </p>
                      <p className="text-xs text-brand-muted">
                        {when(photo.createdAt)}
                        {photo.itemName ? ` · ${photo.itemName}` : ""}
                        {photo.pairs ? ` · ${photo.pairs} ${text("pairs", "जोडी")}` : ""}
                      </p>
                      {photo.note ? <p className="text-sm text-brand-green-ink">“{photo.note}”</p> : null}

                      {photo.status === "added" ? (
                        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">
                          {text("On the books ✓", "हिसाबमा ✓")}
                          {photo.amountEarned !== null ? ` · Rs. ${photo.amountEarned.toLocaleString("en-IN")}` : ""}
                          {photo.workDate ? ` · ${photo.workDate}` : ""}
                        </p>
                      ) : photo.verdict === "not_work" ? (
                        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-800">✖ {text("Not work", "काम होइन")}{photo.reply ? ` — “${photo.reply}”` : ""}</p>
                      ) : null}

                      {isOpen ? (
                        <div className="grid gap-3">
                          {photo.status !== "added" && reviewOn ? (
                            <div className="flex flex-wrap gap-2" role="group" aria-label={text("Work or not", "काम हो कि होइन")}>
                              <button type="button" aria-pressed={draft.work} onClick={() => change(photo, { work: true })} className={`min-h-10 rounded-full border px-3 text-sm font-black ${draft.work ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line"}`}>
                                ✅ {text("Work", "काम हो")}
                              </button>
                              <button type="button" aria-pressed={!draft.work} onClick={() => change(photo, { work: false })} className={`min-h-10 rounded-full border px-3 text-sm font-black ${!draft.work ? "border-red-700 bg-red-700 text-white" : "border-brand-green-line"}`}>
                                ✖ {text("Not work", "काम होइन")}
                              </button>
                            </div>
                          ) : null}

                          {photo.status !== "added" && draft.work && bookable(photo) ? (
                            <div className="grid gap-2">
                              <div className="flex flex-wrap gap-1.5" role="group" aria-label={text("Which work", "कुन काम")}>
                                {STAGES.map((stage) => (
                                  <button
                                    key={stage}
                                    type="button"
                                    aria-pressed={draft.stage === stage}
                                    disabled={!reviewOn}
                                    onClick={() => change(photo, { stage })}
                                    className={`min-h-9 rounded-full border px-3 text-xs font-black ${draft.stage === stage ? "border-brand-green-ink bg-brand-green-ink text-white" : "border-brand-green-line"}`}
                                  >
                                    {factoryCategoryLabel(stage, language === "ne")}
                                  </button>
                                ))}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <label className="grid gap-1 text-xs font-black">
                                  {text("Shoe", "जुत्ता")}
                                  <select value={draft.itemId} onChange={(event) => change(photo, { itemId: event.target.value })} className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-2 text-sm font-normal">
                                    <option value="">{text("— choose —", "— छान्नुहोस् —")}</option>
                                    {items.map((item) => (
                                      <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="grid gap-1 text-xs font-black">
                                  {text("Pairs", "जोडी")}
                                  <input value={draft.pairs} onChange={(event) => change(photo, { pairs: event.target.value })} inputMode="numeric" className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-2 text-sm font-normal" />
                                </label>
                                {reviewOn ? (
                                  <>
                                    <label className="grid gap-1 text-xs font-black">
                                      {text("Day of the work", "कामको दिन")}
                                      <input type="date" value={draft.workDate} max={nepalDay(new Date().toISOString())} onChange={(event) => change(photo, { workDate: event.target.value })} className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-2 text-sm font-normal" />
                                    </label>
                                    <label className="grid gap-1 text-xs font-black">
                                      {text("Damaged pairs", "बिग्रिएको जोडी")}
                                      <input value={draft.rejects} onChange={(event) => change(photo, { rejects: event.target.value })} inputMode="numeric" className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-2 text-sm font-normal" />
                                    </label>
                                  </>
                                ) : null}
                              </div>
                              <p className={`rounded-xl px-3 py-2 text-sm font-black ${price?.rate ? "bg-emerald-50 text-emerald-900" : "bg-brand-cream-soft text-brand-green-ink"}`}>
                                {!price
                                  ? text("Choose the shoe and the pairs.", "जुत्ता र जोडी छान्नुहोस्।")
                                  : price.rate
                                    ? text(`${draft.pairs} pairs × Rs. ${price.rate} = Rs. ${price.amount.toLocaleString("en-IN")}`, `${draft.pairs} जोडी × Rs. ${price.rate} = Rs. ${price.amount.toLocaleString("en-IN")}`)
                                    : text("No rate for this shoe and work — set it in Items first.", "यो जुत्ता र कामको दर छैन — पहिले Items मा दर राख्नुहोस्।")}
                              </p>
                            </div>
                          ) : null}

                          {photo.status !== "added" && !draft.work && reviewOn ? (
                            <label className="grid gap-1 text-xs font-black">
                              {text("Why not (the worker sees this)", "किन होइन (कामदारले देख्छ)")}
                              <select value={draft.reason} onChange={(event) => change(photo, { reason: event.target.value })} className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-2 text-sm font-normal">
                                {NOT_WORK_REASONS.map((reason) => (
                                  <option key={reason.ne} value={reason.ne}>{text(reason.en, reason.ne)}</option>
                                ))}
                              </select>
                            </label>
                          ) : null}

                          {photo.status !== "added" && reviewOn ? (
                            <label className="grid gap-1 text-xs font-black">
                              {text("A word to the worker (optional)", "कामदारलाई सन्देश (नभरे पनि हुन्छ)")}
                              <input value={draft.message} onChange={(event) => change(photo, { message: event.target.value })} maxLength={200} className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-2 text-sm font-normal" />
                            </label>
                          ) : null}

                          <div className="flex flex-wrap gap-2">
                            {photo.status !== "added" && draft.work && bookable(photo) ? (
                              <button type="button" disabled={pending || !price?.rate} onClick={() => run(() => book(photo), () => setOpen(null))} className="min-h-11 rounded-xl bg-brand-green px-4 text-sm font-black text-white disabled:opacity-50">
                                {text("✓ Put on the books", "✓ हिसाबमा थप्ने")}
                              </button>
                            ) : null}
                            {photo.status !== "added" && !draft.work && reviewOn ? (
                              <button type="button" disabled={pending} onClick={() => run(() => notWorkPhotoAction(photo.id, draft.reason, draft.message), () => setOpen(null))} className="min-h-11 rounded-xl bg-red-700 px-4 text-sm font-black text-white disabled:opacity-50">
                                {text("✖ Mark: not work", "✖ काम होइन भन्ने")}
                              </button>
                            ) : null}
                            {photo.status === "added" && canAnswer && reviewOn ? (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => {
                                  if (window.confirm(text("Take this work back off the books? It is removed from their pay, with the reason kept in the audit.", "यो काम हिसाबबाट फिर्ता गर्ने? उसको तलबबाट हट्छ, कारण Activity मा रहन्छ।"))) run(() => takeBackPhotoWorkAction(photo.id));
                                }}
                                className="min-h-11 rounded-xl border border-red-700 px-4 text-sm font-black text-red-800 disabled:opacity-50"
                              >
                                {text("↶ Take it back", "↶ फिर्ता")}
                              </button>
                            ) : null}
                            {reviewOn && (photo.status === "added" || photo.kind === "problem") ? (
                              <button type="button" disabled={pending} onClick={() => run(() => hidePhotoAction(photo.id, !photo.hidden), () => setOpen(null))} className="min-h-11 rounded-xl border border-brand-green-line px-4 text-sm font-bold text-brand-muted">
                                {photo.hidden ? text("Show again", "फेरि देखाउने") : text("Hide (kept)", "लुकाउने (राखिन्छ)")}
                              </button>
                            ) : null}
                            {canAnswer && photo.status !== "added" && photo.kind !== "problem" ? (
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => {
                                  if (window.confirm(text("Delete this photo for good? It is not on the books, so no pay changes.", "यो फोटो सधैँका लागि मेटाउने? यो हिसाबमा छैन, तलब बदलिँदैन।"))) run(() => deletePhotoAction(photo.id), () => setOpen(null));
                                }}
                                className="min-h-11 rounded-xl px-3 text-sm font-bold text-red-800 underline underline-offset-4"
                              >
                                {text("Delete", "मेटाउने")}
                              </button>
                            ) : null}
                            <button type="button" onClick={() => setOpen(null)} className="min-h-11 rounded-xl px-3 text-sm font-bold text-brand-muted">
                              {text("Close", "बन्द")}
                            </button>
                          </div>

                          {photo.history.length > 0 ? (
                            <ul className="grid gap-0.5 border-t border-brand-green-line pt-2 text-xs text-brand-muted">
                              <li>{when(photo.createdAt)} · {photo.workerName} {text("sent it", "ले पठायो")}</li>
                              {photo.history.map((line, index) => (
                                <li key={`${line.at}-${index}`}>{when(line.at)} · {line.by} · {line.what}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ) : (
                        <button type="button" onClick={() => setOpen(photo.id)} className="min-h-11 rounded-xl bg-brand-green px-3 text-sm font-black text-white">
                          {photo.status === "added" || photo.kind === "problem"
                            ? text("Open", "खोल्ने")
                            : !photo.itemId || !photo.pairs
                              ? text("Fill in and check →", "भरेर जाँच्ने →")
                              : text("Check ✓ →", "जाँच्ने ✓ →")}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
