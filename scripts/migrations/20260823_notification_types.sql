-- Two notification types the code sends and the table refuses.
--
-- notification_events carries a CHECK listing the types it will accept, and it
-- was written before two of them existed. 'review-request' is new today. But
-- 'staff-security' has been sent by lib/notifications.ts for some time — an
-- invitation, a staff password reset, an MFA change, a security alert — and
-- every one of those inserts has been failing on this constraint since the day
-- it was added. Nobody saw it because appendEvent is wrapped in reportingErrors:
-- the mail was never sent, and the failure was filed rather than raised.
--
-- Rebuilt rather than extended: a CHECK cannot be added to, and dropping and
-- recreating is the only way to change the list.

ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS notification_events_type_check;

ALTER TABLE notification_events ADD CONSTRAINT notification_events_type_check
  CHECK (type IN (
    'order',
    'contact',
    'password-reset',
    'email-verification',
    -- Staff invitations, staff password resets, MFA changes, security alerts.
    'staff-security',
    -- Asking a buyer what they thought, a week after the pair arrived.
    'review-request',
    'operational-alert'
  ));
