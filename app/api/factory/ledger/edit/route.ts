import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { getAdminSession } from "@/lib/admin-auth";
import { editFactoryWork, FactoryMutationError } from "@/lib/factory-mutations";
import { reportError } from "@/lib/report-error";
import { NextRequest, NextResponse } from "next/server";

/**
 * Correct a saved work entry in place.
 *
 * Reversing leaves two lines for one piece of work and means entering it twice.
 * For a colour that was missed or a rate typed wrong, the owner asked for the
 * row itself to be corrected — with nothing anywhere left saying the old thing.
 *
 * The mutation rewrites all three tables that hold an entry in one transaction
 * and rebuilds the month; this only checks who is asking and what they sent.
 */
export async function POST(request: NextRequest) {
  // Before the try, so a throw can never skip it. wages:write, owner only —
  // the same bar as approving or reversing a wage.
  const denied = await authorizeFactoryApi("/api/factory/ledger/edit", "POST");
  if (denied) return denied;

  try {
    const session = await getAdminSession();
    const editedBy = session?.name || session?.email || "Owner";

    const body = await request.json().catch(() => ({}));
    const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
    const workId = text(body.work_id);
    const workerId = text(body.worker_id);
    const itemId = text(body.item_id);

    if (!workId || !workerId || !itemId) {
      return NextResponse.json(
        { error: "The entry, the worker and the item are all required." },
        { status: 400 },
      );
    }

    const pairsCount = Number(body.pairs_count);
    if (!Number.isFinite(pairsCount) || pairsCount <= 0) {
      return NextResponse.json({ error: "Pairs must be more than zero." }, { status: 400 });
    }

    const result = await editFactoryWork({
      workId,
      workerId,
      itemId,
      color: text(body.color),
      size: text(body.size),
      pairsCount: Math.round(pairsCount),
      rejectPairs: Math.max(0, Math.round(Number(body.reject_pairs) || 0)),
      // Blank asks for the rate on file, which is what the owner wants once
      // they have corrected the item.
      ratePerPair: Number(body.rate_per_pair) || null,
      reason: text(body.reason),
      editedBy,
    });

    const moved = result.amount_earned - result.amount_before;
    await recordAdminAuditEvent(
      "factory_work_edit",
      `${result.worker_name}: work entry corrected — Rs. ${result.amount_before} to Rs. ${
        result.amount_earned
      }${moved === 0 ? " (no change to the wage)" : ""}${
        result.worker_changed ? "; moved to another worker" : ""
      }${result.item_changed ? "; item changed" : ""}. ${text(body.reason)}`,
    );

    return NextResponse.json({ edited: true, ...result, amount_moved: moved });
  } catch (error) {
    // A closed month, a Work Order entry, or an item with no production link
    // each refuse themselves with a message worth showing.
    const status = error instanceof FactoryMutationError ? error.status : 409;
    const message = error instanceof Error ? error.message : "Failed to correct the entry";
    reportError("correct a factory work entry", error);
    return NextResponse.json({ error: message }, { status });
  }
}
