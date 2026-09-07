import type { Metadata } from "next";
import StaffSalary from "@/app/admin/factory/salary/StaffSalary";
import LoadFailure from "@/components/admin/LoadFailure";
import type { FactoryWorker } from "@/lib/factory-board";
import { getFactoryWorkers } from "@/lib/factory-board-data";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";

export const metadata: Metadata = {
  title: "Staff salary | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

async function loadStaff(): Promise<{ workers: FactoryWorker[] | null; error: string }> {
  try {
    const workers = await getFactoryWorkers();
    return {
      workers: workers.filter((worker) => worker.worker_type === "monthly_staff"),
      error: "",
    };
  } catch (error) {
    reportError("load the factory staff for salary", error);
    return { workers: null, error: saveFailureMessage(error, "Could not load the staff.") };
  }
}

export default async function FactorySalaryPage() {
  const loaded = await loadStaff();

  if (!loaded.workers) {
    return (
      <LoadFailure
        what="the staff salary screen"
        message={loaded.error}
        retryHref="/admin/factory/salary"
      />
    );
  }

  return <StaffSalary initialWorkers={loaded.workers} />;
}
