"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
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
/**
 * One row per item, colour and size run — so the helper that identifies a row
 * has to carry all three. The item id alone was enough while a shoe was made in
 * one colour; now black 36/41 and cherry 36/41 are two rows of the same shoe,
 * and keying on the item would give them the same React key, the same draft box
 * and the same spinner.
 */
function groupKeyOf(item: { itemId: string; colour: string; sizeRun: string }) {
  return `${item.itemId}|${item.colour}|${item.sizeRun}`;
}

/**
 * The number this row will post if the button is pressed now.
 *
 * Whatever the box holds, or the pairs the row found when nothing has been
 * typed — so the button reads the same number the box shows, including after a
 * correction. A half-typed or cleared box falls back to the row's own count
 * rather than offering to post nothing.
 */
function postablePairs(
  item: { itemId: string; colour: string; sizeRun: string; pendingPairs: number },
  drafts: Record<string, string>,
) {
  const typed = Number(drafts[groupKeyOf(item)]);
  return Number.isFinite(typed) && typed > 0 ? typed : item.pendingPairs;
}

export default function ReadyToPost({ refreshKey }: { refreshKey: number }) {
  const { text } = useLanguage();
  const [items, setItems] = useState<ReadyItem[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/factory/ready", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || text("Could not read this.", "पढ्न सकिएन।"));
      setItems((data.items || []) as ReadyItem[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text("Could not read this.", "पढ्न सकिएन।"));
      setItems([]);
    }
  }, [text]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load, refreshKey]);

  async function post(item: ReadyItem) {
    const rowKey = groupKeyOf(item);
    const pairs = Number(drafts[rowKey] ?? item.pendingPairs);
    setBusy(rowKey);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/factory/ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The size run travels with the pairs, so stock lands under the run it
        // was made in rather than as "Mixed" — which the Stock screen cannot
        // place.
        body: JSON.stringify({
          item_id: item.itemId,
          pairs,
          size_run: item.sizeRun,
          // Same row, same count, same key — so a retried request replays
          // instead of posting the pairs twice. Change the count and it is a
          // different key, because that is the owner correcting themselves and
          // a genuinely different post. The already-posted total is in it too,
          // so tomorrow's sixty against today's sixty is not read as a retry.
          submission_key: `ready:${rowKey}:${item.postedPairs}:${pairs}`,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || text("Could not post this.", "चढाउन सकिएन।"));
      setMessage(
        text(
          `${item.name} — ${pairs} pairs posted to stock. They show in the shop straight away.`,
          `${item.name} — ${pairs} जोडी स्टकमा चढ्यो। पसलमा तुरुन्तै देखिन्छ।`,
        ),
      );
      setDrafts((current) => ({ ...current, [rowKey]: "" }));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : text("Could not post this.", "चढाउन सकिएन।"));
    } finally {
      setBusy("");
    }
  }

  if (items === null) {
    return (
      <section className="mt-8 rounded-lg border border-brand-green-line bg-brand-paper p-4 sm:p-6">
        <p className="text-sm text-brand-muted">{text("Looking…", "हेर्दैछौँ…")}</p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-lg border border-brand-green-line bg-brand-paper p-4 sm:p-6">
      <h2 className="text-xl font-bold text-brand-green-ink">
        📦 {text("What is made — post it to stock", "कति तयार भयो — स्टकमा चढाउने")}
      </h2>
      <p className="mt-1 text-sm leading-6 text-brand-muted">
        {text(
          "Recording work adds the wage, not the stock — otherwise Upper's 60 and Fibermen's 60 would add up to 120 pairs. Enter what was counted in the godown.",
          "काम टिप्दा ज्याला मात्र चढ्छ, स्टक चढ्दैन — नत्र Upper ६० र Fibermen ६० जोडिएर १२० जोडी देखिन्थ्यो। यहाँ गोदाममा गनेको सङ्ख्या हाल्नुहोस्।",
        )}
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
          {text(
            "No work has been recorded yet. Add it from the form above.",
            "अझै कुनै काम टिपिएको छैन। माथिको फारमबाट टिप्नुहोस्।",
          )}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {items.map((item) => (
            <article
              key={groupKeyOf(item)}
              className={`rounded-xl border p-4 ${
                item.pendingPairs > 0 ? "border-amber-300 bg-amber-50" : "border-brand-green-line bg-brand-paper"
              }`}
            >
              <h3 className="text-base font-black text-brand-green-ink">{item.name}</h3>

              {/* Which pairs these are. One shoe can now be several rows — black
                  36/41 and cherry 36/41 are different pairs — so without this
                  the owner would be asked to press a button on two rows that
                  look identical. Wraps rather than truncating on a phone:
                  half a size run is worse than a second line. */}
              {item.colour || item.sizeRun ? (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-brand-muted">
                  {item.colour ? <span>{item.colour}</span> : null}
                  {item.colour && item.sizeRun ? (
                    <span aria-hidden="true" className="text-brand-muted-soft">
                      ·
                    </span>
                  ) : null}
                  {item.sizeRun ? <span className="tabular-nums">{item.sizeRun}</span> : null}
                </p>
              ) : null}

              <dl className="mt-2 grid gap-1 text-sm text-brand-muted-deep">
                {item.stages.map((stage) => (
                  <div key={stage.category} className="flex justify-between">
                    <dt>{stage.category}</dt>
                    <dd className="font-bold tabular-nums">
                      {text(`${stage.pairs} pairs made`, `${stage.pairs} जोडी बनेको`)}
                    </dd>
                  </div>
                ))}
                <div className="mt-1 flex justify-between border-t border-brand-green-line pt-1">
                  {/* The smallest stage total, never the sum. Sixty uppers and
                      sixty bottoms are sixty finished pairs. */}
                  <dt>{text("Could be ready", "तयार हुनसक्ने")}</dt>
                  <dd className="font-bold tabular-nums">
                    {text(`${item.madePairs} pairs`, `${item.madePairs} जोडी`)}
                  </dd>
                </div>
                {/* A pair passes through Upper and Fibermen and is finished only
                    when both have made it. Name any required stage that is behind
                    — including one with no entry at all (an upper made, no fiber
                    yet) — so the owner sees the shoe is half-made before posting,
                    not after. */}
                {(() => {
                  const REQUIRED = ["Upper", "Fibermen"];
                  const byStage = new Map(item.stages.map((s) => [s.category, s.pairs]));
                  const maxStage = item.stages.reduce((m, s) => Math.max(m, s.pairs), 0);
                  if (maxStage === 0) return null;
                  // A required stage counts even when it has no entry (zero).
                  const lagging = REQUIRED
                    .map((cat) => ({ cat, pairs: byStage.get(cat) ?? 0 }))
                    .filter((s) => s.pairs < maxStage);
                  if (lagging.length === 0) return null;
                  const names = lagging.map((s) => `${s.cat} (${s.pairs})`).join(", ");
                  return (
                    <p className="mt-1 rounded-lg bg-amber-100 px-2 py-1.5 text-xs font-bold text-amber-900">
                      ⚠️{" "}
                      {text(
                        `${names} is behind — a pair needs both Upper and Fibermen. Post only what is truly finished.`,
                        `${names} पछाडि छ — चप्पल तयार हुन Upper र Fiber दुबै चाहिन्छ। साँच्चै तयार भएको मात्र चढाउनुहोस्।`,
                      )}
                    </p>
                  );
                })()}
                <div className="flex justify-between">
                  <dt>{text("Already posted", "स्टकमा चढिसकेको")}</dt>
                  <dd className="font-bold tabular-nums">
                    {text(`${item.postedPairs} pairs`, `${item.postedPairs} जोडी`)}
                  </dd>
                </div>
              </dl>

              {item.pendingPairs > 0 ? (
                <>
                  <p className="mt-3 text-sm font-black text-amber-900">
                    🟡{" "}
                    {text(
                      `${item.pendingPairs} pairs still to post`,
                      `${item.pendingPairs} जोडी चढाउन बाँकी`,
                    )}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={drafts[groupKeyOf(item)] ?? String(item.pendingPairs)}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          // The same key the value is read from. Written under
                          // the item id, a keystroke landed where the row never
                          // looked and the box appeared to reject every digit.
                          ...current,
                          [groupKeyOf(item)]: event.target.value,
                        }))
                      }
                      aria-label={text(
                        `How many pairs of ${item.name} are ready`,
                        `${item.name} को कति जोडी तयार भयो`,
                      )}
                      className="min-h-12 w-28 rounded-xl border border-brand-green-line px-3 text-brand-green-ink"
                    />
                    <button
                      type="button"
                      onClick={() => void post(item)}
                      disabled={busy === groupKeyOf(item)}
                      className="min-h-12 rounded-xl bg-brand-green px-4 text-sm font-black text-white disabled:opacity-60"
                    >
                      {/* The count is on the button, not only in the box beside
                          it. With the walk to the godown gone, the number and
                          the action have to be readable in one glance — and the
                          number is whatever the box currently holds, so it
                          follows a correction rather than the estimate. */}
                      {busy === groupKeyOf(item)
                        ? text("Posting…", "चढाउँदैछौँ…")
                        : text(
                            `Post ${postablePairs(item, drafts)} pairs`,
                            `${postablePairs(item, drafts)} जोडी चढाउने`,
                          )}
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-brand-muted">
                    {text(
                      "Enter what was counted in the godown — the number above is only an estimate.",
                      "गोदाममा गनेको सङ्ख्या हाल्नुहोस् — माथिको अङ्क अनुमान मात्र हो।",
                    )}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm font-bold text-green-700">
                  ✅ {text("All square — nothing left to post", "मिलेको छ — चढाउन बाँकी छैन")}
                </p>
              )}

              {/* Where these pairs land. A factory name no product carries makes
                  a Draft product, which never reaches a shopper — worth saying
                  before the pairs are posted, not after. */}
              <p className="mt-3 border-t border-brand-green-line pt-2 text-xs leading-5 text-brand-muted">
                {item.productName === null ? (
                  <>
                    ⚠️{" "}
                    {text(
                      `The shop has no shoe called "${item.name}" — posting creates a new Draft, and a Draft is not shown in the shop.`,
                      `पसलमा “${item.name}” नामको जुत्ता छैन — चढाउँदा नयाँ Draft बन्नेछ, र Draft पसलमा देखिँदैन।`,
                    )}
                  </>
                ) : item.productStatus !== "Active" ? (
                  <>
                    ⚠️{" "}
                    {text(
                      `The shop has "${item.productName}" but it is ${item.productStatus} — customers cannot see it until it is Active. ${item.productStock} pairs now.`,
                      `पसलमा “${item.productName}” छ तर ${item.productStatus} मा — Active नबनाएसम्म ग्राहकले देख्दैनन्। अहिले ${item.productStock} जोडी।`,
                    )}
                  </>
                ) : (
                  <>
                    ✅{" "}
                    {text(
                      `In the shop as "${item.productName}" — ${item.productStock} pairs on sale now.`,
                      `पसलमा “${item.productName}” — अहिले ${item.productStock} जोडी बिक्रीमा।`,
                    )}
                  </>
                )}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
