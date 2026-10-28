"use server";

import { revalidatePath } from "next/cache";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";
import {
  createStockTransfer,
  receiveStockTransfer,
  setPlaceCount,
  type StockPlace,
} from "@/lib/stock-transfers";
import type { ActionState } from "@/app/admin/actions";
import { CounterItemRefusal, fillSoldFirstByCount, markCounterItemReviewed } from "@/lib/counter-items";
import { tidySizes } from "@/lib/counter-item-rules";
import { ShelfCountRefusal, setPlaceToCount } from "@/lib/shelf-count";
import { transactionPostgres } from "@/lib/postgres/client";

/** The size rows a count form sends, as pairs by size. */
function countedSizes(formData: FormData): Record<string, number> | null {
  try {
    const rows = JSON.parse(textValue(formData, "sizes") || "[]");
    return tidySizes(Array.isArray(rows) ? rows : []);
  } catch {
    return null;
  }
}

/**
 * Count the shelf of any shoe at one place (owner, 2026-10-11): that place's
 * pairs become the count, the other place is not touched, and the stock
 * follows (lib/shelf-count.ts). The Owner and the staff who may change stock
 * may count; a count that finds 10 or more fewer asks "I counted again".
 */
export async function countShelfAction(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const { session } = await requireAdminPermission("operations:write");
  const design = textValue(formData, "design");
  if (!design) return { ok: false, message: "Which shoe is being counted?" };
  const counted = countedSizes(formData);
  if (!counted) return { ok: false, message: "The sizes could not be read. Type them again." };
  const place = placeValue(formData, "place");
  const by = session?.name || session?.email || "Staff";
  try {
    const result = await transactionPostgres("shelf count", (db) =>
      setPlaceToCount(db, {
        design,
        place,
        counted,
        confirmBigDrop: textValue(formData, "confirmBigDrop") === "yes",
        noneOnShelf: textValue(formData, "noneOnShelf") === "yes",
        note: `Counted by ${by}.`,
      }),
    );
    await recordAdminAuditEvent(
      "stock_shelf_counted",
      `${result.design} counted at the ${place.toLowerCase()} by ${by}: ${result.counted} pairs (${result.changes.map((change) => `${change.size} ${change.now}→${change.to}`).join(", ") || "none"}); stock ${result.booksBefore} → ${result.booksAfter}.`,
    );
    refresh();
    revalidatePath("/admin");
    return {
      ok: true,
      message: `${result.design}: the ${place.toLowerCase()} now holds ${result.counted} pairs, as counted. Stock ${result.booksBefore} → ${result.booksAfter}.`,
    };
  } catch (error) {
    if (error instanceof ShelfCountRefusal) return { ok: false, message: error.message };
    reportError("count a shoe's shelf", error);
    return { ok: false, message: saveFailureMessage(error, "The count was not saved.") };
  }
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function placeValue(formData: FormData, key: string): StockPlace {
  return textValue(formData, key) === "Shop" ? "Shop" : "Factory";
}

function wholeValue(formData: FormData, key: string) {
  const parsed = Math.round(Number(textValue(formData, key)));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** The stock screen, the shop's stock count and the storefront all read this. */
function refresh() {
  revalidatePath("/admin/stock");
  revalidatePath("/admin/operations");
}

/**
 * Write a challan and move the pairs.
 *
 * Both places change in one transaction, so pairs are never counted twice and
 * never nowhere. What comes back is the challan number, because that is what
 * the owner needs next: it goes on the paper that travels with the goods.
 */
export async function createStockTransferAction(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  // Moving pairs is a write (owner, 2026-10-21): it needed only stock:read, so
  // a Sales or Viewer sign-in could send pairs between places. The same
  // permission as 🔢 Count.
  await requireAdminPermission("operations:write");

  const from = placeValue(formData, "fromLocation");
  const to = placeValue(formData, "toLocation");
  const lineCount = Math.min(Math.max(0, Math.round(Number(textValue(formData, "lineCount")))), 60);

  const items: Array<{ design: string; sizeRun: string; pairs: number }> = [];
  for (let index = 0; index < lineCount; index += 1) {
    // The shoe box's value is "design::sizeRun" (the size travels on its
    // own too). Read as the design whole, "Test Chappal::Mixed" matched no
    // shoe and every challan was refused with "has 0 pairs" (KR-BUG-005).
    const design = textValue(formData, `line${index}Design`).split("::")[0].trim();
    const pairs = wholeValue(formData, `line${index}Pairs`);
    if (design && pairs > 0) {
      items.push({ design, sizeRun: textValue(formData, `line${index}SizeRun`) || "Mixed", pairs });
    }
  }

  if (items.length === 0) {
    return { ok: false, message: "Choose at least one shoe, and say how many pairs are going." };
  }

  try {
    const challan = await createStockTransfer({
      sentDate: textValue(formData, "sentDate") || new Date().toISOString().slice(0, 10),
      fromLocation: from,
      toLocation: to,
      sentBy: textValue(formData, "sentBy"),
      carriedBy: textValue(formData, "carriedBy"),
      note: textValue(formData, "note"),
      receiveNow: textValue(formData, "receiveNow") === "on",
      submissionKey: textValue(formData, "submissionKey") || undefined,
      items,
    });

    await recordAdminAuditEvent(
      "stock_transfer_create",
      `Challan ${challan.challanNumber}: ${challan.sentPairs} pairs ${from} to ${to}.`,
    );
    refresh();

    return {
      ok: true,
      message:
        challan.status === "Received"
          ? `${challan.challanNumber} — ${challan.sentPairs} pairs moved.`
          : `${challan.challanNumber} — ${challan.sentPairs} pairs sent. Count them in when they arrive.`,
    };
  } catch (error) {
    reportError("create a stock transfer", error);
    return { ok: false, message: saveFailureMessage(error, "The challan was not saved.") };
  }
}

/**
 * Count what arrived.
 *
 * A line left blank means "all of it came" rather than "none of it did" — the
 * common case is that everything arrived, and making the owner retype numbers
 * that did not change is how a screen stops being used.
 */
export async function receiveStockTransferAction(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  // Receiving moves pairs into a place: a write, as sending is (2026-10-21).
  await requireAdminPermission("operations:write");

  const transferId = textValue(formData, "transferId");
  if (!transferId) return { ok: false, message: "Which challan is being counted?" };

  const counted: Record<string, number> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("counted:") || typeof value !== "string") continue;
    if (value.trim() === "") continue;
    const parsed = Math.round(Number(value));
    if (Number.isFinite(parsed) && parsed >= 0) counted[key.slice("counted:".length)] = parsed;
  }

  try {
    const challan = await receiveStockTransfer({
      transferId,
      receivedBy: textValue(formData, "receivedBy"),
      counted,
    });

    await recordAdminAuditEvent(
      "stock_transfer_receive",
      `Challan ${challan.challanNumber}: ${challan.receivedPairs} of ${challan.sentPairs} received (${challan.signal}).`,
    );
    refresh();

    if (challan.signal === "Short") {
      const missing = challan.sentPairs - challan.receivedPairs;
      return { ok: true, message: `${challan.challanNumber} — ${missing} pair(s) short. Worth asking about.` };
    }
    if (challan.signal === "Excess") {
      const extra = challan.receivedPairs - challan.sentPairs;
      return { ok: true, message: `${challan.challanNumber} — ${extra} pair(s) more than the challan says.` };
    }
    return { ok: true, message: `${challan.challanNumber} — all ${challan.receivedPairs} pairs arrived.` };
  } catch (error) {
    reportError("receive a stock transfer", error);
    return { ok: false, message: saveFailureMessage(error, "The count was not saved.") };
  }
}

