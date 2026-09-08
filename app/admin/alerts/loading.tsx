import { SkeletonLine, SkeletonCard } from "@/components/admin/Skeleton";

/** Held while this screen's data arrives, in the shape the page will take. */
export default function AdminAlertsLoading() {
  return (
    <section className="p-6">
      {/* Title and its line of explanation */}
      <div className="space-y-2">
        <SkeletonLine className="h-7 w-72 max-w-full" />
        <SkeletonLine className="h-4 w-96 max-w-full" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </section>
  );
}
