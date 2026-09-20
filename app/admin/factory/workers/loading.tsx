import PageSkeleton from "@/components/admin/PageSkeleton";

/**
 * Held while the team list arrives.
 *
 * A list rather than a dashboard, so no summary cards: showing four tiles that
 * never appear would make the screen jump when the real one lands.
 */
export default function FactoryWorkersLoading() {
  return <PageSkeleton cards={0} rows={8} />;
}
