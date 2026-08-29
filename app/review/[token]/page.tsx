import type { Metadata } from "next";
import Link from "next/link";
import SafeImage from "@/components/SafeImage";
import T from "@/components/T";
import { getProductById } from "@/lib/product-store";
import { readReviewToken } from "@/lib/review-invite";
import { getOrderById } from "@/lib/submissions";
import ReviewInviteForm from "./ReviewInviteForm";

/**
 * Where an emailed review link lands.
 *
 * No account, no password, no navigation — a photograph of the pair they bought
 * and a place to say what they thought. Anything else on this page is a reason
 * to close the tab.
 */

export const metadata: Metadata = {
  title: "How were your shoes? | KRISHOE",
  // A review link is per-customer. It has no business in a search index, and a
  // crawler following one would be asking the shop to render a stranger's
  // order.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function Dead() {
  return (
    <main className="mx-auto max-w-md px-5 py-20 text-center">
      <p className="text-5xl">🔗</p>
      <h1 className="mt-4 text-xl font-black text-brand-green-ink">
        <T en="This link does not work" ne="यो लिङ्क चल्दैन" />
      </h1>
      <p className="mt-2 text-sm leading-6 text-gray-600">
        <T
          en="The link may have expired. If you still want to tell us how they were, say so directly — we would be glad to hear it."
          ne="लिङ्कको म्याद सकिएको हुनसक्छ। राय दिन मन भए हामीलाई सिधै भन्नुहोस् — खुशी लाग्नेछ।"
        />
      </p>
      <Link
        href="/contact"
        className="mt-6 inline-block rounded-xl bg-brand-green-ink px-6 py-3 text-sm font-black text-white"
      >
        <T en="Contact us" ne="सम्पर्क गर्ने" />
      </Link>
    </main>
  );
}

export default async function ReviewInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = readReviewToken(token);
  if (!invite) return <Dead />;

  const [order, product] = await Promise.all([
    getOrderById(invite.orderId),
    getProductById(invite.productId),
  ]);

  // The token says which pair; the order says whether it was ever bought. Both
  // have to agree before a stranger is shown a customer's name.
  const bought = order?.items.some(
    (item) => item.productId === invite.productId && item.quantity > 0,
  );
  if (!order || !product || !bought) return <Dead />;

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <div className="text-center">
        <div className="relative mx-auto h-40 w-40 overflow-hidden rounded-2xl bg-gray-100">
          <SafeImage
            src={product.image}
            alt={product.name}
            fill
            sizes="160px"
            className="object-cover"
          />
        </div>
        <h1 className="mt-5 text-2xl font-black text-brand-green-ink">
          <T en="Hello" ne="नमस्कार" />
          {order.name ? ` ${order.name.split(" ")[0]}` : ""} 🙏
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          <T en="How were the" ne="तपाईंले किन्नुभएको" />{" "}
          <strong>{product.name}</strong>{" "}
          <T
            en="you bought? Two words is a big help to the next shopper."
            ne="कस्तो लाग्यो? दुई शब्दले अरू ग्राहकलाई ठूलो सहयोग हुन्छ।"
          />
        </p>
      </div>

      <div className="mt-8">
        <ReviewInviteForm
          token={token}
          productName={product.name}
          defaultName={order.name ?? ""}
        />
      </div>
    </main>
  );
}
