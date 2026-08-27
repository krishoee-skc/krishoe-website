"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ActionMessage from "@/components/admin/ActionMessage";
import { useLanguage } from "@/components/LanguageProvider";
import type { ActionState } from "@/app/admin/actions";
import {
  createStockTransferAction,
  receiveStockTransferAction,
} from "@/app/admin/stock/actions";
import type { StockAtPlace, StockTransfer } from "@/lib/stock-transfers";

type Props = {
  rows: StockAtPlace[];
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
export default function WherePairsAre({ rows, transfers, staffName, today, todayBs }: Props) {
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

  const to = from === "Factory" ? "Shop" : "Factory";

  const totals = useMemo(() => {
    return rows.reduce(
      (sum, row) => ({
        factory: sum.factory + row.factory,
        shop: sum.shop + row.shop,
        total: sum.total + row.total,
        unplaced: sum.unplaced + row.unplaced,
      }),
      { factory: 0, shop: 0, total: 0, unplaced: 0 },
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

  return (
    <div className="mt-6 grid gap-4">
      {/* ── Where the pairs are ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-brand-green-line bg-brand-paper p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-brand-green-ink">
              {text("Where the pairs are", "जुत्ता कहाँ छ")}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-brand-muted">
              {text(
                "Of the pairs in stock, how many sit at the factory and how many at the shop. Selling is unchanged — it still draws from the total.",
                "स्टकमा भएका जोडीमध्ये कति कारखानामा र कति पसलमा। बिक्री उस्तै छ — जम्माबाटै घट्छ।",
              )}
            </p>
          </div>
          <div className="flex gap-2 text-center">
            <div className="rounded-xl border border-[#EBD9AE] bg-[#FFF9EA] px-4 py-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-brand-gold-ink">
                🏭 {placeLabel("Factory")}
              </p>
              <p className="text-2xl font-black tabular-nums text-brand-gold-ink">{totals.factory}</p>
            </div>
            <div className="rounded-xl border border-brand-green/30 bg-brand-green-wash px-4 py-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-brand-green">
                🛒 {placeLabel("Shop")}
              </p>
              <p className="text-2xl font-black tabular-nums text-brand-green">{totals.shop}</p>
            </div>
          </div>
        </div>

        {totals.unplaced !== 0 ? (
          <p className="mt-3 rounded-xl border border-[#F4DEAE] bg-[#FFF9EA] px-4 py-3 text-sm leading-6 text-brand-gold-ink">
            {text(
              `${Math.abs(totals.unplaced)} pair(s) are in stock without a place — either on the road on a challan, or made or bought before this screen existed. Count them in below.`,
              `${Math.abs(totals.unplaced)} जोडी स्टकमा छन् तर ठाउँ भनिएको छैन — या त चलानमा बाटोमा छन्, या यो पर्दा बन्नुअघिका हुन्। तल गनेर मिलाउनुहोस्।`,
            )}
          </p>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-[0.12em] text-brand-muted-soft">
                <th className="pb-2 pr-3 text-left">{text("Shoe", "जुत्ता")}</th>
                <th className="pb-2 pr-3 text-right">🏭 {placeLabel("Factory")}</th>
                <th className="pb-2 pr-3 text-right">🛒 {placeLabel("Shop")}</th>
                <th className="pb-2 pr-3 text-right">{text("In stock", "जम्मा")}</th>
                <th className="pb-2 text-right">{text("No place", "ठाउँ छैन")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.design}::${row.sizeRun}`} className="border-t border-brand-green-line">
                  <td className="py-2.5 pr-3 font-semibold text-brand-green-ink">
                    {row.design}
                    {row.sizeRun && row.sizeRun !== "Mixed" ? (
                      <span className="ml-2 text-xs font-bold text-brand-muted-soft">{row.sizeRun}</span>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-bold tabular-nums text-brand-gold-ink">
                    {row.factory || <span className="text-brand-muted-soft">0</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-bold tabular-nums text-brand-green">
                    {row.shop || <span className="text-brand-muted-soft">0</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-right font-bold tabular-nums text-brand-green-ink">
                    {row.total}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {row.unplaced === 0 ? (
                      <span className="text-brand-muted-soft">—</span>
                    ) : (
                      <span className="font-bold text-brand-clay">{row.unplaced}</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-brand-muted">
                    {text("No ready stock yet.", "अझै तयारी माल छैन।")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
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

        <form onSubmit={handleSend} className="mt-4 grid gap-3">
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
            <input
              name="carriedBy"
              className={box}
              placeholder={text("Who is carrying it (optional)", "कसले लग्यो (चाहिए)")}
            />
            <input
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
        </form>
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
                  <form onSubmit={handleReceive} className="mt-3 grid gap-2 border-t border-brand-green-line pt-3">
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
                  </form>
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
