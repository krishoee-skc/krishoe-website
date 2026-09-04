-- Owner-controlled public review links (Google, Facebook).
--
-- After an order the app asks "How is the KRISHOE app?"; a happy rating (4-5)
-- is then offered a place to leave a public review, where a kind word brings new
-- customers. Those links belong to the owner's own Google Business and Facebook
-- page, so they live here for the owner to set from Settings — not hard-coded.
-- Empty means "don't offer it", and the rating still reaches the owner in admin.
-- Additive, defaulted, reversible — like the promo columns before them.

ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS google_review_url text NOT NULL DEFAULT '';
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS facebook_review_url text NOT NULL DEFAULT '';
