-- Remove two bad catalog entries the owner confirmed were mistakes (2026-08-31).
--
-- "Bachha Rubber (Kids)" (id 8ec1dd03-48b9-4863-bf7d-6ae9df2eb148) and
-- "close shoes" (id b8889453-dee8-4380-851d-9ae81424151f) sat on the Factory
-- channel but were NOT in the production catalog (factory_items) and were NOT a
-- purchase (no Trading-Goods purchase_invoice_items). So their stock did not come
-- from production or purchase — which the owner's rule forbids: every sellable
-- item must trace to factory production or a purchase. The owner confirmed both
-- are wrong entries and to delete everything, including their sales figures.
--
-- Verified safe before deleting: no foreign key anywhere references either
-- product id — branch_product_stock, factory_production_items,
-- production_qc_postings, production_items all returned 0 rows for these ids —
-- so removing them orphans nothing and breaks nothing.

DELETE FROM finished_stock
 WHERE lower(design) IN ('bachha rubber (kids)', 'close shoes');

DELETE FROM products
 WHERE id IN (
   '8ec1dd03-48b9-4863-bf7d-6ae9df2eb148',
   'b8889453-dee8-4380-851d-9ae81424151f'
 );
