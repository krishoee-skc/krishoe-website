"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReadyToPost from "@/app/admin/factory/add-work/ReadyToPost";
import { createIdempotencyKeyRegistry } from "@/app/admin/factory/_components/idempotency-key";
import { nepalDateKey } from "@/app/admin/factory/_components/nepal-date";
import { FACTORY_WORKER_CATEGORIES, factoryCategoryLabel } from "@/lib/factory-worker-options";
import { pieceWage } from "@/lib/factory-board";
import { quoteWork, type FactoryRate } from "@/lib/factory-rate-book";
import {
  SIZE_RUNS,
  addRun,
  compactSizeRun,
  countsFromSizeRun,
  expandSizeRun,
  normaliseSizeCounts,
  sizeCountsTotal,
  sizeRunLabel,
  toggleSize,
} from "@/lib/shoe-sizes";
import { stageNeedingUpperFirst } from "@/lib/stage-order";
import { productionStageForFactoryCategory } from "@/lib/factory-stage";
import { useToast } from "@/components/admin/ToastProvider";
import NepaliDateField from "@/components/admin/NepaliDateField";

interface Worker {
  id: string;
  name: string;
  category: string;
  worker_type: string;
  today_pairs?: number;
  week_pairs?: number;
  week_earned?: number;
}

interface Item {
  id: string;
  name: string;
  /** Uppers made for this shoe with no bottom on them yet, net of QC. */
  uppersWaiting: number;
  /** The same, split by the colour and size run they were made in. */
  waitingRuns: { colour: string; sizeRun: string; pairs: number }[];
  code: string | null;
  /** The sizes this shoe is made in. Empty when the item is not yet linked to
   *  a catalogue product, which is when the size runs are offered instead. */
  sizes: string[];
  production_item_id: string | null;
}

interface WorkOrder {
  id: string;
  work_order_number: string;
  item_id: string;
  item_name_snapshot: string;
  colour: string;
  size_breakdown: Record<string, number>;
  planned_pairs: number;
  current_stage: string;
  status: string;
  due_date: string | null;
}

// The colours a shoe usually comes in, offered as one-tap chips so the same
// colour is spelled the same way every time. Anything else is still typed.
const COMMON_COLOURS = [
  { en: "Black", ne: "कालो", hex: "#111111" },
  { en: "Blue", ne: "निलो", hex: "#2456c7" },
  { en: "Red", ne: "रातो", hex: "#c0392b" },
  { en: "Brown", ne: "खैरो", hex: "#8b5e3c" },
  { en: "White", ne: "सेतो", hex: "#e8e8e8" },
] as const;

// The sizes usually run, offered as toggle buttons that build the comma list.
// Sizes are no longer a fixed list — they come from the chosen item, or from
// the runs in lib/shoe-sizes when the item has none on file yet.

/** Where the pair count starts, and what it returns to after a save: every
 *  entry this shop has made is sixty pairs. */
const DEFAULT_PAIRS = 60;
/** A size run is six sizes, so a dozen is two of each and sixty is half a case
 *  — the amounts this shop counts in. */
const PAIRS_STEP = 12;

/**
 * The typed boxes Enter walks along, in the order the work is counted out.
 *
 * Only four, and only the ones that are typed. The worker, the stage, the
 * product and the lot are all chosen from lists — a dropdown answers Enter by
 * opening or closing itself, and taking that over would make choosing a worker
 * harder than it is now. The colour and size have buttons above them too; the
 * boxes here are the "or type it" ones beside those buttons.
 *
 * Rejected pairs comes last because it is usually left at zero: the walk ends
 * on the box most days do not need, which means most days the walk ends at the
 * size.
 */
const WORK_WALK = ["pairs", "colour", "size", "rejected"] as const;
type WorkField = (typeof WORK_WALK)[number];

/**
 * What is waiting on a shoe, said in words rather than one number.
 *
 * "60 uppers waiting" was the owner's own question back at us: sixty of which
 * colour? One run answers it outright. Several are listed, because the save
 * counts one run at a time — a total across colours would promise a hundred
 * and then warn at sixty, the option and the save disagreeing about the same
 * pairs on the same click.
 *
 * Capped at two named runs so the option stays one readable line on a phone;
 * beyond that the total carries it, and the colour chips below name the rest.
 *
 * Returns the counts only — "60 Black", "60 Black + 40 cherry", or a bare
 * total. The wording around them belongs in text(), where the English and
 * Nepali halves sit together and the language check can see them paired.
 */
