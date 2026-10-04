"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import Link from "next/link";
import ReadyToPost from "@/app/admin/factory/add-work/ReadyToPost";
import TodayEntries, { type DayEntry } from "@/app/admin/factory/add-work/TodayEntries";
import { createIdempotencyKeyRegistry } from "@/app/admin/factory/_components/idempotency-key";
import { nepalDateKey } from "@/app/admin/factory/_components/nepal-date";
import { FACTORY_WORKER_CATEGORIES, factoryCategoryLabel } from "@/lib/factory-worker-options";
import { pieceWage } from "@/lib/factory-board";
import { quoteWork, type FactoryRate } from "@/lib/factory-rate-book";
import {
  compactSizeRun,
  countsFromSizeRun,
  expandSizeRun,
  normaliseSizeCounts,
  productSizes,
  sizeCountsTotal,
  sizeRunKey,
  sizesInRun,
  toggleSize,
} from "@/lib/shoe-sizes";
import { colourKey } from "@/lib/colour-name";
import { toBikramSambatNepali } from "@/lib/bikram-sambat";
import { money } from "@/lib/format-money";
import { colourSwatch, compactSizes } from "@/lib/shoe-colour";
import { stageNeedingUpperFirst } from "@/lib/stage-order";
import { productionStageForFactoryCategory } from "@/lib/factory-stage";
import { useToast } from "@/components/admin/ToastProvider";
import NepaliDateField from "@/components/admin/NepaliDateField";

import {
  COMMON_COLOURS,
  DEFAULT_PAIRS,
  PAIRS_STEP,
  WORK_SIZE_RUNS,
  WORK_WALK,
  fillFromWaitingRun,
  waitingCounts,
  type Item,
  type WorkField,
  type Worker,
} from "@/app/admin/factory/add-work/work-entry-rules";

// The rules these boxes follow — the shapes, the amounts this shop counts in,
// the order Enter walks the boxes, and what is waiting on a shoe — live in
// work-entry-rules.ts. Re-exported because the tests that cover those two
// decisions have always imported them from this file.
export { fillFromWaitingRun, waitingCounts };

// Every box and button on the form the same height, so a row of four reads as
// one row. The owner's words: the boxes did not line up.
const CONTROL =
  "h-12 w-full min-w-0 rounded-lg border border-brand-green-line bg-brand-paper px-3 text-brand-green-ink focus:border-transparent focus:ring-2 focus:ring-brand-gold disabled:bg-brand-mist disabled:text-brand-muted";
const LABEL = "mb-1.5 block truncate text-sm font-bold text-brand-green-ink";
const HINT = "mt-1 min-h-5 text-xs text-brand-muted";

const WEEKDAYS = [
  { en: "Sunday", ne: "आइतबार" },
  { en: "Monday", ne: "सोमबार" },
  { en: "Tuesday", ne: "मंगलबार" },
  { en: "Wednesday", ne: "बुधबार" },
  { en: "Thursday", ne: "बिहीबार" },
  { en: "Friday", ne: "शुक्रबार" },
  { en: "Saturday", ne: "शनिबार" },
] as const;

