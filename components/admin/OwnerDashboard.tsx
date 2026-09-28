"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

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
  shoes: Array<{ name: string; stock: number }>;
  /** todayPairs: pairs posted to stock today. stages: today's work per stage, never summed. */
  factory: { todayPairs: number; stages?: Array<{ stage: string; pairs: number }>; atFactory: number; atShop: number; mismatched: number };
  days: Array<{ key: string; en: string; ne: string; net: number; today: boolean }>;
};

type Period = "today" | "week" | "month";

const CURRENCY = { en: "Rs.", ne: "रु." };
const rupees = (value: number, language: string) =>
  `${language === "ne" ? CURRENCY.ne : CURRENCY.en} ${Math.round(value).toLocaleString("en-IN")}`;

const tones: Record<Todo["tone"], string> = {
  red: "bg-brand-clay",
  blue: "bg-[#2458A6]",
  gold: "bg-brand-gold",
  green: "bg-brand-green",
};

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
    for (const todo of props.todos.slice(0, 4)) items.push({ en: `• ${todo.en}`, ne: `• ${todo.ne}` });
    items.push({
      en: `💰 This month, sales less purchases ${rupees(props.kpis.salesLessPurchases, "en")}`,
      ne: `💰 यो महिना बिक्री − खरिद ${rupees(props.kpis.salesLessPurchases, "ne")}`,
    });
    return items;
  }, [props.today, props.factory.todayPairs, props.todos, props.kpis.salesLessPurchases]);
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
  const maxShoe = Math.max(1, ...props.shoes.map((shoe) => shoe.stock));
  const greeting = Number.isNaN(hour) || clock === ""
    ? text("Hello", "नमस्ते")
    : hour < 12
      ? text("Good morning", "शुभ प्रभात")
      : hour < 17
        ? text("Good afternoon", "शुभ दिन")
        : text("Good evening", "शुभ साँझ");


  return (
    <div className="grid gap-4">
      {/* ── The news strip ─────────────────────────────────────────── */}
      <div className="grid items-center gap-3 rounded-2xl border border-brand-green-line bg-brand-paper px-4 py-3 shadow-sm sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <div>
          <p className="font-display text-2xl font-black leading-none text-brand-green-ink">{greeting}</p>
          <p className="mt-1 text-xs font-bold text-brand-muted">
            {text(props.dateEn, props.dateNe)} · <span className="tabular-nums">{clock || "--:--"}</span>
          </p>
        </div>
        <p
          aria-live="polite"
          className="truncate rounded-xl bg-brand-green-wash px-3 py-2 text-[15px] font-bold text-brand-green-ink"
          key={turn}
        >
          {headline ? text(headline.en, headline.ne) : null}
        </p>
        <a
          href="#what-now"
          className={`inline-flex h-fit w-fit items-center justify-self-start rounded-full px-3 py-1 text-sm font-black sm:justify-self-end ${
            left > 0 ? "bg-brand-clay text-white" : "bg-brand-green-wash text-brand-green"
          }`}
        >
          {left > 0 ? text(`${left} to do`, `${left} काम बाँकी`) : text("✓ All clear", "✓ सबै सकियो")}
        </a>
      </div>

      {/* ── The day's money, and what now ─────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="relative grid gap-3 overflow-hidden rounded-3xl p-5 text-white shadow-md [background:radial-gradient(120%_140%_at_100%_0%,#1E8A63_0%,#12634A_45%,#0B3F30_100%)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-white/90">{periodLabel}</p>
            <div role="group" aria-label={text("Period", "अवधि")} className="inline-flex rounded-xl bg-white/15 p-1">
              {(["today", "week", "month"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={period === key}
                  onClick={() => setPeriod(key)}
                  className={`rounded-lg px-3 py-1 text-sm font-black ${period === key ? "bg-white text-brand-green-ink" : "text-white"}`}
                >
                  {key === "today" ? text("Today", "आज") : key === "week" ? text("7 days", "७ दिन") : text("Month", "महिना")}
                </button>
              ))}
            </div>
          </div>

          <Money value={money} className="font-display text-[2.75rem] font-black leading-none sm:text-6xl" />

          {period === "today" ? (
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/90">
              <span>{text("Retail", "खुद्रा")} <b className="tabular-nums">{rupees(props.today.retail, language)}</b></span>
              <span>{text("Wholesale", "होलसेल")} <b className="tabular-nums">{rupees(props.today.wholesale, language)}</b></span>
              <span>{text("Online", "अनलाइन")} <b className="tabular-nums">{rupees(props.today.online, language)}</b></span>
              <span>
                {text("Taken in", "हातमा आएको")} <b className="tabular-nums">{rupees(props.collected, language)}</b>
              </span>
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" className="flex-none">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="8" />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="#F0C66A"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - share)}
                transform="rotate(-90 32 32)"
                style={{ transition: "stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)" }}
              />
            </svg>
            <p className="text-sm text-white/95">
              {props.salesGoal > 0 ? (
                text(
                  `${Math.round(share * 100)}% of the ${period === "month" ? "month's" : period === "week" ? "week's share of the" : "day's share of the"} goal (${rupees(target, "en")})`,
                  `${period === "month" ? "महिनाको" : period === "week" ? "हप्ताको भाग" : "आजको भाग"} लक्ष्य ${rupees(target, "ne")} को ${Math.round(share * 100)}% पुग्यो`,
                )
              ) : (
                <Link href="/admin/settings#goals" className="font-bold underline underline-offset-4">
                  {text(`🎯 Set a goal for ${props.monthEn} and this ring fills up`, `🎯 ${props.monthNe} को लक्ष्य राख्नुहोस् — यो घेरा भरिँदै जान्छ`)}
                </Link>
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { href: "/admin/pos", key: "B", en: "🧾 Cut a bill", ne: "🧾 बिल काट्ने" },
              { href: "/admin/factory/add-work", key: "W", en: "📝 Add work", ne: "📝 काम टिप्ने" },
              { href: "/admin/purchasing", key: "P", en: "🛒 Purchase", ne: "🛒 खरिद" },
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-[15px] font-black text-brand-green-ink shadow-sm transition hover:-translate-y-0.5"
              >
                {text(action.en, action.ne)}
                <kbd className="hidden rounded border border-brand-green-line px-1 text-[11px] font-bold text-brand-muted sm:inline">{action.key}</kbd>
              </Link>
            ))}
          </div>
        </div>

        <div id="what-now" className="grid content-start gap-2 rounded-3xl border border-brand-green-line bg-brand-paper p-4 shadow-sm">
          <h2 className="flex items-center justify-between text-lg font-black text-brand-green-ink">
            {text("What now", "अब के गर्ने")}
            {left > 0 ? <span className="rounded-full bg-brand-clay px-2 text-xs font-black text-white">{left}</span> : null}
          </h2>
          {props.todos.length === 0 ? (
            <p className="rounded-xl bg-brand-green-wash p-3 text-sm font-bold text-brand-green">
              {text("Nothing is stuck right now.", "अहिले केही अड्किएको छैन।")}
            </p>
          ) : (
            props.todos.map((todo) => {
              const isDone = done.has(todo.key);
              return (
                <div
                  key={todo.key}
                  className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-brand-green-line bg-brand-paper px-3 py-2 transition ${isDone ? "opacity-45" : ""}`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${tones[todo.tone]}`} aria-hidden="true" />
                  <Link href={todo.href} className={`flex min-w-0 flex-col ${isDone ? "line-through" : ""}`}>
                    <span className="block font-black text-brand-green-ink">{text(todo.en, todo.ne)}</span>
                    <span className="block text-xs text-brand-muted">{text(todo.subEn, todo.subNe)}</span>
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
              );
            })
          )}
        </div>
      </div>

      {/* ── Four figures ───────────────────────────────────────────── */}
      <div data-zone="health" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { href: "/admin/purchasing?view=accounts", en: `Sales less purchases · ${props.monthEn}`, ne: `बिक्री − खरिद · ${props.monthNe}`, value: props.kpis.salesLessPurchases, subEn: "Not profit — bought stock is still on hand", subNe: "नाफा होइन · किनेको माल स्टकमै छ", bar: "bg-brand-green" },
          { href: "/admin/stock", en: "Stock at selling price", ne: "स्टक · बेच्ने मूल्यमा", value: props.kpis.stockValue, subEn: `${props.kpis.stockPairs} pairs`, subNe: `${props.kpis.stockPairs} जोडी`, bar: "bg-brand-gold" },
          { href: "/admin/dues", en: "Customers owe", ne: "ग्राहकको उधारो", value: props.kpis.creditOwed, subEn: props.kpis.creditOwed ? "Still to collect" : "Nobody owes anything ✓", subNe: props.kpis.creditOwed ? "उठाउन बाँकी" : "कसैले तिर्न बाँकी छैन ✓", bar: "bg-[#2458A6]" },
          { href: "/admin/operations/production-accounts/payments", en: "Owed to workers", ne: "कामदारको बाँकी", value: props.kpis.workerDue, subEn: "Wages to pay", subNe: "ज्याला तिर्न बाँकी", bar: "bg-brand-clay" },
        ].map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="relative grid gap-0.5 overflow-hidden rounded-2xl border border-brand-green-line bg-brand-paper p-4 pl-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-gold"
          >
            <span className={`absolute inset-y-0 left-0 w-1 ${tile.bar}`} aria-hidden="true" />
            <span className="text-xs font-black text-brand-muted">{text(tile.en, tile.ne)}</span>
            <Money value={tile.value} className="font-display text-2xl font-black text-brand-green-ink" />
            <span className="text-xs text-brand-muted">{text(tile.subEn, tile.subNe)}</span>
          </Link>
        ))}
      </div>

      {/* ── Shop stock and the factory today ──────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="grid content-start gap-2 rounded-3xl border border-brand-green-line bg-[linear-gradient(180deg,#E4ECF8,transparent_55%)] p-4 dark:bg-[linear-gradient(180deg,#17253A,transparent_55%)]">
          <h2 className="flex items-center justify-between text-lg font-black text-brand-green-ink">
            {text("🛒 Shop stock", "🛒 पसलको स्टक")}
            <Link href="/admin/stock" className="text-sm font-black text-brand-green">{text("Stock →", "स्टक हेर्ने →")}</Link>
          </h2>
          {props.shoes.length === 0 ? (
            <p className="text-sm text-brand-muted">{text("No shoe in the catalogue yet.", "सूचीमा अहिलेसम्म जुत्ता छैन।")}</p>
          ) : (
            <ul className="grid list-none gap-1.5 pl-0">
              {props.shoes.map((shoe) => {
                const colour = shoe.stock <= 0 ? "bg-brand-clay" : shoe.stock <= 5 ? "bg-brand-gold" : "bg-brand-green";
                return (
                  <li key={shoe.name} className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)_44px] items-center gap-2 text-sm">
                    <span className="truncate">{shoe.name}</span>
                    <span className="block h-3 overflow-hidden rounded-full bg-brand-green-line/60" aria-hidden="true">
                      <span
                        className={`block h-full rounded-full ${colour} transition-[width] duration-700`}
                        style={{ width: `${shoe.stock > 0 ? Math.max(3, (shoe.stock / maxShoe) * 100) : 2}%` }}
                      />
                    </span>
                    <b className={`text-right tabular-nums ${shoe.stock <= 0 ? "text-brand-clay" : ""}`}>
                      {shoe.stock <= 0 ? text("out", "सकियो") : shoe.stock}
                    </b>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="grid content-start gap-3 rounded-3xl border border-brand-green-line bg-[linear-gradient(180deg,#FFF3D9,transparent_55%)] p-4 dark:bg-[linear-gradient(180deg,#2C2412,transparent_55%)]">
          <h2 className="flex items-center justify-between text-lg font-black text-brand-green-ink">
            {text("🏭 The factory today", "🏭 कारखाना आज")}
            <Link href="/admin/factory/add-work" className="text-sm font-black text-brand-green">{text("Add work →", "काम टिप्ने →")}</Link>
          </h2>
          <p>
            <Count value={props.factory.todayPairs} className="font-display text-5xl font-black text-brand-green-ink" />{" "}
            <span className="text-sm font-bold text-brand-muted">{text("pairs into stock today", "जोडी आज स्टकमा चढे")}</span>
          </p>
          {/* Each stage on its own: one pair through Upper and Fibermen is two
              entries, and adding them up doubled the day. */}
          {props.factory.stages?.length ? (
            <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-brand-muted">
              <span>{text("Work today:", "आजको काम:")}</span>
              {props.factory.stages.map((entry) => (
                <span key={entry.stage} className="rounded-full border border-brand-green-line bg-brand-paper px-2 py-0.5 tabular-nums text-brand-green-ink">
                  {entry.stage} {entry.pairs}
                </span>
              ))}
            </p>
          ) : null}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { en: "At the factory", ne: "कारखानामा", value: props.factory.atFactory, tone: "text-brand-gold-ink" },
              { en: "At the shop", ne: "पसलमा", value: props.factory.atShop, tone: "text-brand-green" },
              { en: "Not matching", ne: "ठाउँ नमिलेको", value: props.factory.mismatched, tone: props.factory.mismatched ? "text-brand-clay" : "text-brand-green" },
            ].map((cell) => (
              <div key={cell.en} className="rounded-xl border border-brand-green-line bg-brand-paper px-1 py-2">
                <span className="block text-[11px] font-black text-brand-muted">{text(cell.en, cell.ne)}</span>
                <b className={`text-xl tabular-nums ${cell.tone}`}>{cell.value}</b>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Seven days ─────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-brand-green-line bg-brand-paper p-4 shadow-sm">
        <h2 className="text-lg font-black text-brand-green-ink">{text("Sales, the last 7 days", "पछिल्ला ७ दिनको बिक्री")}</h2>
        {props.days.every((day) => day.net === 0) ? (
          <p className="mt-1 text-sm text-brand-muted">
            {text("No sales in the last 7 days yet — the bars fill as bills are cut.", "पछिल्ला ७ दिनमा बिक्री छैन — बिल काटेपछि बार भरिँदै जान्छन्।")}
          </p>
        ) : null}
        <div className="relative mt-3 grid h-44 grid-cols-7 items-end gap-2">
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
  );
}
