-- The notification kinds, put back.
--
-- 20260823_order_confirmation_type.sql widened this list, and is stamped as
-- run, but the live database carries the older five: the database was built
-- again from docs/schema.sql when it moved to Supabase, and that snapshot still
-- held the old list. Since then the buyer's "your order is placed" mail has
-- been refused by this CHECK before it was written — the only online order so
-- far, on 2026-09-27, got none — and the review request a week after an order
-- would be refused the same way (owner, 2026-09-30).
--
-- The same list as that migration, the one lib/notifications.ts writes.
-- A CHECK constraint cannot be altered in place, so it is dropped and made
-- again in one statement pair. No row is changed: every row already stored is
-- one of the older five, all of which stay allowed.

ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS notification_events_type_check;

ALTER TABLE notification_events ADD CONSTRAINT notification_events_type_check
  CHECK (type IN (
    'order',
    'contact',
    'password-reset',
    'email-verification',
    'staff-security',
    'review-request',
    'order-confirmation',
    'operational-alert'
  ));
