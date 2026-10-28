"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import OwnerSummary from "@/components/admin/OwnerSummary";
import type { StockOverview } from "@/lib/dashboard-figures";

/**
 * The owner's dashboard — the page everybody's eye lands on. The owner chose on
 * 2026-09-28 a mix of two samples: the news strip and the shop/factory halves
 * of one, the day's money and "what now" list of the other, with a seven-day
 * chart under it all.
 *
 * Every figure is worked out on the server; this component only arranges it
 * and makes it move: numbers count up, the clock runs, the strip turns over,
 * today / 7 days / month switches the money, a job can be ticked off for the
 * day, and B, W and P open a bill, the work sheet and a purchase bill.
 */
export type Todo = {
  key: string;
  tone: "red" | "blue" | "gold" | "green";
  en: string;
  ne: string;
  subEn: string;
  subNe: string;
  href: string;
};

export type OwnerDashboardProps = {
  dateEn: string;
  dateNe: string;
  monthEn: string;
  monthNe: string;
  today: { net: number; bills: number; pairs: number; retail: number; wholesale: number; online: number; newOrders: number };
  /** What was actually taken in today, next to the sales figure. */
  collected: number;
  week: number;
  month: number;
  /** The month's sales goal in rupees, 0 when none is set. */
  salesGoal: number;
  daysInMonth: number;
  todos: Todo[];
  kpis: { salesLessPurchases: number; stockValue: number; stockPairs: number; creditOwed: number; workerDue: number };
  stock: StockOverview;
  /** todayPairs: pairs posted to stock today. stages: today's work per stage, never summed. */
  factory: { todayPairs: number; stages?: Array<{ stage: string; pairs: number }>; atFactory: number; atShop: number; mismatched: number };
  days: Array<{ key: string; en: string; ne: string; net: number; today: boolean }>;
};

type Period = "today" | "week" | "month";

const CURRENCY = { en: "Rs.", ne: "रु." };
const rupees = (value: number, language: string) =>
  `${language === "ne" ? CURRENCY.ne : CURRENCY.en} ${Math.round(value).toLocaleString("en-IN")}`;

/** Counts up to `to` once, and again whenever `to` changes. */
function useCountUp(to: number) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || to === 0) {
      const id = requestAnimationFrame(() => setShown(to));
      return () => cancelAnimationFrame(id);
    }
    let frame = 0;
    const start = performance.now();
    const step = (time: number) => {
      const k = Math.min(1, (time - start) / 900);
      setShown(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [to]);
  return shown;
}

function Money({ value, className }: { value: number; className?: string }) {
  const { language } = useLanguage();
  const shown = useCountUp(value);
  return <span className={`tabular-nums ${className ?? ""}`}>{rupees(shown, language)}</span>;
}

function Count({ value, className }: { value: number; className?: string }) {
  const shown = useCountUp(value);
  return <span className={`tabular-nums ${className ?? ""}`}>{Math.round(shown).toLocaleString("en-IN")}</span>;
}

