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
  await requireAdminPermission("stock:read");

  const from = placeValue(formData, "fromLocation");
  const to = placeValue(formData, "toLocation");
  const lineCount = Math.min(Math.max(0, Math.round(Number(textValue(formData, "lineCount")))), 60);

  const items: Array<{ design: string; sizeRun: string; pairs: number }> = [];
  for (let index = 0; index < lineCount; index += 1) {
    const design = textValue(formData, `line${index}Design`);
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
  await requireAdminPermission("stock:read");

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
  await requireAdminPermission("stock:read");

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
