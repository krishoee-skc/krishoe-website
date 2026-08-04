-- WhatsApp Integration Database Schema
-- Run this in Neon console

-- Store WhatsApp numbers for contacts
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id TEXT PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL, -- 'worker', 'customer', 'admin'
  entity_id TEXT NOT NULL,
  whatsapp_number VARCHAR(20) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message history
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id TEXT PRIMARY KEY,
  from_number VARCHAR(20) NOT NULL,
  to_number VARCHAR(20) NOT NULL,
  message_text TEXT,
  message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'document', 'audio', 'video'
  direction VARCHAR(20) NOT NULL, -- 'inbound', 'outbound'
  status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
  media_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message templates
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id TEXT PRIMARY KEY,
  template_name VARCHAR(100) NOT NULL UNIQUE,
  template_text TEXT NOT NULL,
  template_type VARCHAR(50) NOT NULL, -- 'order', 'payment', 'delivery', 'review', 'notification'
  variables JSON, -- {"name": "string", "amount": "number", ...}
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled messages
CREATE TABLE IF NOT EXISTS whatsapp_scheduled (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL,
  template_name VARCHAR(100) NOT NULL,
  variables JSON,
  scheduled_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message analytics
CREATE TABLE IF NOT EXISTS whatsapp_analytics (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  messages_sent INT DEFAULT 0,
  messages_received INT DEFAULT 0,
  delivery_rate DECIMAL(5, 2), -- percentage
  message_type_breakdown JSON, -- {"text": 100, "image": 50, ...}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_whatsapp_messages_from ON whatsapp_messages(from_number);
CREATE INDEX idx_whatsapp_messages_to ON whatsapp_messages(to_number);
CREATE INDEX idx_whatsapp_messages_created ON whatsapp_messages(created_at DESC);
CREATE INDEX idx_whatsapp_contacts_entity ON whatsapp_contacts(entity_type, entity_id);
CREATE INDEX idx_whatsapp_scheduled_time ON whatsapp_scheduled(scheduled_time);

-- Insert default templates
INSERT INTO whatsapp_templates (id, template_name, template_text, template_type, variables, active)
VALUES
(
  'tpl-work-entry-' || gen_random_uuid()::text,
  'WORK_ENTRY_NOTIFICATION',
  'नयाँ काम entry:
👤 Worker: {workerName}
📦 Product: {productName}
📊 Pairs: {pairsCount}
💰 Amount: Rs. {amount}',
  'notification',
  '{"workerName": "string", "productName": "string", "pairsCount": "number", "amount": "number"}',
  TRUE
),
(
  'tpl-daily-summary-' || gen_random_uuid()::text,
  'DAILY_SUMMARY',
  '📊 आज को Summary:
📈 Total Pairs: {totalPairs}
💵 Total Amount: Rs. {totalAmount}
👥 Workers: {workersCount}
✅ Completed: {completedTasks}
⏳ In Progress: {inProgress}',
  'notification',
  '{"totalPairs": "number", "totalAmount": "number", "workersCount": "number", "completedTasks": "number", "inProgress": "number"}',
  TRUE
),
(
  'tpl-payment-reminder-' || gen_random_uuid()::text,
  'PAYMENT_REMINDER',
  '💰 Payment Reminder:
👤 Worker: {workerName}
💵 Amount: Rs. {amount}
📅 Due: {dueDate}',
  'payment',
  '{"workerName": "string", "amount": "number", "dueDate": "string"}',
  TRUE
),
(
  'tpl-order-confirmation-' || gen_random_uuid()::text,
  'ORDER_CONFIRMATION',
  '✅ Order Confirmed!
नमस्ते {customerName}!
Order ID: #{orderId}
Amount: Rs. {totalAmount}
Delivery: {deliveryDate}',
  'order',
  '{"customerName": "string", "orderId": "string", "totalAmount": "number", "deliveryDate": "string"}',
  TRUE
);

-- Grant permissions (if needed)
GRANT SELECT, INSERT, UPDATE ON whatsapp_messages TO postgres;
GRANT SELECT, INSERT, UPDATE ON whatsapp_templates TO postgres;
GRANT SELECT, INSERT, UPDATE ON whatsapp_contacts TO postgres;
GRANT SELECT, INSERT, UPDATE ON whatsapp_scheduled TO postgres;

-- Verify tables created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'whatsapp_%';
