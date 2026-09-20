import PageSkeleton from "@/components/admin/PageSkeleton";

/**
 * Held while the analytics screen's data arrives.
 *
 * This route waits on the database before anything is drawn, and without this
 * the wait was a blank screen — on a phone, indistinguishable from an app that
 * has hung. Shaped as 4 summary tiles over its rows, matching what the
 * screen draws.
 */
export default function AdminAnalyticsLoading() {
  return <PageSkeleton cards={4} rows={8} />;
}
