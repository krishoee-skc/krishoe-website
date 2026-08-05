# KRISHOE Admin Guide

## Getting Started

### Login
1. Go to `https://krishoe-website.vercel.app/admin`
2. Enter your credentials
3. You'll see the admin dashboard

---

## Dashboard Features

### 1. Quick Overview Cards

Five cards show today's key metrics:

- **📊 Today's Production**: Total pairs produced today
- **💳 Pending Payments**: Orders needing manual payment confirmation
- **📦 New Orders**: Orders received today
- **⚠️ Low Stock**: Products below reorder level
- **👑 Top Worker**: Best performing worker today

**Click any card** to see more details.

### 2. Navigation Menu

Located in top navigation or sidebar:
- Dashboard (home)
- Work Management
- Worker Analytics
- Alerts
- SMS Logs
- Advanced Analytics
- Monitoring
- Settings

---

## Core Tasks

### Add Production Work

1. Go to **Admin → Quick Actions → Add Work**
2. **Step 1**: Select worker (top 3 shortcuts available)
3. **Step 2**: Select product
4. **Step 3**: Enter pair count (auto-calculates amount)
5. Click **Save**

**Time**: ~30 seconds (vs 5 minutes with old form)

### Check Worker Performance

1. Go to **Admin → Worker Analytics**
2. See team overview cards
3. Click any worker to view:
   - Daily/weekly/monthly metrics
   - Quality tracking
   - Attendance rate
   - Earnings
   - Performance vs team average

### Manage SMS Messages

1. Go to **Admin → SMS Management**
2. View all SMS sent to customers/workers
3. Filter by type, phone, or order ID
4. Click message to view details

### Check System Health

1. Go to **Admin → Monitoring**
2. See system health cards (Database, API, Email, SMS, etc.)
3. View performance metrics:
   - Average response time
   - Error rate
   - Top errors
   - Slowest endpoints
4. Auto-refreshes every 30 seconds

### View Alerts

1. Go to **Admin → Alert Center**
2. See unread alerts count (red badge)
3. Filter by alert type
4. Click alert to view details
5. Mark as read or delete

### Analyze Business Data

1. Go to **Admin → Advanced Analytics**
2. Choose tab:
   - **Overview**: Key metrics comparison (this month vs last)
   - **30-Day Trends**: Sales, production, revenue
   - **Forecast**: AI predictions for next 30 days
   - **Goals**: Track monthly targets
   - **Workers**: Performance & bonus eligibility

---

## Common Workflows

### Daily Morning Checklist

```
1. Check Dashboard (2 min)
   - Any low stock? → Order now
   - Pending payments? → Confirm/follow up
   - New orders? → Note quantities

2. Check Monitoring (1 min)
   - Any red alerts? → Investigate
   - System healthy? → Good to go

3. Review Alerts (3 min)
   - Quality issues? → Talk to worker
   - Attendance problems? → Note patterns
   - Manual payments? → Process them
```

### Worker Payment Day

```
1. Go to Admin → Payroll Suggestions
2. Review worker calculations
3. Approve payments that meet criteria
4. SMS automatically sent to workers
5. Mark as paid
6. Done! ✅
```

### Handling Customer Order

```
1. Order received (SMS notification sent)
2. Confirm stock (Analytics → Goals section)
3. Assign to production
4. SMS sent: Payment link
5. Payment received (Alert created)
6. Confirm payment
7. Ship order
8. SMS sent: Shipped
9. SMS sent: Out for delivery
10. SMS sent: Delivered
```

---

## Tips & Tricks

### 🚀 Speed Tips

- Use **Quick Actions** card buttons (top workers, recent products)
- Dashboard cards are clickable for more details
- Monitoring auto-refreshes—no need to manually refresh
- SMS logs auto-sort by newest first

### 📊 Data Tips

- **Analytics trends**: Look at 30-day view to see patterns
- **Worker performance**: Quality > 95% + Attendance > 90% = bonus eligible
- **Slow endpoints**: Check monitoring if app feels slow
- **Error logs**: Check monitoring to debug issues

### 🔔 Alert Tips

- **Red alert badge**: Unread alerts waiting
- **Alert types**: Filter by type to focus on what matters
- **Action links**: Click alert to go directly to related order/worker
- **Recommendations**: Monitoring dashboard suggests actions

### 💡 Keyboard Shortcuts

- `?` : Show help (future feature)
- `/admin` : Jump to admin dashboard
- `/alerts` : Jump to alert center

---

## Troubleshooting

### App is Slow

1. Check **Admin → Monitoring**
2. Look at "Slowest Endpoints"
3. If database slow: may need optimization
4. If many errors: check error logs

### SMS Not Sending

1. Check **Admin → Monitoring → SMS status**
2. If SMS service down: contact support
3. Check **SMS Logs** to see failed messages
4. Verify customer phone numbers are valid

### Worker Not Appearing in Production

1. Check **Worker Analytics**
2. Verify worker status is "Active"
3. Check if worker has valid phone number
4. May need to re-assign work

### Order Not Showing

1. Check database connection in **Monitoring**
2. Try refreshing page
3. Check error logs in **Monitoring → Top Errors**
4. Verify order was saved (check SMS log)

---

## Features by Role

### Store Manager

Needs access to:
- Dashboard ✅
- Orders ✅
- SMS Logs ✅
- Analytics ✅
- Quick Actions ✅

### Factory Manager

Needs access to:
- Worker Analytics ✅
- Work Management ✅
- Monitoring ✅
- Payroll ✅
- Production Dashboard ✅

### Accountant

Needs access to:
- Analytics ✅
- Payroll ✅
- Payment Alerts ✅
- Customer Ledger (future) ❌

---

## Advanced

### Reading Monitoring Dashboard

```
🟢 Green = Healthy
🔴 Red = Problem
🟡 Yellow = Warning

Health Cards:
✅ Database: Core data store
✅ API: Backend system
✅ Email: Newsletter system
✅ SMS: Message delivery
✅ Storage: File storage
✅ Cache: Speed layer
```

### Performance Metrics

```
Avg Response Time: How fast API responds
- < 200ms: Excellent
- 200-500ms: Good
- 500-1000ms: Acceptable
- > 1000ms: Slow - investigate

Error Rate: What % of requests fail
- < 0.1%: Excellent
- 0.1-0.5%: Good
- 0.5-1%: Acceptable
- > 1%: High - investigate
```

### Understanding Alerts

```
Priority by severity:
CRITICAL 🔴: Fix immediately
HIGH 🟠: Fix today
MEDIUM 🟡: Fix this week
LOW 🔵: Nice to fix
```

---

## Contact & Support

For issues:
1. Check this guide
2. Check monitoring dashboard
3. Contact technical team
4. Email: design.cad.tsa@gmail.com

---

**Last Updated**: 2026-08-06
**Version**: 1.0
