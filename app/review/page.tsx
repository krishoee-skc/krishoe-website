import type { Metadata } from "next";
import T from "@/components/T";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ShopReviewForm, { type ReviewableProduct } from "@/components/ShopReviewForm";
import { getProducts } from "@/lib/product-store";
import { reportError } from "@/lib/report-error";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Leave a review | KRISHOE",
  description:
    "आफूले किनेको KRISHOE जुत्ताबारे राय दिनुहोस् — जुत्ता छान्नुहोस्, तारा दिनुहोस्, दुई शब्द लेख्नुहोस्। Share your experience of a KRISHOE shoe.",
  path: "/review",
});

/**
 * One address for "I want to leave a review".
 *
 * The form itself is not new and has always been open to everyone — but it sat
 * inside an individual shoe's page, and nothing in the menu, the footer, the
 * phone tab bar or the home page pointed at it. Customers told the owner they
 * could not find where to leave a review. They were looking for a door that did
 * not exist.
 *
 * This is that door, and it is a plain address on purpose: /review can be turned
 * into a QR code and stuck on the shop counter or printed on the bill, so a
 * customer standing in the shop can scan it and write a line without hunting
 * through the app for the pair they just bought.
 */
export default async function ReviewPage() {
  let products: ReviewableProduct[] = [];

  try {
    // Only what the shop actually sells: drafts are not visible to customers,
    // so a review of one could never be shown.
    products = (await getProducts()).map((product) => ({
      id: product.id,
      name: product.name,
    }));
  } catch (error) {
    // The page still renders and says so, rather than failing outright.
    reportError("load products for the review page", error);
  }

  return (
    <main className="bg-brand-mist">
      <Navbar />
      <section className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
            <T en="Your voice" ne="तपाईंको राय" />
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink md:text-5xl">
            <T en="How were your shoes?" ne="जुत्ता कस्तो लाग्यो?" />
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-brand-muted">
            <T
              en="Two lines are enough. What you write helps the next person choose, and tells us what to make better."
              ne="दुई हरफ भए पुग्छ। तपाईंले लेखेको कुराले अर्को ग्राहकलाई छान्न सजिलो हुन्छ, र हामीलाई के सुधार्ने भन्ने थाहा हुन्छ।"
            />
          </p>
        </div>

        <div className="rounded-lg border border-brand-green-line bg-brand-paper p-6 shadow-sm md:p-8">
          <ShopReviewForm products={products} />
        </div>
      </section>
      <Footer />
    </main>
  );
}