/**
 * Set a place's count from a stocktake.
 *
 * Deliberately not a challan: nothing moved, somebody counted. A challan for a
 * correction would put goods on a road they never travelled.
 */
export async function setPlaceCountAction(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  // Changing a place's count is a write (owner, 2026-10-13): it needed only
  // stock:read, so a Viewer or Sales sign-in could set the shop's pairs. The
  // same permission as the 🔢 Count on each shoe.
  await requireAdminPermission("operations:write");

  const design = textValue(formData, "design");
  if (!design) return { ok: false, message: "Which shoe is being counted?" };

  const pairs = Math.max(0, Math.round(Number(textValue(formData, "pairs"))) || 0);
  const location = placeValue(formData, "location");

  try {
    await setPlaceCount({
      design,
      sizeRun: textValue(formData, "sizeRun") || "Mixed",
      location,
      pairs,
    });

    await recordAdminAuditEvent(
      "stock_place_count",
      `${design} counted at ${location}: ${pairs} pairs.`,
    );
    refresh();

    return { ok: true, message: `${design} — ${pairs} pair(s) counted at the ${location.toLowerCase()}.` };
  } catch (error) {
    reportError("set a stock place count", error);
    return { ok: false, message: saveFailureMessage(error, "The count was not saved.") };
  }
}

/** The Owner's ✓ on an item added at the counter: seen, and right. */
export async function markCounterItemReviewedAction(formData: FormData) {
  const { session } = await requireAdminPermission("settings:write");
  const id = textValue(formData, "id");
  if (!id) return;
  try {
    await markCounterItemReviewed(id, session?.name || session?.email || "Owner");
    await recordAdminAuditEvent("counter_item_reviewed", `Counter item ${id} looked at and marked right.`);
  } catch (error) {
    reportError("mark a counter item reviewed", error);
  }
  revalidatePath("/admin/stock");
  revalidatePath("/admin");
}

/**
 * A shoe sold at the counter before its stock was put in, filled by counting
 * the shelf (owner, 2026-10-09) — for goods with no purchase bill coming. The
 * same people who may add it at the counter may count it.
 */
export async function fillSoldFirstByCountAction(
  _previous: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const { session } = await requireAdminPermission("pos:write");
  const id = textValue(formData, "id");
  if (!id) return { ok: false, message: "Which shoe is being counted?" };
  const sizes = countedSizes(formData);
  if (!sizes) return { ok: false, message: "The sizes could not be read. Type them again." };
  try {
    const filled = await fillSoldFirstByCount(
      id,
      sizes,
      session?.name || session?.email || "Counter",
      textValue(formData, "confirmBigDrop") === "yes",
      textValue(formData, "noneOnShelf") === "yes",
    );
    await recordAdminAuditEvent(
      "counter_sold_first_counted",
      `${filled.design}: stock set to a count of the shelf — ${filled.pairs} pairs (${Object.entries(sizes).map(([size, pairs]) => `${size}×${pairs}`).join(", ") || "none left"}).`,
    );
    revalidatePath("/admin/stock");
    revalidatePath("/admin/pos");
    revalidatePath("/admin");
    return { ok: true, message: `${filled.design}: stock set to the count — ${filled.pairs} pairs at the shop.` };
  } catch (error) {
    if (error instanceof CounterItemRefusal || error instanceof ShelfCountRefusal) return { ok: false, message: error.message };
    reportError("fill a sold-first shoe by counting", error);
    return { ok: false, message: saveFailureMessage(error, "The count was not saved.") };
  }
}
