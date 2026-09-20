import PageSkeleton from "@/components/admin/PageSkeleton";

/**
 * Held while the salary run arrives.
 *
 * Summary tiles over a table of staff and what each is owed — the same shape
 * as the ledger, and the screen where the week's money is read.
 */
export default function FactorySalaryLoading() {
  return <PageSkeleton cards={4} rows={8} />;
}
