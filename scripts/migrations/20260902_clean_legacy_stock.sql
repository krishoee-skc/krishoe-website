-- Clean the old, sourceless stock so the shop shows only what came from factory
-- production or a purchase. Owner-confirmed 2026-09-02; the old data is saved in
-- the owner's own copy, and the shop starts fresh so entering stock going forward
-- never mixes old with new.
--
-- 1) Three orphan products with no source at all (not in the production catalog,
--    no purchase, stock 0). Verified FK-safe: branch_product_stock,
--    factory_production_items, production_qc_postings, production_items all 0.
DELETE FROM products
 WHERE name IN ('Doctor Chappal moto', 'jeans shoes', 'halka fom');

-- 2) "T bag open" is a real factory design (kept as a product), but its 38 pairs
--    of finished stock were never posted through a QC approval (production_qc_postings
--    is empty), so they are stale. Remove that finished-stock row and zero the
--    product's stale website stock; new QC production will restock it properly.
DELETE FROM finished_stock WHERE lower(design) = 't bag open';
UPDATE products SET stock = 0 WHERE lower(name) = 't bag open';
