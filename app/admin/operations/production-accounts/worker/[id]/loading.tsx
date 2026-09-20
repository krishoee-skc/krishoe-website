import PageSkeleton from "@/components/admin/PageSkeleton";

/**
 * Held while the id screen's data arrives.
 *
 * This route waits on the database before anything is drawn, and without this
 * the wait was a blank screen — on a phone, indistinguishable from an app that
 * has hung. Shaped as 3 summary tiles over its rows, matching what the
 * screen draws.
 */
export default function AdminOperationsProductionAccountsWorkerIdLoading() {
  return <PageSkeleton cards={3} rows={10} />;
}
