"use client";

import EnterWalkForm from "@/components/admin/EnterWalkForm";
import { Fragment, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ActionMessage from "@/components/admin/ActionMessage";
import { useLanguage } from "@/components/LanguageProvider";
import type { ActionState } from "@/app/admin/actions";
import {
  createStockTransferAction,
  receiveStockTransferAction,
  setPlaceCountAction,
} from "@/app/admin/stock/actions";
import type { StockAtPlace, StockTransfer } from "@/lib/stock-transfers";

/** What the stock page knows about a shoe beyond where its pairs are. */
export type ShoeExtra = {
  origin: "Made" | "Bought" | "Both" | "Other";
  sold: number;
  /** How long it lasts, already worded; status picks the colour. */
  lasts: { status: "out" | "urgent" | "soon" | "healthy" | "unknown"; en: string; ne: string } | null;
};

type Fix = {
  key: string;
  row: StockAtPlace;
  location: "Factory" | "Shop";
  pairs: number;
  en: string;
  ne: string;
};

type Text = (en: string, ne: string) => string;

type Props = {
  rows: StockAtPlace[];
  /** By shoe name: made or bought, pairs sold, how long it lasts. */
  extras: Record<string, ShoeExtra>;
  transfers: StockTransfer[];
  /** Who is signed in, so the challan says who sent it without being asked. */
  staffName: string;
  /** Today in Kathmandu, worked out on the server. */
  today: string;
  todayBs: string;
};

type Line = { key: number; design: string; sizeRun: string; pairs: string };

const box =
  "h-11 rounded-md border border-brand-green-line bg-brand-paper px-3 text-sm outline-none transition focus:border-brand-green focus:ring-2 focus:ring-brand-green/15";

function emptyLine(key: number): Line {
  return { key, design: "", sizeRun: "Mixed", pairs: "" };
}

/**
 * Where the pairs are, and the challan that moves them.
 *
 * The totals here are not a second stock ledger. finished_stock stays the one
 * pool selling reads; this says how that pool is split between the two places,
 * and when the two disagree it says so rather than picking a favourite.
 */
export default function WherePairsAre({ rows, extras, transfers, staffName, today, todayBs }: Props) {
  const { text } = useLanguage();
  const router = useRouter();

  const [from, setFrom] = useState<"Factory" | "Shop">("Factory");
  const [lines, setLines] = useState<Line[]>([emptyLine(0)]);
  const [nextKey, setNextKey] = useState(1);
  const [receiveNow, setReceiveNow] = useState(false);
  const [state, setState] = useState<ActionState | null>(null);
  const [saving, startSaving] = useTransition();
  const [openChallan, setOpenChallan] = useState<string | null>(null);
  const [receiveState, setReceiveState] = useState<ActionState | null>(null);
  const [receiving, startReceiving] = useTransition();

  // The stocktake box. Its own state, because counting pairs in is a different
  // act from sending them: nothing moves, somebody counted what is on a shelf.
  const [countKey, setCountKey] = useState("");
  const [countPlace, setCountPlace] = useState<"Factory" | "Shop">("Shop");
  const [countPairs, setCountPairs] = useState("");
  const [countState, setCountState] = useState<ActionState | null>(null);
  const [counting, startCounting] = useTransition();
  const countBox = useRef<HTMLDivElement>(null);
  const countPairsInput = useRef<HTMLInputElement>(null);

  // The one-press fixes on a shoe to put right, each asked "Sure?" first.
  const [confirmFix, setConfirmFix] = useState<string | null>(null);
  const [fixState, setFixState] = useState<ActionState | null>(null);
  const [fixing, startFixing] = useTransition();
  const [openShoes, setOpenShoes] = useState<Set<string>>(() => new Set());

  const to = from === "Factory" ? "Shop" : "Factory";

  const totals = useMemo(() => {
    return rows.reduce(
      (sum, row) => ({
        factory: sum.factory + row.factory,
        shop: sum.shop + row.shop,
        total: sum.total + row.total,
        // Apart, not netted: ten pairs with no place on one shoe and ten
        // placed too many on another are two things to fix, not zero.
        unplaced: sum.unplaced + Math.max(0, row.unplaced),
        overPlaced: sum.overPlaced + Math.max(0, -row.unplaced),
      }),
      { factory: 0, shop: 0, total: 0, unplaced: 0, overPlaced: 0 },
    );
  }, [rows]);

  /** What the chosen side actually holds, so a line cannot ask for more. */
  const heldAt = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(`${row.design}::${row.sizeRun}`, from === "Factory" ? row.factory : row.shop);
    }
    return map;
  }, [rows, from]);

  const waiting = transfers.filter((transfer) => transfer.status === "Sent");

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((current) => {
      const next = current.map((line) => (line.key === key ? { ...line, ...patch } : line));
      const last = next[next.length - 1];
      if (last.key === key && (last.design || last.pairs)) {
        next.push(emptyLine(nextKey));
        setNextKey((value) => value + 1);
      }
      return next;
    });
  }

  function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const asked = lines.filter((line) => line.design && Number(line.pairs) > 0);
    if (asked.length === 0) {
      setState({
        ok: false,
        message: text(
          "Choose a shoe and say how many pairs are going.",
          "जुत्ता छान्नुहोस् र कति जोडी जाने लेख्नुहोस्।",
        ),
      });
      return;
    }

    // Caught here so the owner is told before the goods are written down,
    // rather than after a round trip that ends in a refusal.
    const over = asked.find(
      (line) => Number(line.pairs) > (heldAt.get(`${line.design}::${line.sizeRun}`) ?? 0),
    );
    if (over) {
      const held = heldAt.get(`${over.design}::${over.sizeRun}`) ?? 0;
      setState({
        ok: false,
        message: text(
          `${over.design}: only ${held} pair(s) are at the ${from.toLowerCase()}.`,
          `${over.design}: ${from === "Factory" ? "कारखानामा" : "पसलमा"} ${held} जोडी मात्र छ।`,
        ),
      });
      return;
    }

    startSaving(async () => {
      const result = await createStockTransferAction(state, formData);
      setState(result);
      if (result.ok) {
        setLines([emptyLine(nextKey)]);
        setNextKey((value) => value + 1);
        setReceiveNow(false);
        router.refresh();
      }
    });
  }

  /**
   * Count pairs in at a place.
   *
   * Not a challan: nothing moved. These are pairs that were made or bought
   * before anyone was asked where they went, and this says where they are.
   *
   * The count replaces that place's number rather than adding to it, which is
   * what a stocktake means — you counted the shelf, and that is what is on it.
   */
  function handleCount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const counted = rows.find((row) => `${row.design}::${row.sizeRun}` === countKey);
    if (!counted) {
      setCountState({
        ok: false,
        message: text("Choose a shoe to count.", "गन्ने जुत्ता छान्नुहोस्।"),
      });
      return;
    }

    // Caught here rather than after a round trip. Counting 60 pairs of a shoe
    // the stock says has 48 would leave the row reading -12 under "No place",
    // which is a worse lie than the blank it replaced.
    const pairs = Number(countPairs);
    if (pairs > counted.total) {
      setCountState({
        ok: false,
        message: text(
          `${counted.design}: stock says ${counted.total} pair(s) in all, so ${pairs} cannot be at one place.`,
          `${counted.design}: स्टकमा जम्मा ${counted.total} जोडी छ, त्यसैले एकै ठाउँमा ${pairs} हुन सक्दैन।`,
        ),
      });
      return;
    }

    startCounting(async () => {
      const result = await setPlaceCountAction(null, formData);
      setCountState(result);
      if (result.ok) {
        setCountPairs("");
        router.refresh();
      }
    });
  }

  function handleReceive(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startReceiving(async () => {
      const result = await receiveStockTransferAction(receiveState, formData);
      setReceiveState(result);
      if (result.ok) {
        setOpenChallan(null);
        router.refresh();
      }
    });
  }

  const placeLabel = (place: "Factory" | "Shop") =>
    place === "Factory" ? text("Factory", "कारखाना") : text("Shop", "पसल");

  /** One shoe, one line: a shoe posted size by size is several rows underneath. */
  const groups = useMemo(() => groupByShoe(rows), [rows]);
  const mismatched = rows.filter((row) => row.unplaced !== 0);

  function rowLabel(row: StockAtPlace) {
    const sized = rows.filter((other) => other.design === row.design).length > 1;
    return sized && row.sizeRun && row.sizeRun !== "Mixed"
      ? `${row.design} · ${text("size", "साइज")} ${row.sizeRun}`
      : row.design;
  }

  /** The count box, filled in for this row, and the cursor put in it. */
  function countThis(row: StockAtPlace) {
    setCountKey(`${row.design}::${row.sizeRun}`);
    setCountPlace(row.shop > 0 && row.factory === 0 ? "Shop" : "Factory");
    setCountPairs("");
    countBox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => countPairsInput.current?.focus(), 350);
  }

  /** The one-press fixes a mismatch offers, worked out from the row itself. */
  function fixesFor(row: StockAtPlace): Fix[] {
    const key = `${row.design}::${row.sizeRun}`;
    if (row.unplaced > 0) {
      return [
        { key: `${key}::F`, row, location: "Factory", pairs: row.factory + row.unplaced, en: `Put ${row.unplaced} at the factory`, ne: `${row.unplaced} कारखानामा राख्ने` },
        { key: `${key}::S`, row, location: "Shop", pairs: row.shop + row.unplaced, en: `Put ${row.unplaced} at the shop`, ne: `${row.unplaced} पसलमा राख्ने` },
      ];
    }
    const over = -row.unplaced;
    const fixes: Fix[] = [];
    if (row.shop >= over) {
      fixes.push({ key: `${key}::S`, row, location: "Shop", pairs: row.shop - over, en: `Make the shop ${row.shop - over}`, ne: `पसल ${row.shop - over} बनाउने` });
    }
    if (row.factory >= over) {
      fixes.push({ key: `${key}::F`, row, location: "Factory", pairs: row.factory - over, en: `Make the factory ${row.factory - over}`, ne: `कारखाना ${row.factory - over} बनाउने` });
    }
    return fixes;
  }

  function applyFix(fix: Fix) {
    const formData = new FormData();
    formData.set("design", fix.row.design);
    formData.set("sizeRun", fix.row.sizeRun || "Mixed");
    formData.set("location", fix.location);
    formData.set("pairs", String(fix.pairs));
    startFixing(async () => {
      const result = await setPlaceCountAction(null, formData);
      setFixState(result);
      setConfirmFix(null);
      if (result.ok) router.refresh();
    });
  }

  function toggleShoe(design: string) {
    setOpenShoes((current) => {
      const next = new Set(current);
      if (next.has(design)) next.delete(design);
      else next.add(design);
      return next;
    });
  }

  return (
    // minmax(0,1fr): a grid track otherwise grows to its widest child, and the
    // table below is 520px — wider than a phone, so the whole section spilled
    // off the right edge.
    <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4">
      {/* ── Shoes to put right ──────────────────────────────────────────
          Each one with the fix it most likely needs, one press away. The
          owner's sample, 2026-09-28: the old two paragraphs said how many
          pairs were off, and left finding which shoe to the table. */}
      {totals.unplaced > 0 || totals.overPlaced > 0 ? (
        <section id="put-right" className="scroll-mt-24 rounded-2xl border border-[#EBD9AE] bg-[#FFF9EA] p-4 sm:p-5">
          <h2 className="text-lg font-black text-brand-gold-ink">
            {text(`Put right — ${mismatched.length} to fix`, `मिलाउनुपर्ने — ${mismatched.length} वटा`)}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-gold-ink">
            {text(
              "Where the pairs sit does not match the stock. The buttons change only the factory or shop count — never the stock total or a sale.",
              "जोडी कहाँ छन् भन्ने गन्ती स्टकसँग मिलेन। बटनले कारखाना वा पसलको गन्ती मात्र बदल्छ — जम्मा स्टक र बिक्री बदलिँदैन।",
            )}
          </p>
          <ul className="mt-3 grid gap-2 lg:grid-cols-2">
            {mismatched.map((row) => {
              const fixes = fixesFor(row);
              return (
                <li key={`fix-${row.design}::${row.sizeRun}`} className="grid gap-2 rounded-xl border border-[#EBD9AE] bg-brand-paper p-3">
                  <p className="font-black text-brand-green-ink">
                    {rowLabel(row)}:{" "}
                    {row.unplaced > 0
                      ? text(`${row.unplaced} pair(s) have no place`, `${row.unplaced} जोडीको ठाउँ भनिएको छैन`)
                      : text(`${-row.unplaced} too many counted`, `${-row.unplaced} जोडी बढी गनिएको`)}
                  </p>
                  <p className="text-sm tabular-nums text-brand-muted">
                    {text(
                      `In stock ${row.total} · factory ${row.factory} · shop ${row.shop}`,
                      `स्टकमा ${row.total} · कारखानामा ${row.factory} · पसलमा ${row.shop}`,
                    )}
                    {row.unplaced < 0 && row.total === 0
                      ? ` · ${text("sold before sales took pairs off a place", "बिक्री भए तर ठाउँबाट घटेनन्")}`
                      : ""}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {fixes.map((fix) =>
                      confirmFix === fix.key ? (
                        <span key={fix.key} className="inline-flex flex-wrap items-center gap-2 rounded-full bg-brand-green-wash px-2 py-1">
                          <span className="px-1 text-xs font-bold text-brand-green-ink">{text("Sure?", "पक्का?")}</span>
                          <button
                            type="button"
                            disabled={fixing}
                            onClick={() => applyFix(fix)}
                            className="min-h-9 rounded-full bg-brand-green px-4 text-xs font-black text-white disabled:opacity-60"
                          >
                            {fixing ? text("Saving…", "राख्दै…") : text(`Yes — ${fix.en.toLowerCase()}`, `हो — ${fix.ne}`)}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmFix(null)}
                            className="min-h-9 rounded-full border border-brand-green px-3 text-xs font-bold text-brand-green"
                          >
                            {text("No", "होइन")}
                          </button>
                        </span>
                      ) : (
                        <button
                          key={fix.key}
                          type="button"
                          onClick={() => setConfirmFix(fix.key)}
                          className="min-h-9 rounded-full bg-brand-green px-4 text-xs font-black text-white"
                        >
                          {text(fix.en, fix.ne)}
                        </button>
                      ),
                    )}
                    <button
                      type="button"
                      onClick={() => countThis(row)}
                      className="min-h-9 rounded-full border border-brand-green px-4 text-xs font-black text-brand-green"
                    >
                      {text("Count and enter", "गनेर हाल्ने")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <ActionMessage state={fixState} />
        </section>
      ) : null}

      {/* ── Every shoe, one line each ───────────────────────────────── */}
      <section className="rounded-2xl border border-brand-green-line bg-brand-paper p-4 sm:p-5">
        <h2 className="text-lg font-black text-brand-green-ink">
          {text("Every shoe", "सबै जुत्ता")}
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-brand-muted">
          {text(
            "Where each shoe's pairs are, what has sold and how long it lasts. Selling is unchanged — it still draws from the total.",
            "हरेक जुत्ता कहाँ कति छ, कति बिक्यो र कति दिन पुग्छ। बिक्री उस्तै छ — जम्माबाटै घट्छ।",
          )}
        </p>

        {/* On a phone, one card per shoe: seven columns do not fit 390px. */}
        <ul className="mt-4 grid gap-2 sm:hidden">
          {groups.map((group) => {
            const extra = extras[group.design];
            return (
              <li key={`card-${group.design}`} className="rounded-xl border border-brand-green-line bg-brand-paper px-3 py-2.5">
                <p className="font-semibold text-brand-green-ink">
                  {group.design}
                  <OriginTag origin={extra?.origin} text={text} />
                </p>
                {group.sizes ? <p className="text-xs font-bold text-brand-muted-soft">{text("Sizes", "साइज")} {group.sizes}</p> : null}
                <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
                  <span className="font-bold text-brand-gold-ink">🏭 {group.factory}</span>
                  <span className="font-bold text-brand-green">🛒 {group.shop}</span>
                  <span className="font-bold text-brand-green-ink">
                    {text("In stock", "जम्मा")} {group.total}
                  </span>
                  <span className="text-brand-muted">
                    {text("Sold", "बिक्री")} {extra?.sold ?? 0}
                  </span>
                </p>
                <p className="mt-1 flex flex-wrap gap-2">
                  <LastsChip extra={extra} text={text} />
                  <PlaceGap group={group} text={text} />
                </p>
              </li>
            );
          })}
          {groups.length === 0 ? (
            <li className="py-6 text-center text-brand-muted">{text("No ready stock yet.", "अझै तयारी माल छैन।")}</li>
          ) : null}
        </ul>

        <div className="mt-4 hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-[0.12em] text-brand-muted-soft">
                <th className="pb-2 pr-3 text-left">{text("Shoe", "जुत्ता")}</th>
                <th className="pb-2 pr-3 text-right">🏭 {placeLabel("Factory")}</th>
                <th className="pb-2 pr-3 text-right">🛒 {placeLabel("Shop")}</th>
                <th className="pb-2 pr-3 text-right">{text("In stock", "जम्मा")}</th>
                <th className="pb-2 pr-3 text-right">{text("Sold", "बिक्री")}</th>
                <th className="pb-2 pr-3 text-left">{text("How long it lasts", "कति दिन पुग्छ")}</th>
                <th className="pb-2 text-right">{text("Not matching", "नमिलेको")}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => {
                const extra = extras[group.design];
                const open = openShoes.has(group.design);
                return (
                  <Fragment key={group.design}>
                    <tr className="border-t border-brand-green-line">
                      <td className="py-2.5 pr-3 font-semibold text-brand-green-ink">
                        {group.rows.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => toggleShoe(group.design)}
                            aria-expanded={open}
                            className="text-left font-semibold text-brand-green-ink"
                          >
                            <span aria-hidden="true" className="mr-1 text-brand-muted-soft">{open ? "▾" : "▸"}</span>
                            {group.design}
                          </button>
                        ) : (
                          group.design
                        )}
                        <OriginTag origin={extra?.origin} text={text} />
                        {group.sizes ? (
                          <span className="block text-xs font-bold text-brand-muted-soft">{text("Sizes", "साइज")} {group.sizes}</span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-bold tabular-nums text-brand-gold-ink">
                        {group.factory || <span className="text-brand-muted-soft">0</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-bold tabular-nums text-brand-green">
                        {group.shop || <span className="text-brand-muted-soft">0</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-black tabular-nums text-brand-green-ink">{group.total}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-brand-muted">{extra?.sold ?? 0}</td>
                      <td className="py-2.5 pr-3"><LastsChip extra={extra} text={text} /></td>
                      <td className="py-2.5 text-right tabular-nums"><PlaceGap group={group} text={text} /></td>
                    </tr>
                    {open
                      ? group.rows.map((row) => (
                          <tr key={`${row.design}::${row.sizeRun}`} className="text-xs text-brand-muted">
                            <td className="py-1.5 pl-6 pr-3">{text("Size", "साइज")} {row.sizeRun}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">{row.factory}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">{row.shop}</td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">{row.total}</td>
                            <td colSpan={3} />
                          </tr>
                        ))
                      : null}
                  </Fragment>
                );
              })}
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-brand-muted">
                    {text("No ready stock yet.", "अझै तयारी माल छैन।")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* ── Count pairs in ───────────────────────────────────────────
            Under the list, and where "Count and enter" on a shoe to put
            right brings the cursor. */}
        <div ref={countBox}>
        <EnterWalkForm onSubmit={handleCount} className="mt-4 rounded-xl border border-brand-green-line bg-brand-paper p-3">
          <input type="hidden" name="sizeRun" value={countKey.split("::")[1] ?? "Mixed"} />
          <input type="hidden" name="design" value={countKey.split("::")[0] ?? ""} />
          <input type="hidden" name="location" value={countPlace} />

          <p className="mb-2 text-xs font-black uppercase tracking-[0.1em] text-brand-muted-soft">
            {text("Count pairs in", "गनेर ठाउँ राख्ने")}
          </p>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_110px_auto] sm:items-center">
            <select
              className={box}
              value={countKey}
              onChange={(event) => setCountKey(event.target.value)}
              aria-label={text("Shoe to count", "गन्ने जुत्ता")}
            >
              <option value="">{text("Choose a shoe…", "जुत्ता छान्नुहोस्…")}</option>
              {/* Every shoe, not only the unplaced ones: a shelf can be
                  recounted after it was first placed. The ones that need it
                  most are marked, so they are easy to find in the list. */}
              {rows.map((row) => (
                <option key={`${row.design}::${row.sizeRun}`} value={`${row.design}::${row.sizeRun}`}>
                  {row.design}
                  {row.sizeRun && row.sizeRun !== "Mixed" ? ` (${row.sizeRun})` : ""}
                  {row.unplaced > 0 ? ` — ${text("no place", "ठाउँ छैन")}: ${row.unplaced}` : ""}
                  {row.unplaced < 0 ? ` — ${text("too many placed", "बढी गनिएको")}: ${-row.unplaced}` : ""}
                </option>
              ))}
            </select>

            <select
              className={box}
              value={countPlace}
              onChange={(event) => setCountPlace(event.target.value as "Factory" | "Shop")}
              aria-label={text("Place", "ठाउँ")}
            >
              <option value="Factory">🏭 {placeLabel("Factory")}</option>
              <option value="Shop">🛒 {placeLabel("Shop")}</option>
            </select>

            <input
              ref={countPairsInput}
              name="pairs"
              type="number"
              min="0"
              inputMode="numeric"
              className={`${box} text-right tabular-nums`}
              placeholder={text("Pairs", "जोडी")}
              value={countPairs}
              onChange={(event) => setCountPairs(event.target.value)}
              aria-label={text("Pairs counted", "गनेको जोडी")}
            />

            <button
              type="submit"
              disabled={counting || !countKey || countPairs === ""}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-brand-green px-5 text-sm font-black text-white transition disabled:opacity-50"
            >
              {counting ? text("Saving…", "राख्दै…") : text("Save count", "गन्ती राख्ने")}
            </button>
          </div>

          <p className="mt-2 text-xs leading-5 text-brand-muted">
            {text(
              "This replaces what that place holds — it is a count, not a delivery. Nothing is sold and no challan is written.",
              "यसले त्यो ठाउँको अंक बदल्छ — यो गन्ती हो, ढुवानी होइन। केही बिक्री हुँदैन, चलान पनि बन्दैन।",
            )}
          </p>

          <ActionMessage state={countState} />
        </EnterWalkForm>
        </div>
      </section>

      {/* ── Send a challan ──────────────────────────────────────────── */}
      <section className="rounded-2xl border border-brand-green/30 bg-brand-paper p-4 sm:p-5">
        <h2 className="text-lg font-black text-brand-green-ink">
          {text("Move pairs", "माल सार्ने")}
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-brand-muted">
          {text(
            "This writes a challan — the note that travels with the goods. It is not a bill: nothing is sold, so nothing lands in the VAT record.",
            "यसले चलान बनाउँछ — मालसँगै जाने कागज। यो बिल होइन: बिक्री भएकै छैन, त्यसैले VAT को हिसाबमा चढ्दैन।",
          )}
        </p>

        <EnterWalkForm onSubmit={handleSend} className="mt-4 grid gap-3">
          <input type="hidden" name="lineCount" value={lines.length} />
          <input type="hidden" name="fromLocation" value={from} />
          <input type="hidden" name="toLocation" value={to} />
          <input type="hidden" name="sentBy" value={staffName} />
          <input type="hidden" name="sentDate" value={today} />
          {/* One challan per press, however slow the connection. */}
          <input type="hidden" name="submissionKey" value={`trf-${today}-${nextKey}-${staffName}`} />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setFrom(from === "Factory" ? "Shop" : "Factory")}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-green bg-brand-green-wash px-4 text-sm font-black text-brand-green"
            >
              <span>{from === "Factory" ? "🏭" : "🛒"} {placeLabel(from)}</span>
              <span aria-hidden="true">→</span>
              <span>{to === "Factory" ? "🏭" : "🛒"} {placeLabel(to)}</span>
            </button>
            <span className="text-xs text-brand-muted">
              {text("Press to turn it around", "उल्टो पार्न थिच्नुहोस्")}
            </span>
            <span className="ml-auto text-xs font-bold text-brand-muted-soft">{todayBs}</span>
          </div>

          <div className="grid gap-2">
            {lines.map((line, index) => {
              const held = heldAt.get(`${line.design}::${line.sizeRun}`) ?? 0;
              const asking = Number(line.pairs) || 0;
              const tooMany = Boolean(line.design) && asking > held;

              return (
                <div key={line.key} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-center">
                  <input type="hidden" name={`line${index}SizeRun`} value={line.sizeRun} />
                  <select
                    name={`line${index}Design`}
                    className={box}
                    value={line.design ? `${line.design}::${line.sizeRun}` : ""}
                    onChange={(event) => {
                      const [design, sizeRun] = event.target.value.split("::");
                      updateLine(line.key, { design: design ?? "", sizeRun: sizeRun ?? "Mixed" });
                    }}
                    aria-label={text(`Shoe ${index + 1}`, `जुत्ता ${index + 1}`)}
                  >
                    <option value="">{text("Choose a shoe…", "जुत्ता छान्नुहोस्…")}</option>
                    {rows
                      .filter((row) => (from === "Factory" ? row.factory : row.shop) > 0)
                      .map((row) => (
                        <option key={`${row.design}::${row.sizeRun}`} value={`${row.design}::${row.sizeRun}`}>
                          {row.design}
                          {row.sizeRun && row.sizeRun !== "Mixed" ? ` (${row.sizeRun})` : ""} —{" "}
                          {from === "Factory" ? row.factory : row.shop}
                        </option>
                      ))}
                  </select>
                  <input
                    name={`line${index}Pairs`}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    className={`${box} text-right tabular-nums ${tooMany ? "border-brand-clay bg-brand-clay-tint/40" : ""}`}
                    placeholder={text("Pairs", "जोडी")}
                    value={line.pairs}
                    onChange={(event) => updateLine(line.key, { pairs: event.target.value })}
                    aria-label={text(`Pairs ${index + 1}`, `जोडी ${index + 1}`)}
                  />
                  <span className="text-xs font-bold text-brand-muted-soft sm:w-28">
                    {line.design
                      ? tooMany
                        ? text(`only ${held} there`, `त्यहाँ ${held} मात्र`)
                        : text(`${held} there`, `त्यहाँ ${held}`)
                      : ""}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input aria-label="Who is carrying it (optional)"
              name="carriedBy"
              className={box}
              placeholder={text("Who is carrying it (optional)", "कसले लग्यो (चाहिए)")}
            />
            <input aria-label="Vehicle, gate pass, note"
              name="note"
              className={box}
              placeholder={text("Vehicle, gate pass, note", "गाडी, गेट पास, टिपोट")}
            />
          </div>

          {/* The owner's own suggestion: one press when he carries the pairs
              himself, two when somebody else does. */}
          <label className="flex items-start gap-3 rounded-xl border border-brand-green-line bg-brand-mist/40 p-3">
            <input
              type="checkbox"
              name="receiveNow"
              checked={receiveNow}
              onChange={(event) => setReceiveNow(event.target.checked)}
              className="mt-0.5 h-5 w-5 accent-[#12634A]"
            />
            <span className="text-sm leading-6 text-brand-green-ink">
              <strong>{text("Received now", "अहिल्यै बुझ्ने")}</strong>
              <span className="block text-xs text-brand-muted">
                {text(
                  "Tick when you are carrying the pairs yourself — the challan is closed in the same press. Leave it for somebody else to count in.",
                  "आफैं लैजाँदा टिक लगाउनुहोस् — एकै पटकमा सकिन्छ। अरूले लैजाँदा नलगाउनुहोस्, पुगेपछि गनेर बुझ्ने।",
                )}
              </span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="h-12 rounded-full bg-brand-green px-7 text-sm font-black text-white transition hover:bg-brand-green-ink disabled:opacity-60"
            >
              {saving
                ? text("Saving…", "राख्दै…")
                : receiveNow
                  ? text("Move and close", "सारेर सक्ने")
                  : text("Send challan", "चलान पठाउने")}
            </button>
            <ActionMessage state={state} />
          </div>
        </EnterWalkForm>
      </section>

      {/* ── Challans ────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-brand-green-line bg-brand-paper p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-black text-brand-green-ink">
            {text("Challans", "चलान")}
          </h2>
          {waiting.length > 0 ? (
            <span className="rounded-full bg-[#FFF9EA] px-3 py-1 text-xs font-black text-brand-gold-ink">
              {text(`${waiting.length} on the road`, `${waiting.length} बाटोमा`)}
            </span>
          ) : null}
        </div>

        <ActionMessage state={receiveState} />

        <div className="mt-3 grid gap-2">
          {transfers.map((transfer) => {
            const open = openChallan === transfer.id;
            const short = transfer.signal === "Short";
            return (
              <div
                key={transfer.id}
                className={`rounded-xl border p-3 ${
                  transfer.status === "Sent"
                    ? "border-[#EBD9AE] bg-[#FFF9EA]"
                    : short
                      ? "border-brand-clay/40 bg-brand-clay-tint/40"
                      : "border-brand-green-line bg-brand-paper"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-black tabular-nums text-brand-green">{transfer.challanNumber}</p>
                    <p className="text-xs text-brand-muted">
                      {transfer.sentDate} · {transfer.fromLocation === "Factory" ? "🏭" : "🛒"}{" "}
                      {placeLabel(transfer.fromLocation)} → {transfer.toLocation === "Factory" ? "🏭" : "🛒"}{" "}
                      {placeLabel(transfer.toLocation)}
                      {transfer.carriedBy ? ` · ${transfer.carriedBy}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold tabular-nums text-brand-green-ink">
                      {transfer.status === "Sent"
                        ? text(`${transfer.sentPairs} sent`, `${transfer.sentPairs} पठाएको`)
                        : `${transfer.receivedPairs}/${transfer.sentPairs}`}
                    </span>
                    {transfer.status === "Sent" ? (
                      <button
                        type="button"
                        onClick={() => setOpenChallan(open ? null : transfer.id)}
                        className="h-10 rounded-full bg-brand-green px-4 text-xs font-black text-white"
                      >
                        {open ? text("Close", "बन्द") : text("Count it in", "बुझ्ने")}
                      </button>
                    ) : (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          short
                            ? "bg-brand-clay text-white"
                            : transfer.signal === "Excess"
                              ? "bg-[#FFF9EA] text-brand-gold-ink"
                              : "bg-brand-green-wash text-brand-green"
                        }`}
                      >
                        {short
                          ? text(
                              `${transfer.sentPairs - transfer.receivedPairs} short`,
                              `${transfer.sentPairs - transfer.receivedPairs} जोडी छुट्यो`,
                            )
                          : transfer.signal === "Excess"
                            ? text("Extra", "बढी आयो")
                            : text("Arrived", "पुग्यो")}
                      </span>
                    )}
                  </div>
                </div>

                {open ? (
                  <EnterWalkForm onSubmit={handleReceive} className="mt-3 grid gap-2 border-t border-brand-green-line pt-3">
                    <input type="hidden" name="transferId" value={transfer.id} />
                    <input type="hidden" name="receivedBy" value={staffName} />
                    <p className="text-xs text-brand-muted">
                      {text(
                        "Count what actually arrived. Leave a line alone if all of it came.",
                        "साँच्चै कति पुग्यो, त्यही लेख्नुहोस्। पूरै आएको भए छाड्नुहोस्।",
                      )}
                    </p>
                    {transfer.items.map((item) => (
                      <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_110px] items-center gap-2">
                        <span className="truncate text-sm font-semibold text-brand-green-ink">
                          {item.design}
                          <span className="ml-2 text-xs text-brand-muted-soft">
                            {text(`${item.sentPairs} sent`, `${item.sentPairs} पठाएको`)}
                          </span>
                        </span>
                        <input
                          name={`counted:${item.id}`}
                          type="number"
                          min="0"
                          inputMode="numeric"
                          className={`${box} text-right tabular-nums`}
                          placeholder={String(item.sentPairs)}
                          aria-label={text(`${item.design} received`, `${item.design} बुझेको`)}
                        />
                      </div>
                    ))}
                    <button
                      type="submit"
                      disabled={receiving}
                      className="h-11 justify-self-start rounded-full bg-brand-green px-6 text-sm font-black text-white disabled:opacity-60"
                    >
                      {receiving ? text("Saving…", "राख्दै…") : text("Save the count", "गनेको राख्ने")}
                    </button>
                  </EnterWalkForm>
                ) : null}
              </div>
            );
          })}

          {transfers.length === 0 ? (
            <p className="py-6 text-center text-sm text-brand-muted">
              {text("No challans yet.", "अझै कुनै चलान छैन।")}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/** Rows of one shoe (a row per size, or one "Mixed" row) as one line. */
function groupByShoe(rows: StockAtPlace[]) {
  const byShoe = new Map<string, StockAtPlace[]>();
  for (const row of rows) byShoe.set(row.design, [...(byShoe.get(row.design) ?? []), row]);
  return [...byShoe.entries()].map(([design, shoeRows]) => ({
    design,
    rows: shoeRows,
    factory: shoeRows.reduce((sum, row) => sum + row.factory, 0),
    shop: shoeRows.reduce((sum, row) => sum + row.shop, 0),
    total: shoeRows.reduce((sum, row) => sum + row.total, 0),
    noPlace: shoeRows.reduce((sum, row) => sum + Math.max(0, row.unplaced), 0),
    tooMany: shoeRows.reduce((sum, row) => sum + Math.max(0, -row.unplaced), 0),
    sizes: sizesLabel(shoeRows.map((row) => row.sizeRun)),
  }));
}

/** "25–30" for a run of single sizes, the run as written for one row, "" for Mixed. */
function sizesLabel(runs: string[]) {
  const named = runs.filter((run) => run && run !== "Mixed");
  if (named.length === 0) return "";
  if (named.length === 1) return named[0];
  const numbers = named.map(Number);
  if (numbers.every((value) => Number.isFinite(value))) {
    const sorted = [...numbers].sort((a, b) => a - b);
    const consecutive = sorted.every((value, index) => index === 0 || value === sorted[index - 1] + 1);
    if (consecutive) return `${sorted[0]}–${sorted[sorted.length - 1]}`;
    return sorted.join(", ");
  }
  return named.join(", ");
}

function OriginTag({ origin, text }: { origin: ShoeExtra["origin"] | undefined; text: Text }) {
  if (!origin || origin === "Other") return null;
  const label =
    origin === "Made" ? text("made", "बनेको") : origin === "Bought" ? text("bought", "किनेको") : text("made + bought", "बनेको + किनेको");
  const tone = origin === "Bought" ? "bg-[#E6EEF9] text-[#1F4E8C]" : "bg-emerald-50 text-emerald-800";
  return <span className={`ml-2 inline-block rounded-full px-2 py-0.5 align-middle text-[11px] font-black ${tone}`}>{label}</span>;
}

function LastsChip({ extra, text }: { extra: ShoeExtra | undefined; text: Text }) {
  if (!extra?.lasts) return <span className="text-xs text-brand-muted-soft">—</span>;
  const tone: Record<NonNullable<ShoeExtra["lasts"]>["status"], string> = {
    out: "bg-brand-clay text-white",
    urgent: "bg-brand-clay-mist text-brand-clay",
    soon: "bg-amber-100 text-amber-900",
    healthy: "bg-emerald-100 text-emerald-900",
    unknown: "bg-brand-mist text-brand-muted",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-black ${tone[extra.lasts.status]}`}>
      {text(extra.lasts.en, extra.lasts.ne)}
    </span>
  );
}

function PlaceGap({ group, text }: { group: ReturnType<typeof groupByShoe>[number]; text: Text }) {
  if (group.noPlace === 0 && group.tooMany === 0) return <span className="text-brand-muted-soft">—</span>;
  return (
    <a href="#put-right" className="font-bold text-brand-clay underline underline-offset-2">
      {group.noPlace > 0 ? text(`${group.noPlace} no place`, `${group.noPlace} ठाउँ छैन`) : null}
      {group.noPlace > 0 && group.tooMany > 0 ? " · " : null}
      {group.tooMany > 0 ? text(`${group.tooMany} too many`, `${group.tooMany} बढी`) : null}
    </a>
  );
}
