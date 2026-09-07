import type { Metadata } from "next";
import PayrollReport from "@/app/admin/factory/reports/PayrollReport";
import LoadFailure from "@/components/admin/LoadFailure";
import { bikramMonthKeyOf, bikramMonthRange } from "@/lib/bikram-sambat";
import { getFactoryPayrollForMonth } from "@/lib/factory-board-data";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";

export const metadata: Metadata = {
  title: "Monthly reports | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

/**
 * The month's payroll as it already stands, read in one query for the whole
 * team. The screen rebuilds each worker's summary behind this, so the numbers
 * are readable immediately rather than after a rebuild that grows longer with
 * every person the factory hires.
 */
async function loadPayroll(month: string) {
  const range = bikramMonthRange(month);

  if (!range) {
    return { summaries: [], error: "" };
  }

  try {
    return { summaries: await getFactoryPayrollForMonth(range.startKey, range.endKey), error: "" };
  } catch (error) {
    reportError("load the factory payroll", error);
    return {
      summaries: null,
      error: saveFailureMessage(error, "Could not load the monthly payroll."),
    };
  }
}

export default async function FactoryReportsPage() {
  // Bikram Sambat, because that is the month wages are agreed in.
  const month = bikramMonthKeyOf(new Date());
  const loaded = await loadPayroll(month);

  if (!loaded.summaries) {
    return (
      <LoadFailure
        what="the monthly payroll"
        message={loaded.error}
        retryHref="/admin/factory/reports"
      />
    );
  }

  return <PayrollReport initialMonth={month} initialSummaries={loaded.summaries} />;
}
