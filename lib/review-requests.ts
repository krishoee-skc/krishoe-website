import { notifyReviewRequested } from "@/lib/notifications";
import { getCustomerEmailChoice, mayEmailCustomer } from "@/lib/customer-email-choice";
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
  /** Null for a guest order — nobody to hold a preference. */
  customer_user_id: string | null;
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
    `SELECT id, name, email, order_text, customer_user_id
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

/**
 * The unsubscribe link for one customer, or an empty string for a guest.
 *
 * A guest order has no account, so there is nothing to remember a choice
 * against and nothing for the link to change. The letter simply goes without
 * one rather than carrying a link that would do nothing when pressed.
 */
async function unsubscribeUrlFor(userId: string | undefined, siteUrl: string) {
  if (!userId) return "";

  try {
    const choice = await getCustomerEmailChoice(userId);
    return `${siteUrl}/account/email-choice?stop=${encodeURIComponent(choice.unsubscribeToken)}`;
  } catch (error) {
    // A letter without an unsubscribe link is worse than one with it, but a
    // letter that never arrives is worse than both.
    reportError("build an unsubscribe link", error);
    return "";
  }
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

      // Asked before writing. This is the letter nobody ordered — a shopper
      // who has said "no more of these" must not get one, and the marker below
      // is set either way so a refusal is not reconsidered every morning.
      const allowed = await mayEmailCustomer(order.customer_user_id ?? undefined, "reviewInvites");
      if (!allowed) {
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
        unsubscribeUrl: await unsubscribeUrlFor(order.customer_user_id ?? undefined, siteUrl),
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