/**
 * The colour and size to open the boxes with, given what is waiting.
 *
 * The option says "bachha sandil — 60 Black · 25-30" and then the boxes below
 * it open empty. That gap cost the owner sixty pairs: the uppers were made
 * 25–30, the bottom entry was typed 31–35, and the pairs could not be posted
 * until the size was corrected in the database by hand. The screen knew the
 * answer — it had just printed it.
 *
 * Only when there is exactly one run waiting. Two colours waiting is a real
 * choice, and filling one in would have to be noticed to be corrected, which
 * is worse than an empty box a person has to fill.
 *
 * The size goes in as it was recorded, not compacted: "36/41" is what the save
 * guard matches the uppers on, and the short form is only for reading.
 */
export function fillFromWaitingRun(
  runs: { colour: string; sizeRun: string; pairs: number }[],
  stage: string,
): { color: string; size: string } {
  const empty = { color: "", size: "" };

  // Upper work starts a shoe: nothing is waiting behind it, and the last run's
  // colour is not this run's answer.
  if (!stageNeedingUpperFirst(stage)) return empty;

  // A colour is what makes a run identifiable. Entries made before colour was
  // required have none, and "" in the box only looks like a filled field.
  const named = runs.filter((run) => run.colour.trim() && run.pairs > 0);
  if (named.length !== 1) return empty;

  return { color: named[0].colour, size: named[0].sizeRun };
}

export function waitingCounts(
  runs: { colour: string; sizeRun: string; pairs: number }[],
  total: number,
) {
  const named = runs.filter((run) => run.colour);

  // One or two runs are named — "60 Black · 36-41". Beyond that the line stops
  // fitting a phone, so the total carries it and the colour chips below the box
  // name the rest.
  if (named.length === 0 || named.length > 2) return String(total);

  // The size is what the owner's bachha sandil entry needed and did not have:
  // its uppers were recorded 31–35 when they were made 25–30, and the screen
  // where the bottom work is chosen could not show it.
  //
  // Compacted, because spelled out it does not fit — "25, 26, 27, 28, 29, 30"
  // is 22 characters against a phone's 38 for the whole label, and "25-30" is
  // five. Two runs name the size only when they share one, which is the case
  // where naming it twice would say the same thing twice and overflow anyway.
  const sizes = new Set(named.map((run) => compactSizeRun(run.sizeRun)).filter(Boolean));
  const shared = sizes.size === 1 ? [...sizes][0] : "";

  const colours = named.map((run) => `${run.pairs} ${run.colour}`).join(" + ");
  return shared ? `${colours} · ${shared}` : colours;
}

