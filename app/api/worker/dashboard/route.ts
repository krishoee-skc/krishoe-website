import { NextResponse } from "next/server";
import { getCurrentWorkerAccess } from "@/lib/worker-auth";

export async function GET() {
  const access = await getCurrentWorkerAccess();

  if (!access.authenticated) {
    return NextResponse.json(
      { error: "Worker sign-in is required" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!access.linked) {
    return NextResponse.json(
      { error: access.reason },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Mirrors the portal pages: the worker's own factory record, their recent
  // entries and their month totals. No attendance — the factory records pairs
  // handed over, not clock-in times.
  const { detail } = access;
  return NextResponse.json(
    {
      data: {
        profile: {
          id: detail.worker.id,
          name: detail.worker.name,
          category: detail.worker.category,
          workerType: detail.worker.workerType,
          status: detail.worker.status,
        },
        balance: detail.balance,
        production: detail.work,
        months: detail.months,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
