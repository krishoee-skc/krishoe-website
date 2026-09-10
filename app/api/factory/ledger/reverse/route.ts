import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { getAdminSession } from "@/lib/admin-auth";
import { bikramMonthKeyOf } from "@/lib/bikram-sambat";
import { refreshFactoryMonthlySummary } from "@/lib/factory-mutations";
import { reverseProductionWorkEntry } from "@/lib/production-accounting";
import { reportError } from "@/lib/report-error";
import { NextRequest, NextResponse } from "next/server";

/**
 * Reverse a mistaken work entry from the ledger the owner is reading.
 *
 * The reversal itself already existed on the wages screen, and was made
 * two-sided earlier — it takes back the factory row, the worker's ledger row
 * and the production row together, and rebuilds the month. What was missing was
 * a way to reach it from the piece ledger, which is where a mistake is actually
 * noticed: two entries went in without a colour or size and the owner had to
 * leave for another screen to undo them.
 *
 * Nothing is deleted. The row stays, struck through and badged, with the reason
 * beside it — a ledger keeps its history, and a worker who asks where their
 * wage went deserves an answer.
 */
export async function POST(request: NextRequest) {
  // Before the try, so a thrown error can never skip it. The policy map holds
  // the rule — wages:write, owner only, the same bar the wages screen applies
  // to the same act.
  const denied = await authorizeFactoryApi("/api/factory/ledger/reverse", "POST");
  if (denied) return denied;

  try {
    const session = await getAdminSession();
    const reversedBy = session?.name || session?.email || "Owner";

    const body = await request.json().catch(() => ({}));
    const entryId = typeof body.entry_id === "string" ? body.entry_id.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    if (!entryId) {
      return NextResponse.json({ error: "Which entry to reverse is required." }, { status: 400 });
    }
    // Long enough to say what happened. "wrong" tells the next reader nothing,
    // and this line is the whole record of why a wage was taken back.
    if (reason.length < 5) {
      return NextResponse.json(
        { error: "Write a clear reason (at least 5 characters) — it stays on the entry." },
        { status: 400 },
      );
    }

    const result = await reverseProductionWorkEntry({ entryId, reason, reversedBy });

    // The month the wage is paid from still counted the reversed work. Rebuilt
    // here rather than inside the reversal, which holds the worker lock that
    // refreshFactoryMonthlySummary would try to take again.
    if (result.factoryWorkReversed && result.submissionKey) {
      await refreshFactoryMonthlySummary({
        submissionKey: `reverse:${result.submissionKey}`,
        month: bikramMonthKeyOf(result.workDate),
        workerId: result.employeeId,
      });
    }

    await recordAdminAuditEvent(
      "production_work_reverse",
      `${result.employeeName} wage Rs. ${result.earnedWage} reversed from the piece ledger: ${reason}${
        result.factoryWorkReversed ? "; factory work entry and worker ledger reversed too" : ""
      }.`,
    );

    return NextResponse.json({
      reversed: true,
      worker_name: result.employeeName,
      amount: result.earnedWage,
      both_sides: result.factoryWorkReversed,
    });
  } catch (error) {
    // An entry already reversed, or one whose lot has posted stock, refuses
    // itself with a message worth showing rather than a generic failure.
    const message = error instanceof Error ? error.message : "Failed to reverse the work entry";
    reportError("reverse a work entry from the piece ledger", error);
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
