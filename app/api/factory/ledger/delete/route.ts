import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { getAdminSession } from "@/lib/admin-auth";
import { deleteFactoryWork, FactoryMutationError } from "@/lib/factory-mutations";
import { reportError } from "@/lib/report-error";
import { NextRequest, NextResponse } from "next/server";

/**
 * Delete a work entry outright.
 *
 * Reversing left the row on the ledger struck through, which is what a bank
 * does — but the owner reads fifty rows a morning on a workshop phone, and a
 * double entry needed three lines before it read correctly. They asked for the
 * row to go, and this is that.
 *
 * What was deleted is written to the admin audit: the worker, the shoe, the
 * pairs, the wage and the reason. The ledger no longer carries it, but a worker
 * asking where their wage went can still be answered.
 */
export async function POST(request: NextRequest) {
  // Before the try, so a throw can never skip it. wages:write, owner only.
  const denied = await authorizeFactoryApi("/api/factory/ledger/delete", "POST");
  if (denied) return denied;

  try {
    const session = await getAdminSession();
    const deletedBy = session?.name || session?.email || "Owner";

    const body = await request.json().catch(() => ({}));
    const workId = typeof body.work_id === "string" ? body.work_id.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!workId) {
      return NextResponse.json({ error: "Which entry to delete is required." }, { status: 400 });
    }

    const gone = await deleteFactoryWork({ workId, reason, deletedBy });

    // Written after the rows are gone, because this is now the only record that
    // the work was ever entered — everything a worker might later ask about it.
    await recordAdminAuditEvent(
      "factory_work_delete",
      `Deleted work entry: ${gone.workerName} · ${gone.itemName} · ${gone.date} · ${
        gone.pairsCount
      } pairs × Rs. ${gone.rate} = Rs. ${gone.amountEarned}${
        gone.color || gone.size ? ` · ${[gone.color, gone.size].filter(Boolean).join(" · ")}` : ""
      }. Reason: ${gone.reason}`,
    );

    return NextResponse.json({
      deleted: true,
      worker_name: gone.workerName,
      item_name: gone.itemName,
      pairs_count: gone.pairsCount,
      amount_earned: gone.amountEarned,
    });
  } catch (error) {
    // A closed month or a Work Order entry refuses itself with a message worth
    // showing rather than a generic failure.
    const status = error instanceof FactoryMutationError ? error.status : 409;
    const message = error instanceof Error ? error.message : "Failed to delete the entry";
    reportError("delete a factory work entry", error);
    return NextResponse.json({ error: message }, { status });
  }
}