export default function WorkEntryForm({
  initialWorkers,
  initialItems,
  initialWorkOrders,
  initialRates,
}: {
  initialWorkers: Worker[];
  initialItems: Item[];
  initialWorkOrders: WorkOrder[];
  initialRates: FactoryRate[];
}) {
  const router = useRouter();
  const { text, language } = useLanguage();
  const toast = useToast();
  const [workers] = useState<Worker[]>(initialWorkers);

  // Enter moves the cursor along the four typed boxes, so it has to be able to
  // find the box it is moving to.
  const boxes = useRef(new Map<string, HTMLInputElement | null>());
  // A ref rather than state: the box to move to is decided in a key handler
  // and acted on after the next render, which is a note-to-self rather than
  // something the screen is drawn from.
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    const box = boxes.current.get(key);
    if (!box) return;
    pendingFocus.current = null;
    box.focus();
    box.select();
  });

  /**
   * Enter and Shift+Enter along the four typed boxes.
   *
   * Enter never saves. In a browser Enter in a text box submits the form —
   * W3C records it as failure F36 — and this form pays a worker: a half-typed
   * entry filed by a mis-hit puts a wrong number in somebody's wages. Every
   * path calls preventDefault and the last box simply stops. Save stays the
   * only way an entry is filed.
   */
  function handleFieldWalk(event: React.KeyboardEvent<HTMLInputElement>, field: WorkField) {
    if (event.key !== "Enter") return;
    event.preventDefault();

    const at = WORK_WALK.indexOf(field);

    if (event.shiftKey) {
      if (at > 0) pendingFocus.current = WORK_WALK[at - 1];
      return;
    }

    if (at < WORK_WALK.length - 1) {
      pendingFocus.current = WORK_WALK[at + 1];
    }
  }
  const [items, setItems] = useState<Item[]>(initialItems);
  const [workOrders] = useState<WorkOrder[]>(initialWorkOrders);
  // Every rate in force, so picking an item prices the work with no round trip.
  // A rate the owner sets from this screen is added to it on the spot.
  const [rates, setRates] = useState<FactoryRate[]>(initialRates);
  const [loading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    date: nepalDateKey(),
    worker_id: "",
    item_id: "",
    // The production stage this entry is for — the work actually done, not the
    // worker's fixed category, because fiber silai can be done by anyone. Blank
    // until a worker is chosen, then it defaults to that worker's category and
    // can be changed on the dropdown below.
    stage: "",
    work_order_id: "",
    color: "",
    size: "",
    // Sixty: every entry this shop has ever made is sixty pairs. Typing over
    // it is one action; typing it out is two.
    pairs_count: String(DEFAULT_PAIRS),
    reject_pairs: "",
    status: "completed",
  });

  const [selectedRate, setSelectedRate] = useState<number | null>(null);
  const [selectedRateSource, setSelectedRateSource] = useState("");
  const [calculatedAmount, setCalculatedAmount] = useState<number>(0);
  // Bumped when a work entry saves, so the panel below recounts what is made
  // against what is on the shelf without the page being reloaded by hand.
  const [workSaved, setWorkSaved] = useState(0);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  /**
   * What the save noticed about the uppers behind this bottom work.
   *
   * createFactoryWork counts them and puts a shortfall on the response; it has
   * travelled here since it was written and nothing read it, which made the
   * check worse than none — it counted quietly, saved anyway, and told nobody.
   *
   * Its own state rather than folded into `success`, because the entry did
   * save: the wage is earned and the work is recorded, and the note sits
   * beside that rather than replacing it.
   */
  const [upperWarning, setUpperWarning] = useState<string>("");
  /**
   * How many pairs in each size, when the entry says.
   *
   * The owner's question: a 36–41 run where 38 was made twice. One total and
   * one piece of text cannot record it, so the screen asks the way the question
   * is asked — a box per size, and the total adds itself up.
   *
   * Empty until the boxes are opened. An entry that never opens them behaves
   * exactly as it did, with the typed total standing on its own.
   */
  const [sizeCounts, setSizeCounts] = useState<Record<string, string>>({});
  const [showSizeCounts, setShowSizeCounts] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  // Which half of the screen is showing: the entry form, or the post-to-stock
  // list. Only one at a time, so the page is short. "entry" first — that is what
  // this screen is opened to do.
  const [view, setView] = useState<"entry" | "post">("entry");
  const [newProductName, setNewProductName] = useState("");
  const [showSetRate, setShowSetRate] = useState(false);
  const [newRate, setNewRate] = useState("");
  const [idempotencyKeys] = useState(() => createIdempotencyKeyRegistry());

  const handleWorkerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const workerId = e.target.value;
    // Default the stage to the chosen worker's category — the common case — but
    // leave it changeable on the stage dropdown, since fiber silai can be done
    // by an Upper man too.
    const worker = workers.find((w) => w.id === workerId);
    setFormData((prev) => ({ ...prev, worker_id: workerId, stage: worker?.category ?? "" }));
  };

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
      work_order_id: "",
      color: filled.color,
      size: filled.size,
    }));
    setError("");

    if (!formData.worker_id || !itemId) return;

    const quote = priceFor(
      formData.worker_id,
      itemId,
      formData.stage,
      parseInt(formData.pairs_count) || 0,
    );

    if (quote?.rate) {
      setSelectedRate(quote.rate);
      setSelectedRateSource(quote.source ?? "Factory rate");
      setShowSetRate(false);
      setCalculatedAmount(quote.amount);
      return;
    }

    // No rate on file for this item and this kind of work. That is a question
    // for the owner, not a zero — the form offers to set one.
    setSelectedRate(null);
    setSelectedRateSource("");
    setCalculatedAmount(0);
    setShowSetRate(true);
    setSuccess(
      text(
        "No rate set for this yet — add one below.",
        "यसको दर अझै तोकिएको छैन — तल थप्नुहोस्।",
      ),
    );
  };

  const handleWorkOrderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const workOrderId = event.target.value;
    const order = workOrders.find((row) => row.id === workOrderId);
    setFormData((current) => ({
      ...current,
      work_order_id: workOrderId,
      color: order?.colour || "",
      size: "",
    }));
  };

  const handlePairsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pairs = parseInt(e.target.value) || 0;
    setFormData((prev) => ({ ...prev, pairs_count: e.target.value }));

    setCalculatedAmount(selectedRate ? pieceWage(pairs, selectedRate) : 0);
  };

  /**
   * Step the pair count by a dozen, without reaching for the keyboard.
   *
   * From sixty when the box is empty rather than from zero: an empty field
   * parses to nothing, so + used to land on 12 instead of near the usual count,
   * and minus sat disabled because 0 is under the floor.
   *
   * Rounded to the dozen, so the buttons always land on a quantity the shop
   * actually makes — a hand-typed 5 pressing + gave 17, which fits no run.
   * Typing any number by hand still works; this is only what the buttons do.
   */
  const stepPairs = (by: number) => {
    const typed = parseInt(formData.pairs_count);
    const from = Number.isFinite(typed) && typed > 0 ? typed : DEFAULT_PAIRS;
    const next = Math.max(PAIRS_STEP, Math.round((from + by) / PAIRS_STEP) * PAIRS_STEP);

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
      const worker = workers.find((entry) => entry.id === formData.worker_id);
      if (worker) {
        setRates((current) => [
          ...current,
          {
            itemId: formData.item_id,
            workerId: "",
            stage: "",
            workerCategory: worker.category,
            ratePerPair: added,
            effectiveFrom: formData.date,
            source: "Factory rate" as const,
          },
        ]);
      }
      setSelectedRate(added);
      setSelectedRateSource("Production stage synchronized");
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

  // The sizes this shoe is made in, and which of them are already chosen.
  const itemSizes = items.find((item) => item.id === formData.item_id)?.sizes ?? [];
  const chosenSizes = formData.size
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

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
   * empty boxes keeps the ordinary entry to no typing at all, and leaves the
   * uneven one a single box to change.
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    // A warning left from the last entry would be read as belonging to this
    // one — and the next entry is usually the one that was corrected.
    setUpperWarning("");

    if (!formData.color.trim() || !formData.size.trim()) {
      // Which one, rather than "fill the form": the person is mid-entry with a
      // worker waiting, and the two fields sit side by side.
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
      return;
    }

    if (!formData.worker_id || !formData.item_id || !formData.pairs_count) {
      setError(
        text("Please fill in all required fields", "सबै आवश्यक कुरा भर्नुहोस्"),
      );
      return;
    }

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

    // Clear for the next row now, not when the server answers. The worker, the
    // item and the stage stay: a person makes three or four rows of the same
    // work, and re-picking them each time was most of the typing.
    setFormData((current) => ({
      ...current,
      pairs_count: String(DEFAULT_PAIRS),
      reject_pairs: "",
      size: "",
      color: "",
    }));
    setCalculatedAmount(0);
    // The size is cleared, so boxes for it would be boxes for nothing.
    closeSizeCounts();

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

  const selectedItem = items.find((item) => item.id === formData.item_id);
  const availableWorkOrders = workOrders.filter(
    (order) => order.item_id === selectedItem?.production_item_id,
  );
  const selectedWorkOrder = workOrders.find(
    (order) => order.id === formData.work_order_id,
  );
  const plannedSizes = selectedWorkOrder
    ? Object.entries(selectedWorkOrder.size_breakdown).filter(([, pairs]) => Number(pairs) > 0)
    : [];

  if (loading) {
    return (
      <div className="p-4 sm:p-6 text-center">
        <div className="animate-pulse text-brand-muted">{text("Loading…", "खुल्दैछ…")}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      {/* A small factory-crest header, the same monogram the shop signs itself
          with, so the busiest screen in the building reads as KRISHOE's own. */}
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-gradient-to-br from-brand-green to-brand-green-ink font-display text-lg font-black text-brand-gold-bright shadow-sm"
        >
          K
        </span>
        <div>
          <h1 className="font-display text-2xl font-black leading-tight text-brand-green-ink sm:text-3xl">
            {text("Add work", "काम टिप्ने")}
          </h1>
          <p className="text-sm text-brand-muted">
            {text("A worker, a product, the pairs — and the total.", "कामदार, सामान, जोडी — अनि जम्मा।")}
          </p>
        </div>
      </div>

      {/* Two views, one at a time, so the page stays short: entering work, and
          posting what was made to stock. Entering is the default because that
          is what this screen is for; posting is one tap away when the pairs are
          counted in the godown. */}
      <div className="mt-5 flex gap-1.5 rounded-xl bg-brand-mist p-1">
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

      <form
        onSubmit={handleSubmit}
        hidden={view !== "entry"}
        className="mt-5 bg-brand-paper rounded-lg border border-brand-green-line p-4 sm:p-6 space-y-4 sm:space-y-6"
      >
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        {/* More bottoms than there are uppers behind them.
            Amber, not red: the entry saved and the wage is earned, so this is
            something to check rather than something that failed. It names the
            counts and the two fields most likely to be wrong, and wraps rather
            than truncating — cut short on a factory phone it would show a
            number and nothing about what to look at. */}
        {upperWarning ? (
          <div
            role="status"
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
          >
            ⚠️ {upperWarning}
          </div>
        ) : null}

        {/* The day this work was done. One field, so it needs no section
            heading over it — the label sits beside the picker and the whole
            thing is one line instead of four. Picked in Bikram Sambat and
            stored as AD; the field shows both. */}
        {/* Which entry this is: the day, the person, the shoe. One control
            each, so they sit on one row and the form starts with a single
            glance rather than a scroll. */}
        <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="work-date" className="mb-2 block text-sm font-medium text-brand-green-ink">
            📅 {text("Work done on", "कामको मिति")}
          </label>
          <NepaliDateField
            id="work-date"
            value={formData.date}
            onChange={(adValue) => setFormData((prev) => ({ ...prev, date: adValue }))}
            required
          />
        </div>

        {/* Worker + Product on one row on wider phones and up, so the two most
            important choices sit together and the form is shorter to scroll. On
            a narrow phone they stack, one per line, as before. */}
        {/* Worker */}
        <div>
          <label htmlFor="work-worker" className="block text-sm font-medium text-brand-green-ink mb-2">👤 {text("Worker", "कामदार")}</label>
          <select
            id="work-worker"
            value={formData.worker_id}
            onChange={handleWorkerChange}
            className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent"
            required
          >
            <option value="">{text("Select a worker…", "कामदार छान्नुहोस्…")}</option>
            {workers.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.name} ({worker.category})
              </option>
            ))}
          </select>

          {/* The chosen worker's running week — pairs and wage so far — right
              here, so the owner sees who they are paying without leaving the
              entry screen for the ledger. Shown only once a worker is picked. */}
          {(() => {
            const w = workers.find((x) => x.id === formData.worker_id);
            if (!w) return null;
            const pairs = w.week_pairs ?? 0;
            const earned = Math.round(w.week_earned ?? 0);
            return (
              <div className="mt-2 rounded-xl border border-brand-green-line bg-brand-green-wash px-3 py-2.5">
                <p className="text-xs font-bold text-brand-green-ink">
                  👷 {w.name} — {text("this week", "यो हप्ता")}
                </p>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-brand-paper px-2 py-1.5 text-center">
                    <p className="text-[10px] font-bold uppercase text-brand-muted">{text("pairs", "जोडी")}</p>
                    <p className="text-sm font-black tabular-nums text-brand-green">{pairs}</p>
                  </div>
                  <div className="rounded-lg bg-brand-paper px-2 py-1.5 text-center">
                    <p className="text-[10px] font-bold uppercase text-brand-muted">{text("earned", "कमाइ")}</p>
                    <p className="text-sm font-black tabular-nums text-brand-gold-deep">Rs. {earned.toLocaleString("en-IN")}</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Stage — the work this entry is for. Defaults to the worker's category
            but is changeable, because fiber silai can be done by anyone. Shown
            once a worker is chosen. */}
        {formData.worker_id ? (
          <div>
            <label className="block text-sm font-medium text-brand-green-ink mb-2">
              🧵 {text("Which work", "कुन काम")}
            </label>
            <select
              id="work-stage"
              value={formData.stage}
              onChange={(e) => setFormData((prev) => ({ ...prev, stage: e.target.value }))}
              className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent"
              required
            >
              {FACTORY_WORKER_CATEGORIES.filter((c) => c !== "Staff").map((cat) => (
                <option key={cat} value={cat}>
                  {factoryCategoryLabel(cat, language === "ne")}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-brand-muted">
              {text(
                "Defaults to the member's stage — change it if they did a different job today.",
                "कामदारको सामान्य काम आउँछ — आज अर्को काम गरे बदल्नुहोस्।",
              )}
            </p>
          </div>
        ) : null}

        {/* Item/Product */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-brand-green-ink">🛞 {text("Product", "कुन जुत्ता")}</label>
            <div className="flex gap-2">
              <Link
                href="/admin/factory/items"
                className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200"
              >
                Item Master
              </Link>
              <button
                type="button"
                onClick={() => setShowAddProduct(true)}
                className="text-xs bg-brand-green-wash text-brand-green hover:bg-brand-green-tint px-2 py-1 rounded"
              >
                ➕ Add New
              </button>
              {showSetRate && (
                <button
                  type="button"
                  onClick={() => setShowSetRate(true)}
                  className="text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 px-2 py-1 rounded font-semibold"
                >
                  ⚙️ Set Rate
                </button>
              )}
            </div>
          </div>
          <select
            id="work-item"
            value={formData.item_id}
            onChange={handleItemChange}
            className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent"
            required
          >
            <option value="">{text("Select a product…", "जुत्ता छान्नुहोस्…")}</option>
            {/* How many uppers are waiting, shown where the choice is made.
                Only for the stages done on an upper: Upper work is where a new
                shoe starts, and "0 waiting" beside it would read as a fault
                rather than a beginning.

                Every item stays in the list. Filtering the empty ones out
                would make it impossible to record the first upper of anything
                — the factory could never begin a new design. */}
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {stageNeedingUpperFirst(formData.stage)
                  ? item.uppersWaiting > 0
                    ? // Named, not just counted. "Sixty waiting" leaves the
                      // question the owner asked — which colour? — and the
                      // entry that follows has to answer it. With one run the
                      // label says it; with several it lists them, which is
                      // also what stops the option disagreeing with the save,
                      // since the save counts one run at a time.
                      text(
                        ` — ${waitingCounts(item.waitingRuns, item.uppersWaiting)}`,
                        ` — ${waitingCounts(item.waitingRuns, item.uppersWaiting)}`,
                      )
                    : text(" — no uppers waiting", " — upper पर्खिरहेको छैन")
                  : ""}
              </option>
            ))}
          </select>
        </div>
        </div>

        {/* Work Order / Lot */}
        {selectedItem?.production_item_id && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
            <label className="block text-sm font-bold text-emerald-950 mb-2">
              {text("Work order / lot", "कामको अर्डर / लट")}
            </label>
            <select
              id="work-order"
              value={formData.work_order_id}
              onChange={handleWorkOrderChange}
              className="w-full min-h-12 rounded-lg border border-emerald-300 bg-brand-paper px-3 py-2"
            >
              <option value="">
                {text("No work order — wage history only", "Work Order बिना — ज्यालाको हिसाब मात्र")}
              </option>
              {availableWorkOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.work_order_number} · {order.current_stage} · {order.planned_pairs} pairs
                </option>
              ))}
            </select>
            {selectedWorkOrder ? (
              <p className="mt-2 text-xs leading-5 text-emerald-800">
                {selectedWorkOrder.item_name_snapshot} · {selectedWorkOrder.colour} · Current stage {selectedWorkOrder.current_stage}
                {selectedWorkOrder.due_date ? ` · Due ${selectedWorkOrder.due_date}` : ""}
              </p>
            ) : (
              <p className="mt-2 text-xs leading-5 text-emerald-800">
                Select a lot to preserve its stage, size and progress history. You can continue without one for legacy wage-only work.
              </p>
            )}
          </div>
        )}

        {/* Colour, Size and Pairs on one row from small screens up — three short
            fields that belong together, so the form does not run down the page.
            They stack on a narrow phone. */}

        {/* The count and the wage it decides, side by side.
            "60" had the full width of the form to itself — about 450px for two
            characters — while the money it works out sat underneath in small
            text. They are one fact: sixty pairs at forty rupees IS two
            thousand four hundred, so changing the count now shows the amount
            move beside it.
            The colour and the size could not take that space: both carry a row
            of chips above a text box and would break on a phone. The QC box is
            blank most days, and an empty field every morning is worse than an
            empty half-row. */}
        <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-brand-green-ink mb-2">
            🔢 {text("Number of pairs", "कति जोडी")}
          </label>
          {/* A button either side of the number. The browser's own spinners
              are a few pixels tall and step by one, which is not a control for
              a phone held in a workshop. */}
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => stepPairs(-PAIRS_STEP)}
              aria-label={text("Twelve fewer pairs", "बाह्र जोडी घटाउने")}
              disabled={pairsAtFloor}
              className="press-dip grid min-h-14 w-14 shrink-0 place-items-center rounded-lg border-2 border-brand-green-line text-2xl font-black text-brand-green-ink transition hover:border-brand-green disabled:opacity-40"
            >
              −
            </button>
            <input
              ref={(element) => {
                boxes.current.set("pairs", element);
              }}
              onKeyDown={(event) => handleFieldWalk(event, "pairs")}
              type="number"
              value={formData.pairs_count}
              onChange={handlePairsChange}
              placeholder="0"
              min="1"
              inputMode="numeric"
              className="min-h-14 w-full rounded-lg border-2 border-brand-green-line px-3 py-2 text-center text-2xl font-black tabular-nums text-brand-green-ink focus:border-transparent focus:ring-2 focus:ring-brand-gold"
              required
            />
            <button
              type="button"
              onClick={() => stepPairs(PAIRS_STEP)}
              aria-label={text("Twelve more pairs", "बाह्र जोडी थप्ने")}
              className="press-dip grid min-h-14 w-14 shrink-0 place-items-center rounded-lg border-2 border-brand-green-line text-2xl font-black text-brand-green-ink transition hover:border-brand-green"
            >
              +
            </button>
          </div>
          {/* How many in each size.
              The owner's question: a 36–41 run where 38 was made twice. One
              total cannot say it. Offered rather than imposed — most runs are
              even, and six boxes on every entry would slow the ordinary case
              down to answer a question it does not have. */}
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
                {/* The total, added up rather than asked for again. Two numbers
                    for one quantity is how a breakdown ends up disagreeing with
                    the wage it was paid on. */}
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
                className="press-dip mt-2 inline-flex min-h-11 items-center rounded-lg border border-brand-green-line px-3 text-sm font-bold text-brand-green-ink transition hover:border-brand-green"
              >
                {text("Sizes are not equal?", "साइज बराबर छैन?")}
              </button>
            )
          ) : null}
        </div>

        {/* The wage, in the space the pair count was not using.
            A field of its own now that it sits beside another: an unlabelled
            number next to a labelled one reads as part of it. */}
        <div>
          <label className="block text-sm font-medium text-brand-green-ink mb-2">
            💰 {text("Wage", "ज्याला")}
          </label>
          {calculatedAmount > 0 ? (
            <div className="rounded-lg bg-brand-green/10 px-3 py-2.5">
              <p className="text-2xl font-black tabular-nums text-brand-green-ink">
                Rs. {calculatedAmount.toLocaleString()}
              </p>
              <p className="text-xs font-semibold text-brand-muted">
                {text(`at Rs. ${selectedRate}/pair`, `प्रति जोडी रु. ${selectedRate}`)}
              </p>
            </div>
          ) : (
            /* Before a worker and an item are chosen there is no rate to
               quote. The box keeps its place rather than appearing later and
               pushing the fields below it down mid-entry. */
            <div className="rounded-lg border border-dashed border-brand-green-line px-3 py-2.5">
              <p className="text-sm font-semibold text-brand-muted">
                {text("Choose a worker and a product", "कामदार र जुत्ता छान्नुहोस्")}
              </p>
            </div>
          )}
        </div>
        </div>

        {/* Colour and size are required: two entries went in without either,
            and three rows of one item at one rate could not be told apart
            afterwards. The chips make each one tap, so this costs a moment
            rather than a form. */}
        <div className="grid gap-4 sm:grid-cols-2">
        {/* Color — quick chips for the common colours (one tap, so nobody types
            "कालो" one day and "Black" the next), with the free text kept below
            for anything off the list. Tapping a chip fills the same field. */}
        <div>
          <label className="block text-sm font-medium text-brand-green-ink mb-2">
            🎨 {text("Colour", "रङ")}{" "}
            <span className="font-normal text-brand-clay">{text("(required)", "— अनिवार्य")}</span>
          </label>
          {!selectedWorkOrder ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {COMMON_COLOURS.map((c) => {
                const active = formData.color.trim() === c.ne || formData.color.trim() === c.en;
                return (
                  <button
                    key={c.en}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, color: text(c.en, c.ne) }))}
                    className={`press-dip inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                      active
                        ? "border-brand-green bg-brand-green-wash text-brand-green"
                        : "border-brand-green-line text-brand-green-ink hover:border-brand-green"
                    }`}
                  >
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full border border-black/15" style={{ background: c.hex }} />
                    {text(c.en, c.ne)}
                  </button>
                );
              })}
            </div>
          ) : null}
          <input
            ref={(element) => {
              boxes.current.set("colour", element);
            }}
            onKeyDown={(event) => handleFieldWalk(event, "colour")}
            type="text"
            value={formData.color}
            onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
            readOnly={Boolean(selectedWorkOrder)}
            placeholder={text("or type a colour", "वा रङ लेख्नुहोस्")}
            className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent"
          />
        </div>
        {/* Size */}
        <div>
          <label htmlFor="work-size" className="block text-sm font-medium text-brand-green-ink mb-2">
            📏 {text("Size", "साइज")}{" "}
            <span className="font-normal text-brand-clay">{text("(required)", "— अनिवार्य")}</span>
          </label>
          {selectedWorkOrder ? (
            <select
              id="work-size"
              value={formData.size}
              onChange={(e) => setFormData((prev) => ({ ...prev, size: e.target.value }))}
              className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent"
              required
            >
              <option value="">{text("Select a planned size…", "तय भएको साइज छान्नुहोस्…")}</option>
              {plannedSizes.map(([size, pairs]) => (
                <option key={size} value={size}>{size} · planned {pairs} pairs</option>
              ))}
            </select>
          ) : (
            <>
              {/* Tap the sizes made — each toggles in and out of the comma list,
                  so a run like "7, 8, 9" is built without typing commas. The
                  text field below still takes anything off these buttons. */}
              {/* The sizes this shoe is made in, when the item is linked to a
                  catalogue product — so "hill sandel" offers 36–40 and a
                  child's shoe offers 25–30, with nothing to keep in step by
                  hand. Each chip toggles in and out of the comma list. */}
              {itemSizes.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {itemSizes.map((size) => {
                    const active = chosenSizes.includes(size);
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, size: toggleSize(prev.size, size) }))
                        }
                        className={`press-dip grid h-9 min-w-9 shrink-0 place-items-center rounded-lg border px-1.5 text-sm font-black transition ${
                          active
                            ? "border-brand-green bg-brand-green text-white"
                            : "border-brand-green-line text-brand-green-ink hover:border-brand-green"
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* No sizes on file for this item yet. A whole run in one tap
                   beats typing six numbers — and beats a fixed list of five
                   that was right for nothing this shop makes. */
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {SIZE_RUNS.map((run) => (
                    <button
                      key={run.en}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, size: addRun(prev.size, run) }))
                      }
                      className="press-dip inline-flex h-9 shrink-0 items-center rounded-full border border-brand-green-line px-3 text-xs font-black text-brand-green-ink transition hover:border-brand-green"
                    >
                      + {sizeRunLabel(run, language === "ne")}
                    </button>
                  ))}
                </div>
              )}
              <input
                ref={(element) => {
                  boxes.current.set("size", element);
                }}
                onKeyDown={(event) => handleFieldWalk(event, "size")}
                type="text"
                value={formData.size}
                onChange={(e) => setFormData((prev) => ({ ...prev, size: e.target.value }))}
                placeholder={text("or type sizes", "वा साइज लेख्नुहोस्")}
                className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent"
              />
            </>
          )}
        </div>
        </div>

        {/* QC — how many of those pairs were rejects (bad). Optional; 0 means all good. */}
        <div>
          <label className="block text-sm font-medium text-brand-green-ink mb-2">
            ❌ {text("Rejected pairs (QC)", "खराब जोडी (QC)")}
          </label>
          <input
            ref={(element) => {
              boxes.current.set("rejected", element);
            }}
            onKeyDown={(event) => handleFieldWalk(event, "rejected")}
            id="work-reject"
            type="number"
            value={formData.reject_pairs}
            onChange={(e) => setFormData((prev) => ({ ...prev, reject_pairs: e.target.value }))}
            placeholder={text("0 — leave blank if all good", "० — सबै राम्रो भए खाली")}
            min="0"
            className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent"
          />
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          ✅ Save here only after the worker has completed and handed over the work.
          Rejected work should be corrected first.
        </div>

        {/* The live total — the one figure the owner is really entering this
            work for. Shown big and gold the moment a worker, product and pair
            count are chosen, with the rate and where it came from beside it, so
            there is nothing to scroll for and nothing to add up by hand. */}
        {selectedRate !== null && (
          <div className="overflow-hidden rounded-2xl border-2 border-brand-gold bg-gradient-to-br from-brand-gold/10 to-transparent">
            <div className="flex items-center justify-between gap-3 border-b border-brand-green-line/60 px-4 py-2.5">
              <p className="text-sm font-semibold text-brand-green-ink">
                {text("Rate", "दर")}: <span className="font-black">Rs. {selectedRate}</span>{" "}
                <span className="text-xs font-normal text-brand-muted">{text("/ pair", "/ जोडी")}</span>
              </p>
              {selectedRateSource ? (
                <span className="shrink-0 rounded-full bg-brand-green-mist px-2.5 py-1 text-[11px] font-black text-brand-green">
                  ✓ {selectedRateSource}
                </span>
              ) : null}
            </div>
            <div className="flex items-baseline justify-between gap-3 px-4 py-3">
              <span className="text-sm text-brand-muted">
                {formData.pairs_count || 0} {text("pairs", "जोडी")} × Rs. {selectedRate}
              </span>
              <span className="font-display text-3xl font-black leading-none tabular-nums text-brand-green-ink">
                Rs. {calculatedAmount.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"

            className="flex-1 bg-brand-green hover:bg-brand-green-ink disabled:bg-brand-muted-soft text-white font-semibold py-3 px-4 rounded-lg transition-colors min-h-12 flex items-center justify-center"
          >
            {submitting
              ? text("Saving… (carry on)", "टिप्दै… (अर्को हाल्न सक्नुहुन्छ)")
              : text("✅ Save work entry", "✅ काम टिप्ने")}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/factory")}
            className="flex-1 bg-brand-green-line hover:bg-brand-muted-soft text-brand-green-ink font-semibold py-3 px-4 rounded-lg transition-colors min-h-12 flex items-center justify-center"
          >
            Cancel
          </button>
        </div>
      </form>

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
