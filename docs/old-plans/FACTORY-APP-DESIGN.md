# KRISHOE Slippers Factory - App Design Document

## 🎯 App Vision

**Simple Daily Work Register System**
- One entry per task
- 1 minute to record
- Auto-calculate everything
- Crystal clear reports

---

## 📊 App Structure (3 Main Screens)

### Screen 1: HOME/DASHBOARD
```
┌─────────────────────────────────────┐
│  KRISHOE Factory - 29 July 2026    │
│  Today's Summary                    │
├─────────────────────────────────────┤
│                                     │
│  📊 TODAY AT A GLANCE              │
│  ├─ Total Pairs: 150               │
│  ├─ Total Amount: Rs. 3,000        │
│  └─ Workers Active: 12/12          │
│                                     │
│  💼 TOP WORKERS TODAY              │
│  ├─ राज कुमार: 60 pairs (Upper)   │
│  ├─ संतोष: 50 pairs (Fibermen)     │
│  └─ अन्य: 40 pairs                 │
│                                     │
│  🎒 PRODUCTS TODAY                 │
│  ├─ Flatpatta: 50 pairs            │
│  ├─ Sendil: 40 pairs               │
│  └─ Close Shoes: 30 pairs          │
│                                     │
│  📋 QUALITY STATUS                 │
│  ├─ Completed: 150 ✅              │
│  ├─ In Progress: 0 ⏳              │
│  └─ Rework: 0 🔄                   │
│                                     │
│  [+ ADD WORK] [📊 REPORTS] [⚙️ HR]│
└─────────────────────────────────────┘
```

---

### Screen 2: ADD DAILY WORK (Main Entry Point)

```
┌─────────────────────────────────────┐
│  + ADD WORK                         │
│  (Simple Daily Work Register)       │
├─────────────────────────────────────┤
│                                     │
│  📅 Date                            │
│  ┌─────────────────────────────────┐│
│  │ 29 July 2026 [Calendar]        ││
│  └─────────────────────────────────┘│
│                                     │
│  👤 Worker                          │
│  ┌─────────────────────────────────┐│
│  │ 🔍 राज कुमार (Upper)           ││
│  │    Search... Worker names      ││
│  │ • राज कुमार (Upper)            ││
│  │ • संतोष (Fibermen)              ││
│  │ • ... 10 more                  ││
│  └─────────────────────────────────┘│
│                                     │
│  🛞 Product                         │
│  ┌─────────────────────────────────┐│
│  │ 🔍 Flatpatta                   ││
│  │    Search products             ││
│  │ • Flatpatta                    ││
│  │ • Sendil                       ││
│  │ • Close Shoes                  ││
│  │ • Hill Sandel                  ││
│  │ • ... 5 more                   ││
│  └─────────────────────────────────┘│
│                                     │
│  🎨 Color                           │
│  ┌─────────────────────────────────┐│
│  │ Black                          ││
│  └─────────────────────────────────┘│
│                                     │
│  📏 Size                            │
│  ┌─────────────────────────────────┐│
│  │ 7                              ││
│  └─────────────────────────────────┘│
│                                     │
│  🔢 Pairs (Quantity)                │
│  ┌─────────────────────────────────┐│
│  │ 50                             ││
│  └─────────────────────────────────┘│
│                                     │
│  ✅ Status                          │
│  ┌─────────────────────────────────┐│
│  │ ◉ Completed                    ││
│  │ ○ In Progress                  ││
│  │ ○ Rework                       ││
│  └─────────────────────────────────┘│
│                                     │
│  💰 RATE (Auto-Filled)              │
│  ┌─────────────────────────────────┐│
│  │ Rs. 12 per pair (Flatpatta)   ││
│  │ Flatpatta Upper Rate           ││
│  └─────────────────────────────────┘│
│                                     │
│  💵 AMOUNT (Auto-Calculated)        │
│  ┌─────────────────────────────────┐│
│  │ 50 pairs × Rs. 12 = Rs. 600   ││
│  └─────────────────────────────────┘│
│                                     │
│         [✅ SAVE WORK]              │
│                                     │
│    ✓ Added to daily total          │
│    ✓ Worker amount updated         │
│    ✓ Product count updated         │
│                                     │
└─────────────────────────────────────┘
```

---

### Screen 3: MONTHLY REPORTS

```
┌─────────────────────────────────────┐
│  📊 REPORTS - July 2026             │
├─────────────────────────────────────┤
│                                     │
│  🎯 MONTHLY SUMMARY                │
│  ├─ Total Pairs: 3,500             │
│  ├─ Total Amount: Rs. 70,000       │
│  └─ Working Days: 25               │
│                                     │
│  👥 TOP WORKERS THIS MONTH         │
│  ├─ 🥇 राज कुमार: 1,200 pairs     │
│  │     = Rs. 24,000                │
│  ├─ 🥈 संतोष: 1,000 pairs         │
│  │     = Rs. 20,000                │
│  ├─ 🥉 अन्य: 1,300 pairs          │
│  │     = Rs. 26,000                │
│  └─ ... (12 workers total)         │
│                                     │
│  📦 PRODUCT RANKING                │
│  ├─ 1. Flatpatta: 1,200 pairs      │
│  ├─ 2. Sendil: 900 pairs           │
│  ├─ 3. Close Shoes: 800 pairs      │
│  ├─ 4. Hill Sandel: 600 pairs      │
│  └─ ... (9+ products)              │
│                                     │
│  📈 DAILY AVERAGE                  │
│  ├─ Pairs per Day: 140             │
│  ├─ Amount per Day: Rs. 2,800      │
│  └─ Per Worker: 11.67 pairs/day    │
│                                     │
│  ✅ QUALITY METRICS                │
│  ├─ Completed: 3,400 (97%)         │
│  ├─ In Progress: 50 (1.4%)         │
│  ├─ Rework: 50 (1.4%)              │
│  └─ Success Rate: 97%              │
│                                     │
│  💰 PAYROLL READY                  │
│  ├─ राज कुमार: Rs. 24,000         │
│  ├─ संतोष: Rs. 20,000              │
│  ├─ ... (12 workers)               │
│  └─ TOTAL: Rs. 70,000              │
│                                     │
│  [📥 EXPORT] [🖨️ PRINT] [📊 VIEW] │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔄 Data Flow (कस काम गर्छ)

```
STEP 1: Worker आयो
    ↓
