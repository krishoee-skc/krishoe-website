-- Customer Engagement System Database Schema
-- Run this in Neon console

-- Customer information table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  whatsapp_number VARCHAR(20),
  location VARCHAR(255),
  city VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Nepal',
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'blocked'
  notification_preference VARCHAR(50) DEFAULT 'all', -- 'all', 'email', 'whatsapp', 'sms', 'none'
  total_orders INT DEFAULT 0,
  total_spent NUMERIC(12, 2) DEFAULT 0.00,
  loyalty_points INT DEFAULT 0,
  rating_avg NUMERIC(3, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer contact information
CREATE TABLE IF NOT EXISTS customer_contacts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  contact_type VARCHAR(50) NOT NULL, -- 'phone', 'email', 'whatsapp'
  contact_value VARCHAR(255) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, contact_type)
);

-- Customer orders
CREATE TABLE IF NOT EXISTS customer_orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'
  total_amount NUMERIC(12, 2) NOT NULL,
  items_count INT NOT NULL,
  order_date DATE NOT NULL,
  expected_delivery DATE,
  actual_delivery DATE,
  shipping_address TEXT,
  tracking_number VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  product_name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  total_price NUMERIC(12, 2) NOT NULL,
  color VARCHAR(100),
  size VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer feedback and reviews
CREATE TABLE IF NOT EXISTS customer_feedback (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES customer_orders(id) ON DELETE SET NULL,
  feedback_type VARCHAR(50) NOT NULL, -- 'review', 'complaint', 'suggestion', 'issue'
  rating INT, -- 1-5 stars
  title VARCHAR(255),
  message TEXT NOT NULL,
  product_mentioned VARCHAR(255),
  status VARCHAR(50) DEFAULT 'new', -- 'new', 'acknowledged', 'resolved', 'closed'
  response_message TEXT,
  response_date TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer notifications
CREATE TABLE IF NOT EXISTS customer_notifications (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES customer_orders(id) ON DELETE SET NULL,
  notification_type VARCHAR(50) NOT NULL, -- 'order_confirmed', 'shipped', 'delivered', 'feedback_request', 'promotion'
  channel VARCHAR(50) NOT NULL, -- 'whatsapp', 'email', 'sms'
  message_text TEXT NOT NULL,
  recipient VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'read'
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSON, -- additional data like template variables
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  order_updates BOOLEAN DEFAULT TRUE,
  delivery_updates BOOLEAN DEFAULT TRUE,
  promotions BOOLEAN DEFAULT TRUE,
  feedback_requests BOOLEAN DEFAULT TRUE,
  newsletter BOOLEAN DEFAULT TRUE,
  sms_enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT TRUE,
  whatsapp_enabled BOOLEAN DEFAULT TRUE,
  do_not_disturb_start TIME, -- e.g., '22:00:00'
  do_not_disturb_end TIME,   -- e.g., '08:00:00'
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty and rewards
CREATE TABLE IF NOT EXISTS customer_loyalty (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE REFERENCES customers(id) ON DELETE CASCADE,
  points_balance INT DEFAULT 0,
  points_lifetime INT DEFAULT 0,
  tier VARCHAR(50) DEFAULT 'bronze', -- 'bronze', 'silver', 'gold', 'platinum'
  tier_since TIMESTAMPTZ DEFAULT NOW(),
  last_purchase_date DATE,
  referral_code VARCHAR(50) UNIQUE,
  referral_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer engagement metrics
CREATE TABLE IF NOT EXISTS customer_analytics (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  orders_count INT DEFAULT 0,
  total_spent NUMERIC(12, 2) DEFAULT 0.00,
  average_order_value NUMERIC(10, 2),
  feedback_count INT DEFAULT 0,
  avg_rating NUMERIC(3, 2),
  messages_received INT DEFAULT 0,
  messages_opened INT DEFAULT 0,
  open_rate NUMERIC(5, 2), -- percentage
  last_order_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, month)
);

-- Create indexes for performance
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_whatsapp ON customers(whatsapp_number);
CREATE INDEX idx_customers_created ON customers(created_at DESC);
CREATE INDEX idx_customer_orders_customer_id ON customer_orders(customer_id);
CREATE INDEX idx_customer_orders_status ON customer_orders(status);
CREATE INDEX idx_customer_orders_date ON customer_orders(order_date DESC);
CREATE INDEX idx_customer_feedback_customer_id ON customer_feedback(customer_id);
CREATE INDEX idx_customer_feedback_status ON customer_feedback(status);
CREATE INDEX idx_customer_notifications_customer_id ON customer_notifications(customer_id);
CREATE INDEX idx_customer_notifications_status ON customer_notifications(status);
CREATE INDEX idx_customer_notifications_channel ON customer_notifications(channel);
CREATE INDEX idx_customer_notifications_created ON customer_notifications(created_at DESC);
CREATE INDEX idx_customer_loyalty_referral ON customer_loyalty(referral_code);
CREATE INDEX idx_customer_analytics_month ON customer_analytics(month DESC);

-- Grant permissions (if needed)
GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_contacts TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_orders TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_items TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_feedback TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_notifications TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_preferences TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_loyalty TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_analytics TO postgres;

-- Verify tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'customer%';
