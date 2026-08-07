-- Product Reviews System
-- Supports customer reviews, ratings, and moderation

CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  verified_purchase BOOLEAN DEFAULT FALSE,
  helpful_count INTEGER DEFAULT 0,
  unhelpful_count INTEGER DEFAULT 0,
  response_text TEXT,
  response_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,
  order_id TEXT
);

-- Index for faster queries
CREATE INDEX idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX idx_product_reviews_status ON product_reviews(status);
CREATE INDEX idx_product_reviews_rating ON product_reviews(rating);
CREATE INDEX idx_product_reviews_created_at ON product_reviews(created_at DESC);

-- View for product review statistics
CREATE OR REPLACE VIEW product_review_stats AS
SELECT
  product_id,
  COUNT(*) as total_reviews,
  COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_reviews,
  ROUND(AVG(CASE WHEN status = 'approved' THEN rating END), 2) as average_rating,
  COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star_count,
  COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star_count,
  COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star_count,
  COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star_count,
  COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star_count,
  COUNT(CASE WHEN verified_purchase THEN 1 END) as verified_purchases,
  MAX(created_at) as latest_review_date
FROM product_reviews
WHERE status = 'approved'
GROUP BY product_id;

-- Auto-update modified timestamp
CREATE OR REPLACE FUNCTION update_product_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_reviews_updated_at_trigger
BEFORE UPDATE ON product_reviews
FOR EACH ROW
EXECUTE FUNCTION update_product_reviews_updated_at();
