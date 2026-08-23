-- The confirmation the customer gets when they order.
--
-- notification_events lists the types it accepts, and a type it does not know
-- is rejected by the CHECK rather than stored. 'order-confirmation' is new: the
-- customer used to get nothing at all when they placed an order — a line on the
-- screen, and nothing in writing once the tab was closed.

ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS notification_events_type_check;

ALTER TABLE notification_events ADD CONSTRAINT notification_events_type_check
  CHECK (type IN (
    'order',
    'contact',
    'password-reset',
    'email-verification',
    'staff-security',
    'review-request',
    -- Sent to the buyer, not the owner: their order number, what they ordered,
    -- and who to ring.
    'order-confirmation',
    'operational-alert'
  ));
