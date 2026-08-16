import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

export type CouponKind = "percent" | "amount";
export type CouponStatus = "Active" | "Disabled";

export type Coupon = {
  code: string;
  kind: CouponKind;
  value: number;
  minOrderPaisa: number;
  maxDiscountPaisa: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  status: CouponStatus;
  note: string;
  createdAt: string;
};

type CouponRow = {
  code: string;
  kind: CouponKind;
  value: number | string;
  min_order_paisa: number | string;
  max_discount_paisa: number | string | null;
  starts_at: Date | string | null;
  expires_at: Date | string | null;
  max_uses: number | string | null;
  used_count: number | string;
  status: CouponStatus;
  note: string;
  created_at: Date | string;
};

const STORE = "orders";

const COLUMNS = `code, kind, value, min_order_paisa, max_discount_paisa,
  starts_at, expires_at, max_uses, used_count, status, note, created_at`;

/**
 * One spelling for a code.
 *
 * The customer types it on a phone keyboard that likes to capitalise, off a
 * poster that shouted it, or out of a TikTok caption. All of those have to find
 * the row the shop created, so everything upper-cases and the stored code is
 * the key.
 */
export function normalizeCouponCode(code: string) {
  return (code ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function couponFromRow(row: CouponRow): Coupon {
  const number = (value: number | string | null) =>
    value === null ? null : Math.round(Number(value) || 0);

  return {
    code: row.code,
    kind: row.kind,
    value: number(row.value) ?? 0,
    minOrderPaisa: number(row.min_order_paisa) ?? 0,
    maxDiscountPaisa: number(row.max_discount_paisa),
    startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    maxUses: number(row.max_uses),
    usedCount: number(row.used_count) ?? 0,
    status: row.status,
    note: row.note ?? "",
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function listCoupons() {
  const rows = await queryPostgres<CouponRow>(
    STORE,
    `SELECT ${COLUMNS} FROM coupons ORDER BY created_at DESC LIMIT 200`,
  );
  return rows.map(couponFromRow);
}

export async function getCoupon(code: string) {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return null;

  const rows = await queryPostgres<CouponRow>(
    STORE,
    `SELECT ${COLUMNS} FROM coupons WHERE code = $1 LIMIT 1`,
    [normalized],
  );
  return rows[0] ? couponFromRow(rows[0]) : null;
}

export type CouponCheck =
  | { ok: true; coupon: Coupon; discountPaisa: number }
  | { ok: false; reason: string };

/**
 * Decides what a code is worth against a basket, and refuses it out loud.
 *
 * Every refusal names the condition rather than saying the code is invalid — a
 * customer who is told "this code needs Rs 1,000" adds another pair, and a
 * customer who is told "invalid" leaves. The one exception is a code that does
 * not exist, where there is nothing true to say.
 */
export function evaluateCoupon(
  coupon: Coupon | null,
  subtotalPaisa: number,
  now = new Date(),
): CouponCheck {
  const rupees = (paisa: number) => `Rs. ${Math.round(paisa / 100).toLocaleString("en-IN")}`;

  if (!coupon) {
    return { ok: false, reason: "This code does not exist. Check the spelling." };
  }

  if (coupon.status !== "Active") {
    return { ok: false, reason: "This code is no longer active." };
  }

  if (coupon.startsAt && now < new Date(coupon.startsAt)) {
    return { ok: false, reason: "This code has not started yet." };
  }

  if (coupon.expiresAt && now > new Date(coupon.expiresAt)) {
    return { ok: false, reason: "This code has expired." };
  }

  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, reason: "This code has been fully used." };
  }

  if (subtotalPaisa < coupon.minOrderPaisa) {
    return {
      ok: false,
      reason: `This code needs an order of ${rupees(coupon.minOrderPaisa)} or more.`,
    };
  }

  const raw =
    coupon.kind === "percent"
      ? Math.floor((subtotalPaisa * coupon.value) / 100)
      : coupon.value;

  const capped =
    coupon.kind === "percent" && coupon.maxDiscountPaisa !== null
      ? Math.min(raw, coupon.maxDiscountPaisa)
      : raw;

  // Never more than the basket. A Rs 500 code on a Rs 300 order is a Rs 300
  // discount, not a Rs 200 refund.
  const discountPaisa = Math.max(0, Math.min(capped, subtotalPaisa));

  if (discountPaisa === 0) {
    return { ok: false, reason: "This code gives no discount on this order." };
  }

  return { ok: true, coupon, discountPaisa };
}

/**
 * Counts a redemption, and refuses to exceed the ceiling.
 *
 * The check happens inside the UPDATE rather than before it, so two orders
 * placed in the same second cannot both take the last use of a code that was
 * limited to a hundred. Returns false when the code was already exhausted,
 * which the caller treats as the coupon no longer applying.
 */
export async function redeemCoupon(code: string) {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return false;

  return transactionPostgres(STORE, async (db) => {
    const rows = await db.query<{ code: string }>(
      `UPDATE coupons
       SET used_count = used_count + 1, updated_at = now()
       WHERE code = $1
         AND status = 'Active'
         AND (max_uses IS NULL OR used_count < max_uses)
       RETURNING code`,
      [normalized],
    );
    return rows.length > 0;
  });
}

export async function saveCoupon(input: {
  code: string;
  kind: CouponKind;
  value: number;
  minOrderPaisa: number;
  maxDiscountPaisa: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  maxUses: number | null;
  status: CouponStatus;
  note: string;
}) {
  const code = normalizeCouponCode(input.code);
  if (!code) throw new Error("कोड चाहिन्छ।");
  if (!/^[A-Z0-9]{3,24}$/.test(code)) {
    throw new Error("कोडमा अंग्रेजी अक्षर र अंक मात्र, ३ देखि २४ अक्षर।");
  }
  if (input.kind === "percent" && (input.value < 1 || input.value > 100)) {
    throw new Error("प्रतिशत १ देखि १०० बीच हुनुपर्छ।");
  }
  if (input.value <= 0) throw new Error("छुटको मात्रा ० भन्दा बढी हुनुपर्छ।");

  const rows = await queryPostgres<CouponRow>(
    STORE,
    `INSERT INTO coupons (
       code, kind, value, min_order_paisa, max_discount_paisa,
       starts_at, expires_at, max_uses, status, note, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     ON CONFLICT (code) DO UPDATE SET
       kind = EXCLUDED.kind,
       value = EXCLUDED.value,
       min_order_paisa = EXCLUDED.min_order_paisa,
       max_discount_paisa = EXCLUDED.max_discount_paisa,
       starts_at = EXCLUDED.starts_at,
       expires_at = EXCLUDED.expires_at,
       max_uses = EXCLUDED.max_uses,
       status = EXCLUDED.status,
       note = EXCLUDED.note,
       updated_at = now()
     RETURNING ${COLUMNS}`,
    [
      code,
      input.kind,
      Math.round(input.value),
      Math.max(0, Math.round(input.minOrderPaisa)),
      input.maxDiscountPaisa === null ? null : Math.max(1, Math.round(input.maxDiscountPaisa)),
      input.startsAt ? new Date(input.startsAt) : null,
      input.expiresAt ? new Date(input.expiresAt) : null,
      input.maxUses === null ? null : Math.max(1, Math.round(input.maxUses)),
      input.status,
      input.note.slice(0, 240),
    ],
  );

  return couponFromRow(rows[0]);
}