function useNepalClock() {
  const [now, setNow] = useState("");
  useEffect(() => {
    const format = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kathmandu",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const tick = () => setNow(format.format(new Date()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export default function OwnerDashboard(props: OwnerDashboardProps) {
  const { text, language } = useLanguage();
  const router = useRouter();
  const clock = useNepalClock();
  const hour = Number(clock.slice(0, 2));
  const [period, setPeriod] = useState<Period>("today");

  // Jobs ticked off stay ticked for the rest of the Nepal day on this device.
  const dayKey = props.days.find((day) => day.today)?.key ?? "";
  const storeKey = `krishoe-dashboard-done-${dayKey}`;
  const [done, setDone] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storeKey);
      if (saved) {
        const keys = JSON.parse(saved) as string[];
        const id = requestAnimationFrame(() => setDone(new Set(keys)));
        return () => cancelAnimationFrame(id);
      }
    } catch {
      // Private window or blocked storage: the list simply starts unticked.
    }
    return undefined;
  }, [storeKey]);
  function toggleDone(key: string) {
    setDone((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.localStorage.setItem(storeKey, JSON.stringify([...next]));
      } catch {
        // Nothing to do: ticking still works for this visit.
      }
      return next;
    });
  }
  const left = props.todos.filter((todo) => !done.has(todo.key)).length;

  // B, W and P — the three jobs of the day — from anywhere on the page.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();
      if (key === "b") router.push("/admin/pos");
      if (key === "w") router.push("/admin/factory/add-work");
      if (key === "p") router.push("/admin/purchasing");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  // The news strip, built from the day's own facts.
  const news = useMemo(() => {
    const items: Array<{ en: string; ne: string }> = [];
    if (props.today.bills > 0) {
      items.push({ en: `🛒 ${props.today.bills} bills today · ${rupees(props.today.net, "en")}`, ne: `🛒 आज ${props.today.bills} बिल · ${rupees(props.today.net, "ne")}` });
    } else {
      items.push({ en: "🛒 No bill cut yet today", ne: "🛒 आज अहिलेसम्म बिल काटिएको छैन" });
    }
    if (props.factory.todayPairs > 0) {
      items.push({ en: `🏭 ${props.factory.todayPairs} pairs into stock today`, ne: `🏭 आज कारखानाबाट ${props.factory.todayPairs} जोडी स्टकमा चढे` });
    }
    // The month's sales less purchases is not told here: it sits hidden in its
    // tile below until the Owner asks to see it.
    for (const todo of props.todos.slice(0, 4)) items.push({ en: `• ${todo.en}`, ne: `• ${todo.ne}` });
    return items;
  }, [props.today, props.factory.todayPairs, props.todos]);
  // The four figures start hidden on every visit (owner, 2026-10-01: "not
  // shown always, but there when I want to look"). Kept in memory only, so
  // leaving the page hides them again.
  const [openFigures, setOpenFigures] = useState<Set<string>>(() => new Set());
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || news.length < 2) return;
    const id = window.setInterval(() => setTurn((value) => value + 1), 3200);
    return () => window.clearInterval(id);
  }, [news.length]);
  const headline = news[turn % news.length];

  // The money for the chosen stretch, and the goal ring beside it.
  const money = period === "today" ? props.today.net : period === "week" ? props.week : props.month;
  const target =
    props.salesGoal > 0
      ? period === "month"
        ? props.salesGoal
        : (props.salesGoal / Math.max(1, props.daysInMonth)) * (period === "week" ? 7 : 1)
      : 0;
  const share = target > 0 ? Math.min(1, Math.max(0, money / target)) : 0;
  const circumference = 2 * Math.PI * 26;
  const periodLabel = {
    today: text(`Sold today · ${props.dateEn}`, `आज बिक्री · ${props.dateNe}`),
    week: text("Sold in the last 7 days", "पछिल्ला ७ दिनको बिक्री"),
    month: text(`Sold in ${props.monthEn} so far`, `${props.monthNe} मा अहिलेसम्म`),
  }[period];

  // Seven-day bars.
  const maxDay = Math.max(1, ...props.days.map((day) => day.net));
  const [hoverDay, setHoverDay] = useState<string | null>(null);
  const stock = props.stock;
  // The seven with most pairs, then any website shoe sold out — that is news.
  const withPairs = stock.lines.filter((line) => line.total > 0);
  const shown = [...withPairs.slice(0, 7), ...stock.lines.filter((line) => line.web && line.total <= 0)];
  const rest = withPairs.slice(7);
  const restPairs = rest.reduce((sum, line) => sum + line.total, 0);
  const maxShoe = Math.max(1, ...shown.map((line) => line.total + line.over));
  const stockShare = (pairs: number) => (stock.all > 0 ? (pairs / stock.all) * 100 : 0);
  const stockTodos: Array<{ key: string; icon: string; tone: string; en: string; ne: string; goEn: string; goNe: string; href: string }> = [];
  // A place that does not match is said once, in What now (owner, 2026-10-12).
  if (stock.draftShoes > 0) {
    stockTodos.push({
      key: "drafts",
      icon: "📷",
      tone: "bg-brand-cream-soft text-brand-gold-ink",
      en: `${stock.draftShoes} ${stock.draftShoes === 1 ? "shoe" : "shoes"} · ${stock.draft} pairs not on the website — add a photo`,
      ne: `${stock.draftShoes} जुत्ता · ${stock.draft} जोडी वेबसाइटमा छैनन् — फोटो राख्ने`,
      goEn: "Drafts →",
      goNe: "Draft →",
      href: "/admin/stock#not-on-website",
    });
  }
  if (stock.noneAtShop.length > 0) {
    const atFactory = stock.noneAtShop.reduce((sum, shoe) => sum + shoe.factory, 0);
    stockTodos.push({
      key: "none-at-shop",
      icon: "🚚",
      tone: "bg-brand-green-wash text-brand-green",
      en: `${stock.noneAtShop.length} website ${stock.noneAtShop.length === 1 ? "shoe has" : "shoes have"} none at the shop (${atFactory} pairs at the factory)`,
      ne: `वेबसाइटका ${stock.noneAtShop.length} जुत्ता पसलमा छैनन् (कारखानामा ${atFactory} जोडी)`,
      goEn: "Send →",
      goNe: "पठाउने →",
      href: "/admin/stock#move-pairs",
    });
  }
  const greeting = Number.isNaN(hour) || clock === ""
    ? text("Hello", "नमस्ते")
    : hour < 12
      ? text("Good morning", "शुभ प्रभात")
      : hour < 17
        ? text("Good afternoon", "शुभ दिन")
        : text("Good evening", "शुभ साँझ");

  // What each job's button says (the dashboard sample, 2026-10-27): the card
  // is the reason, the button is the job.
  const actionLabel: Record<string, { en: string; ne: string }> = {
    "customer-voice": { en: "Reply", ne: "जवाफ दिने" },
    wages: { en: "Pay wages", ne: "ज्याला तिर्ने" },
    places: { en: "Check", ne: "जाँच्ने" },
    goal: { en: "Set goal", ne: "लक्ष्य राख्ने" },
    orders: { en: "Send", ne: "पठाउने" },
    post: { en: "Post to stock", ne: "स्टकमा चढाउने" },
  };
  const toneBorder: Record<Todo["tone"], string> = {
    red: "border-l-brand-clay",
    blue: "border-l-[#2458A6]",
    gold: "border-l-brand-gold",
    green: "border-l-brand-green",
  };
  const sentToShop = stock.noneAtShop.reduce((sum, shoe) => sum + shoe.factory, 0);
  const draftTodo = stockTodos.find((todo) => todo.key === "drafts");
  // The pairs bar: what the books hold at the factory and the shop, and the
  // pairs placed beyond the books beside them, so the shop is one number.
  const placedAll = Math.max(1, stock.factory + stock.shop + stock.onRoad + stock.over + stock.noPlace);
  const placedShare = (pairs: number) => (pairs / placedAll) * 100;

  return (
    <div className="grid gap-4">
      {/* ── Hello, and the day's jobs ──────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl font-black leading-none text-brand-green-ink">
            {greeting}{" "}
            <span className="text-sm font-bold text-brand-muted">
              {text(props.dateEn, props.dateNe)} · <span className="tabular-nums">{clock || "--:--"}</span>
            </span>
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-bold text-brand-muted">
            <a
              href="#what-now"
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-black ${
                left > 0 ? "bg-brand-clay text-white" : "bg-brand-green-wash text-brand-green"
              }`}
            >
              {left > 0 ? text(`${left} to do`, `${left} काम बाँकी`) : text("✓ All clear", "✓ सबै सकियो")}
            </a>
            <span aria-live="polite" className="min-w-0 truncate text-brand-green-ink" key={turn}>
              {headline ? text(headline.en, headline.ne) : null}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#0B3F30] p-2 shadow-sm">
          {[
            { href: "/admin/pos", key: "B", en: "🧾 Cut a bill", ne: "🧾 बिल काट्ने", first: true },
            { href: "/admin/factory/add-work", key: "W", en: "📝 Add work", ne: "📝 काम टिप्ने", first: false },
            { href: "/admin/purchasing", key: "P", en: "🛒 Purchase", ne: "🛒 खरिद", first: false },
          ].map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-[0.9375rem] font-black transition hover:-translate-y-0.5 ${
                action.first ? "bg-brand-gold text-[#1A1A1A]" : "border border-white/25 text-white hover:bg-white/10"
              }`}
            >
              {text(action.en, action.ne)}
              <kbd className="hidden rounded border border-current/40 px-1 text-xs font-bold opacity-75 sm:inline">{action.key}</kbd>
            </Link>
          ))}
          {/* The week against the week before, in one place: bills, pairs
              made, purchases, online orders, stock in and out (owner, from
              the app audit, 2026-10-27). The report already counts them. */}
          <Link
            href="/admin/reports?period=week"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 px-3.5 text-[0.9375rem] font-black text-white transition hover:bg-white/10"
          >
            {text("📊 This week vs last", "📊 यो हप्ता र अघिल्लो")}
          </Link>
        </div>
      </div>

      {/* The day as one journey (owner, 2026-10-27, the dashboard sample):
          made → sent to the shop → sold → taken in, and the goal. On a phone
          What now comes first, above it (owner, 2026-10-01, asked again
          2026-10-27). */}
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-brand-green-line bg-brand-green-line shadow-sm lg:grid-cols-[repeat(4,minmax(0,1fr))_10rem]">
          {/* 🏭 Made */}
          <div className="relative grid content-start gap-1 bg-brand-paper p-4">
            <span className="text-xs font-black uppercase tracking-wide text-brand-muted">{text("🏭 Made · today", "🏭 बन्यो · आज")}</span>
            <p>
              <Count value={props.factory.todayPairs} className="font-display text-3xl font-black text-brand-green-ink" />{" "}
              <span className="text-xs font-bold text-brand-muted">{text("pairs into stock today", "जोडी आज स्टकमा चढे")}</span>
            </p>
            {/* Each stage on its own: one pair through Upper and Fibermen is two
                entries, and adding them up doubled the day. */}
            {props.factory.stages?.length ? (
              <p className="flex flex-wrap items-center gap-1 text-xs font-bold text-brand-muted">
                <span>{text("Work today:", "आजको काम:")}</span>
                {props.factory.stages.map((entry) => (
                  <span key={entry.stage} className="rounded-full border border-brand-green-line px-1.5 tabular-nums text-brand-green-ink">
                    {entry.stage} {entry.pairs}
                  </span>
                ))}
              </p>
            ) : null}
            <Link href="/admin/factory/add-work" className="text-sm font-black text-brand-green">{text("Add work →", "काम टिप्ने →")}</Link>
            <span aria-hidden="true" className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 font-black text-brand-gold lg:block">→</span>
          </div>

          {/* 🚚 Sent to the shop */}
          <div className="relative grid content-start gap-1 bg-brand-paper p-4">
            <span className="text-xs font-black uppercase tracking-wide text-brand-muted">{text("🚚 Sent to shop", "🚚 पसलमा पठाउने")}</span>
            {stock.noneAtShop.length > 0 ? (
              <>
                <p>
                  <Count value={stock.noneAtShop.length} className="font-display text-3xl font-black text-brand-green-ink" />{" "}
                  <span className="text-xs font-bold text-brand-muted">
                    {text(
                      `website ${stock.noneAtShop.length === 1 ? "shoe has" : "shoes have"} none at the shop`,
                      "वेबसाइटका जुत्ता पसलमा छैनन्",
                    )}
                  </span>
                </p>
                <span className="text-xs font-bold text-brand-muted">{text(`${sentToShop} pairs at the factory`, `कारखानामा ${sentToShop} जोडी`)}</span>
                <Link href="/admin/stock#move-pairs" className="text-sm font-black text-brand-green">{text("Send →", "पठाउने →")}</Link>
              </>
            ) : (
              <p className="text-sm font-bold text-brand-green">{text("✓ Every website shoe is at the shop", "✓ वेबसाइटका सबै जुत्ता पसलमा छन्")}</p>
            )}
            <span aria-hidden="true" className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 font-black text-brand-gold lg:block">→</span>
          </div>

          {/* 🛒 Sold */}
          <div className="relative col-span-2 grid content-start gap-1 bg-brand-paper p-4 lg:col-span-1">
            <div className="grid gap-1">
              <span className="text-xs font-black uppercase tracking-wide text-brand-muted">🛒 {periodLabel}</span>
              <div role="group" aria-label={text("Period", "अवधि")} className="inline-flex w-fit rounded-lg bg-brand-green-wash p-0.5">
                {(["today", "week", "month"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={period === key}
                    onClick={() => setPeriod(key)}
                    className={`whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-black ${period === key ? "bg-brand-green text-white" : "text-brand-green-ink"}`}
                  >
                    {key === "today" ? text("Today", "आज") : key === "week" ? text("7 days", "७ दिन") : text("Month", "महिना")}
                  </button>
                ))}
              </div>
            </div>
            <Money value={money} className="font-display text-3xl font-black leading-tight text-brand-green-ink" />
            {period === "today" ? (
              <p className="flex flex-wrap gap-x-3 text-xs font-bold text-brand-muted">
                <span>{text("Retail", "खुद्रा")} <b className="tabular-nums">{rupees(props.today.retail, language)}</b></span>
                <span>{text("Wholesale", "होलसेल")} <b className="tabular-nums">{rupees(props.today.wholesale, language)}</b></span>
                <span>{text("Online", "अनलाइन")} <b className="tabular-nums">{rupees(props.today.online, language)}</b></span>
              </p>
            ) : null}
            <span aria-hidden="true" className="absolute -right-2.5 top-1/2 z-10 hidden -translate-y-1/2 font-black text-brand-gold lg:block">→</span>
          </div>

          {/* 💰 Taken in */}
          <div className="grid content-start gap-1 bg-brand-paper p-4">
            <span className="text-xs font-black uppercase tracking-wide text-brand-muted">{text("💰 Taken in · today", "💰 हातमा आएको · आज")}</span>
            <span className="font-display text-3xl font-black leading-tight tabular-nums text-brand-green-ink">{rupees(props.collected, language)}</span>
          </div>

          {/* 🎯 The goal */}
          <div className="flex flex-col items-center justify-center gap-2 bg-brand-paper p-3 text-center">
            <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" className="flex-none">
              <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="8" className="text-brand-green-line" />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="#C99A2E"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - share)}
                transform="rotate(-90 32 32)"
                style={{ transition: "stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)" }}
              />
            </svg>
            <p className="text-xs font-bold text-brand-muted">
              {props.salesGoal > 0 ? (
                text(
                  `${Math.round(share * 100)}% of the ${period === "month" ? "month's" : period === "week" ? "week's share of the" : "day's share of the"} goal (${openFigures.size > 0 ? rupees(target, "en") : "Rs. ••••"})`,
                  `${period === "month" ? "महिनाको" : period === "week" ? "हप्ताको भाग" : "आजको भाग"} लक्ष्य ${openFigures.size > 0 ? rupees(target, "ne") : "रु. ••••"} को ${Math.round(share * 100)}% पुग्यो`,
                )
              ) : (
                <Link href="/admin/settings#goals" className="font-black text-brand-green underline underline-offset-4">
                  {text(`🎯 Set a goal for ${props.monthEn} and this ring fills up`, `🎯 ${props.monthNe} को लक्ष्य राख्नुहोस् — यो घेरा भरिँदै जान्छ`)}
                </Link>
              )}
            </p>
          </div>
        </div>

        {/* ── What now: a card a job, and the job's button on it ────── */}
        <div id="what-now" className="max-lg:-order-1 grid content-start gap-2">
          <h2 className="flex flex-wrap items-center justify-between gap-2 text-lg font-black text-brand-green-ink">
            <span className="flex items-center gap-2">
              {text("What now", "अब के गर्ने")}
              {left > 0 ? <span className="rounded-full bg-brand-clay px-2 text-xs font-black text-white">{left}</span> : null}
            </span>
          </h2>
          {/* The day in a few points, on a press (owner, 2026-10-01). */}
          <OwnerSummary
            facts={{
              today: { net: props.today.net, bills: props.today.bills, pairs: props.today.pairs, newOrders: props.today.newOrders },
              week: props.week,
              month: props.month,
              salesGoal: props.salesGoal,
              todos: props.todos.map((todo) => todo.ne),
              lowShoes: stock.lines
                .filter((line) => line.web && line.total > 0 && line.total <= 5)
                .slice(0, 5)
                .map((line) => ({ name: line.name, stock: line.total })),
              factoryTodayPairs: props.factory.todayPairs,
              creditOwed: props.kpis.creditOwed,
              workerDue: props.kpis.workerDue,
            }}
          />
          {props.todos.length === 0 ? (
            <p className="rounded-xl bg-brand-green-wash p-3 text-sm font-bold text-brand-green">
              {text("Nothing is stuck right now.", "अहिले केही अड्किएको छैन।")}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {props.todos.map((todo) => {
                const isDone = done.has(todo.key);
                const action = actionLabel[todo.key] ?? { en: "Open →", ne: "खोल्ने →" };
                // The pairs beyond the books, said on the card that sends there.
                const extra = todo.key === "places" && stock.over > 0 ? text(` · ${stock.over} pairs`, ` · ${stock.over} जोडी`) : "";
                return (
                  <div
                    key={todo.key}
                    className={`grid content-between gap-2 rounded-xl border border-l-4 border-brand-green-line bg-brand-paper px-3 py-2.5 shadow-sm transition ${toneBorder[todo.tone]} ${isDone ? "opacity-45" : ""}`}
                  >
                    <div className={`min-w-0 ${isDone ? "line-through" : ""}`}>
                      <span className="block font-black text-brand-green-ink">{text(todo.en, todo.ne)}{extra}</span>
                      <span className="block text-xs text-brand-muted">{text(todo.subEn, todo.subNe)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={todo.href}
                        className="inline-flex min-h-9 items-center rounded-lg bg-brand-green px-3 text-sm font-black text-white"
                      >
                        {text(action.en, action.ne)}
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleDone(todo.key)}
                        aria-pressed={isDone}
                        aria-label={isDone ? text("Mark not done", "नसकिएको बनाउने") : text("Mark done for today", "आजका लागि सकियो")}
                        className="min-h-9 min-w-9 rounded-lg border border-brand-green-line text-sm font-black text-brand-green-ink"
                      >
                        {isDone ? "↺" : "✓"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* ── Where the pairs are ─────────────────────────────────────
            Every shoe's stock and where it is (owner, 2026-10-11), said once
            (owner, 2026-10-27): the factory card beside it gave the shop the
            pairs placed beyond the books too, 464 against 364. */}
        <section id="stock-by-shoe" className="grid content-start gap-3 rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm">
          <h2 className="flex items-center justify-between gap-2 text-lg font-black text-brand-green-ink">
            {text(`👟 Where are my ${stock.all} pairs?`, `👟 मेरा ${stock.all} जोडी कहाँ छन्?`)}
            <Link href="/admin/stock#every-shoe" className="text-sm font-black text-brand-green">{text("Stock →", "स्टक हेर्ने →")}</Link>
          </h2>
          <div className="grid gap-1">
            <span className="flex h-6 overflow-hidden rounded-lg bg-brand-green-line/60 text-xs font-black text-white" aria-hidden="true">
              {stock.factory > 0 ? <span className="grid place-items-center overflow-hidden bg-brand-gold" style={{ width: `${placedShare(stock.factory)}%` }}>🏭 {stock.factory}</span> : null}
              {stock.shop > 0 ? <span className="grid place-items-center overflow-hidden bg-brand-green" style={{ width: `${placedShare(stock.shop)}%` }}>🛒 {stock.shop}</span> : null}
              {stock.onRoad > 0 ? <span className="grid place-items-center overflow-hidden bg-[#2458A6]" style={{ width: `${placedShare(stock.onRoad)}%` }}>🚚 {stock.onRoad}</span> : null}
              {stock.over > 0 ? <span className="grid place-items-center overflow-hidden bg-brand-clay" style={{ width: `${placedShare(stock.over)}%` }}>⚠ {stock.over}</span> : null}
              {stock.noPlace > 0 ? <span className="grid place-items-center overflow-hidden bg-brand-clay/60" style={{ width: `${placedShare(stock.noPlace)}%` }}>{stock.noPlace}</span> : null}
            </span>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-brand-muted">
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-gold align-middle" />{text(`Factory ${stock.factory}`, `कारखाना ${stock.factory}`)}</span>
              <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-green align-middle" />{text(`Shop ${stock.shop}`, `पसल ${stock.shop}`)}</span>
              {stock.onRoad > 0 ? (
                <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#2458A6] align-middle" />{text(`On the road ${stock.onRoad}`, `बाटोमा ${stock.onRoad}`)}</span>
              ) : null}
              {stock.over > 0 ? (
                <span className="text-brand-clay"><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-clay align-middle" />{text(`Not matching ${stock.over}`, `नमिलेको ${stock.over}`)}</span>
              ) : null}
              {stock.noPlace > 0 ? <span className="text-brand-clay">{text(`${stock.noPlace} no place`, `${stock.noPlace} ठाउँ छैन`)}</span> : null}
            </div>
          </div>
          <div className="grid gap-1">
            <span className="flex h-3 overflow-hidden rounded-full bg-brand-green-line/60" aria-hidden="true">
              <span className="h-full bg-brand-green" style={{ width: `${stockShare(stock.web)}%` }} />
              <span className="h-full bg-brand-gold/60" style={{ width: `${stockShare(stock.draft)}%` }} />
            </span>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-brand-muted">
              <span>{text(`On the website ${stock.web}`, `वेबसाइटमा ${stock.web}`)}</span>
              <span>{text(`Draft ${stock.draft}`, `Draft ${stock.draft}`)}</span>
            </div>
          </div>
          {draftTodo ? (
            <Link href={draftTodo.href} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm font-bold ${draftTodo.tone}`}>
              <span aria-hidden="true">{draftTodo.icon}</span>
              <span className="min-w-0 flex-1">{text(draftTodo.en, draftTodo.ne)}</span>
              <span className="whitespace-nowrap underline">{text(draftTodo.goEn, draftTodo.goNe)}</span>
            </Link>
          ) : null}

          <h3 className="mt-1 text-base font-black text-brand-green-ink">{text("👟 Stock by shoe", "👟 जुत्ता अनुसार स्टक")}</h3>
          {shown.length === 0 ? (
            <p className="text-sm text-brand-muted">{text("No shoe in the catalogue yet.", "सूचीमा अहिलेसम्म जुत्ता छैन।")}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-3 text-xs font-bold text-brand-muted" aria-hidden="true">
                <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-gold align-middle" />{text("Factory", "कारखाना")}</span>
                <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-green align-middle" />{text("Shop", "पसल")}</span>
                <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-brand-clay align-middle" />{text("Not matching", "नमिलेको")}</span>
              </div>
              <ul className="grid list-none gap-1.5 pl-0">
                {shown.map((shoe) => (
                  <li
                    key={shoe.name}
                    className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)_44px] items-center gap-2 text-sm"
                    title={text(`Factory ${shoe.factory} · Shop ${shoe.shop}${shoe.over ? ` · ${shoe.over} placed too many` : ""}`, `कारखाना ${shoe.factory} · पसल ${shoe.shop}${shoe.over ? ` · ${shoe.over} बढी` : ""}`)}
                  >
                    <span className="truncate">
                      {shoe.name}{" "}
                      <span className={`rounded-full px-1.5 text-xs font-black ${shoe.web ? "bg-brand-green-wash text-brand-green" : "bg-brand-cream-soft text-brand-gold-ink"}`}>
                        {shoe.web ? text("web", "web") : text("draft", "draft")}
                      </span>
                    </span>
                    <span className="flex h-3 overflow-hidden rounded-full bg-brand-green-line/60" aria-hidden="true">
                      <span className="h-full bg-brand-gold" style={{ width: `${(shoe.factory / maxShoe) * 100}%` }} />
                      <span className="h-full bg-brand-green" style={{ width: `${(shoe.shop / maxShoe) * 100}%` }} />
                      <span
                        className="h-full bg-[repeating-linear-gradient(45deg,#7B3128_0_4px,transparent_4px_8px)] dark:bg-[repeating-linear-gradient(45deg,#e59a8d_0_4px,transparent_4px_8px)]"
                        style={{ width: `${(shoe.over / maxShoe) * 100}%` }}
                      />
                    </span>
                    <b className={`text-right tabular-nums ${shoe.total <= 0 ? "text-brand-clay" : ""}`}>
                      {shoe.total <= 0 ? text("out", "सकियो") : shoe.total}
                    </b>
                  </li>
                ))}
              </ul>
              {rest.length > 0 ? (
                <p className="text-xs font-bold text-brand-muted">
                  {text(`+ ${rest.length} more ${rest.length === 1 ? "shoe" : "shoes"} · ${restPairs} pairs`, `+ अरू ${rest.length} जुत्ता · ${restPairs} जोडी`)}
                </p>
              ) : null}
            </>
          )}
        </section>

        <div className="grid content-start gap-4">
          {/* ── 🔒 Money: the four figures in one place ─────────────────
              Hidden on every visit (owner, 2026-10-01); one eye shows all
              four, and each still has its own. On a phone the box stays one
              line until it is opened. */}
          <section data-zone="health" className="grid gap-3 rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-black text-brand-green-ink">{text("🔒 Money", "🔒 पैसा")}</h2>
              <button
                type="button"
                data-figures-eye="all"
                onClick={() =>
                  setOpenFigures((open) =>
                    open.size > 0
                      ? new Set()
                      : new Set(["/admin/purchasing?view=accounts", "/admin/stock", "/admin/dues", "/admin/operations/production-accounts/payments"]),
                  )
                }
                aria-pressed={openFigures.size > 0}
                className="min-h-11 rounded-xl border border-brand-green-line bg-brand-paper px-4 text-sm font-black text-brand-green-ink"
              >
                {openFigures.size > 0 ? text("🙈 Hide amounts", "🙈 रकम लुकाउने") : text("👁 Show amounts", "👁 रकम हेर्ने")}
              </button>
            </div>
            <div className={`${openFigures.size > 0 ? "grid" : "hidden lg:grid"} grid-cols-1 gap-2 sm:grid-cols-2`}>
              {[
                { href: "/admin/purchasing?view=accounts", en: `Sales less purchases · ${props.monthEn}`, ne: `बिक्री − खरिद · ${props.monthNe}`, value: props.kpis.salesLessPurchases, subEn: "Not profit — bought stock is still on hand", subNe: "नाफा होइन · किनेको माल स्टकमै छ", bar: "bg-brand-green" },
                { href: "/admin/stock", en: "Stock at selling price", ne: "स्टक · बेच्ने मूल्यमा", value: props.kpis.stockValue, subEn: `${props.kpis.stockPairs} pairs in all · ${stock.web} on the website · ${stock.draft} in draft`, subNe: `जम्मा ${props.kpis.stockPairs} जोडी · वेबसाइटमा ${stock.web} · Draft मा ${stock.draft}`, bar: "bg-brand-gold" },
                { href: "/admin/dues", en: "Customers owe", ne: "ग्राहकको उधारो", value: props.kpis.creditOwed, subEn: props.kpis.creditOwed ? "Still to collect" : "Nobody owes anything ✓", subNe: props.kpis.creditOwed ? "उठाउन बाँकी" : "कसैले तिर्न बाँकी छैन ✓", bar: "bg-[#2458A6]" },
                { href: "/admin/operations/production-accounts/payments", en: "Owed to workers", ne: "कामदारको बाँकी", value: props.kpis.workerDue, subEn: "Wages to pay", subNe: "ज्याला तिर्न बाँकी", bar: "bg-brand-clay" },
              ].map((tile) => {
                const isOpen = openFigures.has(tile.href);
                return (
                  <div key={tile.href} className="relative">
                    <Link
                      href={tile.href}
                      className="relative grid h-full gap-0.5 overflow-hidden rounded-xl border border-brand-green-line bg-brand-paper p-3 pl-4 pr-12 transition hover:border-brand-gold"
                    >
                      <span className={`absolute inset-y-0 left-0 w-1 ${tile.bar}`} aria-hidden="true" />
                      <span className="text-xs font-black text-brand-muted">{text(tile.en, tile.ne)}</span>
                      {isOpen ? (
                        <Money value={tile.value} className="font-display text-xl font-black text-brand-green-ink" />
                      ) : (
                        <span data-figure-hidden className="font-display text-xl font-black tracking-widest text-brand-muted" aria-label={text("Amount hidden", "रकम लुकाइएको")}>
                          {text("Rs.", "रु.")} ••••
                        </span>
                      )}
                      <span className="text-xs text-brand-muted">{text(tile.subEn, tile.subNe)}</span>
                      {tile.href === "/admin/stock" && stock.noPrice > 0 ? (
                        <span className="text-xs font-bold text-brand-gold-ink">
                          ⚠ {text(`${stock.noPrice} ${stock.noPrice === 1 ? "shoe has" : "shoes have"} no price, so no value`, `${stock.noPrice} जुत्ताको मूल्य राखिएको छैन, रकममा गनिएन`)}
                        </span>
                      ) : null}
                    </Link>
                    {/* Beside the link, not in it: the eye shows the amount and opens nothing. */}
                    <button
                      type="button"
                      data-figures-eye={tile.href}
                      onClick={() =>
                        setOpenFigures((open) => {
                          const next = new Set(open);
                          if (next.has(tile.href)) next.delete(tile.href);
                          else next.add(tile.href);
                          return next;
                        })
                      }
                      aria-pressed={isOpen}
                      aria-label={isOpen ? text("Hide this amount", "यो रकम लुकाउने") : text("Show this amount", "यो रकम हेर्ने")}
                      className="absolute right-1.5 top-1.5 grid min-h-10 min-w-10 place-items-center rounded-lg border border-brand-green-line bg-brand-paper"
                    >
                      {isOpen ? "🙈" : "👁"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Seven days ─────────────────────────────────────────────── */}
          <section className="rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm">
            <h2 className="text-lg font-black text-brand-green-ink">{text("Sales, the last 7 days", "पछिल्ला ७ दिनको बिक्री")}</h2>
            {props.days.every((day) => day.net === 0) ? (
              <p className="mt-1 text-sm text-brand-muted">
                {text("No sales in the last 7 days yet — the bars fill as bills are cut.", "पछिल्ला ७ दिनमा बिक्री छैन — बिल काटेपछि बार भरिँदै जान्छन्।")}
              </p>
            ) : null}
            <div className="relative mt-3 grid h-32 grid-cols-7 items-end gap-2">
              {props.days.map((day) => {
                const height = day.net > 0 ? Math.max(4, (day.net / maxDay) * 100) : 2;
                const label = `${text(day.en, day.ne)}: ${rupees(day.net, language)}`;
                return (
                  <button
                    key={day.key}
                    type="button"
                    aria-label={label}
                    onMouseEnter={() => setHoverDay(day.key)}
                    onMouseLeave={() => setHoverDay(null)}
                    onFocus={() => setHoverDay(day.key)}
                    onBlur={() => setHoverDay(null)}
                    onClick={() => setHoverDay(day.key)}
                    className="relative flex h-full flex-col items-center justify-end gap-1"
                  >
                    {hoverDay === day.key ? (
                      <span className="absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-md bg-brand-green-ink px-2 py-0.5 text-xs font-black text-white">
                        {label}
                      </span>
                    ) : null}
                    <span
                      className={`block w-full max-w-12 rounded-t-[4px] transition-[height] duration-700 ${day.today ? "bg-brand-gold" : "bg-brand-green"}`}
                      style={{ height: `${height}%` }}
                    />
                    <span className={`text-xs font-bold ${day.today ? "text-brand-gold-ink" : "text-brand-muted"}`}>
                      {day.today ? text("Today", "आज") : text(day.en, day.ne)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* A bill a thumb away on a phone, above the dock (the dashboard sample). */}
      <Link
        href="/admin/pos"
        className="fixed bottom-[calc(6.25rem+env(safe-area-inset-bottom))] right-4 z-30 inline-flex min-h-12 items-center rounded-full bg-brand-gold px-5 text-[0.9375rem] font-black text-[#1A1A1A] shadow-lg md:hidden print:hidden"
      >
        {text("＋ Cut a bill", "＋ बिल काट्ने")}
      </Link>
    </div>
  );
}
