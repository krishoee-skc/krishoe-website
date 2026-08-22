import { NextRequest, NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { getProductById } from "@/lib/product-store";
import { getOrdersForCustomer } from "@/lib/submissions";
import { reportError } from "@/lib/report-error";

/**
 * Whether the person reading a product page may review it.
 *
 * This was computed on the page itself, and computing it there cost the whole
 * page its prerendering: `getCurrentCustomer()` reads cookies, and one
 * request-time read anywhere in the tree makes the route dynamic. So
 * /product/[id] was rebuilt for every visitor and never cached — 2.3 seconds
 * against 0.45 for /shop beside it — on the one page a Facebook ad, a shared
 * link and a Google result all land on.
 *
 * Moved out here, the page is the same for everybody and can be built once.
 * The answer arrives a moment later, which is the right trade: the review panel
 * sits below the fold, and nothing above it depends on who is reading.
 */
export type ReviewAccessAnswer = {
  canReview: boolean;
  isLoggedIn: boolean;
  reason: { en: string; ne: string };
};

const SIGNED_OUT: ReviewAccessAnswer = {
  canReview: false,
  isLoggedIn: false,
  reason: {
    en: "Sign in to review a product you purchased.",
    ne: "किन्नुभएको सामानको समीक्षा लेख्न साइन इन गर्नुहोस्।",
  },
};

export async function GET(request: NextRequest) {
  const productId = (request.nextUrl.searchParams.get("productId") ?? "").trim();

  if (!productId) {
    return NextResponse.json({ error: "productId is required" }, { status: 400 });
  }

  try {
    const viewer = await getCurrentCustomer();
    if (!viewer) {
      return NextResponse.json(SIGNED_OUT);
    }

    const product = await getProductById(productId);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const alreadyReviewed = product.reviews.some(
      (review) => review.customerUserId === viewer.id,
    );
    const orders = await getOrdersForCustomer(viewer);
    // Closed, not merely placed: a review is worth something because the pair
    // arrived, and an order still in transit has not proved that yet.
    const verifiedPurchase = orders.some(
      (order) =>
        order.status === "Closed" &&
        order.items.some((item) => item.productId === product.id && item.quantity > 0),
    );

    return NextResponse.json({
      canReview: verifiedPurchase && !alreadyReviewed,
      isLoggedIn: true,
      reason: alreadyReviewed
        ? {
            en: "You have already submitted a review for this product.",
            ne: "तपाईंले यो सामानको समीक्षा पहिले नै लेखिसक्नुभएको छ।",
          }
        : verifiedPurchase
          ? {
              en: "Your completed purchase is verified.",
              ne: "तपाईंको किनमेल पुष्टि भएको छ।",
            }
          : {
              en: "Reviews open after a completed purchase of this product.",
              ne: "यो सामान किनेर अर्डर पूरा भएपछि समीक्षा लेख्न मिल्छ।",
            },
    } satisfies ReviewAccessAnswer);
  } catch (error) {
    // A shopper reading a product page must not see it break because the
    // review panel could not work out who they are. Signed out is what every
    // visitor sees anyway, and it is the safe answer: it offers nothing.
    reportError(`read review access for ${productId}`, error);
    return NextResponse.json(SIGNED_OUT);
  }
}
