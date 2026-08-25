"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReadyItem } from "@/app/api/factory/ready/route";

/**
 * What has been made, what is on the shelf, and the gap between them.
 *
 * Wages and stock are two separate ledgers on purpose: one shoe passes through
 * Upper and Fibermen, so a wage entry per stage records 60 pairs twice — and if
 * either entry moved stock, 60 finished pairs would show as 120. The owner saw
 * that risk before writing a single entry, and it is why the two must stay
 * apart.
 *
 * The cost of keeping them apart is that nothing said how far apart they had
 * drifted. Work could be entered all week with nobody posting the pairs, and
 * the shop would sit at SOLD OUT with a full godown behind it. Or the same
 * pairs could be posted twice and the shop would sell what was not there.
 * Neither made a sound. This is where the gap becomes visible, on the screen
 * the work is entered from.
 *
 * The suggested figure is the smallest stage total, never the sum, because a
 * pair is finished only once every stage has had it. It is offered as a
 * suggestion and nothing more: the number that goes into stock is the one
 * counted in the godown, which is the owner's rule and the only one that is
 * ever true.
 */
export default function ReadyToPost({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<ReadyItem[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/factory/ready", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "पढ्न सकिएन।");
      setItems((data.items || []) as ReadyItem[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "पढ्न सकिएन।");
      setItems([]);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load, refreshKey]);

  async function post(item: ReadyItem) {
    const pairs = Number(drafts[item.itemId] ?? item.pendingPairs);
    setBusy(item.itemId);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/factory/ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.itemId, pairs }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "चढाउन सकिएन।");
      setMessage(`${item.name} — ${pairs} जोडी स्टकमा चढ्यो। पसलमा तुरुन्तै देखिन्छ।`);
      setDrafts((current) => ({ ...current, [item.itemId]: "" }));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "चढाउन सकिएन।");
    } finally {
      setBusy("");
    }
  }

  if (items === null) {
    return (
      <section className="mt-8 rounded-lg border border-brand-green-line bg-brand-paper p-4 sm:p-6">
        <p className="text-sm text-brand-muted">हेर्दैछौँ…</p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-lg border border-brand-green-line bg-brand-paper p-4 sm:p-6">
      <h2 className="text-xl font-bold text-brand-green-ink">📦 कति तयार भयो — स्टकमा चढाउने</h2>
      <p className="mt-1 text-sm leading-6 text-brand-muted">
        काम टिप्दा ज्याला मात्र चढ्छ, स्टक चढ्दैन — नत्र Upper ६० र Fibermen ६० जोडिएर
        १२० जोडी देखिन्थ्यो। यहाँ <strong>गोदाममा गनेको सङ्ख्या</strong> हाल्नुहोस्।
      </p>

      {message ? (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-brand-muted">
          अझै कुनै काम टिपिएको छैन। माथिको फारमबाट टिप्नुहोस्।
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {items.map((item) => (
            <article
              key={item.itemId}
              className={`rounded-xl border p-4 ${
                item.pendingPairs > 0 ? "border-amber-300 bg-amber-50" : "border-brand-green-line bg-brand-paper"
              }`}
            >
              <h3 className="text-base font-black text-brand-green-ink">{item.name}</h3>

              <dl className="mt-2 grid gap-1 text-sm text-brand-muted-deep">
                {item.stages.map((stage) => (
                  <div key={stage.category} className="flex justify-between">
                    <dt>{stage.category}</dt>
                    <dd className="font-bold tabular-nums">{stage.pairs} जोडी बनेको</dd>
                  </div>
                ))}
                <div className="mt-1 flex justify-between border-t border-brand-green-line pt-1">
                  {/* The smallest stage total, never the sum. Sixty uppers and
                      sixty bottoms are sixty finished pairs. */}
                  <dt>तयार हुनसक्ने</dt>
                  <dd className="font-bold tabular-nums">{item.madePairs} जोडी</dd>
                </div>
                <div className="flex justify-between">
                  <dt>स्टकमा चढिसकेको</dt>
                  <dd className="font-bold tabular-nums">{item.postedPairs} जोडी</dd>
                </div>
              </dl>

              {item.pendingPairs > 0 ? (
                <>
                  <p className="mt-3 text-sm font-black text-amber-900">
                    🟡 {item.pendingPairs} जोडी चढाउन बाँकी
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={drafts[item.itemId] ?? String(item.pendingPairs)}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, [item.itemId]: event.target.value }))
                      }
                      aria-label={`${item.name} को कति जोडी तयार भयो`}
                      className="min-h-12 w-28 rounded-xl border border-brand-green-line px-3 text-brand-green-ink"
                    />
                    <button
                      type="button"
                      onClick={() => void post(item)}
                      disabled={busy === item.itemId}
                      className="min-h-12 rounded-xl bg-brand-green px-4 text-sm font-black text-white disabled:opacity-60"
                    >
                      {busy === item.itemId ? "चढाउँदैछौँ…" : "स्टकमा चढाउने"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-brand-muted">
                    गोदाममा गनेको सङ्ख्या हाल्नुहोस् — माथिको अङ्क अनुमान मात्र हो।
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm font-bold text-green-700">✅ मिलेको छ — चढाउन बाँकी छैन</p>
              )}

              {/* Where these pairs land. A factory name no product carries makes
                  a Draft product, which never reaches a shopper — worth saying
                  before the pairs are posted, not after. */}
              <p className="mt-3 border-t border-brand-green-line pt-2 text-xs leading-5 text-brand-muted">
                {item.productName === null ? (
                  <>⚠️ पसलमा “{item.name}” नामको जुत्ता छैन — चढाउँदा नयाँ Draft बन्नेछ, र Draft पसलमा देखिँदैन।</>
                ) : item.productStatus !== "Active" ? (
                  <>
                    ⚠️ पसलमा “{item.productName}” छ तर <strong>{item.productStatus}</strong> मा —
                    Active नबनाएसम्म ग्राहकले देख्दैनन्। अहिले {item.productStock} जोडी।
                  </>
                ) : (
                  <>✅ पसलमा “{item.productName}” — अहिले {item.productStock} जोडी बिक्रीमा।</>
                )}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
