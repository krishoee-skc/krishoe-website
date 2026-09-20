import PageSkeleton from "@/components/admin/PageSkeleton";

/**
 * Held while the piece ledger arrives.
 *
 * This screen is a row of summary figures above a long table of entries, and
 * it waits on the database for every one of them. Shaped to match, so the wait
 * reads as the ledger filling in rather than as a screen that has hung.
 */
export default function FactoryLedgerLoading() {
  return <PageSkeleton cards={4} rows={10} />;
}
