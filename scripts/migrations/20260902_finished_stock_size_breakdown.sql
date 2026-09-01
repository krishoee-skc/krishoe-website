-- Size-wise stock, step 1: a place to record how a design's pairs split by size.
--
-- A shoe is sold by size, so "55 in stock" is not enough — size 30 can be gone
-- while 35 is piled up. The Packing/QC approval already collects a size
-- breakdown ({"30":5,"31":8}); it is stored on the QC posting but lost when the
-- sellable finished_stock row is written as one "Mixed" total.
--
-- This adds a size_breakdown JSON to finished_stock to hold that split. It is
-- ADDITIVE display metadata only: the authoritative pair counts stay in
-- stock_pairs / sold_pairs / returned_pairs, and nothing about wages, stock
-- totals or reversal reads or writes this column yet. So it cannot change a
-- single number the shop or the books depend on — it only gives a later step a
-- column to populate and read. Defaulted to '{}', so every existing row is valid.

ALTER TABLE finished_stock
  ADD COLUMN IF NOT EXISTS size_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb;
