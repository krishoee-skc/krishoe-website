import type { Metadata } from "next";
import WorkerInboxLink from "./WorkerInboxLink";
import TeamList from "@/app/admin/factory/workers/TeamList";
import LoadFailure from "@/components/admin/LoadFailure";
import { getFactoryWorkers } from "@/lib/factory-board-data";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";
import type { FactoryWorker } from "@/lib/factory-board";
import { getAdminSession } from "@/lib/admin-auth";
import { canAdmin, getSessionAdminRole } from "@/lib/admin-role-permissions";
import { getAdminSettings } from "@/lib/admin-settings";
import { formatStaffPhone } from "@/lib/staff-phone";
import type { WorkerApp } from "./WorkerAppPanel";
import { getWorkersOnLeave, workerBalances, workerInboxCounts } from "@/lib/worker-portal";
import { workerTableReady } from "@/lib/worker-portal-db";

export const metadata: Metadata = {
  title: "Team | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

async function loadTeam(): Promise<{ workers: FactoryWorker[] | null; error: string }> {
  try {
    // Retired members included: this is the only screen that can bring someone
    // back, and every other list and form hides them.
    return { workers: await getFactoryWorkers({ includeRetired: true }), error: "" };
  } catch (error) {
    reportError("load the factory team", error);
    return { workers: null, error: saveFailureMessage(error, "Could not load the team.") };
  }
}

export default async function FactoryWorkersPage() {
  const loaded = await loadTeam();

  if (!loaded.workers) {
    return (
      <LoadFailure
        what="the factory team"
        message={loaded.error}
        retryHref="/admin/factory/workers"
      />
    );
  }

  const [apps, leave, balances, inbox] = await Promise.all([
    loadWorkerApps(),
    workerTableReady("factory_worker_leave")
      .then(async (ready) => (ready ? Object.fromEntries(await getWorkersOnLeave()) : null))
      .catch(() => null),
    workerBalances().catch(() => ({})),
    workerInboxCounts().catch(() => ({ photos: 0, requests: 0 })),
  ]);
  return (
    <>
      <WorkerInboxLink photos={inbox.photos} requests={inbox.requests} />
      <TeamList initialWorkers={loaded.workers} apps={apps} leave={leave} balances={balances} />
    </>
  );
}

/**
 * Which workers already have the app (owner, 2026-10-02) — only for a reader
 * who may make and reset accounts; for anyone else the row is left out rather
 * than shown with buttons that would be refused.
 */
async function loadWorkerApps(): Promise<Record<string, WorkerApp> | null> {
  const session = await getAdminSession();
  if (!session || !canAdmin(getSessionAdminRole(session), "settings:write")) return null;
  try {
    const { staff } = await getAdminSettings();
    const apps: Record<string, WorkerApp> = {};
    for (const member of staff) {
      if (member.factoryWorkerId) {
        apps[member.factoryWorkerId] = { phone: formatStaffPhone(member.phone), email: member.email ?? "", status: member.status, lastLoginAt: member.lastLoginAt };
      }
    }
    return apps;
  } catch (error) {
    reportError("load the workers' app accounts", error);
    return null;
  }
}
