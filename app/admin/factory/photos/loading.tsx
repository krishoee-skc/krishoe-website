import PageSkeleton from "@/components/admin/PageSkeleton";

/**
 * Held while the workers' photos and requests arrive.
 *
 * A list rather than a dashboard, so no summary cards: showing four tiles that
 * never appear would make the screen jump when the real one lands.
 */
export default function WorkerPhotosLoading() {
  return <PageSkeleton cards={0} rows={8} />;
}
