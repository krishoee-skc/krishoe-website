-- Made or bought, said by hand (owner, 2026-10-29), for a shoe whose stock
-- history has no Production In or Purchase In. One row a shoe; no row means
-- not said. Additive: a new table, nothing existing is changed. Reversible
-- (DROP TABLE product_origins).

CREATE TABLE IF NOT EXISTS product_origins (
  product_id text PRIMARY KEY,
  origin text NOT NULL CHECK (origin IN ('made', 'bought')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);
