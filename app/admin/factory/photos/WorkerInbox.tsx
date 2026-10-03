"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import type { ItemHistory, WorkerPhoto, WorkerRequest } from "@/lib/worker-portal";
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
  robotPhotoAction,
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
  { en: "The photo is not clear — send again", ne: "फोटो प्रस्ट भएन — फेरि पठाउनुहोस्" },
  { en: "Send the shoe and the pairs", ne: "जुत्ता र जोडी लेखेर फेरि पठाउनुहोस्" },
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

type Draft = { work: boolean; stage: string; itemId: string; pairs: string; color: string; size: string; workDate: string; rejects: string; reason: string; message: string };

/** "36, 37, 38" → its single sizes, for the chips. */
function sizesOf(run: string) {
  return run.split(/[,/s]+/).map((size) => size.trim()).filter((size) => /^d{1,2}$/.test(size));
}

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
  history = {},
  robotOn = false,
}: {
  photos: WorkerPhoto[];
  requests: WorkerRequest[];
  /** Owner and Admin: answer requests, take work back, delete. */
  canAnswer: boolean;
  items?: Array<{ id: string; name: string }>;
  rates?: FactoryRate[];
  draftsOn?: boolean;
  reviewOn?: boolean;
  /** The colour and size each shoe was last made in (2026-10-03). */
  history?: Record<string, ItemHistory>;
  /** The robot looks at photos (Settings switch, Gemini key). */
  robotOn?: boolean;
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

  /** The robot's shoe, only when it is one the factory makes. */
  const robotItem = (photo: WorkerPhoto) => (photo.robot?.itemId && items.some((item) => item.id === photo.robot?.itemId) ? photo.robot.itemId : "");
  // What the worker wrote comes first, then the robot's guess, then what the
  // books knew of this shoe last time (owner, 2026-10-03).
  const draftOf = (photo: WorkerPhoto): Draft => {
    if (drafts[photo.id]) return drafts[photo.id];
    const itemId = photo.itemId || robotItem(photo);
    return {
      work: photo.verdict !== "not_work",
      stage: photo.stage || photo.workerCategory,
      itemId,
      pairs: photo.pairs ? String(photo.pairs) : photo.robot?.pairs ? String(photo.robot.pairs) : "",
      color: photo.robot?.color || history[itemId]?.color || "",
      size: history[itemId]?.size || "",
      workDate: photo.workDate || nepalDay(photo.createdAt),
      rejects: photo.rejectPairs ? String(photo.rejectPairs) : "0",
      reason: NOT_WORK_REASONS[0].ne,
      message: "",
    };
  };
  const change = (photo: WorkerPhoto, patch: Partial<Draft>) => setDrafts((current) => ({ ...current, [photo.id]: { ...draftOf(photo), ...patch } }));
  /** Another shoe brings its own last colour and size, unless the robot saw the colour. */
  const changeItem = (photo: WorkerPhoto, itemId: string) =>
    change(photo, { itemId, color: photo.robot?.color || history[itemId]?.color || "", size: history[itemId]?.size || "" });
  /** Filled by the robot and not changed since — marked 🤖 for checking. */
  const byRobot = (photo: WorkerPhoto, field: "itemId" | "pairs" | "color") => {
    const draft = draftOf(photo);
    if (!photo.robot) return false;
    if (field === "itemId") return !photo.itemId && Boolean(draft.itemId) && draft.itemId === photo.robot.itemId;
    if (field === "pairs") return !photo.pairs && Boolean(draft.pairs) && draft.pairs === String(photo.robot.pairs ?? "");
    return Boolean(draft.color) && draft.color === photo.robot.color;
  };

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
  const complete = (draft: Draft) => Boolean(draft.itemId) && Number(draft.pairs) > 0 && Boolean(draft.color.trim()) && Boolean(draft.size.trim());
  const readyToBook = shown.filter((photo) => tab === "check" && bookable(photo) && complete(draftOf(photo)));

  const book = (photo: WorkerPhoto) => {
    const draft = draftOf(photo);
    return bookPhotoWorkAction(photo.id, {
      itemId: draft.itemId,
      pairs: Number(draft.pairs),
      color: draft.color,
      size: draft.size,
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
                              {photo.robot && !photo.robot.missing ? (
                                <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-black text-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
                                  🤖 {text("Robot's guess", "रोबोटको अनुमान")}: {items.find((item) => item.id === photo.robot?.itemId)?.name ?? text("shoe not known", "जुत्ता चिनेन")}
                                  {photo.robot.color ? ` · ${photo.robot.color}` : ""}
                                  {photo.robot.pairs ? text(` · about ${photo.robot.pairs} pairs`, ` · लगभग ${photo.robot.pairs} जोडी`) : ""}
                                  <span className="block text-xs font-semibold">
                                    {text("A guess only — check the shoe and count the pairs.", "अनुमान मात्र — जुत्ता हेर्नुहोस्, जोडी गन्नुहोस्।")}
                                  </span>
                                </p>
                              ) : null}
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
                                  <span>{text("Shoe", "जुत्ता")}{byRobot(photo, "itemId") ? " 🤖" : ""}</span>
                                  <select value={draft.itemId} onChange={(event) => changeItem(photo, event.target.value)} className={`min-h-11 rounded-xl border px-2 text-sm font-normal ${byRobot(photo, "itemId") ? "border-sky-600 bg-sky-50 dark:bg-sky-950/40" : "border-brand-green-line bg-brand-paper"}`}>
                                    <option value="">{text("— choose —", "— छान्नुहोस् —")}</option>
                                    {items.map((item) => (
                                      <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="grid gap-1 text-xs font-black">
                                  <span>{text("Pairs", "जोडी")}{byRobot(photo, "pairs") ? text(" 🤖 — check", " 🤖 — गन्नुहोस्") : ""}</span>
                                  <input value={draft.pairs} onChange={(event) => change(photo, { pairs: event.target.value })} inputMode="numeric" className={`min-h-11 rounded-xl border px-2 text-sm font-normal ${byRobot(photo, "pairs") ? "border-sky-600 bg-sky-50 dark:bg-sky-950/40" : "border-brand-green-line bg-brand-paper"}`} />
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
                              <div className="grid gap-2">
                                <div className="grid gap-1 text-xs font-black">
                                  <span>{text("Colour", "रङ")}{byRobot(photo, "color") ? " 🤖" : ""}</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {[...new Set([photo.robot?.color, ...(history[draft.itemId]?.colors ?? [])].filter((colour): colour is string => Boolean(colour)))].map((colour) => (
                                      <button key={colour} type="button" aria-pressed={draft.color === colour} onClick={() => change(photo, { color: colour })} className={`min-h-9 rounded-full border px-3 text-xs font-black ${draft.color === colour ? "border-brand-green-ink bg-brand-green-ink text-white" : "border-brand-green-line"}`}>
                                        {colour}{colour === photo.robot?.color ? " 🤖" : colour === history[draft.itemId]?.color ? text(" · last time", " · पहिले") : ""}
                                      </button>
                                    ))}
                                    <input value={draft.color} onChange={(event) => change(photo, { color: event.target.value })} maxLength={40} placeholder={text("or type", "वा लेख्नुहोस्")} aria-label={text("Colour", "रङ")} className="min-h-9 w-32 rounded-full border border-brand-green-line bg-brand-paper px-3 text-xs font-normal" />
                                  </div>
                                </div>
                                <div className="grid gap-1 text-xs font-black">
                                  <span>{text("Size", "साइज")}</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {history[draft.itemId]?.size ? (
                                      <button type="button" aria-pressed={draft.size === history[draft.itemId].size} onClick={() => change(photo, { size: history[draft.itemId].size })} className={`min-h-9 rounded-full border px-3 text-xs font-black ${draft.size === history[draft.itemId].size ? "border-brand-green-ink bg-brand-green-ink text-white" : "border-brand-green-line"}`}>
                                        {history[draft.itemId].size}{text(" · last time", " · पहिले")}
                                      </button>
                                    ) : null}
                                    {sizesOf(history[draft.itemId]?.size ?? "").map((single) => (
                                      <button key={single} type="button" aria-pressed={draft.size === single} onClick={() => change(photo, { size: single })} className={`min-h-9 rounded-full border px-3 text-xs font-black ${draft.size === single ? "border-brand-green-ink bg-brand-green-ink text-white" : "border-brand-green-line"}`}>
                                        {single}
                                      </button>
                                    ))}
                                    <input value={draft.size} onChange={(event) => change(photo, { size: event.target.value })} maxLength={80} placeholder={text("e.g. 36, 37, 38", "जस्तै 36, 37, 38")} aria-label={text("Size", "साइज")} className="min-h-9 w-40 rounded-full border border-brand-green-line bg-brand-paper px-3 text-xs font-normal" />
                                  </div>
                                </div>
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
                              <>
                                <button type="button" disabled={pending || !price?.rate || !complete(draft)} onClick={() => run(() => book(photo), () => setOpen(null))} className="min-h-11 rounded-xl bg-brand-green px-4 text-sm font-black text-white disabled:opacity-50">
                                  {text("✓ Put on the books", "✓ हिसाबमा थप्ने")}
                                </button>
                                {price?.rate && !complete(draft) ? (
                                  <span className="self-center text-sm font-bold text-amber-800">
                                    {!draft.color.trim() ? text("Choose the colour", "रङ छान्नुहोस्") : text("Choose the size", "साइज छान्नुहोस्")}
                                  </span>
                                ) : null}
                              </>
                            ) : null}
                            {robotOn && photo.status !== "added" && photo.kind !== "problem" && (!photo.robot || photo.robot.missing) ? (
                              <button type="button" disabled={pending} onClick={() => run(() => robotPhotoAction(photo.id))} className="min-h-11 rounded-xl border border-sky-600 px-4 text-sm font-black text-sky-900 disabled:opacity-50 dark:text-sky-100">
                                🤖 {text("Ask the robot", "रोबोटलाई सोध्ने")}
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
                      ) : photo.status !== "added" && photo.kind !== "problem" && photo.verdict !== "not_work" && (!draftOf(photo).itemId || !draftOf(photo).pairs) ? (
                        // Half-told (owner, 2026-10-03): say what is missing on
                        // the card, and let a wrong one be called not work
                        // without first filling it in.
                        <div className="grid gap-2">
                          <p className="w-max rounded-full bg-amber-100 px-3 py-0.5 text-xs font-black text-amber-900">
                            ⚠ {!draftOf(photo).itemId && !draftOf(photo).pairs
                              ? text("No shoe · no pairs", "जुत्ता र जोडी छैन")
                              : !draftOf(photo).itemId
                                ? text("No shoe", "जुत्ता छैन")
                                : text("No pairs", "जोडी छैन")}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setOpen(photo.id)} className="min-h-11 rounded-xl bg-brand-green px-3 text-sm font-black text-white">
                              {text("Fill in and check →", "भरेर जाँच्ने →")}
                            </button>
                            {reviewOn ? (
                              <button
                                type="button"
                                onClick={() => {
                                  change(photo, { work: false });
                                  setOpen(photo.id);
                                }}
                                className="min-h-11 rounded-xl border border-red-700 px-3 text-sm font-black text-red-800"
                              >
                                {text("✖ Not work", "✖ काम होइन")}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setOpen(photo.id)} className="min-h-11 rounded-xl bg-brand-green px-3 text-sm font-black text-white">
                          {photo.status === "added" || photo.kind === "problem"
                            ? text("Open", "खोल्ने")
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
