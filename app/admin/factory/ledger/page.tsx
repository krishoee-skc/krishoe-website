import type { Metadata } from "next";
import PieceLedger from "@/app/admin/factory/ledger/PieceLedger";
import LoadFailure from "@/components/admin/LoadFailure";
import type { FactoryWorker } from "@/lib/factory-board";
import { getFactoryWorkers } from "@/lib/factory-board-data";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";

export const metadata: Metadata = {
  title: "Piece ledger | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

async function loadTeam(): Promise<{ workers: FactoryWorker[] | null; error: string }> {
  try {
    // Piece-rate only: a monthly-salaried staff member is settled on the salary
    // screen, and has no pairs to carry a piece-wage ledger. Asked for in the
    // query rather than filtered afterwards, so the whole team is not carried
    // across to show part of it.
    return { workers: await getFactoryWorkers({ workerType: "piece_rate" }), error: "" };
  } catch (error) {
    reportError("load the factory team for the ledger", error);
    return { workers: null, error: saveFailureMessage(error, "Could not load the team.") };
  }
}

export default async function FactoryLedgerPage() {
  const loaded = await loadTeam();

  if (!loaded.workers) {
    return (
      <LoadFailure
        what="the piece ledger"
        message={loaded.error}
        retryHref="/admin/factory/ledger"
      />
    );
  }

  return <PieceLedger initialWorkers={loaded.workers} />;
}