/** The day before a YYYY-MM-DD key, as a key. */
function dayBefore(key: string) {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

type LastEntry = {
  worker_id: string;
  stage: string;
  item_id: string;
  color: string;
  size: string;
};

export default function WorkEntryForm({
  initialWorkers,
  initialItems,
  initialRates,
}: {
  initialWorkers: Worker[];
  initialItems: Item[];
  initialRates: FactoryRate[];
}) {
  const { text, language } = useLanguage();
  const toast = useToast();
  const [workers] = useState<Worker[]>(initialWorkers);

  // Enter moves the cursor along every box and on to Save, so it has to be able
  // to find each one.
  const walkRefs = useRef(new Map<WorkField, HTMLElement | null>());
  // A ref rather than state: the box to move to is decided in a key handler
  // and acted on after the next render, which is a note-to-self rather than
  // something the screen is drawn from.
  const pendingFocus = useRef<WorkField | "confirm" | null>(null);
  const confirmYes = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    const target = key === "confirm" ? confirmYes.current : walkRefs.current.get(key);
    if (!target) return;
    pendingFocus.current = null;
    target.focus();
    if (target instanceof HTMLInputElement) target.select();
  });

  const [items, setItems] = useState<Item[]>(initialItems);
  // Every rate in force, so picking an item prices the work with no round trip.
  // A rate the owner sets from this screen is added to it on the spot.
  const [rates, setRates] = useState<FactoryRate[]>(initialRates);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    date: nepalDateKey(),
    worker_id: "",
    item_id: "",
    // The production stage this entry is for — the work actually done, not the
    // worker's fixed category, because fiber silai can be done by anyone. Blank
    // until a worker is chosen, then it defaults to that worker's category and
    // can be changed on the dropdown beside it.
    stage: "",
    color: "",
    size: "",
    // Sixty: every entry this shop has ever made is sixty pairs. Typing over
    // it is one action; typing it out is two.
    pairs_count: String(DEFAULT_PAIRS),
    reject_pairs: "",
    status: "completed",
  });

  const [selectedRate, setSelectedRate] = useState<number | null>(null);
  const [calculatedAmount, setCalculatedAmount] = useState<number>(0);
  // Bumped when a work entry saves, so the panels recount without the page
  // being reloaded by hand.
  const [workSaved, setWorkSaved] = useState(0);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  /**
   * What the save noticed about the uppers behind this bottom work.
   *
   * createFactoryWork counts them and puts a shortfall on the response. Its own
   * state rather than folded into `success`, because the entry did save: the
   * wage is earned and the work is recorded, and the note sits beside that.
   */
  const [upperWarning, setUpperWarning] = useState<string>("");
  /**
   * How many pairs in each size, when the entry says.
   *
   * The owner's question: a 36–41 run where 38 was made twice. One total and
   * one piece of text cannot record it, so the screen asks the way the question
   * is asked — a box per size, and the total adds itself up. Empty until the
   * boxes are opened.
   */
  const [sizeCounts, setSizeCounts] = useState<Record<string, string>>({});
  const [showSizeCounts, setShowSizeCounts] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  // Which half of the screen is showing: the entry form, or the post-to-stock
  // list. "entry" first — that is what this screen is opened to do.
  const [view, setView] = useState<"entry" | "post">("entry");
  const [newProductName, setNewProductName] = useState("");
  const [showSetRate, setShowSetRate] = useState(false);
  const [newRate, setNewRate] = useState("");
  const [idempotencyKeys] = useState(() => createIdempotencyKeyRegistry());
  // The calendar opens only when the day is neither today nor yesterday.
  const [pickingDate, setPickingDate] = useState(false);
  // What was saved last, for "↻ same as last".
  const [lastEntry, setLastEntry] = useState<LastEntry | null>(null);
  /** What was just saved, shown in full until the next entry is begun (2026-10-04). */
  const [savedCard, setSavedCard] = useState<{
    workerId: string; workerName: string; itemName: string; color: string; size: string; pairs: string; amount: number; pending: boolean;
  } | null>(null);
  // The question Save asks before writing: always after Enter, and after a
  // click when the same work is already on the day's list.
  const [confirming, setConfirming] = useState<{ duplicate: boolean } | null>(null);
  const [dayEntries, setDayEntries] = useState<DayEntry[] | null>(null);

  const loadDay = useCallback(async (date: string) => {
    try {
      const response = await fetch(`/api/factory/work?date=${encodeURIComponent(date)}`, { cache: "no-store" });
      const data = await response.json();
      setDayEntries(Array.isArray(data?.works) ? (data.works as DayEntry[]) : []);
    } catch {
      // The list is a help beside the form, not the form. A failure leaves it
      // empty and the entry itself untouched.
      setDayEntries([]);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void loadDay(formData.date), 0);
    return () => window.clearTimeout(id);
  }, [loadDay, formData.date, workSaved]);

  /**
   * The rate for who is working, on what, at which stage, on the day being
   * entered — looked up in the book the page arrived with. No request, so the
   * amount appears as the item is chosen rather than a moment after.
   */
  const priceFor = (workerId: string, itemId: string, stage: string, pairs: number) => {
    const worker = workers.find((entry) => entry.id === workerId);
    if (!worker || !itemId) return null;

    return quoteWork(rates, {
      itemId,
      workerId,
      stage: productionStageForFactoryCategory(stage || worker.category) ?? "",
      workerCategory: worker.category,
      onDate: formData.date,
    }, pairs);
  };

  /** Price what is on the form now, and say plainly when there is no rate. */
  const applyQuote = (workerId: string, itemId: string, stage: string, pairsText: string) => {
    if (!workerId || !itemId) {
      setSelectedRate(null);
      setCalculatedAmount(0);
      return;
    }
    const quote = priceFor(workerId, itemId, stage, parseInt(pairsText) || 0);
    if (quote?.rate) {
      setSelectedRate(quote.rate);
      setShowSetRate(false);
      setCalculatedAmount(quote.amount);
      return;
    }
    // No rate on file for this item and this kind of work. That is a question
    // for the owner, not a zero — the form offers to set one.
    setSelectedRate(null);
    setCalculatedAmount(0);
    setShowSetRate(true);
    setSuccess(
      text(
        "No rate set for this yet — add one below.",
        "यसको दर अझै तोकिएको छैन — तल थप्नुहोस्।",
      ),
    );
  };

  const handleWorkerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const workerId = e.target.value;
    // Default the stage to the chosen worker's category — the common case — but
    // leave it changeable, since fiber silai can be done by an Upper man too.
    const worker = workers.find((w) => w.id === workerId);
    const stage = worker?.category ?? "";
    setFormData((prev) => ({ ...prev, worker_id: workerId, stage }));
    applyQuote(workerId, formData.item_id, stage, formData.pairs_count);
  };

  const handleStageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const stage = e.target.value;
    setFormData((prev) => ({ ...prev, stage }));
    applyQuote(formData.worker_id, formData.item_id, stage, formData.pairs_count);
  };

  const handleItemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const itemId = e.target.value;
    // Open the colour and size with what this shoe is actually waiting in,
    // rather than empty. Both stay editable — this is the answer for the
    // ordinary case, not a lock.
    const waiting = items.find((item) => item.id === itemId)?.waitingRuns ?? [];
    const filled = fillFromWaitingRun(waiting, formData.stage);
    setFormData((prev) => ({
      ...prev,
      item_id: itemId,
      color: filled.color,
      size: filled.size,
    }));
    setError("");
    applyQuote(formData.worker_id, itemId, formData.stage, formData.pairs_count);
  };

  const handlePairsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pairs = parseInt(e.target.value) || 0;
    setSavedCard((card) => (card?.pending ? card : null));
    setFormData((prev) => ({ ...prev, pairs_count: e.target.value }));
    setCalculatedAmount(selectedRate ? pieceWage(pairs, selectedRate) : 0);
  };

  /**
   * Step the pair count by a dozen, without reaching for the keyboard.
   *
   * From sixty when the box is empty rather than from zero, and rounded to the
   * dozen, so the buttons always land on a quantity the shop actually makes.
   * Typing any number by hand still works; this is only what the buttons do.
   */
  const stepPairs = (by: number) => {
    const typed = parseInt(formData.pairs_count);
    const from = Number.isFinite(typed) && typed > 0 ? typed : DEFAULT_PAIRS;
    const next = Math.max(PAIRS_STEP, Math.round((from + by) / PAIRS_STEP) * PAIRS_STEP);

    setSavedCard((card) => (card?.pending ? card : null));
    setFormData((prev) => ({ ...prev, pairs_count: String(next) }));
    setCalculatedAmount(selectedRate ? pieceWage(next, selectedRate) : 0);
  };

  // Only when the box actually holds the floor. An empty box steps from sixty,
  // so minus has somewhere to go and must stay live.
  const pairsAtFloor = parseInt(formData.pairs_count) === PAIRS_STEP;

  const handleAddProduct = async () => {
    if (!newProductName.trim()) {
      setError("Product name is required");
      return;
    }

    try {
      const res = await fetch("/api/factory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProductName }),
      });

      if (!res.ok) throw new Error("Failed to add product");

      const data = await res.json();

      // Link it to the Production Item Master now, so work on it saves. An
      // unlinked item is refused at save time, and being sent to another
      // screen with a worker standing there is not a thing to discover later.
      let productionItemId: string | null = null;
      try {
        const linkRes = await fetch("/api/factory/items", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: data.id, create_production_item: true }),
        });
        if (linkRes.ok) {
          const linked = await linkRes.json();
          productionItemId = linked?.item?.production_item_id ?? null;
        }
      } catch {
        // Leave it unlinked; the items screen links it in one tap.
      }

      setItems([
        ...items,
        {
          id: data.id,
          name: data.name,
          // A shoe created from this form has no work behind it yet, so no
          // uppers are waiting. It refreshes with the page.
          uppersWaiting: 0,
          waitingRuns: [],
          code: "",
          sizes: [],
          production_item_id: productionItemId,
        },
      ]);
      setFormData((prev) => ({ ...prev, item_id: data.id }));
      setNewProductName("");
      setShowAddProduct(false);
      setSuccess("✅ Product added! Now set the rate.");
      setShowSetRate(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add product");
    }
  };

  const handleSetRate = async () => {
    if (!newRate || !formData.item_id) {
      setError("Rate is required");
      return;
    }

    const selectedWorker = workers.find((w) => w.id === formData.worker_id);
    if (!selectedWorker) {
      setError(text("Please select a worker first", "पहिले कामदार छान्नुहोस्"));
      return;
    }

    try {
      const res = await fetch("/api/factory/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: formData.item_id,
          worker_category: selectedWorker.category,
          rate_per_pair: parseFloat(newRate),
        }),
      });

      if (!res.ok) throw new Error("Failed to set rate");

      const added = parseFloat(newRate);
      setRates((current) => [
        ...current,
        {
          itemId: formData.item_id,
          workerId: "",
          stage: "",
          workerCategory: selectedWorker.category,
          ratePerPair: added,
          effectiveFrom: formData.date,
          source: "Factory rate" as const,
        },
      ]);
      setSelectedRate(added);
      setNewRate("");
      setShowSetRate(false);
      setSuccess("✅ Rate set! Amount will calculate now.");

      if (formData.pairs_count) {
        setCalculatedAmount(pieceWage(parseFloat(formData.pairs_count), parseFloat(newRate)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set rate");
    }
  };

  // The shoe on the form, its sizes, and what was last made of it.
  const currentItem = items.find((item) => item.id === formData.item_id);
  const itemSizes = currentItem?.sizes ?? [];
  const chosenSizes = formData.size
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  /**
   * The colour chips, with this shoe's usual colour first and starred.
   *
   * The usual colour is the one last entered on it. When it is one of the six
   * chips, that chip moves to the front; when it is something else ("Maroon"),
   * it gets a chip of its own in front of them.
   */
  const lastColour = currentItem?.lastColour?.trim() ?? "";
  const colourChips = (() => {
    const chips = COMMON_COLOURS.map((c) => ({
      key: c.en,
      value: text(c.en, c.ne),
      label: text(c.en, c.ne),
      hex: c.hex as string,
      star: Boolean(lastColour) && (colourKey(lastColour) === colourKey(c.en) || colourKey(lastColour) === colourKey(c.ne)),
      matches: [colourKey(c.en), colourKey(c.ne)],
    }));
    if (!lastColour) return chips;
    const starred = chips.filter((chip) => chip.star);
    if (starred.length > 0) return [...starred, ...chips.filter((chip) => !chip.star)];
    return [
      { key: `last:${lastColour}`, value: lastColour, label: lastColour, hex: "transparent", star: true, matches: [colourKey(lastColour)] },
      ...chips,
    ];
  })();

  /**
   * The size runs, this shoe's own first and starred: the run last entered on
   * it, then the sizes its catalogue product is made in. The five runs the
   * factory makes follow, without repeating a starred one.
   */
  const sizeChips = (() => {
    const starred: string[] = [];
    for (const value of [currentItem?.lastSize ?? "", itemSizes.join(", ")]) {
      const key = sizeRunKey(value);
      if (key && !starred.some((seen) => sizeRunKey(seen) === key)) starred.push(value);
    }
    const runs = WORK_SIZE_RUNS.map((run) => productSizes(sizesInRun(run)).join(", ")).filter(
      (value) => !starred.some((seen) => sizeRunKey(seen) === sizeRunKey(value)),
    );
    return [
      ...starred.map((value) => ({ value, star: true })),
      ...runs.map((value) => ({ value, star: false })),
    ];
  })();

  // The sizes the boxes are drawn for, in the order they are made. Read from
  // the size field itself so a run typed "36/41" gets the same six boxes as one
  // tapped out size by size.
  const countableSizes = expandSizeRun(formData.size);
  const countedPairs = sizeCountsTotal(normaliseSizeCounts(sizeCounts));

  /**
   * Open the boxes, pre-filled from the run.
   *
   * Sixty over six sizes is ten of each, which is what every row in the factory
   * already means by "60 pairs, 36/41". Opening on that rather than on six
   * empty boxes keeps the ordinary entry to no typing at all.
   */
  const openSizeCounts = () => {
    const seeded = countsFromSizeRun(formData.size, parseInt(formData.pairs_count) || 0);
    setSizeCounts(
      Object.fromEntries(Object.entries(seeded).map(([size, pairs]) => [size, String(pairs)])),
    );
    setShowSizeCounts(true);
  };

  /** Put the count back to one typed number, leaving the total as it stands. */
  const closeSizeCounts = () => {
    setShowSizeCounts(false);
    setSizeCounts({});
  };

  /** Whether a row already on the day's list is the work on the form now. */
  const looksLikeForm = (entry: DayEntry) =>
    Boolean(formData.worker_id && formData.item_id) &&
    entry.status !== "reversed" &&
    entry.worker_id === formData.worker_id &&
    entry.item_id === formData.item_id &&
    Number(entry.pairs_count) === (parseInt(formData.pairs_count) || 0) &&
    colourKey(entry.color) === colourKey(formData.color) &&
    sizeRunKey(entry.size) === sizeRunKey(formData.size);

  /**
   * Check the form before anything is asked or written.
   *
   * Which box is missing, and the cursor put in it: the person is mid-entry
   * with a worker waiting, and "fill the form" sends them looking.
   */
  const checkForm = () => {
    if (!formData.worker_id) {
      setError(text("Choose the worker.", "कामदार छान्नुहोस्।"));
      pendingFocus.current = "worker";
      return false;
    }
    if (!formData.item_id) {
      setError(text("Choose the shoe.", "जुत्ता छान्नुहोस्।"));
      pendingFocus.current = "item";
      return false;
    }
    if (!(parseInt(formData.pairs_count) > 0)) {
      setError(text("How many pairs?", "कति जोडी?"));
      pendingFocus.current = "pairs";
      return false;
    }
    if (!formData.color.trim() || !formData.size.trim()) {
      const missing = !formData.color.trim() && !formData.size.trim()
        ? text("colour and size", "रङ र साइज")
        : !formData.color.trim()
          ? text("colour", "रङ")
          : text("size", "साइज");
      setError(
        text(
          `Choose the ${missing} — the ledger has to say which pairs this wage was for.`,
          `${missing} छान्नुहोस् — यो ज्याला कुन जुत्ताको हो खातामा देखिनुपर्छ।`,
        ),
      );
      pendingFocus.current = !formData.color.trim() ? "colour" : "size";
      return false;
    }
    return true;
  };

  /**
   * Save was pressed. From the keyboard it always asks first; with a click it
   * asks only when the same work is already on the day's list — a second
   * sixty pairs is a second wage.
   */
  const requestSave = (fromKeyboard: boolean) => {
    setError("");
    setSuccess("");
    if (!checkForm()) return;
    const duplicate = (dayEntries ?? []).some(looksLikeForm);
    if (fromKeyboard || duplicate) {
      setConfirming({ duplicate });
      pendingFocus.current = "confirm";
      return;
    }
    void saveEntry();
  };

  const cancelConfirm = () => {
    setConfirming(null);
    pendingFocus.current = "save";
  };

  /**
   * Enter and Shift+Enter along every box, and on to Save.
   *
   * A box that cannot take the cursor (the stage before a worker is chosen) is
   * stepped over. Enter on Save asks before writing, so a mis-hit never files a
   * wage.
   */
  function handleFieldWalk(event: React.KeyboardEvent<HTMLElement>, field: WorkField) {
    if (event.key !== "Enter") return;
    event.preventDefault();

    if (field === "save" && !event.shiftKey) {
      requestSave(true);
      return;
    }

    const at = WORK_WALK.indexOf(field);
    const step = event.shiftKey ? -1 : 1;
    for (let index = at + step; index >= 0 && index < WORK_WALK.length; index += step) {
      const target = walkRefs.current.get(WORK_WALK[index]);
      if (target && !(target as HTMLInputElement).disabled) {
        target.focus();
        if (target instanceof HTMLInputElement) target.select();
        return;
      }
    }
  }

  /** Fill the form with what was saved last, leaving the pairs to type. */
  const repeatLast = () => {
    if (!lastEntry) return;
    setSavedCard(null);
    setFormData((prev) => ({ ...prev, ...lastEntry }));
    applyQuote(lastEntry.worker_id, lastEntry.item_id, lastEntry.stage, formData.pairs_count);
    setError("");
    setSuccess("");
    pendingFocus.current = "pairs";
    walkRefs.current.get("pairs")?.focus();
  };

  const saveEntry = async () => {
    setConfirming(null);
    setError("");
    setSuccess("");
    // A warning left from the last entry would be read as belonging to this
    // one — and the next entry is usually the one that was corrected.
    setUpperWarning("");

    // What is being sent, kept aside: the form is cleared immediately, and this
    // is what goes back into it if the save fails.
    //
    // When the boxes are open they carry the count: the server takes the total
    // from them, so sending a separately typed pairs_count beside them is the
    // disagreement this change exists to remove.
    const counted = showSizeCounts ? normaliseSizeCounts(sizeCounts) : {};
    const hasCounted = sizeCountsTotal(counted) > 0;
    // The form's own fields, which is what goes back on a failure.
    const entry = {
      ...formData,
      pairs_count: hasCounted ? String(sizeCountsTotal(counted)) : formData.pairs_count,
    };
    // And what is sent: the same fields, plus the breakdown when there is one.
    const payload = hasCounted ? { ...entry, size_counts: counted } : entry;
    const keyScope = `work:${JSON.stringify(payload)}`;
    const key = idempotencyKeys.get(keyScope);
    idempotencyKeys.rotate(keyScope);

    // What is being saved, in full, on a card above the form.
    setSavedCard({
      workerId: entry.worker_id,
      workerName: workers.find((worker) => worker.id === entry.worker_id)?.name ?? "",
      itemName: items.find((item) => item.id === entry.item_id)?.name ?? "",
      color: entry.color,
      size: entry.size,
      pairs: entry.pairs_count,
      amount: calculatedAmount,
      pending: true,
    });

    // Clear for the next row now, not when the server answers. The worker, the
    // item and the stage stay: a person makes three or four rows of the same
    // work, and re-picking them each time was most of the typing. The pairs
    // go blank, not back to sixty (owner, 2026-10-04): sixty again read as the
    // entry not saved, and a blank box keeps Save shut until the next count.
    setFormData((current) => ({
      ...current,
      pairs_count: "",
      reject_pairs: "",
      size: "",
      color: "",
    }));
    setCalculatedAmount(0);
    // The size is cleared, so boxes for it would be boxes for nothing.
    closeSizeCounts();
    // Back to the first box, ready for the next entry.
    pendingFocus.current = "worker";

    setSubmitting(true);

    try {
      const res = await fetch("/api/factory/work", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save work entry");
      }

      const saved = await res.json().catch(() => ({}));
      // The shortfall the save worked out, if any. Empty on an ordinary entry,
      // so the note only appears on the day something needs looking at.
      setUpperWarning(typeof saved?.upper_warning === "string" ? saved.upper_warning : "");
      setWorkSaved((count) => count + 1);
      setSavedCard((card) => (card ? { ...card, pending: false, amount: Number(saved?.amount_earned) || card.amount } : card));
      setLastEntry({
        worker_id: entry.worker_id,
        stage: entry.stage,
        item_id: entry.item_id,
        color: entry.color,
        size: entry.size,
      });

      const pairs = entry.pairs_count;
      const worker = workers.find((entry_) => entry_.id === entry.worker_id);
      toast.show(
        text(
          `Saved — ${pairs} pairs for ${worker?.name ?? "the worker"}`,
          `टिपियो — ${worker?.name ?? "कामदार"} को ${pairs} जोडी`,
        ),
        "success",
      );
    } catch (err) {
      setSavedCard(null);
      // Put it back exactly as typed. A wage entry that vanishes because the
      // network blinked is a day's work the factory has to remember by hand —
      // the per-size boxes included, which are the slowest part to retype.
      setFormData(entry);
      if (hasCounted) {
        setSizeCounts(
          Object.fromEntries(Object.entries(counted).map(([size, pairs]) => [size, String(pairs)])),
        );
        setShowSizeCounts(true);
      }
      setCalculatedAmount(
        priceFor(entry.worker_id, entry.item_id, entry.stage, parseInt(entry.pairs_count) || 0)
          ?.amount ?? 0,
      );
      const message = err instanceof Error ? err.message : "Failed to save work entry";
      setError(message);
      toast.show(
        text(`Not saved — ${message}`, `टिपिएन — ${message}`),
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestSave(false);
  };

  // The day, said the way the owner reads it: "Today · Saturday 11 Asoj 2083".
  const todayKey = nepalDateKey();
  const yesterdayKey = dayBefore(todayKey);
  const weekday = WEEKDAYS[new Date(`${formData.date}T00:00:00Z`).getUTCDay()] ?? WEEKDAYS[0];
  const bsDate = toBikramSambatNepali(formData.date);
  const dayWord =
    formData.date === todayKey
      ? text("Today", "आज")
      : formData.date === yesterdayKey
        ? text("Yesterday", "हिजो")
        : "";
  const dateLabel = [dayWord, `${text(weekday.en, weekday.ne)} ${bsDate}`].filter(Boolean).join(" · ");

  const worker = workers.find((w) => w.id === formData.worker_id);
  const pairsNow = parseInt(formData.pairs_count) || 0;
  const confirmSummary = [
    worker?.name ?? "",
    currentItem?.name ?? "",
    formData.color,
    compactSizeRun(formData.size),
    text(`${pairsNow} pairs`, `${pairsNow} जोडी`),
    calculatedAmount > 0 ? money(calculatedAmount) : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6">
      {/* No title block here, deliberately: the breadcrumb and the highlighted
          tab already say "Add work", and on a phone a heading here was a tenth
          of the screen spent repeating them. */}

      {/* Two views, one at a time, so the page stays short: entering work, and
          posting what was made to stock. */}
      <div className="mt-1 flex gap-1.5 rounded-xl bg-brand-mist p-1 sm:mt-5">
        <button
          type="button"
          onClick={() => setView("entry")}
          className={`flex-1 min-h-11 rounded-lg px-3 text-sm font-black transition ${
            view === "entry" ? "bg-brand-green-ink text-white shadow-sm" : "text-brand-muted"
          }`}
        >
          📝 {text("Add work", "काम टिप्ने")}
        </button>
        <button
          type="button"
          onClick={() => setView("post")}
          className={`flex-1 min-h-11 rounded-lg px-3 text-sm font-black transition ${
            view === "post" ? "bg-brand-green-ink text-white shadow-sm" : "text-brand-muted"
          }`}
        >
          📦 {text("Post to stock", "माल चढाउने")}
        </button>
      </div>

      {/* The whole width on a computer: the form on the left, the day's
          entries on the right. It sat in a narrow column with half the screen
          empty either side. On a phone the list follows the form. */}
      {/* The grid class only while this view shows. `lg:grid` sets display
          itself, which beats the hidden attribute on a computer — so the form
          and the day's list stayed on screen above "Post to stock". */}
      <div
        hidden={view !== "entry"}
        className={view === "entry" ? "lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6" : "hidden"}
      >
        <form
          onSubmit={handleSubmit}
          className="mt-5 space-y-4 rounded-lg border border-brand-green-line bg-brand-paper p-4 sm:p-5"
        >
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* What was just saved, in full, until the next entry is begun
              (owner, 2026-10-04: after a save the form showed "Save 60 pairs ·
              Rs. 2,400" again, and it read as not saved). */}
          {savedCard ? (
            <div role="status" className="grid gap-2 rounded-2xl border-2 border-brand-green bg-brand-green-wash p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-lg font-black text-brand-green">
                  {savedCard.pending ? text("⏳ Saving…", "⏳ टिप्दै…") : text("✓ Saved", "✓ टिपियो")}
                </p>
                <p className="text-xs font-bold text-brand-muted">{text("just now", "भर्खर")}</p>
              </div>
              <p className="flex flex-wrap items-center gap-x-1.5 text-sm font-bold text-brand-green-ink">
                <span>{savedCard.workerName}</span>
                <span aria-hidden="true">·</span>
                <span>{savedCard.itemName}</span>
                {savedCard.color ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      {colourSwatch(savedCard.color) ? (
                        <span aria-hidden="true" className="h-3 w-3 rounded-full ring-1 ring-black/20" style={{ background: colourSwatch(savedCard.color) ?? undefined }} />
                      ) : null}
                      {savedCard.color}
                    </span>
                  </>
                ) : null}
                {savedCard.size ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{compactSizes(savedCard.size)}</span>
                  </>
                ) : null}
              </p>
              <p className="text-2xl font-black tabular-nums text-brand-green">
                {text(`${savedCard.pairs} pairs`, `${savedCard.pairs} जोडी`)}
                {savedCard.amount > 0 ? ` · ${money(savedCard.amount)}` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSavedCard(null);
                    walkRefs.current.get("pairs")?.focus();
                  }}
                  className="min-h-11 rounded-full bg-brand-green px-4 text-sm font-black text-white"
                >
                  ➕ {text("Next entry · same worker", "अर्को entry · उही कामदार")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSavedCard(null);
                    setFormData((prev) => ({ ...prev, worker_id: "", stage: "", item_id: "", color: "", size: "", pairs_count: "" }));
                    setCalculatedAmount(0);
                    walkRefs.current.get("worker")?.focus();
                  }}
                  className="min-h-11 rounded-full border border-brand-green-line bg-brand-paper px-4 text-sm font-black text-brand-green-ink"
                >
                  👤 {text("Another worker", "अर्को कामदार")}
                </button>
                <Link
                  href={`/admin/factory/ledger?workerId=${savedCard.workerId}`}
                  className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-brand-green underline underline-offset-4"
                >
                  ✏️ {text("Wrong? Fix it", "गल्ती? सच्याउने")}
                </Link>
              </div>
            </div>
          ) : null}

          {success && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {success}
            </div>
          )}

          {/* More bottoms than there are uppers behind them. Amber, not red:
              the entry saved and the wage is earned, so this is something to
              check rather than something that failed. */}
          {upperWarning ? (
            <div
              role="status"
              className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
            >
              ⚠️ {upperWarning}
            </div>
          ) : null}

          {/* The day, as one line: most entries are today's, so it is read
              rather than filled. Today and yesterday are one tap; any other
              day opens the Nepali calendar. */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-green-wash px-3 py-2">
            <span aria-hidden="true">📅</span>
            <span className="font-black text-brand-green-ink">{dateLabel}</span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => {
                setFormData((prev) => ({ ...prev, date: todayKey }));
                setPickingDate(false);
              }}
              className={`min-h-9 rounded-full border px-3 text-xs font-bold ${
                formData.date === todayKey ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line text-brand-green-ink"
              }`}
            >
              {text("Today", "आज")}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormData((prev) => ({ ...prev, date: yesterdayKey }));
                setPickingDate(false);
              }}
              className={`min-h-9 rounded-full border px-3 text-xs font-bold ${
                formData.date === yesterdayKey ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line text-brand-green-ink"
              }`}
            >
              {text("Yesterday", "हिजो")}
            </button>
            <button
              type="button"
              onClick={() => setPickingDate((open) => !open)}
              className={`min-h-9 rounded-full border px-3 text-xs font-bold ${
                formData.date !== todayKey && formData.date !== yesterdayKey
                  ? "border-brand-green bg-brand-green text-white"
                  : "border-brand-green-line text-brand-green-ink"
              }`}
            >
              {text("Another day…", "अर्को मिति…")}
            </button>
          </div>
          {pickingDate ? (
            <div className="max-w-sm">
              <label htmlFor="work-date" className={LABEL}>
                📅 {text("Work done on", "कामको मिति")}
              </label>
              <NepaliDateField
                id="work-date"
                value={formData.date}
                onChange={(adValue) => setFormData((prev) => ({ ...prev, date: adValue }))}
                required
              />
            </div>
          ) : null}

          {/* One grid, every box the same height: four across on a computer,
              two on a phone. */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4 xl:grid-cols-4">
            {/* Worker */}
            <div className="min-w-0">
              <label htmlFor="work-worker" className={LABEL}>👤 {text("Worker", "कामदार")}</label>
              <select
                id="work-worker"
                ref={(element) => {
                  walkRefs.current.set("worker", element);
                }}
                onKeyDown={(event) => handleFieldWalk(event, "worker")}
                value={formData.worker_id}
                onChange={handleWorkerChange}
                className={CONTROL}
                required
              >
                <option value="">{text("Choose…", "छान्नुहोस्…")}</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.category})
                  </option>
                ))}
              </select>
              {/* The chosen worker's running week, on one line under the box —
                  it used to be a card that pushed the boxes beside it down. */}
              <p className={HINT}>
                {worker
                  ? text(
                      `This week ${worker.week_pairs ?? 0} pairs · ${money(Math.round(worker.week_earned ?? 0))}`,
                      `यो हप्ता ${worker.week_pairs ?? 0} जोडी · ${money(Math.round(worker.week_earned ?? 0))}`,
                    )
                  : ""}
              </p>
            </div>

            {/* Stage — the work this entry is for. Defaults to the worker's
                category but is changeable, because fiber silai can be done by
                anyone. Always drawn, so the row does not shift. */}
            <div className="min-w-0">
              <label htmlFor="work-stage" className={LABEL}>🧵 {text("Which work", "कुन काम")}</label>
              <select
                id="work-stage"
                ref={(element) => {
                  walkRefs.current.set("stage", element);
                }}
                onKeyDown={(event) => handleFieldWalk(event, "stage")}
                value={formData.stage}
                onChange={handleStageChange}
                disabled={!formData.worker_id}
                className={CONTROL}
                required
              >
                {!formData.worker_id ? (
                  <option value="">{text("Worker first", "पहिले कामदार")}</option>
                ) : null}
                {FACTORY_WORKER_CATEGORIES.filter((c) => c !== "Staff").map((cat) => (
                  <option key={cat} value={cat}>
                    {factoryCategoryLabel(cat, language === "ne")}
                  </option>
                ))}
              </select>
              <p className={HINT}>
                {formData.worker_id ? text("The worker's own work — change if not", "कामदारको आफ्नै काम — फरक भए बदल्नुहोस्") : ""}
              </p>
            </div>

            {/* Item/Product */}
            <div className="min-w-0">
              <label htmlFor="work-item" className={LABEL}>🛞 {text("Which shoe", "कुन जुत्ता")}</label>
              <select
                id="work-item"
                ref={(element) => {
                  walkRefs.current.set("item", element);
                }}
                onKeyDown={(event) => handleFieldWalk(event, "item")}
                value={formData.item_id}
                onChange={handleItemChange}
                className={CONTROL}
                required
              >
                <option value="">{text("Choose…", "छान्नुहोस्…")}</option>
                {/* How many uppers are waiting, shown where the choice is made —
                    only for the stages done on an upper. Every item stays in
                    the list, or the first upper of a new design could never be
                    recorded. */}
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {stageNeedingUpperFirst(formData.stage)
                      ? item.uppersWaiting > 0
                        ? text(
                            ` — ${waitingCounts(item.waitingRuns, item.uppersWaiting)}`,
                            ` — ${waitingCounts(item.waitingRuns, item.uppersWaiting)}`,
                          )
                        : text(" — no uppers waiting", " — upper पर्खिरहेको छैन")
                      : ""}
                  </option>
                ))}
              </select>
              <p className={`${HINT} flex flex-wrap gap-x-3`}>
                <button type="button" onClick={() => setShowAddProduct(true)} className="font-bold text-brand-green hover:underline">
                  ➕ {text("New shoe", "नयाँ जुत्ता")}
                </button>
                <Link href="/admin/factory/items" className="font-bold text-brand-green hover:underline">
                  {text("Items and rates", "item र दर")}
                </Link>
              </p>
            </div>

            {/* Pairs, with the wage it decides written under it. */}
            <div className="min-w-0">
              <label htmlFor="work-pairs" className={LABEL}>🔢 {text("Number of pairs", "कति जोडी")}</label>
              {/* − and + step by a dozen from a computer or tablet. On a phone
                  the half-width box needs the room for the number itself, and
                  the number keypad is already up. */}
              <div className="flex gap-1.5">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => stepPairs(-PAIRS_STEP)}
                  aria-label={text("Twelve fewer pairs", "बाह्र जोडी घटाउने")}
                  disabled={pairsAtFloor}
                  className="press-dip hidden h-12 w-11 shrink-0 place-items-center rounded-lg border border-brand-green-line text-xl font-black text-brand-green-ink transition hover:border-brand-green sm:grid disabled:opacity-40"
                >
                  −
                </button>
                <input
                  id="work-pairs"
                  aria-label={text("Number of pairs", "कति जोडी")}
                  ref={(element) => {
                  walkRefs.current.set("pairs", element);
                }}
                  onKeyDown={(event) => handleFieldWalk(event, "pairs")}
                  type="number"
                  value={formData.pairs_count}
                  onChange={handlePairsChange}
                  placeholder="0"
                  min="1"
                  inputMode="numeric"
                  className={`${CONTROL} text-center text-2xl font-black tabular-nums`}
                  required
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => stepPairs(PAIRS_STEP)}
                  aria-label={text("Twelve more pairs", "बाह्र जोडी थप्ने")}
                  className="press-dip hidden h-12 w-11 shrink-0 place-items-center rounded-lg border border-brand-green-line text-xl font-black text-brand-green-ink transition hover:border-brand-green sm:grid"
                >
                  +
                </button>
              </div>
              <p className={HINT}>
                {selectedRate !== null ? (
                  <>
                    {text("Wage", "ज्याला")}{" "}
                    <b className="tabular-nums text-brand-green-ink">{money(calculatedAmount)}</b>{" "}
                    ({text(`Rs. ${selectedRate}/pair`, `रु. ${selectedRate}/जोडी`)})
                  </>
                ) : formData.worker_id && formData.item_id ? (
                  <button type="button" onClick={() => setShowSetRate(true)} className="font-bold text-orange-700 hover:underline">
                    ⚙️ {text("No rate yet — set it", "दर छैन — दर तोक्ने")}
                  </button>
                ) : (
                  text("Choose a worker and a shoe", "कामदार र जुत्ता छान्नुहोस्")
                )}
              </p>
            </div>

            {/* Colour — required: rows of one item at one rate could not be
                told apart afterwards without it. The chips are the colours this
                factory makes, the shoe's usual one first (★). */}
            <div className="col-span-2 min-w-0">
              <label htmlFor="work-colour" className={LABEL}>🎨 {text("Colour", "रङ")}</label>
              <input
                id="work-colour"
                aria-label={text("Colour", "रङ")}
                ref={(element) => {
                  walkRefs.current.set("colour", element);
                }}
                onKeyDown={(event) => handleFieldWalk(event, "colour")}
                type="text"
                value={formData.color}
                onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                placeholder={text("Tap below or type a colour", "तल थिच्नुहोस् वा रङ लेख्नुहोस्")}
                className={CONTROL}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {colourChips.map((chip) => {
                  const active = chip.matches.includes(colourKey(formData.color));
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, color: chip.value }))}
                      className={`press-dip inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition ${
                        active
                          ? "border-brand-green bg-brand-green text-white"
                          : chip.star
                            ? "border-brand-gold bg-brand-gold/10 text-brand-green-ink"
                            : "border-brand-green-line text-brand-green-ink hover:border-brand-green"
                      }`}
                    >
                      {chip.hex !== "transparent" ? (
                        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border border-black/15" style={{ background: chip.hex }} />
                      ) : null}
                      {chip.label}
                      {chip.star ? <span aria-label={text("usual", "सधैँको")}> ★</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Size — the runs this factory makes, the shoe's own first (★), and
                its single sizes to tap one at a time. Anything else is typed:
                "21/25", "36, 38, 40". */}
            <div className="col-span-2 min-w-0">
              <label htmlFor="work-size" className={LABEL}>📏 {text("Size", "साइज")}</label>
              <input
                id="work-size"
                aria-label={text("Size", "साइज")}
                ref={(element) => {
                  walkRefs.current.set("size", element);
                }}
                onKeyDown={(event) => handleFieldWalk(event, "size")}
                type="text"
                value={formData.size}
                onChange={(e) => setFormData((prev) => ({ ...prev, size: e.target.value }))}
                placeholder={text("Tap below or type sizes (e.g. 21/25)", "तल थिच्नुहोस् वा साइज लेख्नुहोस् (जस्तै 21/25)")}
                className={CONTROL}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sizeChips.map((chip) => {
                  const active = sizeRunKey(formData.size) !== "" && sizeRunKey(formData.size) === sizeRunKey(chip.value);
                  return (
                    <button
                      key={`${chip.star ? "star" : "run"}:${sizeRunKey(chip.value)}`}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, size: chip.value }))}
                      className={`press-dip inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-black tabular-nums transition ${
                        active
                          ? "border-brand-green bg-brand-green text-white"
                          : chip.star
                            ? "border-brand-gold bg-brand-gold/10 text-brand-green-ink"
                            : "border-brand-green-line text-brand-green-ink hover:border-brand-green"
                      }`}
                    >
                      {compactSizeRun(chip.value).replace("-", "–")}
                      {chip.star ? <span aria-label={text("this shoe's", "यो जुत्ताको")}> ★</span> : null}
                    </button>
                  );
                })}
              </div>
              {/* The shoe's single sizes, for a run that is not a whole run —
                  "41" alone, or 36, 38 and 40. Each toggles in and out. */}
              {itemSizes.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {itemSizes.map((size) => {
                    const active = chosenSizes.includes(size);
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, size: toggleSize(prev.size, size) }))}
                        className={`press-dip grid h-9 min-w-9 place-items-center rounded-md border px-1 text-xs font-black transition ${
                          active
                            ? "border-brand-green bg-brand-green text-white"
                            : "border-brand-green-line text-brand-muted hover:border-brand-green"
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {/* How many in each size, offered rather than imposed — most runs
                  are even. */}
              {countableSizes.length > 1 ? (
                showSizeCounts ? (
                  <div className="mt-3 rounded-xl border-2 border-brand-green bg-brand-green/5 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase tracking-wide text-brand-green-ink">
                        {text("Pairs in each size", "कुन साइजको कति जोडी")}
                      </span>
                      <button
                        type="button"
                        onClick={closeSizeCounts}
                        className="press-dip rounded-lg border border-brand-green-line px-2.5 py-1 text-xs font-bold text-brand-green-ink transition hover:border-brand-green"
                      >
                        {text("Use one total", "जम्मा मात्र लेख्ने")}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {countableSizes.map((size) => (
                        <label key={size} className="block">
                          <span className="block text-center text-[11px] font-bold text-brand-muted">
                            {size}
                          </span>
                          <input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            aria-label={text(`Pairs in size ${size}`, `साइज ${size} को जोडी`)}
                            value={sizeCounts[size] ?? ""}
                            onChange={(event) =>
                              setSizeCounts((current) => ({
                                ...current,
                                [size]: event.target.value,
                              }))
                            }
                            className="min-h-11 w-full rounded-lg border-2 border-brand-green-line px-1 py-1 text-center text-lg font-black tabular-nums text-brand-green-ink focus:border-transparent focus:ring-2 focus:ring-brand-gold"
                          />
                        </label>
                      ))}
                    </div>
                    {/* The total, added up rather than asked for again. */}
                    <p className="mt-2 text-sm font-black text-brand-green-ink">
                      {text(
                        `Total ${countedPairs} pairs — added up`,
                        `जम्मा ${countedPairs} जोडी — आफैँ जोडिएको`,
                      )}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openSizeCounts}
                    className="press-dip mt-2 inline-flex min-h-9 items-center rounded-lg border border-brand-green-line px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green"
                  >
                    {text("Sizes are not equal?", "साइज बराबर छैन?")}
                  </button>
                )
              ) : null}
            </div>

            {/* QC — rejects, usually none. One box of the grid like the rest;
                it had the full width of the form for one small number. */}
            <div className="min-w-0">
              <label htmlFor="work-reject" className={LABEL}>❌ {text("Rejected pairs", "खराब जोडी")}</label>
              <input
                ref={(element) => {
                  walkRefs.current.set("rejected", element);
                }}
                onKeyDown={(event) => handleFieldWalk(event, "rejected")}
                id="work-reject"
                type="number"
                value={formData.reject_pairs}
                onChange={(e) => setFormData((prev) => ({ ...prev, reject_pairs: e.target.value }))}
                placeholder="0"
                min="0"
                inputMode="numeric"
                className={`${CONTROL} text-center text-xl font-black tabular-nums`}
              />
              <p className={HINT}>{text("Blank if all good", "सबै राम्रो भए खाली")}</p>
            </div>

            {/* The last entry again, with only the pairs to type. */}
            <div className="min-w-0">
              <span className={LABEL} aria-hidden="true">&nbsp;</span>
              <button
                type="button"
                onClick={repeatLast}
                disabled={!lastEntry}
                className="h-12 w-full rounded-lg border border-dashed border-brand-green px-3 text-sm font-bold text-brand-green transition hover:bg-brand-green-wash disabled:border-brand-green-line disabled:text-brand-muted"
              >
                ↻ {text("Same as last", "अघिल्लो जस्तै")}
              </button>
              <p className={HINT}>{text("Same worker, shoe, colour, size", "कामदार, जुत्ता, रङ, साइज उही")}</p>
            </div>

            {/* Save. Enter here asks first; a click saves, unless the same work
                is already on the day's list. */}
            <div className="col-span-2 min-w-0">
              <span className={LABEL} aria-hidden="true">&nbsp;</span>
              <button
                type="submit"
                ref={(element) => {
                  walkRefs.current.set("save", element);
                }}
                onKeyDown={(event) => handleFieldWalk(event, "save")}
                disabled={!submitting && pairsNow <= 0}
                className="flex h-12 w-full items-center justify-center rounded-lg bg-brand-green px-4 font-black text-white transition-colors hover:bg-brand-green-ink focus:outline-none focus:ring-4 focus:ring-brand-gold disabled:cursor-not-allowed disabled:opacity-45"
              >
                {submitting
                  ? text("Saving… (carry on)", "टिप्दै… (अर्को हाल्न सक्नुहुन्छ)")
                  : pairsNow > 0
                    // The count on the button itself: it starts at 60, the
                    // usual lot, and a 12-pair job saved without changing it
                    // books five times the wage. The wage beside it.
                    ? text(
                        `✅ Save ${formData.pairs_count} pairs${calculatedAmount > 0 ? ` · ${money(calculatedAmount)}` : ""}`,
                        `✅ ${formData.pairs_count} जोडी टिप्ने${calculatedAmount > 0 ? ` · ${money(calculatedAmount)}` : ""}`,
                      )
                    : text("Enter the pairs to save", "टिप्न जोडी लेख्नुहोस्")}
              </button>
              <p className={`${HINT} hidden sm:block`}>
                {text("Enter: next box · Shift+Enter: back · Esc: cancel", "Enter: अर्को बक्स · Shift+Enter: पछाडि · Esc: रद्द")}
              </p>
            </div>
          </div>

          {/* The question before writing: what is about to be saved, and
              whether the day already has it. Enter says yes, Esc goes back. */}
          {confirming ? (
            <div
              role="alertdialog"
              aria-labelledby="work-confirm-text"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelConfirm();
                }
              }}
              className={`rounded-lg border-2 p-3 ${confirming.duplicate ? "border-amber-400 bg-amber-50" : "border-brand-gold bg-brand-gold/10"}`}
            >
              {confirming.duplicate ? (
                <p className="mb-1 text-sm font-black text-amber-900">
                  ⚠️ {text("This looks already entered today.", "यो आज टिपिसकेको जस्तो छ।")}
                </p>
              ) : null}
              <p id="work-confirm-text" className="text-sm font-bold text-brand-green-ink">
                {confirmSummary} — {text("save?", "टिप्ने?")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  ref={confirmYes}
                  onClick={() => void saveEntry()}
                  className="min-h-11 rounded-lg bg-brand-green px-4 text-sm font-black text-white focus:outline-none focus:ring-4 focus:ring-brand-gold"
                >
                  {text("Yes, save (Enter)", "हो, टिप्ने (Enter)")}
                </button>
                <button
                  type="button"
                  onClick={cancelConfirm}
                  className="min-h-11 rounded-lg border border-brand-green-line px-4 text-sm font-bold text-brand-green-ink"
                >
                  {text("Go back (Esc)", "फर्किने (Esc)")}
                </button>
              </div>
            </div>
          ) : null}
        </form>

        <TodayEntries
          entries={dayEntries}
          heading={
            formData.date === todayKey
              ? text("Entered today", "आज टिपिएका काम")
              : text(`Entered on ${bsDate}`, `${bsDate} मा टिपिएका काम`)
          }
          looksLikeForm={looksLikeForm}
          fresh={savedCard && !savedCard.pending ? { workerId: savedCard.workerId, pairs: Number(savedCard.pairs) } : null}
        />
      </div>

      <div hidden={view !== "post"} className="mt-5">
        <ReadyToPost refreshKey={workSaved} />
      </div>

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-brand-paper rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold text-brand-green-ink mb-4">
              ➕ {text("Add new product", "नयाँ सामान थप्ने")}
            </h2>
            <input
              aria-label={text("New product name", "नयाँ सामानको नाम")}
              type="text"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              placeholder={text("Product name (e.g. Flatpatta, Sendil)", "जुत्ताको नाम (जस्तै: फ्ल्याटपट्टा, सेन्डिल)")}
              className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent mb-4"
              onKeyPress={(e) => e.key === "Enter" && handleAddProduct()}
            />
            <div className="flex gap-2">
              <button
                onClick={handleAddProduct}
                className="flex-1 bg-brand-green hover:bg-brand-green-ink text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                ✅ Add Product
              </button>
              <button
                onClick={() => {
                  setShowAddProduct(false);
                  setNewProductName("");
                }}
                className="flex-1 bg-brand-green-line hover:bg-brand-muted-soft text-brand-green-ink font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Rate Modal */}
      {showSetRate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-brand-paper rounded-lg p-6 max-w-md w-full shadow-xl">
            <h2 className="text-xl font-bold text-brand-green-ink mb-2">⚙️ Set Rate</h2>
            <p className="text-sm text-brand-muted mb-4">
              Rate not found for this product. Please enter the rate per pair.
            </p>
            <input
              aria-label={text("Rate per pair", "प्रति जोडी दर")}
              type="number"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              placeholder={text("Rate per pair (e.g. 10, 12, 15)", "प्रति जोडी दर (जस्तै: १०, १२, १५)")}
              className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent mb-4"
              onKeyPress={(e) => e.key === "Enter" && handleSetRate()}
            />
            <p className="text-xs text-brand-muted mb-4">
              Category: <strong>{workers.find((w) => w.id === formData.worker_id)?.category}</strong>
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSetRate}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                ✅ Set Rate
              </button>
              <button
                onClick={() => {
                  setShowSetRate(false);
                  setNewRate("");
                }}
                className="flex-1 bg-brand-green-line hover:bg-brand-muted-soft text-brand-green-ink font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
