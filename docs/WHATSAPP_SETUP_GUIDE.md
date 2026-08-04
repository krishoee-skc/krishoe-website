# WhatsApp Integration Setup Guide - KRISHOE Factory

## नेपालीमा गाइड (Nepali Guide)

---

## चरण 1: Twilio Account बनाउनुहोस्

### पहिलो: Account Signup
1. [https://www.twilio.com](https://www.twilio.com) मा जाउनुहोस्
2. **Sign Up** बटन क्लिक गर्नुहोस्
3. Email र password दिनुहोस्
4. फोन नम्बर verify गर्नुहोस् (OTP आउनेछ)
5. Account confirm गर्नुहोस्

### दोस्रो: WhatsApp Sandbox Enable गर्नुहोस्
1. Twilio Dashboard मा लॉगिन गर्नुहोस्
2. **Messaging** > **Try it out** > **Send an SMS** क्लिक गर्नुहोस्
3. नयाँ page मा **Explore Messaging Products** देख्नुहोस्
4. **WhatsApp** सेलेक्ट गर्नुहोस्
5. **WhatsApp Sandbox** enable गर्नुहोस्

### तेस्रो: Credentials Copy गर्नुहोस्
Dashboard मा यो सब कुरा खोज्नुहोस्:
- **Account SID**: `ACxxxxxxxxxxxxxxxxxxxx...`
- **Auth Token**: `xxxxxxxxxxxxxxxxxxx...`
- **WhatsApp Number**: `+1234567890` (Twilio को नम्बर)

---

## चरण 2: Environment Variables Set गर्नुहोस्

### Vercel Environment Variables
1. Vercel Dashboard खोल्नुहोस्
2. KRISHOE project खोज्नुहोस्
3. **Settings** > **Environment Variables** क्लिक गर्नुहोस्
4. यो variables add गर्नुहोस्:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=+1234567890
WHATSAPP_ADMIN_NUMBER=+9779841234567
```

**Note**: `WHATSAPP_ADMIN_NUMBER` मा आफ्नो Nepal को WhatsApp नम्बर दिनुहोस्

### पुष्टि गर्नुहोस्
Variables set गरेपछि, Vercel automatically redeploy गर्नेछ।

---

## चरण 3: Database Tables बनाउनुहोस्

### Neon Console खोल्नुहोस्
1. Neon Dashboard खोल्नुहोस्
2. KRISHOE database सेलेक्ट गर्नुहोस्
3. **SQL Editor** क्लिक गर्नुहोस्

### SQL Copy-Paste गर्नुहोस्
`docs/whatsapp-schema.sql` को सब कुरा copy गर्नुहोस्:

```sql
-- WhatsApp Integration Database Schema
-- Run this in Neon console

-- Store WhatsApp numbers for contacts
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id TEXT PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
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
  message_type VARCHAR(50) DEFAULT 'text',
  direction VARCHAR(20) NOT NULL,
  status VARCHAR(50) DEFAULT 'sent',
  media_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message templates
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id TEXT PRIMARY KEY,
  template_name VARCHAR(100) NOT NULL UNIQUE,
  template_text TEXT NOT NULL,
  template_type VARCHAR(50) NOT NULL,
  variables JSON,
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
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message analytics
CREATE TABLE IF NOT EXISTS whatsapp_analytics (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  messages_sent INT DEFAULT 0,
  messages_received INT DEFAULT 0,
  delivery_rate DECIMAL(5, 2),
  message_type_breakdown JSON,
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
```

SQL Editor मा paste गर्नुहोस्।

### Query चलाउनुहोस्
**Run** बटन क्लिक गर्नुहोस्। Success message आउनेछ।

---

## चरण 4: WhatsApp Sandbox को साथ Test गर्नुहोस्

### Twilio Sandbox को नम्बरमा Message पठाउनुहोस्
1. Twilio Dashboard मा जाउनुहोस्
2. WhatsApp Sandbox सेक्शन खोज्नुहोस्
3. Join code देख्नुहोस्: `join xxxx-xxxx`
4. आफ्नो WhatsApp को Twilio को नम्बरमा यो message पठाउनुहोस्:
   - `join xxxx-xxxx` (Twilio को नम्बर मा)

### Success!
Twilio reply भेज्नेछ कि आप confirm भयौ।

---

## चरण 5: KRISHOE App मा Test गर्नुहोस्

### Admin Settings Page खोल्नुहोस्
1. KRISHOE App खोल्नुहोस्
2. **Admin** > **Settings** > **WhatsApp** क्लिक गर्नुहोस्

### Admin Number दिनुहोस्
- आफ्नो Nepal को WhatsApp नम्बर: `+9779841234567`

### Test Message पठाउनुहोस्
- **Send Test Message** बटन क्लिक गर्नुहोस्
- Success message आउनेछ
- आफ्नो WhatsApp मा message पाउनुहोस् ✅

---

## चरण 6: सबै सेटअप गरिसके - अब काम गर्न शुरु गर्नुहोस्!

### काम Entry नयाँ काम गर्दै गरे:
1. Worker select गर्नुहोस्
2. Product select गर्नुहोस्
3. Pairs दिनुहोस्
4. Save गर्नुहोस्

### Automatic Notification:
- Admin को WhatsApp मा message आउनेछ
- Example: "नयाँ काम entry: Raj - Upper Slipper - 50 pairs - Rs. 500"

---

## Troubleshooting - समस्या समाधान

### Message नआउँदै?

#### समस्या 1: "WhatsApp gateway not configured"
**Solution:**
- Environment variables check गर्नुहोस्
- Vercel को Settings मा गए सब कुरा ठिक छ?
- Redeploy गर्नुहोस्

#### समस्या 2: "Invalid phone number"
**Solution:**
- Phone number format: `+977XXXXXXXXXX`
- `+` चिन्ह भएको छ?
- Country code `977` ठिक छ?

#### समस्या 3: Twilio account ko issue
**Solution:**
- Twilio Dashboard खोल्नुहोस्
- Balance check गर्नुहोस्
- WhatsApp Sandbox active छ?

### Database issue?

#### Error: "Table already exists"
**Solution:**
- Table पहिले नै बनिसकेको छ
- कोई लिखना दिनु पर्दैन

#### Error: "Unknown database"
**Solution:**
- DATABASE_URL ठिक छ?
- Neon मा सही database छ?

---

## URLs याद राखनुहोस्

| काम | URL |
|-----|-----|
| Admin Settings | `https://krishoe-website.vercel.app/admin/settings/whatsapp` |
| Work Entry | `https://krishoe-website.vercel.app/admin/factory/add-work` |
| API Webhook | `https://krishoe-website.vercel.app/api/webhooks/whatsapp` |

---

## Support - कहिले गर्ने?

समस्या आएमा:
1. अपने Vercel deployment logs check गर्नुहोस्
2. Neon database को schema verify गर्नुहोस्
3. Environment variables confirm गर्नुहोस्
4. Twilio Account status check गर्नुहोस्

---

## Next Phase - अगिलो काम

✅ Phase 1: WhatsApp Integration (Complete)
- Notifications काम गर्दै छन्
- Admin settings page सेटअप भयो
- Database तयार छ

📊 Phase 2 (आगामी):
- Customer notifications
- Message analytics dashboard
- Scheduled messages
- Message history viewer

---

**Ready to start using WhatsApp? 🚀**

पहिलो काम entry गर्नुहोस् र WhatsApp notification पाउनुहोस्!