STEP 2: ADD WORK Form खोल
    - Worker select गर
    - Product select गर
    - Color, Size, Pairs enter गर
    ↓
STEP 3: System Auto-Calculate गर
    - Rate lookup (Worker category + Product)
    - Amount calculate (Pairs × Rate)
    - Save to database
    ↓
STEP 4: Dashboard Updates Automatically
    - Today's total pair count +
    - Today's total amount +
    - Worker's daily count +
    - Product's count +
    - Quality status updated
    ↓
STEP 5: Reports Generate
    - Daily summary
    - Monthly summary
    - Payroll ready
    - Worker performance
```

---

## 📊 Database Structure (Backend)

```
TABLES:

1. WORKERS
   ├─ ID
   ├─ Name
   ├─ Category (Upper / Fibermen)
   └─ Status (Active / Inactive)

2. PRODUCTS
   ├─ ID
   ├─ Name (Flatpatta, Sendil, etc.)
   ├─ Code (SK-101, SK-102, etc.)
   └─ Status

3. RATES
   ├─ ID
   ├─ Product ID
   ├─ Worker Category
   ├─ Rate per Pair (Rs.)
   └─ Effective Date

4. DAILY_WORK
   ├─ ID
   ├─ Date
   ├─ Worker ID
   ├─ Product ID
   ├─ Color
   ├─ Size
   ├─ Pairs Count
   ├─ Status (Completed/In Progress/Rework)
   ├─ Rate (Auto-filled)
   ├─ Amount (Auto-calculated)
   └─ Timestamp

5. MONTHLY_SUMMARY (Auto-Generated)
   ├─ Month
   ├─ Worker ID
   ├─ Total Pairs
   ├─ Total Amount
   ├─ Working Days
   └─ Status (Draft/Locked)
```

---

## 🎯 Key Features

### ✅ Automatic Calculations:
```
1. Rate Lookup
   Worker Category + Product → Rs. Rate

2. Amount Calculation
   Pairs × Rate = Amount

3. Daily Summary
   Sum all work entries for today

4. Monthly Summary
   Sum all work entries for month
   Auto-generate payroll

5. Worker Performance
   Total pairs per worker per month
   Average pairs per day per worker
```

### ✅ Smart Search:
```
- Search workers by name
- Search products by name
- Auto-complete suggestions
- Quick selection
```

### ✅ Status Tracking:
```
⏳ In Progress (काम सुरु भएको)
✅ Completed (काम पूरा भएको)
🔄 Rework (फिर गर्न सक्छ भएको)
```

---

## 🖥️ Technical Stack

```
Frontend:
├─ React/Next.js (UI)
├─ Tailwind CSS (Styling)
└─ TypeScript (Type safety)

Backend:
├─ Next.js API Routes
├─ PostgreSQL (Database)
└─ Prisma (ORM)

Features:
├─ Real-time calculations
├─ Auto-fill rates
├─ Instant reports
└─ Export to CSV/Excel
```

---

## 📱 Mobile Responsive

```
✅ Desktop (PC):
   - Full dashboard
   - Detailed reports
   - All features

✅ Tablet:
   - Add work form optimized
   - Dashboard readable
   - Touch-friendly

✅ Mobile:
   - Simplified view
   - Large buttons
   - Quick entry focus
   - Swipe navigation
```

---

## 🔐 Access Control

```
Owner/Manager:
├─ View all data
├─ Add/Edit work
├─ Generate reports
├─ Access payroll
└─ Manage workers

Worker (View-Only):
├─ See own work
├─ View own earnings
└─ No edit access
```

---

## 📋 Implementation Phases

### Phase 1 (Week 1):
- Worker management
- Product management
- Rate management
- Daily work entry form

### Phase 2 (Week 2):
- Dashboard
- Daily summary
- Worker performance tracking
- Quality status

### Phase 3 (Week 3):
- Monthly reports
- Payroll generation
- Export features
- Mobile optimization

### Phase 4 (Week 4):
- Testing
- Refinements
- Go-live preparation
- Training

---

## ✨ Why This Design?

```
✅ Simple - 1 form, 6-7 fields
✅ Fast - 1 minute per entry
✅ Accurate - Auto-calculate, no manual errors
✅ Clear - Dashboard shows everything
✅ Scalable - Can add more features later
✅ Practical - Matches actual factory workflow
✅ Payroll-Ready - Automatic monthly payroll
```

---

## 🎬 Next Steps

1. **Review this design** - कस्तो लाग्यो?
2. **Feedback** - कुनै change चाहिन्छ?
3. **Rates & Workers** - Final data दिनु
4. **START CODING** - App बनाऊ

---

**यो design ठीक छ? या changes चाहिन्छ?** 🎨
