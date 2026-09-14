-- Atomic checkout foundation: immutable prices, numeric totals and one order
-- per browser submission key. Legacy rows retain zero item prices so POS can
-- deliberately use its legacy text parser for those rows only.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS subtotal_paisa BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_paisa >= 0),
  ADD COLUMN IF NOT EXISTS total_paisa BIGINT NOT NULL DEFAULT 0 CHECK (total_paisa >= 0),
  ADD COLUMN IF NOT EXISTS checkout_submission_key TEXT;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS unit_price_paisa BIGINT NOT NULL DEFAULT 0 CHECK (unit_price_paisa >= 0),
  ADD COLUMN IF NOT EXISTS line_total_paisa BIGINT NOT NULL DEFAULT 0 CHECK (line_total_paisa >= 0);

-- Existing totals are human labels such as "Rs. 1,499". Preserve their value
-- numerically where possible; item-level legacy prices cannot be reconstructed
-- safely from today's catalog and intentionally remain zero.
UPDATE orders
   SET total_paisa = GREATEST(
         0,
         round(
           COALESCE(
             NULLIF(
               regexp_replace(
                 regexp_replace(total, '^[^0-9]*', '', 'g'),
                 '[^0-9.]',
                 '',
                 'g'
               ),
               ''
             )::numeric,
             0
           ) * 100
         )::bigint
       )
 WHERE total_paisa = 0
   AND total ~ '[0-9]';

UPDATE orders
   SET subtotal_paisa = total_paisa + GREATEST(0, COALESCE(discount_paisa, 0))
 WHERE subtotal_paisa = 0;

CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_submission_key_unique_idx
  ON orders(checkout_submission_key)
  WHERE checkout_submission_key IS NOT NULL AND checkout_submission_key <> '';
