import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { getAdminSession } from "@/lib/admin-auth";
import { reverseFactoryWork, FactoryMutationError } from "@/lib/factory-mutations";
import { reportError } from "@/lib/report-error";
import { NextRequest, NextResponse } from "next/server";

/**
 * Take a work entry back from the ledger's ✏️.
 *
 * It deleted the entry outright for a while — the owner read fifty rows a
 * morning and a struck-through double entry got in the way — and the audit was
 * then the only trace of a wage once entered. On 2026-10-13 the owner chose
 * that proof of a wage is never removed: the entry stays, marked reversed, its
 * wage no longer counted, and the screen folds reversed lines away so the
 * morning's reading stays short. The path is kept so nothing that calls it
 * breaks.
 */
export async function POST(request: NextRequest) {
  // Before the try, so a throw can never skip it. wages:write, owner only.
  const denied = await authorizeFactoryApi("/api/factory/ledger/delete", "POST");
  if (denied) return denied;

  try {
    const session = await getAdminSession();
    const reversedBy = session?.name || session?.email || "Owner";

    const body = await request.json().catch(() => ({}));
    const workId = typeof body.work_id === "string" ? body.work_id.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!workId) {
      return NextResponse.json({ error: "Which entry to take back is required." }, { status: 400 });
    }

    const back = await reverseFactoryWork({ workId, reason, reversedBy });

    await recordAdminAuditEvent(
      "factory_work_reverse",
      `Took back work entry: ${back.workerName} · ${back.itemName} · ${back.date} · ${
        back.pairsCount
      } pairs × Rs. ${back.rate} = Rs. ${back.amountEarned}${
        back.color || back.size ? ` · ${[back.color, back.size].filter(Boolean).join(" · ")}` : ""
      }. Reason: ${back.reason}. The entry stays on the ledger, reversed.`,
    );

    return NextResponse.json({
      reversed: true,
      worker_name: back.workerName,
      item_name: back.itemName,
      pairs_count: back.pairsCount,
      amount_earned: back.amountEarned,
    });
  } catch (error) {
    // A closed month or a Work Order entry refuses itself with a message worth
    // showing rather than a generic failure.
    const status = error instanceof FactoryMutationError ? error.status : 409;
    const message = error instanceof Error ? error.message : "Failed to take the entry back";
    reportError("take back a factory work entry", error);
    return NextResponse.json({ error: message }, { status });
  }
}
