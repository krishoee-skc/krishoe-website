-- Merge the duplicate design "T bag open" into "bag open".
--
-- The same shoe had been recorded under two spellings: made and first sold on
-- the factory floor as "T bag open" (Aug 21-25), then carried on as "bag open"
-- once it moved to wholesale (Aug 26 on). Two names split its books across two
-- pools, and left an Active catalog product ("T bag open", stock 0) that traced
-- to no live pool. This folds every trace of the old spelling onto the real
-- design so no sale is lost, then removes the duplicate product.
--
-- Applied live on 2026-09-02 by scripts (verified by a BEGIN/ROLLBACK dry run
-- first); this file records the change and is safe to run again — every step is
-- scoped to the old spelling, which no longer exists after the first run, so a
-- second run matches nothing and changes nothing.

-- 1. Stock movements: rename onto bag open and onto its one pool's channel.
UPDATE stock_movements
  SET design = 'bag open', channel = 'Wholesale'
  WHERE lower(trim(design)) = 't bag open';

-- 2. POS invoices: rewrite the design inside the items JSONB array.
UPDATE pos_invoices AS pi
  SET items = sub.new_items
  FROM (
    SELECT
      p.id,
      jsonb_agg(
        CASE
          WHEN lower(trim(item->>'design')) = 't bag open'
          THEN jsonb_set(item, '{design}', '"bag open"')
          ELSE item
        END
        ORDER BY ord
      ) AS new_items
    FROM pos_invoices p,
         jsonb_array_elements(p.items) WITH ORDINALITY AS elem(item, ord)
    WHERE p.items::text ILIKE '%T bag open%'
    GROUP BY p.id
  ) AS sub
  WHERE pi.id = sub.id;

-- 3. Order items: point the line at the real product and name.
UPDATE order_items
  SET product_name = 'bag open', product_id = '88bef0d4-5752-4021-bdf2-3065d0d49842'
  WHERE product_name = 'T bag open';

-- 4. Rewrite bag open's pool from the merged movements: made (Production/Purchase
--    In) minus what left the shelf (Sale/Dispatch/Damage Out), plus returns.
UPDATE finished_stock fs
  SET stock_pairs = t.made + t.returned - t.out,
      sold_pairs = t.out
  FROM (
    SELECT
      COALESCE(SUM(pairs) FILTER (WHERE type IN ('Production In','Purchase In')), 0) AS made,
      COALESCE(SUM(pairs) FILTER (WHERE type = 'Return In'), 0) AS returned,
      COALESCE(SUM(pairs) FILTER (WHERE type IN ('Sale Out','Dispatch Out','Damage Out')), 0) AS out
    FROM stock_movements
    WHERE lower(trim(design)) = 'bag open' AND channel = 'Wholesale'
  ) AS t
  WHERE lower(trim(fs.design)) = 'bag open' AND fs.channel = 'Wholesale';

-- 5. Remove the now-unreferenced duplicate product.
DELETE FROM products WHERE id = '00d66701-3e16-46f2-91cf-d45e31d9d3a5';
