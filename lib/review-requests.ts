import { notifyReviewRequested } from "@/lib/notifications";
import { queryPostgres } from "@/lib/postgres/client";
import { reportError } from "@/lib/report-error";
import { ASK_AFTER_DAYS, createReviewToken, reviewInviteUrl } from "@/lib/review-invite";
import { getSiteUrl } from "@/lib/seo";

/**
 * Asking buyers what they thought, once, a week after the order closed.
 *
 * The shop has seven products with real photographs on all of them and no
 * reviews at all. A shopper choosing between KRISHOE and a shop they already
 * know has nothing to read, and a Nepali shopper checks reviews on Daraz before
 * buying a two-hundred-rupee item. Nothing on the storefront is worth more per
 * hour of work than the first ten honest reviews, and none of them arrive
 * unless somebody asks.
 *
 * A week, because the pair has to have arrived and been worn. Asking the day it
 * ships gets a review of the delivery; asking a month later gets nothing.
 */

const STORE = "customer voice";

/** One email per run, not one per pair: a customer who bought three pairs gets asked about one. */
const PER_RUN = 20;

type PendingRow = {
  id: string;
  name: string;
  email: string;
  order_text: string;
};

export type ReviewRequestResult = {
  asked: number;
  skipped: number;
};

/**
 * Orders that closed at least a week ago and have never been asked.
 *
 * review_invite_sent_at is stamped whether or not the mail went out, which is
 * deliberate: a customer who cannot be reached should not be retried every
 * morning for the rest of the year, and a shop that mails the same person daily
 * has done more damage than a missing review ever would.
 */
async function pendingOrders(): Promise<PendingRow[]> {
  return queryPostgres<PendingRow>(
    STORE,
    `SELECT id, name, email, order_text
     FROM orders
     WHERE status = 'Closed'
       AND review_invite_sent_at IS NULL
       AND email <> ''
       AND created_at < NOW() - ($1 * INTERVAL '1 day')
     ORDER BY created_at
     LIMIT $2`,
    [ASK_AFTER_DAYS, PER_RUN],
  );
}

async function markAsked(orderId: string) {
  await queryPostgres(
    STORE,
    `UPDATE orders SET review_invite_sent_at = now() WHERE id = $1`,
    [orderId],
  );
}

type OrderItemLike = { productId: string; name: string; quantity: number };

/**
 * The pair to ask about.
 *
 * One, even when the order had several. Two forms in one email is how a customer
 * decides to fill in neither, and one honest review is worth more than two
 * abandoned ones.
 */
function pickProduct(items: OrderItemLike[]): OrderItemLike | null {
  return items.find((item) => item.productId && item.quantity > 0) ?? null;
}

export async function sendReviewRequests(
  loadItems: (orderId: string) => Promise<OrderItemLike[]>,
): Promise<ReviewRequestResult> {
  const result: ReviewRequestResult = { asked: 0, skipped: 0 };

  let orders: PendingRow[] = [];
  try {
    orders = await pendingOrders();
  } catch (error) {
    reportError("find orders owed a review request", error);
    return result;
  }

  const siteUrl = getSiteUrl();

  for (const order of orders) {
    try {
      const product = pickProduct(await loadItems(order.id));
      const token = product ? createReviewToken({ orderId: order.id, productId: product.productId }) : null;

      if (!product || !token) {
        // Nothing to ask about, or no secret to sign with. Stamped anyway so
        // the same dead order is not reconsidered every morning.
        await markAsked(order.id);
        result.skipped += 1;
        continue;
      }

      await notifyReviewRequested({
        email: order.email,
        customerName: order.name ?? "",
        productName: product.name,
        reviewUrl: reviewInviteUrl(siteUrl, token),
        orderId: order.id,
      });

      await markAsked(order.id);
      result.asked += 1;
    } catch (error) {
      // One failure must not stop the rest of the run.
      reportError(`send review request for order ${order.id}`, error);
      result.skipped += 1;
    }
  }

  return result;
}
