import { getDataBackendConfig } from "@/lib/data-backend";
import { orderDispatchReady } from "@/lib/order-dispatch-database";
import { queryPostgres } from "@/lib/postgres/client";

/**
 * How an online order left the shop: when it was sent, who took it, what the
 * delivery cost, the courier's number — and, for a dropped order, why.
 *
 * Kept beside the order rather than in it. The order's status is not touched
 * by sending it: a sent order stays Contacted, which keeps holding its pairs
 * and counts as a sale in every report exactly as it did. These columns arrive
 * from an Owner button (lib/order-dispatch-database.ts); until then nothing is
 * read or written and the desk works as before.
 */
export type OrderDispatch = {
  dispatchedAt: string;
  dispatchBy: string;
  dispatchChargePaisa: number;
  dispatchTracking: string;
  cancelReason: string;
};

const STORE = "orders";

/** Whether sending can be recorded here: the live database, with its columns. */
export async function orderDispatchAvailable() {
  if (getDataBackendConfig().backend !== "postgres") return false;
  return orderDispatchReady().catch(() => false);
}

export async function getOrderDispatchByIds(ids: string[]): Promise<Record<string, OrderDispatch>> {
  if (ids.length === 0 || !(await orderDispatchAvailable())) return {};
  const rows = await queryPostgres<{
    id: string;
    dispatched_at: Date | string | null;
    dispatch_by: string;
    dispatch_charge_paisa: number | string;
    dispatch_tracking: string;
    cancel_reason: string;
  }>(
    STORE,
    `SELECT id, dispatched_at, dispatch_by, dispatch_charge_paisa, dispatch_tracking, cancel_reason
       FROM orders WHERE id = ANY($1)
      LIMIT 2000`,
    [ids],
  );
  return Object.fromEntries(
    rows.map((row) => [
      row.id,
      {
        dispatchedAt: row.dispatched_at
          ? row.dispatched_at instanceof Date
            ? row.dispatched_at.toISOString()
            : String(row.dispatched_at)
          : "",
        dispatchBy: row.dispatch_by ?? "",
        dispatchChargePaisa: Number(row.dispatch_charge_paisa) || 0,
        dispatchTracking: row.dispatch_tracking ?? "",
        cancelReason: row.cancel_reason ?? "",
      },
    ]),
  );
}

/**
 * Mark an order sent. A New order is confirmed by being sent, so it becomes
 * Contacted — the status that holds its pairs. A Closed or Cancelled order is
 * left alone: sending one of those is a mistake to refuse, not to record.
 */
export async function markOrderDispatched(
  id: string,
  dispatch: { by: string; chargePaisa: number; tracking: string },
) {
  if (!(await orderDispatchAvailable())) {
    throw new Error("Prepare the database for sending orders first (Settings).");
  }
  const rows = await queryPostgres<{ id: string }>(
    STORE,
    `UPDATE orders
        SET dispatched_at = now(),
            dispatch_by = $2,
            dispatch_charge_paisa = $3,
            dispatch_tracking = $4,
            status = CASE WHEN status = 'New' THEN 'Contacted' ELSE status END
      WHERE id = $1 AND status IN ('New', 'Contacted')
      RETURNING id`,
    [id, dispatch.by.slice(0, 80), Math.max(0, Math.round(dispatch.chargePaisa)), dispatch.tracking.slice(0, 80)],
  );
  if (!rows[0]) throw new Error("Only a new or confirmed order can be sent.");
}

/** Take back a "sent" pressed by mistake. The status is left as it is. */
export async function clearOrderDispatch(id: string) {
  if (!(await orderDispatchAvailable())) return;
  await queryPostgres(
    STORE,
    `UPDATE orders SET dispatched_at = NULL, dispatch_by = '', dispatch_charge_paisa = 0, dispatch_tracking = ''
      WHERE id = $1 AND status IN ('New', 'Contacted') AND cancel_reason = ''`,
    [id],
  );
}

/**
 * A sent order the customer did not take is on its way back.
 *
 * Cancelling it there and then would free its pairs for the website while
 * they are still with the courier, and they could be sold a second time
 * before they reach the shop. So it stays Contacted — still holding its
 * pairs — and the reason is written beside it; that pair (sent, a reason, not
 * yet Cancelled) is what "coming back" means. Only orderReturned lets the
 * pairs go, once they are in the shop again. No new column: a reason on an
 * order that is not Cancelled had no other meaning. The desk reads it with
 * isOrderComingBack (lib/order-cancel-reasons.ts).
 */
export async function startOrderReturn(id: string, reason: string) {
  if (!(await orderDispatchAvailable())) {
    throw new Error("Prepare the database for sending orders first (Settings).");
  }
  const rows = await queryPostgres<{ id: string }>(
    STORE,
    `UPDATE orders SET cancel_reason = $2
      WHERE id = $1 AND status = 'Contacted' AND dispatched_at IS NOT NULL
      RETURNING id`,
    [id, reason.slice(0, 120)],
  );
  if (!rows[0]) throw new Error("Only an order that was sent can come back.");
}

/** The customer took it after all: back to plain "sent". */
export async function cancelOrderReturn(id: string) {
  if (!(await orderDispatchAvailable())) return;
  await queryPostgres(
    STORE,
    `UPDATE orders SET cancel_reason = ''
      WHERE id = $1 AND status = 'Contacted' AND dispatched_at IS NOT NULL`,
    [id],
  );
}

/**
 * The pairs are in the shop again: the order is Cancelled, which is what
 * lets them go back on sale. Checked in the same statement, so an order that
 * was never marked as coming back cannot be closed this way.
 */
export async function orderReturned(id: string) {
  if (!(await orderDispatchAvailable())) {
    throw new Error("Prepare the database for sending orders first (Settings).");
  }
  const rows = await queryPostgres<{ id: string }>(
    STORE,
    `UPDATE orders SET status = 'Cancelled'
      WHERE id = $1 AND status = 'Contacted' AND dispatched_at IS NOT NULL AND cancel_reason <> ''
      RETURNING id`,
    [id],
  );
  if (!rows[0]) throw new Error("This order is not marked as coming back.");
}

/** Record why an order was cancelled, beside the Cancelled status. */
export async function saveOrderCancelReason(id: string, reason: string) {
  if (!(await orderDispatchAvailable())) return;
  await queryPostgres(STORE, `UPDATE orders SET cancel_reason = $2 WHERE id = $1`, [id, reason.slice(0, 120)]);
}
