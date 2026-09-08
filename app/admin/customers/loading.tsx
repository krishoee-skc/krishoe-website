import { SkeletonLine, SkeletonStatRow, SkeletonCard } from "@/components/admin/Skeleton";

/** Held while this screen's data arrives, in the shape the page will take. */
export default function AdminCustomersLoading() {
  return (
    <section className="p-6">
      {/* Title and its line of explanation */}
      <div className="space-y-2">
        <SkeletonLine className="h-7 w-72 max-w-full" />
        <SkeletonLine className="h-4 w-96 max-w-full" />
      </div>

      <div className="mt-6">
        <SkeletonStatRow count={5} />
      </div>

      <div className="mt-6 grid gap-4">
        <SkeletonCard />
      </div>
    </section>
  );
}
