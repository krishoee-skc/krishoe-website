import { randomBytes } from "node:crypto";
import { queryPostgres } from "@/lib/postgres/client";

const STORE = "krishoe";

/**
 * Which letters a customer has agreed to receive.
 *
 * The shop had no way to stop writing to somebody. A shopper who wanted it to
 * stop had exactly one lever — the spam button — and pressing it does not just
 * silence their own letters, it teaches the mail provider to distrust the next
 * hundred. An unsubscribe link is not a courtesy to the reader; it is what
 * keeps the order confirmations arriving for everybody else.
 *
 * This replaces a file that tried to do the same job with six tables of its
 * own, including a second list of customers and a second list of orders. The
 * shop already knows who its customers are and what they bought. This is the
 * one thing it did not know.
 *
 * Absence means yes. A customer with no row has never been asked and has never
 * refused, so nothing here can silence a letter by accident — only an explicit
 * `false` does that.
 */
export type CustomerEmailChoice = {
  orderUpdates: boolean;
  reviewInvites: boolean;
  unsubscribeToken: string;
};

/**
 * What a customer we have never asked is taken to have said.
 *
 * Not stored, and deliberately: writing a default row for every customer would
 * mean a row that says "they agreed" for somebody who was never asked.
 */
const NEVER_ASKED: Omit<CustomerEmailChoice, "unsubscribeToken"> = {
  orderUpdates: true,
  reviewInvites: true,
};

type Row = {
  order_updates: boolean;
  review_invites: boolean;
  unsubscribe_token: string;
};

function newToken() {
  return randomBytes(24).toString("base64url");
}

/**
 * May the shop send this customer this kind of letter?
 *
 * Fails open, and that is the right way round for THIS question: a database
 * that cannot be reached must not swallow the letter that tells somebody their
 * order arrived. The cost of one unwanted review invitation is a shrug; the
 * cost of a silent shop is a customer who thinks their money vanished.
 */
export async function mayEmailCustomer(
  userId: string | undefined,
  kind: "orderUpdates" | "reviewInvites",
): Promise<boolean> {
  if (!userId) return true; // A guest order has no account to hold a choice.

  try {
    const rows = await queryPostgres<Row>(
      STORE,
      `SELECT order_updates, review_invites, unsubscribe_token
       FROM customer_email_preferences WHERE user_id = $1`,
      [userId],
    );
    if (!rows[0]) return NEVER_ASKED[kind];

    return kind === "orderUpdates" ? rows[0].order_updates : rows[0].review_invites;
  } catch {
    return true;
  }
}

/** What the account screen shows, creating the row the first time it is asked. */
export async function getCustomerEmailChoice(userId: string): Promise<CustomerEmailChoice> {
  const rows = await queryPostgres<Row>(
    STORE,
    `INSERT INTO customer_email_preferences (user_id, unsubscribe_token)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
     RETURNING order_updates, review_invites, unsubscribe_token`,
    [userId, newToken()],
  );

  return {
    orderUpdates: rows[0].order_updates,
    reviewInvites: rows[0].review_invites,
    unsubscribeToken: rows[0].unsubscribe_token,
  };
}

/** The account screen's save. Needs a signed-in customer; can set either way. */
export async function setCustomerEmailChoice(
  userId: string,
  choice: { orderUpdates: boolean; reviewInvites: boolean },
): Promise<void> {
  await queryPostgres(
    STORE,
    `INSERT INTO customer_email_preferences
       (user_id, order_updates, review_invites, unsubscribe_token)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       order_updates = EXCLUDED.order_updates,
       review_invites = EXCLUDED.review_invites,
       updated_at = now()`,
    [userId, choice.orderUpdates, choice.reviewInvites, newToken()],
  );
}

/**
 * The link at the bottom of a letter.
 *
 * One direction only. A token that arrives in an inbox can turn the review
 * invitations off and can do nothing else — it cannot turn them back on, cannot
 * touch order confirmations, and cannot be used to find out whose address it
 * belongs to. Whoever forwards the email cannot use it to sign anybody up for
 * anything, and the worst a stranger with the token can do is stop letters the
 * owner of the account can start again from their own screen.
 *
 * Returns false for a token that does not exist, so the page can say the link
 * has expired without revealing whether it ever was one.
 */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  const clean = token.trim();
  if (!clean) return false;

  const rows = await queryPostgres<{ user_id: string }>(
    STORE,
    `UPDATE customer_email_preferences
     SET review_invites = false, updated_at = now()
     WHERE unsubscribe_token = $1
     RETURNING user_id`,
    [clean],
  );

  return rows.length > 0;
}
