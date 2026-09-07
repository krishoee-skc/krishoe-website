import type { Metadata } from "next";
import TeamList from "@/app/admin/factory/workers/TeamList";
import LoadFailure from "@/components/admin/LoadFailure";
import { getFactoryWorkers } from "@/lib/factory-board-data";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";
import type { FactoryWorker } from "@/lib/factory-board";

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

  return <TeamList initialWorkers={loaded.workers} />;
}
