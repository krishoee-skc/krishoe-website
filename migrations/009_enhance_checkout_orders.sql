-- Enhance Orders Table for Optimized Checkout
-- Adds fields for better checkout experience tracking

ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS
  checkout_step VARCHAR(50) DEFAULT 'cart',
  checkout_started_at TIMESTAMP,
  checkout_abandoned_at TIMESTAMP,
  promo_code TEXT,
  discount_amount INTEGER DEFAULT 0,
  shipping_address TEXT,
  billing_address TEXT,
  shipping_method VARCHAR(50),
  shipping_cost INTEGER DEFAULT 0,
  estimated_delivery DATE,
  guest_checkout BOOLEAN DEFAULT FALSE,
  save_address BOOLEAN DEFAULT FALSE,
  phone_number TEXT,
  special_instructions TEXT;

-- Index for checkout analytics
CREATE INDEX IF NOT EXISTS idx_orders_checkout_step ON orders(checkout_step);
CREATE INDEX IF NOT EXISTS idx_orders_checkout_started_at ON orders(checkout_started_at);
CREATE INDEX IF NOT EXISTS idx_orders_promo_code ON orders(promo_code);

-- Create promo codes table
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type VARCHAR(20) CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value INTEGER NOT NULL,
  max_discount INTEGER,
  min_purchase INTEGER DEFAULT 0,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_active ON promo_codes(active);

-- Create shipping methods table
CREATE TABLE IF NOT EXISTS shipping_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  base_cost INTEGER,
  cost_per_km DECIMAL(5, 2),
  estimated_days INTEGER,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- View for checkout funnel analytics
CREATE OR REPLACE VIEW checkout_funnel_analytics AS
SELECT
  DATE(checkout_started_at) as checkout_date,
  COUNT(DISTINCT id) as total_checkouts_started,
  COUNT(DISTINCT CASE WHEN checkout_step = 'shipping' THEN id END) as reached_shipping,
  COUNT(DISTINCT CASE WHEN checkout_step = 'payment' THEN id END) as reached_payment,
  COUNT(DISTINCT CASE WHEN checkout_step = 'confirmation' THEN id END) as completed,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN checkout_step = 'shipping' THEN id END) / COUNT(DISTINCT id), 2) as shipping_rate,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN checkout_step = 'payment' THEN id END) / COUNT(DISTINCT id), 2) as payment_rate,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN checkout_step = 'confirmation' THEN id END) / COUNT(DISTINCT id), 2) as completion_rate,
  COUNT(DISTINCT CASE WHEN checkout_abandoned_at IS NOT NULL THEN id END) as abandoned
FROM orders
WHERE checkout_started_at IS NOT NULL
GROUP BY DATE(checkout_started_at)
ORDER BY checkout_date DESC;
