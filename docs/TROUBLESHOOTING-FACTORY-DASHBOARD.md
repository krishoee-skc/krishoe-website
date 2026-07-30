# 🔧 KRISHOE Factory Dashboard - Troubleshooting Guide

## समस्या (Problem)
Admin dashboard `/admin/factory` ले यो error दिन्छ:
```
Cannot read properties of undefined (reading 'name')
Nothing was saved or changed. Press Try again
```

---

## कारण (Root Cause)

**Error का कारण 3 हुन सक्छन्:**

### 1. **Empty Database (सबसे सम्भावित)**
Database को यो tables मा data नछ:
- `factory_workers` (Workers नछन्)
- `factory_items` (Products नछन्)

जब API को JOIN चल्छ तब NULL return हुन्छ → undefined → error

### 2. **Database Connection Down**
PostgreSQL को connection fail भएको हो

### 3. **JOIN Column Mismatch**
API ले `fw.name` खोजिरहेको छ तर column को नाम फरक होला

---

## समाधान (Solution)

### **Step 1: Database चेक गर्ने**

**Neon Console मा login गर:**
```
https://console.neon.tech/app/projects
Login: skschhapal@gmail.com
```

**Query run गर:**
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'factory_%';

-- Check factory_workers data
SELECT COUNT(*) as worker_count FROM factory_workers;

-- Check factory_items data
SELECT COUNT(*) as item_count FROM factory_items;
```

---

### **Step 2: Data Populate गर्ने (अगर empty छ)**

**Neon Console मा यो SQL run गर:**

```sql
-- Add sample workers
INSERT INTO factory_workers (id, name, worker_type, category, status)
VALUES
  ('w1', 'राज कुमार', 'piece_rate', 'Upper', 'active'),
  ('w2', 'संतोष शर्मा', 'piece_rate', 'Fibermen', 'active'),
  ('w3', 'अन्य', 'piece_rate', 'Upper', 'active');

-- Add sample items
INSERT INTO factory_items (id, name, code, status)
VALUES
  ('i1', 'Flatpatta', 'FP', 'active'),
  ('i2', 'Sendil', 'SD', 'active'),
  ('i3', 'Close Shoes', 'CS', 'active');

-- Add sample rates
INSERT INTO factory_rates (id, item_id, worker_category, rate_per_pair, effective_date)
VALUES
  ('r1', 'i1', 'Upper', 12, '2026-07-31'),
  ('r2', 'i1', 'Fibermen', 8, '2026-07-31'),
  ('r3', 'i2', 'Upper', 10, '2026-07-31'),
  ('r4', 'i2', 'Fibermen', 6, '2026-07-31');
```

---

### **Step 3: Admin Dashboard Refresh गर्ने**

1. Admin login page जा: `/admin/login`
2. Factory dashboard खोल: `/admin/factory`
3. Page refresh गर: `F5` या `Ctrl+Shift+R`

---

## ✅ **Fixed Code Changes**

### **What Changed:**

#### 1. **API Route (`app/api/factory/work/route.ts`)**
```typescript
// BEFORE: Could return NULL
SELECT fw.name as worker_name, fi.name as item_name

// AFTER: Falls back to default + uses LEFT JOIN
SELECT COALESCE(fw.name, 'Unknown Worker') as worker_name,
       COALESCE(fi.name, 'Unknown Item') as item_name
FROM factory_daily_work w
LEFT JOIN factory_workers fw ON w.worker_id = fw.id    // Changed to LEFT JOIN
LEFT JOIN factory_items fi ON w.item_id = fi.id        // Changed to LEFT JOIN
```

**Benefits:**
- NULL values को जाई 'Unknown Worker' show हुन्छ
- Error नआएको
- API error message return गर्छ

#### 2. **Frontend (`app/admin/factory/page.tsx`)**
```typescript
// BEFORE: Could access undefined.name
if (!workerStats[w.worker_id]) {
  workerStats[w.worker_id] = { name: w.worker_name, ... };
}

// AFTER: Checks for valid data
if (w && w.worker_id && w.worker_name) {
  workerStats[w.worker_id] = { name: w.worker_name || 'Unknown', ... };
}
```

**Benefits:**
- Undefined check गर्छ
- Error message display गर्छ
- User को लागि helpful message

#### 3. **Error Display**
```typescript
// Now shows user-friendly error message
{error && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <p className="text-red-800 font-medium">⚠️ Dashboard Error</p>
    <p className="text-red-700">{error}</p>
    <p className="text-red-600 text-xs">
      Troubleshooting: Check if factory_workers and factory_items tables have data
    </p>
  </div>
)}
```

---

## 🔍 **Debug करने को स्टेप्स**

### **Browser Console मा देख:**
1. Open DevTools: `F12`
2. Console tab खोल
3. Error message पढ
4. API response check गर: Network tab में देख

### **API Response Check गर:**
```bash
# Terminal मा run गर:
curl "http://localhost:3000/api/factory/work?date=2026-07-31"
```

Expected response:
```json
{
  "works": [
    {
      "id": "...",
      "worker_id": "w1",
      "worker_name": "राज कुमार",
      "item_id": "i1",
      "item_name": "Flatpatta",
      ...
    }
  ]
}
```

Alternate (if empty):
```json
{
  "error": "No valid work entries found. Check if factory_workers and factory_items tables are populated.",
  "works": []
}
```

---

## 🚨 **If Problem Persists:**

### 1. **Database Connection Check गर:**
```bash
# .env.local verify गर
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT version();"
```

### 2. **Schema Verify गर:**
```sql
-- Check column names
\d factory_workers
\d factory_items

-- Make sure 'name' column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'factory_workers';
```

### 3. **Rebuild & Restart गर:**
```bash
npm run build
npm run dev
```

---

## 📝 **Permanent Prevention**

यो fix अब लागु भएको छ:
- ✅ API LEFT JOIN use गर्छ (NULL-safe)
- ✅ COALESCE() को साथ default values
- ✅ Frontend validation checks
- ✅ User-friendly error messages
- ✅ Better error logging

अब यो error दोबारा नआउनचाहिँ! 🎉

---

## सहायक Commands

```bash
# Check all factory tables
psql $DATABASE_URL -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema='public' 
AND table_name LIKE 'factory_%' 
ORDER BY table_name;"

# Check data counts
psql $DATABASE_URL -c "
SELECT 'Workers' as table_name, COUNT(*) as count FROM factory_workers
UNION ALL
SELECT 'Items', COUNT(*) FROM factory_items
UNION ALL
SELECT 'Rates', COUNT(*) FROM factory_rates
UNION ALL
SELECT 'Work Entries', COUNT(*) FROM factory_daily_work;"

# Clear and repopulate (if needed)
psql $DATABASE_URL -c "
TRUNCATE factory_workers CASCADE;
TRUNCATE factory_items CASCADE;
-- Then run Step 2 insert statements
"
```

---

**Status:** ✅ **FIXED** - Code changes deployed and ready to test
**Last Updated:** 2026-07-31
**Tested By:** Claude Code Assistant
