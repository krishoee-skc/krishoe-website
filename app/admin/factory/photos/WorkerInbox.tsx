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
  return run.split(/[,/\s]+/).map((size) => size.trim()).filter((size) => /^\d{1,2}$/.test(size));
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
  /** The "⋯ More" drawer of the open photo, and the photo a ✓ may be undone for. */
  const [more, setMore] = useState<string | null>(null);
  const [undo, setUndo] = useState<string | null>(null);

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
    { key: "problems", en: "Problems", ne: "समस्या" },
    { key: "hidden", en: "Hidden", ne: "लुकाइएका" },
  ];

  // The page at a glance (owner, 2026-10-03, "1 2 3 4"): how many wait, what
  // they would pay, and what went on the books this week.
  const allToCheck = photos.filter((photo) => tabOf(photo) === "check");
  const waitingRs = allToCheck.reduce((sum, photo) => sum + (bookable(photo) ? (quote(photo)?.amount ?? 0) : 0), 0);
  const [weekStart] = useState(() => nepalDay(new Date(Date.now() - 6 * 86_400_000).toISOString()));
  const bookedThisWeek = photos.filter((photo) => photo.status === "added" && (photo.workDate || nepalDay(photo.createdAt)) >= weekStart);
  const bookedRs = bookedThisWeek.reduce((sum, photo) => sum + (photo.amountEarned ?? 0), 0);
  const perWorker = (name: string) => photos.filter((photo) => photo.workerName === name && tabOf(photo) === "check").length;
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
  const shoeName = (itemId: string) => items.find((item) => item.id === itemId)?.name ?? "";
  const rs = (amount: number) => `Rs ${Math.round(amount).toLocaleString("en-IN")}`;

  /** ✓ one photo; the toast offers Undo, and the next photo to check opens. */
  const bookOne = (photo: WorkerPhoto) =>
    start(async () => {
      const reply = await book(photo);
      setNotice(reply);
      if (!reply.ok) return;
      setUndo(photo.id);
      setMore(null);
      const next = shown.find((other) => other.id !== photo.id && tabOf(other) === "check");
      setOpen((current) => (current === photo.id ? (next?.id ?? null) : current));
      router.refresh();
    });

  const step = (number: number, label: string) => (
    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-brand-muted">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-green-ink text-[11px] text-white">{number}</span>
      {label}
    </p>
  );
  const chip = (on: boolean) =>
    `min-h-9 rounded-full border px-3 text-xs font-black transition ${on ? "border-brand-green-ink bg-brand-green-ink text-white" : "border-brand-green-line bg-brand-paper text-brand-green-ink hover:border-brand-green"}`;

  return (
    <div className="grid gap-6">
      {/* 1 · The page at a glance. */}
      <section className="grid gap-3 rounded-3xl border border-brand-green-line bg-brand-paper p-4 shadow-[0_10px_30px_rgba(16,35,29,0.05)] sm:p-5">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className={`rounded-2xl px-3 py-2.5 ${counts.check > 0 ? "bg-red-50 dark:bg-red-950/30" : "border border-brand-green-line"}`}>
            <p className={`whitespace-nowrap text-xl font-black tabular-nums sm:text-3xl ${counts.check > 0 ? "text-brand-clay" : "text-brand-green"}`}>{allToCheck.length}</p>
            <p className="text-[10px] font-black uppercase leading-tight tracking-[0.04em] text-brand-muted sm:text-xs">{text("To check", "जाँच्न बाँकी")}</p>
          </div>
          <div className="rounded-2xl border border-brand-green-line px-3 py-2.5">
            <p className="whitespace-nowrap text-xl font-black tabular-nums text-brand-green-ink sm:text-3xl">{rs(waitingRs)}</p>
            <p className="text-[10px] font-black uppercase leading-tight tracking-[0.04em] text-brand-muted sm:text-xs">{text("Waiting to book", "चढ्न बाँकी")}</p>
          </div>
          <div className="rounded-2xl border border-brand-green-line px-3 py-2.5">
            <p className="whitespace-nowrap text-xl font-black tabular-nums text-brand-green sm:text-3xl">{bookedThisWeek.length}</p>
            <p className="text-[10px] font-black uppercase leading-tight tracking-[0.04em] text-brand-muted sm:text-xs">
              {text("Booked this week", "यो हप्ता चढेको")}{bookedRs > 0 ? ` · ${rs(bookedRs)}` : ""}
            </p>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-full bg-brand-paper-deep p-1 [scrollbar-width:none]" role="tablist" aria-label={text("Photos by state", "फोटो अवस्था अनुसार")}>
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-black transition ${tab === item.key ? "bg-brand-paper text-brand-green-ink shadow" : "text-brand-muted hover:text-brand-green-ink"}`}
            >
              {text(item.en, item.ne)}
              {item.key === "check" && counts.check > 0 ? (
                <span className="rounded-full bg-brand-clay px-1.5 text-[11px] leading-5 text-white">{counts.check}</span>
              ) : counts[item.key] > 0 ? (
                <span className="text-xs font-bold text-brand-muted">{counts[item.key]}</span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]" role="group" aria-label={text("Worker", "कामदार")}>
          <button type="button" aria-pressed={!who} onClick={() => setWho("")} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full border py-0.5 pl-0.5 pr-3 text-sm font-bold ${!who ? "border-brand-green bg-brand-green-wash text-brand-green-ink" : "border-brand-green-line text-brand-muted"}`}>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-green text-[11px] font-black text-white">{text("ALL", "सबै")}</span>
            {text("Everyone", "सबै कामदार")}
          </button>
          {workers.map((name) => (
            <button key={name} type="button" aria-pressed={who === name} onClick={() => setWho(who === name ? "" : name)} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-full border py-0.5 pl-0.5 pr-3 text-sm font-bold ${who === name ? "border-brand-green bg-brand-green-wash text-brand-green-ink" : "border-brand-green-line text-brand-muted"}`}>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-gold-deep text-[11px] font-black text-white">{initials(name)}</span>
              {name}{perWorker(name) > 0 ? ` · ${perWorker(name)}` : ""}
            </button>
          ))}
          {readyToBook.length > 1 ? (
            <button type="button" disabled={pending} onClick={bookAll} className="ml-auto min-h-10 shrink-0 rounded-full bg-brand-green px-4 text-sm font-black text-white disabled:opacity-60">
              {text(`✓ All ${readyToBook.length} ready`, `✓ तयार सबै ${readyToBook.length}`)}
            </button>
          ) : null}
        </div>

        {requests.length === 0 ? (
          <p className="text-sm text-brand-muted">{text("Questions and advances · none ✓", "प्रश्न र पेस्की · केही छैन ✓")}</p>
        ) : null}
        {!reviewOn ? (
          <p className="rounded-xl bg-brand-cream-soft px-3 py-2 text-sm font-bold text-brand-green-ink">
            {text("To check photos in full — work or not, stage, day, take back — press OK in Settings → Worker app.", "फोटो पूरा जाँच्न (काम हो कि होइन, चरण, दिन, फिर्ता) Settings → कामदारको app मा OK थिच्नुहोस्।")}
          </p>
        ) : null}
      </section>

      {requests.length > 0 ? (
      <section>
        <h2 className="text-xl font-black text-brand-green-ink">{text("Questions and advances", "हिसाबका प्रश्न र पेस्की")}</h2>
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
      </section>
      ) : null}

      <section className="grid gap-3">
        {shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-brand-green-line px-4 py-8 text-center text-sm text-brand-muted">
            {tab === "check" ? text("All checked ✓ Nothing waiting.", "सबै जाँचियो ✓ केही बाँकी छैन।") : text("Nothing here.", "यहाँ केही छैन।")}
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((photo) => {
              const draft = draftOf(photo);
              const price = quote(photo);
              const isOpen = open === photo.id;
              const ready = bookable(photo) && draft.work && complete(draft) && Boolean(price?.rate);
              const kind = KIND_WORDS[photo.kind];
              const shoe = shoeName(draft.itemId) || photo.itemName;
              return (
                <li key={photo.id} className={`rounded-3xl border bg-brand-paper shadow-[0_10px_30px_rgba(16,35,29,0.06)] ${photo.kind === "problem" ? "border-red-400" : "border-brand-green-line"} ${isOpen ? "sm:col-span-2 lg:col-span-3" : "overflow-hidden"}`}>
                  {!isOpen ? (
                    <>
                      <a href={photo.imageUrl} target="_blank" rel="noreferrer" className="relative block" aria-label={text("Open the photo full size", "फोटो ठूलो खोल्ने")}>
                        <img src={photo.imageUrl} alt={`${photo.workerName} — ${kind.en}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                        <span className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-black text-white backdrop-blur">{kind.icon} {text(kind.en, kind.ne)}</span>
                        {shoe || draft.pairs ? (
                          <span className="absolute inset-x-0 bottom-0 flex justify-between gap-2 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-8 text-sm font-black text-white">
                            <span className="truncate">{shoe}</span>
                            <span className="shrink-0">{draft.pairs ? `${draft.pairs} ${text("pairs", "जोडी")}` : ""}</span>
                          </span>
                        ) : null}
                      </a>
                      <div className="grid gap-2.5 p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gold-deep text-[11px] font-black text-white">{initials(photo.workerName)}</span>
                          <span className="min-w-0 leading-tight">
                            <span className="block truncate text-sm font-black text-brand-green-ink">{photo.workerName}</span>
                            <span className="block text-xs text-brand-muted">{factoryCategoryLabel(photo.workerCategory, language === "ne")} · {when(photo.createdAt)}</span>
                          </span>
                        </div>
                        {photo.note || draft.color || draft.size ? (
                          <p className="text-xs text-brand-muted">
                            {[photo.note ? `“${photo.note}”` : "", draft.color, draft.size].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                        {photo.robot && !photo.robot.missing && !photo.itemId ? (
                          <p className="rounded-xl bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-900 dark:bg-sky-950/40 dark:text-sky-100">🤖 {text("Robot filled — check", "रोबोटले भर्‍यो — जाँच्नुहोस्")}</p>
                        ) : null}

                        {photo.status === "added" ? (
                          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">
                            {text("On the books ✓", "हिसाबमा ✓")}
                            {photo.amountEarned !== null ? ` · ${rs(photo.amountEarned)}` : ""}
                            {photo.workDate ? ` · ${photo.workDate}` : ""}
                          </p>
                        ) : photo.verdict === "not_work" ? (
                          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-800">✖ {text("Not work", "काम होइन")}{photo.reply ? ` — “${photo.reply}”` : ""}</p>
                        ) : null}

                        {ready ? (
                          <div className="grid gap-2">
                            <button type="button" disabled={pending} onClick={() => bookOne(photo)} className="flex min-h-12 items-center justify-between gap-2 rounded-2xl bg-brand-green px-4 text-sm font-black text-white shadow-[0_8px_20px_rgba(11,77,59,0.25)] disabled:opacity-50">
                              <span>{text("✓ Put on the books", "✓ हिसाबमा थप्ने")}</span>
                              <span className="tabular-nums opacity-90">{rs(price?.amount ?? 0)}</span>
                            </button>
                            <button type="button" onClick={() => setOpen(photo.id)} className="min-h-10 rounded-2xl border border-brand-green-line text-sm font-black text-brand-green-ink">
                              {text("Open to change", "खोलेर फेर्ने")}
                            </button>
                          </div>
                        ) : photo.status !== "added" && photo.kind !== "problem" && photo.verdict !== "not_work" && (!draft.itemId || !draft.pairs) ? (
                          <div className="grid gap-2">
                            <p className="w-max rounded-full bg-amber-100 px-3 py-0.5 text-xs font-black text-amber-900">
                              ⚠ {!draft.itemId && !draft.pairs
                                ? text("No shoe · no pairs", "जुत्ता र जोडी छैन")
                                : !draft.itemId
                                  ? text("No shoe", "जुत्ता छैन")
                                  : text("No pairs", "जोडी छैन")}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => setOpen(photo.id)} className="min-h-11 flex-1 rounded-2xl bg-brand-green px-3 text-sm font-black text-white">
                                {text("Fill in and check →", "भरेर जाँच्ने →")}
                              </button>
                              {reviewOn ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    change(photo, { work: false });
                                    setOpen(photo.id);
                                  }}
                                  className="min-h-11 rounded-2xl border border-red-700 px-3 text-sm font-black text-red-800"
                                >
                                  {text("✖ Not work", "✖ काम होइन")}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setOpen(photo.id)} className={`min-h-11 rounded-2xl px-3 text-sm font-black ${photo.status === "added" || photo.kind === "problem" || photo.verdict === "not_work" ? "border border-brand-green-line text-brand-green-ink" : "bg-brand-green text-white"}`}>
                            {photo.status === "added" || photo.kind === "problem" || photo.verdict === "not_work" ? text("Open", "खोल्ने") : text("Check ✓ →", "जाँच्ने ✓ →")}
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="grid gap-4 p-3 sm:p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                      <a href={photo.imageUrl} target="_blank" rel="noreferrer" className="relative block self-start overflow-hidden rounded-2xl bg-black/5" aria-label={text("Open the photo full size", "फोटो ठूलो खोल्ने")}>
                        <img src={photo.imageUrl} alt={`${photo.workerName} — ${kind.en}`} className="max-h-[34rem] w-full object-contain" />
                        <span className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-black text-white backdrop-blur">🔍 {text("Full size", "ठूलो हेर्ने")}</span>
                      </a>

                      <div className="grid content-start gap-4">
                        <div className="flex items-center gap-2">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-gold-deep text-xs font-black text-white">{initials(photo.workerName)}</span>
                          <span className="min-w-0 leading-tight">
                            <span className="block text-base font-black text-brand-green-ink">{photo.workerName} · {kind.icon} {text(kind.en, kind.ne)}</span>
                            <span className="block text-xs text-brand-muted">{factoryCategoryLabel(photo.workerCategory, language === "ne")} · {when(photo.createdAt)}</span>
                          </span>
                        </div>
                        {photo.note ? <p className="text-sm text-brand-green-ink">“{photo.note}”</p> : null}
                        {photo.robot && !photo.robot.missing && photo.status !== "added" ? (
                          <p className="rounded-2xl bg-sky-50 px-3 py-2 text-sm font-black text-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
                            🤖 {text("Robot's guess", "रोबोटको अनुमान")}: {shoeName(photo.robot.itemId) || text("shoe not known", "जुत्ता चिनेन")}
                            {photo.robot.color ? ` · ${photo.robot.color}` : ""}
                            {photo.robot.pairs ? text(` · about ${photo.robot.pairs} pairs`, ` · लगभग ${photo.robot.pairs} जोडी`) : ""}
                            <span className="block text-xs font-semibold">{text("A guess only — check the shoe and count the pairs.", "अनुमान मात्र — जुत्ता हेर्नुहोस्, जोडी गन्नुहोस्।")}</span>
                          </p>
                        ) : null}

                        {photo.status === "added" ? (
                          <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">
                            {text("On the books ✓", "हिसाबमा ✓")}
                            {photo.amountEarned !== null ? ` · ${rs(photo.amountEarned)}` : ""}
                            {photo.workDate ? ` · ${photo.workDate}` : ""}
                          </p>
                        ) : null}

                        {photo.status !== "added" && reviewOn ? (
                          <div className="grid gap-2">
                            {step(1, text("Work", "काम"))}
                            <div className="flex flex-wrap gap-2" role="group" aria-label={text("Work or not", "काम हो कि होइन")}>
                              <button type="button" aria-pressed={draft.work} onClick={() => change(photo, { work: true })} className={`min-h-10 rounded-full border px-4 text-sm font-black ${draft.work ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line"}`}>
                                ✅ {text("Work", "काम हो")}
                              </button>
                              <button type="button" aria-pressed={!draft.work} onClick={() => change(photo, { work: false })} className={`min-h-10 rounded-full border px-4 text-sm font-black ${!draft.work ? "border-red-700 bg-red-700 text-white" : "border-brand-green-line"}`}>
                                ✖ {text("Not work", "काम होइन")}
                              </button>
                            </div>
                          </div>
                        ) : null}

                        {photo.status !== "added" && draft.work && bookable(photo) ? (
                          <>
                            <div className="grid gap-2">
                              {step(2, text("What · how many", "के · कति"))}
                              <label className="grid gap-1 text-xs font-black">
                                <span>{text("Shoe", "जुत्ता")}{byRobot(photo, "itemId") ? " 🤖" : ""}</span>
                                <select value={draft.itemId} onChange={(event) => changeItem(photo, event.target.value)} className={`min-h-11 rounded-xl border px-2 text-sm font-normal ${byRobot(photo, "itemId") ? "border-sky-600 bg-sky-50 dark:bg-sky-950/40" : "border-brand-green-line bg-brand-paper"}`}>
                                  <option value="">{text("— choose —", "— छान्नुहोस् —")}</option>
                                  {items.map((item) => (
                                    <option key={item.id} value={item.id}>{item.name}</option>
                                  ))}
                                </select>
                              </label>
                              <div className="grid gap-1 text-xs font-black">
                                <span>{text("Pairs", "जोडी")}{byRobot(photo, "pairs") ? text(" 🤖 — count them", " 🤖 — गन्नुहोस्") : ""}</span>
                                <div className="flex items-center gap-2">
                                  <button type="button" aria-label={text("One pair fewer", "एक जोडी घटाउने")} onClick={() => change(photo, { pairs: String(Math.max(0, (Number(draft.pairs) || 0) - 1)) })} className="grid h-11 w-11 place-items-center rounded-xl border border-brand-green-line text-lg">−</button>
                                  <input value={draft.pairs} onChange={(event) => change(photo, { pairs: event.target.value })} inputMode="numeric" aria-label={text("Pairs", "जोडी")} className={`min-h-11 w-24 rounded-xl border px-2 text-center text-xl font-black tabular-nums ${byRobot(photo, "pairs") ? "border-sky-600 bg-sky-50 dark:bg-sky-950/40" : "border-brand-green-line bg-brand-paper"}`} />
                                  <button type="button" aria-label={text("One pair more", "एक जोडी थप्ने")} onClick={() => change(photo, { pairs: String((Number(draft.pairs) || 0) + 1) })} className="grid h-11 w-11 place-items-center rounded-xl border border-brand-green-line text-lg">+</button>
                                </div>
                              </div>
                            </div>

                            <div className="grid gap-2">
                              {step(3, text("Colour · size", "रङ · साइज"))}
                              <div className="flex flex-wrap gap-1.5" role="group" aria-label={text("Colour", "रङ")}>
                                {[...new Set([photo.robot?.color, ...(history[draft.itemId]?.colors ?? [])].filter((colour): colour is string => Boolean(colour)))].map((colour) => (
                                  <button key={colour} type="button" aria-pressed={draft.color === colour} onClick={() => change(photo, { color: colour })} className={chip(draft.color === colour)}>
                                    {colour}{colour === photo.robot?.color ? " 🤖" : colour === history[draft.itemId]?.color ? text(" · last time", " · पहिले") : ""}
                                  </button>
                                ))}
                                <input value={draft.color} onChange={(event) => change(photo, { color: event.target.value })} maxLength={40} placeholder={text("colour", "रङ")} aria-label={text("Colour", "रङ")} className="min-h-9 w-28 rounded-full border border-brand-green-line bg-brand-paper px-3 text-xs" />
                              </div>
                              <div className="flex flex-wrap gap-1.5" role="group" aria-label={text("Size", "साइज")}>
                                {history[draft.itemId]?.size ? (
                                  <button type="button" aria-pressed={draft.size === history[draft.itemId].size} onClick={() => change(photo, { size: history[draft.itemId].size })} className={chip(draft.size === history[draft.itemId].size)}>
                                    {history[draft.itemId].size}{text(" · last time", " · पहिले")}
                                  </button>
                                ) : null}
                                {sizesOf(history[draft.itemId]?.size ?? "").map((single) => (
                                  <button key={single} type="button" aria-pressed={draft.size === single} onClick={() => change(photo, { size: single })} className={chip(draft.size === single)}>
                                    {single}
                                  </button>
                                ))}
                                <input value={draft.size} onChange={(event) => change(photo, { size: event.target.value })} maxLength={80} placeholder={text("e.g. 36, 37, 38", "जस्तै 36, 37, 38")} aria-label={text("Size", "साइज")} className="min-h-9 w-36 rounded-full border border-brand-green-line bg-brand-paper px-3 text-xs" />
                              </div>
                            </div>

                            <div className="grid gap-2">
                              {step(4, text("Stage · day", "चरण · दिन"))}
                              <div className="flex flex-wrap gap-1.5" role="group" aria-label={text("Which work", "कुन काम")}>
                                {STAGES.map((stage) => (
                                  <button key={stage} type="button" aria-pressed={draft.stage === stage} disabled={!reviewOn} onClick={() => change(photo, { stage })} className={chip(draft.stage === stage)}>
                                    {factoryCategoryLabel(stage, language === "ne")}
                                  </button>
                                ))}
                              </div>
                              {reviewOn ? (
                                <div className="grid grid-cols-2 gap-2">
                                  <label className="grid gap-1 text-xs font-black">
                                    {text("Day of the work", "कामको दिन")}
                                    <input type="date" value={draft.workDate} max={nepalDay(new Date().toISOString())} onChange={(event) => change(photo, { workDate: event.target.value })} className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-2 text-sm font-normal" />
                                  </label>
                                  <label className="grid gap-1 text-xs font-black">
                                    {text("Damaged pairs", "बिग्रिएको जोडी")}
                                    <input value={draft.rejects} onChange={(event) => change(photo, { rejects: event.target.value })} inputMode="numeric" className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-2 text-sm font-normal" />
                                  </label>
                                </div>
                              ) : null}
                            </div>
                          </>
                        ) : null}

                        {photo.status !== "added" && !draft.work && reviewOn ? (
                          <div className="grid gap-2">
                            {step(2, text("Why not", "किन होइन"))}
                            <select value={draft.reason} onChange={(event) => change(photo, { reason: event.target.value })} aria-label={text("Why not (the worker sees this)", "किन होइन (कामदारले देख्छ)")} className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-2 text-sm">
                              {NOT_WORK_REASONS.map((reason) => (
                                <option key={reason.ne} value={reason.ne}>{text(reason.en, reason.ne)}</option>
                              ))}
                            </select>
                            <input value={draft.message} onChange={(event) => change(photo, { message: event.target.value })} maxLength={200} placeholder={text("A word to the worker (optional)", "कामदारलाई सन्देश (नभरे पनि हुन्छ)")} aria-label={text("A word to the worker", "कामदारलाई सन्देश")} className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-2 text-sm" />
                          </div>
                        ) : null}

                        {photo.history.length > 0 ? (
                          <ul className="grid gap-0.5 border-t border-brand-green-line pt-2 text-xs text-brand-muted">
                            <li>{when(photo.createdAt)} · {photo.workerName} {text("sent it", "ले पठायो")}</li>
                            {photo.history.map((line, index) => (
                              <li key={`${line.at}-${index}`}>{when(line.at)} · {line.by} · {line.what}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>

                      {/* The amount and the one button, together — fixed to the
                          bottom of a phone so ✓ is never a scroll away. */}
                      <div className="sticky bottom-24 z-10 -mx-3 grid gap-2 rounded-b-3xl border-t border-brand-green-line bg-brand-paper/95 px-3 py-3 backdrop-blur sm:-mx-4 sm:px-4 md:static md:col-span-2 md:mx-0 md:rounded-none md:bg-transparent md:px-0 md:pb-0">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="leading-tight">
                            {photo.status !== "added" && draft.work && bookable(photo) ? (
                              <>
                                <p className={`text-2xl font-black tabular-nums ${price?.rate ? "text-brand-green" : "text-brand-muted"}`}>{price?.rate ? rs(price.amount) : "—"}</p>
                                <p className="text-xs text-brand-muted">
                                  {!price
                                    ? text("Choose the shoe and the pairs.", "जुत्ता र जोडी छान्नुहोस्।")
                                    : price.rate
                                      ? text(`${draft.pairs} pairs × Rs ${price.rate}`, `${draft.pairs} जोडी × Rs ${price.rate}`)
                                      : text("No rate for this shoe and work — set it in Items first.", "यो जुत्ता र कामको दर छैन — पहिले Items मा दर राख्नुहोस्।")}
                                </p>
                              </>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button type="button" aria-expanded={more === photo.id} onClick={() => setMore(more === photo.id ? null : photo.id)} className="min-h-11 rounded-2xl border border-brand-green-line px-3 text-sm font-black text-brand-muted">
                              ⋯ {text("More", "अरू")}
                            </button>
                            {photo.status !== "added" && draft.work && bookable(photo) ? (
                              <button type="button" disabled={pending || !price?.rate || !complete(draft)} onClick={() => bookOne(photo)} className="min-h-12 rounded-2xl bg-brand-green px-5 text-base font-black text-white shadow-[0_8px_20px_rgba(11,77,59,0.25)] disabled:opacity-50">
                                {text("✓ Put on the books", "✓ हिसाबमा थप्ने")}
                              </button>
                            ) : null}
                            {photo.status !== "added" && !draft.work && reviewOn ? (
                              <button type="button" disabled={pending} onClick={() => run(() => notWorkPhotoAction(photo.id, draft.reason, draft.message), () => setOpen(null))} className="min-h-12 rounded-2xl bg-red-700 px-5 text-base font-black text-white disabled:opacity-50">
                                {text("✖ Mark: not work", "✖ काम होइन भन्ने")}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        {photo.status !== "added" && draft.work && bookable(photo) && price?.rate && !complete(draft) ? (
                          <p className="text-right text-sm font-bold text-amber-800">
                            {!draft.color.trim() ? text("Choose the colour", "रङ छान्नुहोस्") : text("Choose the size", "साइज छान्नुहोस्")}
                          </p>
                        ) : null}
                        {more === photo.id ? (
                          <div className="grid gap-2 rounded-2xl border border-brand-green-line bg-brand-paper p-3">
                            {photo.status !== "added" && draft.work && reviewOn ? (
                              <input value={draft.message} onChange={(event) => change(photo, { message: event.target.value })} maxLength={200} placeholder={text("A word to the worker (optional)", "कामदारलाई सन्देश (नभरे पनि हुन्छ)")} aria-label={text("A word to the worker", "कामदारलाई सन्देश")} className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-2 text-sm" />
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              {robotOn && photo.status !== "added" && photo.kind !== "problem" && (!photo.robot || photo.robot.missing) ? (
                                <button type="button" disabled={pending} onClick={() => run(() => robotPhotoAction(photo.id))} className="min-h-11 rounded-xl border border-sky-600 px-4 text-sm font-black text-sky-900 disabled:opacity-50 dark:text-sky-100">
                                  🤖 {text("Ask the robot", "रोबोटलाई सोध्ने")}
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
                              <button type="button" onClick={() => { setOpen(null); setMore(null); }} className="min-h-11 rounded-xl px-3 text-sm font-bold text-brand-muted">
                                {text("Close", "बन्द")}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* What just happened, at the foot of the screen; after a ✓, the owner
          may undo it on the spot (the same take-back, reason in the audit). */}
      {notice ? (
        <div role="status" className={`fixed inset-x-4 bottom-28 z-50 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-bold shadow-2xl md:inset-x-auto md:bottom-6 md:right-6 md:w-[28rem] ${notice.ok ? "bg-brand-green-ink text-white" : "bg-red-700 text-white"}`}>
          <span>{text(notice.en, notice.ne)}</span>
          <span className="flex shrink-0 items-center gap-3">
            {notice.ok && undo && canAnswer && reviewOn ? (
              <button type="button" disabled={pending} onClick={() => { const id = undo; setUndo(null); run(() => takeBackPhotoWorkAction(id)); }} className="font-black text-emerald-200 underline underline-offset-4">
                {text("Undo", "फिर्ता")}
              </button>
            ) : null}
            <button type="button" aria-label={text("Close", "बन्द")} onClick={() => { setNotice(null); setUndo(null); }} className="text-lg leading-none">×</button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
