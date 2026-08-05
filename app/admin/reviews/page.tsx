import Link from "next/link";
import { formatAdminDate } from "@/lib/format-date";
import ExportButton from "@/components/admin/ExportButton";
import ConfirmDeleteButton from "@/components/admin/ConfirmDeleteButton";
import {
  deleteReviewAction,
  updateReviewStatusAction,
} from "@/app/admin/reviews/actions";
import { getProducts } from "@/lib/product-store";
import type { Review } from "@/lib/products";
import ReviewCard from "./ReviewCard";

export const metadata = {
  title: "Reviews | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

type ReviewRow = {
  productId: string;
  productName: string;
  productSku: string;
  review: Review;
};

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-brand-green-ink">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted-soft">
        {detail}
      </p>
    </div>
  );
}

function ReviewsGrid({ rows, title }: { rows: ReviewRow[]; title: string }) {
  if (rows.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-lg font-black text-brand-green-ink mb-4">
        {title} ({rows.length})
      </h2>
      <div className="grid gap-4">
        {rows.map((row) => (
          <ReviewCard key={`${row.productId}:${row.review.id}`} row={row} />
        ))}
      </div>
    </section>
  );
}

export default async function AdminReviewsPage() {
  const products = await getProducts({ includeDrafts: true });
  const rows = products
    .flatMap((product) =>
      product.reviews.map((review) => ({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        review,
      })),
    )
    .sort((left, right) => {
      const statusOrder = { pending: 0, rejected: 1, approved: 2 };
      const statusDiff = statusOrder[left.review.status] - statusOrder[right.review.status];

      if (statusDiff !== 0) {
        return statusDiff;
      }

      return new Date(right.review.createdAt).getTime() - new Date(left.review.createdAt).getTime();
    });

  const pending = rows.filter((row) => row.review.status === "pending");
  const approved = rows.filter((row) => row.review.status === "approved");
  const rejected = rows.filter((row) => row.review.status === "rejected");
  const spamFlags = rows.filter((row) => (row.review as any).flaggedAsSpam);
  const averageRating =
    rows.length > 0
      ? rows.reduce((total, row) => total + row.review.rating, 0) / rows.length
      : 0;

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-green-ink">Customer Review Moderation</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Approve reviews to build customer trust, reject low-quality submissions, or flag spam. Each decision impacts your storefront credibility.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            href="/api/admin/reviews/export"
            className="inline-flex h-9 items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
          >
            📊 Export CSV
          </ExportButton>
          <Link
            href="/admin/products"
            className="inline-flex h-9 items-center rounded-full bg-brand-green px-3 text-xs font-bold text-white"
          >
            Products
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-5">
        <StatCard label="Pending" value={pending.length} detail="needs moderation" />
        <StatCard label="Approved" value={approved.length} detail="live on storefront" />
        <StatCard label="Rejected" value={rejected.length} detail="hidden" />
        {spamFlags.length > 0 && (
          <StatCard label="Flagged Spam" value={spamFlags.length} detail="suspicious reviews" />
        )}
        <StatCard label="Avg Rating" value={averageRating ? averageRating.toFixed(1) : "-"} detail={`${rows.length} reviews`} />
      </div>

      <ReviewsGrid rows={pending} title="🔴 Pending Moderation" />
      <ReviewsGrid rows={approved} title="🟢 Approved Reviews" />
      {rejected.length > 0 && <ReviewsGrid rows={rejected} title="🔴 Rejected Reviews" />}

      {rows.length === 0 && (
        <div className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm font-semibold text-gray-600">No customer reviews yet.</p>
          <p className="mt-1 text-xs text-gray-500">Reviews will appear here once customers submit them on your product pages.</p>
        </div>
      )}
    </section>
  );
}
