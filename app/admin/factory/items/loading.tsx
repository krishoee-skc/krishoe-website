import PageSkeleton from "@/components/admin/PageSkeleton";

/** Held while the item list arrives — a list, so no summary cards. */
export default function FactoryItemsLoading() {
  return <PageSkeleton cards={0} rows={8} />;
}
