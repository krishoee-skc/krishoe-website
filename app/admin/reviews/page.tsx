import Link from "next/link";
import { formatAdminDate } from "@/lib/format-date";
import ExportButton from "@/components/admin/ExportButton";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import ConfirmDeleteButton from "@/components/admin/ConfirmDeleteButton";
import {
  deleteReviewAction,
  updateReviewStatusAction,
} from "@/app/admin/reviews/actions";
import { getProducts } from "@/lib/product-store";
import type { Review } from "@/lib/products";

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

function formatDate(value: string) {
  return formatAdminDate(value, { time: true });
}

function statusClass(status: Review["status"]) {
  if (status === "approved") return "bg-brand-green-tint text-brand-green";
  if (status === "rejected") return "bg-brand-clay-tint text-brand-clay";
  return "bg-brand-cream-soft text-brand-gold-ink";
}

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

function ReviewStatusButton({
  row,
  status,
  label,
}: {
  row: ReviewRow;
  status: Review["status"];
  label: string;
}) {
  return (
    <form action={updateReviewStatusAction}>
      <input type="hidden" name="productId" value={row.productId} />
      <input type="hidden" name="reviewId" value={row.review.id} />
      <input type="hidden" name="status" value={status} />
      <FormSubmitButton className="inline-flex h-9 items-center rounded-full border border-gray-200 px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green">
        {label}
      </FormSubmitButton>
    </form>
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
  const averageRating =
    rows.length > 0
      ? rows.reduce((total, row) => total + row.review.rating, 0) / rows.length
      : 0;

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-green-ink">Review moderation</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Approve customer reviews for storefront trust, reject low-quality submissions, or remove spam.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportButton
            href="/api/admin/reviews/export"
            className="inline-flex h-9 items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
          >
            Export CSV
          </ExportButton>
          <Link
            href="/admin/products"
            className="inline-flex h-9 items-center rounded-full bg-brand-green px-3 text-xs font-bold text-white"
          >
            Products
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Pending" value={pending.length} detail="needs moderation" />
        <StatCard label="Approved" value={approved.length} detail="visible on product pages" />
        <StatCard label="Rejected" value={rejected.length} detail="hidden from customers" />
        <StatCard label="Average rating" value={averageRating ? averageRating.toFixed(1) : "-"} detail={`${rows.length} total reviews`} />
      </div>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-black text-brand-green-ink">Review queue</h2>
          <p className="mt-1 text-sm text-gray-500">Pending reviews are shown first.</p>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
            No product reviews yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Rating</th>
                  <th className="py-2 pr-3">Review</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={`${row.productId}:${row.review.id}`}>
                    <td className="whitespace-nowrap py-3 pr-3 text-xs text-gray-500">
                      {formatDate(row.review.createdAt)}
                    </td>
                    <td className="min-w-52 py-3 pr-3">
                      <Link href={`/product/${row.productId}`} className="font-bold text-brand-green-ink hover:text-brand-green">
                        {row.productName}
                      </Link>
                      <p className="mt-1 font-mono text-xs text-gray-400">{row.productSku}</p>
                    </td>
                    <td className="py-3 pr-3 font-semibold text-brand-green-ink">{row.review.name}</td>
                    <td className="whitespace-nowrap py-3 pr-3 font-black text-brand-gold-ink">
                      {row.review.rating}/5
                    </td>
                    <td className="min-w-80 max-w-xl py-3 pr-3 leading-6 text-gray-600">{row.review.comment}</td>
                    <td className="py-3 pr-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(row.review.status)}`}>
                        {row.review.status}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {row.review.status !== "approved" ? (
                          <ReviewStatusButton row={row} status="approved" label="Approve" />
                        ) : null}
                        {row.review.status !== "rejected" ? (
                          <ReviewStatusButton row={row} status="rejected" label="Reject" />
                        ) : null}
                        {row.review.status !== "pending" ? (
                          <ReviewStatusButton row={row} status="pending" label="Pending" />
                        ) : null}
                        <form action={deleteReviewAction}>
                          <input type="hidden" name="productId" value={row.productId} />
                          <input type="hidden" name="reviewId" value={row.review.id} />
                          <ConfirmDeleteButton
                            message={`Delete this review by ${row.review.name}? This cannot be undone.`}
                            className="inline-flex h-9 items-center rounded-full border border-red-200 px-3 text-xs font-bold text-red-700 transition hover:bg-red-50"
                          />
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
