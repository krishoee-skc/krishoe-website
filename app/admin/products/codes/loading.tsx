import PageSkeleton from "@/components/admin/PageSkeleton";

/**
 * Held while every shoe's code is read. Shaped as a list, like the page it
 * stands in for, so nothing jumps when the real one lands.
 */
export default function AdminProductCodesLoading() {
  return <PageSkeleton cards={0} rows={8} />;
}
