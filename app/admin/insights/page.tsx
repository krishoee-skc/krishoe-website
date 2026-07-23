import Link from "next/link";
import type { Metadata } from "next";
import LoadFailure from "@/components/admin/LoadFailure";
import { getProducts } from "@/lib/product-store";
import { getOperationsSnapshot } from "@/lib/operations";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";
import { formatAdminDate } from "@/lib/format-date";

export const metadata: Metadata = {
  title: "Customer Voice | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

// A design earns an "attention" flag when customers say so with words (low
// rating) or with their feet (returns coming back).
const LOW_RATING = 3.5;
const HIGH_RETURN_RATE = 10;

async function loadInsights() {
  try {
    return {
      data: await Promise.all([
        getProducts({ includeDrafts: true }),
        getOperationsSnapshot(),
      ]),
      error: "",
    };
  } catch (error) {
    reportError("load the customer voice page", error);
    return { data: null, error: saveFailureMessage(error, "Could not load customer voice.") };
  }
}

function Stars({ value }: { value: number }) {
  return (
    <span className="font-black text-brand-gold-ink">
      {"★".repeat(Math.round(value))}
      <span className="text-gray-300">{"★".repeat(Math.max(0, 5 - Math.round(value)))}</span>
      <span className="ml-1 text-xs font-bold text-gray-500">{value.toFixed(1)}</span>
    </span>
  );
}

export default async function CustomerVoicePage() {
  const loaded = await loadInsights();

  if (!loaded.data) {
    return <LoadFailure what="the customer voice report" message={loaded.error} retryHref="/admin/insights" />;
  }

  const [products, operations] = loaded.data;

  // Words: every non-rejected review, grouped per design.
  const reviewRows = products
    .map((product) => {
      const reviews = product.reviews.filter((review) => review.status !== "rejected");
      const count = reviews.length;
      const average = count > 0 ? reviews.reduce((total, review) => total + review.rating, 0) / count : 0;
      return { id: product.id, name: product.name, reviews, count, average };
    })
    .filter((row) => row.count > 0);

  // Feet: returns per design, aggregated across size runs and channels.
  const returnsByDesign = new Map<string, { sold: number; returned: number }>();
  for (const row of operations.reports.stockHealthRows) {
    const entry = returnsByDesign.get(row.design) ?? { sold: 0, returned: 0 };
    entry.sold += row.soldPairs;
    entry.returned += row.returnedPairs;
    returnsByDesign.set(row.design, entry);
  }
  const returnRows = [...returnsByDesign.entries()]
    .map(([design, entry]) => ({
      design,
      sold: entry.sold,
      returned: entry.returned,
      rate: entry.sold > 0 ? Math.round((entry.returned / entry.sold) * 1000) / 10 : 0,
    }))
    .filter((row) => row.sold > 0 || row.returned > 0);

  const totalReviews = reviewRows.reduce((total, row) => total + row.count, 0);
  const overallAverage =
    totalReviews > 0
      ? reviewRows.reduce((total, row) => total + row.average * row.count, 0) / totalReviews
      : 0;
  const totalSold = returnRows.reduce((total, row) => total + row.sold, 0);
  const totalReturned = returnRows.reduce((total, row) => total + row.returned, 0);
  const overallReturnRate = totalSold > 0 ? Math.round((totalReturned / totalSold) * 1000) / 10 : 0;

  // The improvement list: a design customers rated low, returned often, or both.
  const attention = new Map<string, { design: string; reasons: string[] }>();
  for (const row of reviewRows) {
    if (row.average < LOW_RATING) {
      attention.set(row.name, {
        design: row.name,
        reasons: [`rating ${row.average.toFixed(1)}/5 (${row.count} reviews)`],
      });
    }
  }
  for (const row of returnRows) {
    if (row.rate >= HIGH_RETURN_RATE && row.returned > 0) {
      const existing = attention.get(row.design);
      const reason = `${row.rate}% returned (${row.returned}/${row.sold} pairs)`;
      if (existing) {
        existing.reasons.push(reason);
      } else {
        attention.set(row.design, { design: row.design, reasons: [reason] });
      }
    }
  }
  const attentionRows = [...attention.values()];

  const topRated = [...reviewRows].sort((a, b) => b.average - a.average || b.count - a.count).slice(0, 5);
  const recentReviews = products
    .flatMap((product) =>
      product.reviews
        .filter((review) => review.status !== "rejected")
        .map((review) => ({ product: product.name, review })),
    )
    .sort(
      (a, b) => new Date(b.review.createdAt).getTime() - new Date(a.review.createdAt).getTime(),
    )
    .slice(0, 8);

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-green-ink">ग्राहकको आवाज — Customer Voice</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            ग्राहकले शब्दले (review) र खुट्टाले (return) के भन्छन् — दुवै एकै ठाउँमा। यसैबाट अर्को design
            र सुधारको दिशा निस्कन्छ।
          </p>
        </div>
        <Link
          href="/admin/reviews"
          className="inline-flex h-10 items-center rounded-full border border-gray-200 bg-white px-4 text-sm font-bold text-brand-green-ink transition hover:border-brand-green hover:text-brand-green"
        >
          Review moderation
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Average rating</p>
          <p className="mt-2 text-3xl font-black text-brand-green-ink">
            {totalReviews > 0 ? `${overallAverage.toFixed(1)}/5` : "-"}
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted-soft">
            {totalReviews} reviews
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Return rate</p>
          <p className={`mt-2 text-3xl font-black ${overallReturnRate >= HIGH_RETURN_RATE ? "text-brand-clay" : "text-brand-green"}`}>
            {totalSold > 0 ? `${overallReturnRate}%` : "-"}
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted-soft">
            {totalReturned} of {totalSold} pairs returned
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Designs praised</p>
          <p className="mt-2 text-3xl font-black text-brand-green">{topRated.length}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted-soft">
            with customer reviews
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Needs attention</p>
          <p className={`mt-2 text-3xl font-black ${attentionRows.length > 0 ? "text-brand-clay" : "text-brand-green"}`}>
            {attentionRows.length}
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted-soft">
            low rating or high returns
          </p>
        </div>
      </div>

      {attentionRows.length > 0 ? (
        <section className="mt-8 rounded-2xl border border-brand-clay bg-brand-clay-tint p-5">
          <h2 className="text-lg font-black text-brand-clay">⚠️ सुधार्न ध्यान दिने design</h2>
          <p className="mt-1 text-sm font-semibold text-brand-green-ink">
            ग्राहकले यी design मा चित्त नबुझेको संकेत दिएका छन् — अर्को batch अघि हेर्नुहोस्।
          </p>
          <div className="mt-4 grid gap-3">
            {attentionRows.map((row) => (
              <div key={row.design} className="rounded-lg border border-brand-clay/30 bg-white p-4">
                <p className="font-black text-brand-green-ink">{row.design}</p>
                <p className="mt-1 text-sm text-brand-clay">{row.reasons.join(" · ")}</p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p className="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-brand-green">
          अहिलेसम्म कुनै design मा चिन्ताको संकेत छैन। 👍
        </p>
      )}

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink">⭐ मनपरेका design</h2>
          <p className="mt-1 text-sm text-gray-500">ग्राहकले उच्च rating दिएका — यस्तै अरू बनाउने संकेत।</p>
          {topRated.length === 0 ? (
            <p className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
              अहिलेसम्म review छैन। बिल WhatsApp मा पठाउँदा &ldquo;राम्रो लागे review लेखिदिनुस्&rdquo;
              भन्न सकिन्छ — आवाज आउन थाल्छ।
            </p>
          ) : (
            <div className="mt-4 divide-y">
              {topRated.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/product/${row.id}`}
                      className="font-bold text-brand-green-ink underline decoration-brand-gold-bright underline-offset-4 hover:text-brand-green"
                    >
                      {row.name}
                    </Link>
                    <p className="text-xs text-gray-500">{row.count} reviews</p>
                  </div>
                  <Stars value={row.average} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-brand-green-ink">📦 Return को हिसाब (design-अनुसार)</h2>
          <p className="mt-1 text-sm text-gray-500">फर्किएका जोडी — साइज, आराम, वा गुणस्तरको संकेत।</p>
          {returnRows.length === 0 ? (
            <p className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
              बिक्री/return को data अझै छैन।
            </p>
          ) : (
            <div className="mt-4 divide-y">
              {[...returnRows]
                .sort((a, b) => b.rate - a.rate || b.returned - a.returned)
                .slice(0, 8)
                .map((row) => (
                  <div key={row.design} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-bold text-brand-green-ink">{row.design}</p>
                      <p className="text-xs text-gray-500">
                        {row.returned} returned / {row.sold} sold
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                        row.rate >= HIGH_RETURN_RATE
                          ? "bg-brand-clay-tint text-brand-clay"
                          : "bg-brand-green-tint text-brand-green"
                      }`}
                    >
                      {row.rate}%
                    </span>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-brand-green-ink">🗣️ पछिल्ला प्रतिक्रिया</h2>
        {recentReviews.length === 0 ? (
          <p className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-600">
            अहिलेसम्म कुनै प्रतिक्रिया छैन।
          </p>
        ) : (
          <div className="mt-4 divide-y">
            {recentReviews.map(({ product, review }) => (
              <div key={review.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-brand-green-ink">
                    {product}
                    <span className="ml-2 text-xs font-semibold text-gray-500">— {review.name}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Stars value={review.rating} />
                    <span className="text-xs text-gray-400">{formatAdminDate(review.createdAt)}</span>
                  </div>
                </div>
                <p className="mt-1 text-sm leading-6 text-gray-600">{review.comment}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
