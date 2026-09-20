import PageSkeleton from "@/components/admin/PageSkeleton";

/**
 * Held while the forbidden screen's data arrives.
 *
 * This route waits on the database before anything is drawn, and without this
 * the wait was a blank screen — on a phone, indistinguishable from an app that
 * has hung. Shaped as a list, so no summary tiles: showing tiles that never arrive would
 * make the page jump when the real one lands.
 */
export default function AdminForbiddenLoading() {
  return <PageSkeleton cards={0} rows={0} />;
}
