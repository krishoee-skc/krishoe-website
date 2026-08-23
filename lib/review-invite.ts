import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A link that lets the buyer write a review without making an account.
 *
 * The review form already built opens only to a signed-in customer who can be
 * matched to a closed order. That is the right rule and it is also why the shop
 * has zero reviews: almost nobody makes an account to praise a slipper, and a
 * shopper deciding between KRISHOE and a shop they already know has nothing to
 * read.
 *
 * So the proof of purchase travels in the link instead. The shop signs "this
 * order, this pair" with a secret only the server holds; tapping the link is
 * the whole of what the customer has to do. Nothing in the token is secret —
 * the signature is what makes it unforgeable, not obscurity.
 *
 * What a stolen link can do is bounded on purpose: write one review, on one
 * pair, from one order, unpublished until the owner puts it on the storefront.
 * It cannot read an order, change one, or reach any other part of the shop.
 */

/** Long enough for a parcel to arrive and be worn; short enough to expire. */
export const INVITE_TTL_DAYS = 90;

/** Days after an order closes before the shop asks. */
export const ASK_AFTER_DAYS = 7;

const SEPARATOR = ".";

function secret(): string | null {
  // Signed with the admin session secret rather than a new variable of its own.
  // A second secret is a second thing to set on the host and a second thing to
  // forget, and this one is already required for the shop to run at all.
  const value = (process.env.ADMIN_SESSION_SECRET ?? "").trim();
  return value.length >= 16 ? value : null;
}

function base64url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(payload: string, key: string) {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export type ReviewInvite = {
  orderId: string;
  productId: string;
  /** Milliseconds since the epoch, after which the link is refused. */
  expiresAt: number;
};

/** Null when no secret is configured — the caller sends no email rather than a link that cannot be checked. */
export function createReviewToken(
  invite: Omit<ReviewInvite, "expiresAt"> & { expiresAt?: number },
): string | null {
  const key = secret();
  if (!key) return null;
  if (!invite.orderId.trim() || !invite.productId.trim()) return null;

  const expiresAt = invite.expiresAt ?? Date.now() + INVITE_TTL_DAYS * 86_400_000;
  const payload = [
    base64url(invite.orderId.trim()),
    base64url(invite.productId.trim()),
    String(expiresAt),
  ].join(SEPARATOR);

  return `${payload}${SEPARATOR}${sign(payload, key)}`;
}

/**
 * The invite a token stands for, or null.
 *
 * Null for every kind of wrong — bad shape, bad signature, expired, no secret
 * configured. The caller shows one message for all of them: a token that failed
 * should not tell whoever sent it which part it failed on.
 */
export function readReviewToken(token: string): ReviewInvite | null {
  const key = secret();
  if (!key) return null;

  const parts = String(token ?? "").split(SEPARATOR);
  if (parts.length !== 4) return null;

  const [orderPart, productPart, expiryPart, signature] = parts;
  const payload = [orderPart, productPart, expiryPart].join(SEPARATOR);

  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(String(signature));
  // Equal length first: timingSafeEqual throws rather than returning false when
  // the buffers differ in length, and a thrown error here is a 500 on a page a
  // customer is holding.
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  const expiresAt = Number(expiryPart);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  try {
    const orderId = Buffer.from(orderPart, "base64url").toString("utf8");
    const productId = Buffer.from(productPart, "base64url").toString("utf8");
    if (!orderId || !productId) return null;
    return { orderId, productId, expiresAt };
  } catch {
    return null;
  }
}

export function reviewInviteUrl(siteUrl: string, token: string) {
  return `${siteUrl.replace(/\/+$/, "")}/review/${token}`;
}
