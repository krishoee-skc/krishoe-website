# KRISHOE Developer Guide

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL (Neon for cloud)
- Git

### Setup
```bash
# Clone repo
git clone https://github.com/krishoee-skc/krishoe-website.git
cd krishoe-website

# Install dependencies
npm install

# Setup .env.local
cp .env.example .env.local
# Edit with your values

# Start dev server
npm run dev

# Open http://localhost:3000
```

---

## Project Structure

```
krishoe-website/
├── app/                    # Next.js app router
│   ├── admin/             # Admin pages
│   ├── worker/            # Worker portal pages
│   ├── api/               # Backend API routes
│   └── layout.tsx         # Root layout
├── lib/                   # Utilities & logic
│   ├── postgres/          # Database client
│   ├── monitoring.ts      # Error tracking
│   ├── analytics-engine.ts # Analytics
│   ├── sms-gateway.ts     # SMS integration
│   └── ...
├── components/            # React components
│   ├── admin/             # Admin UI
│   ├── worker/            # Worker UI
│   ├── mobile/            # Mobile PWA
│   └── ...
├── public/                # Static assets
│   ├── manifest.json      # PWA manifest
│   └── sw.js              # Service worker
└── docs/                  # Documentation
```

---

## Tech Stack

### Frontend
- **Next.js 16**: React framework with SSR
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **React Hooks**: State management

### Backend
- **Next.js API Routes**: Serverless functions
- **PostgreSQL (Neon)**: Database
- **Session-based Auth**: User authentication

### Integrations
- **Twilio**: SMS delivery
- **eSewa/Khalti**: Payment processing
- **Brevo**: Email service
- **Vercel**: Deployment

---

## Database Schema

### Key Tables

```sql
-- Users & Auth
hr_employees          -- Factory workers
admin_staff_accounts  -- Admin users
users                 -- Shop customers

-- Business
orders                -- Customer orders
production_work_entries -- Worker production
hr_payroll            -- Worker payroll
hr_attendance         -- Attendance tracking

-- Monitoring
monitoring_errors     -- Error logs
monitoring_performance -- API performance
monitoring_uptime     -- Uptime tracking

-- Notifications
sms_messages          -- SMS history
admin_alerts          -- Alert logs
```

### Connect to Database

```javascript
import { queryPostgres } from '@/lib/postgres/client';

// Query
const users = await queryPostgres(
  'krishoe',
  'SELECT * FROM hr_employees WHERE status = $1',
  ['Active']
);
```

---

## API Development

### Creating New Endpoint

```typescript
// app/api/example/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");
    
    // Your logic here
    
    return NextResponse.json({
      success: true,
      data: {...}
    });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

### Protected Endpoints

```typescript
import { requireAdminPermission } from "@/lib/admin-permissions";

export async function GET(request: NextRequest) {
  const adminUser = await requireAdminPermission();
  if (!adminUser) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  // Continue...
}
```

---

## Component Development

### Page Component

```typescript
// app/admin/example/page.tsx
"use client";

import Component from "@/components/admin/Component";

export default function Page() {
  return <Component />;
}
```

### Client Component

```typescript
// components/admin/Example.tsx
"use client";

import { useEffect, useState } from "react";

export default function Example() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/example")
      .then(r => r.json())
      .then(d => setData(d.data));
  }, []);

  return <div>{/* UI */}</div>;
}
```

---

## Environment Variables

Required in `.env.local`:

```env
# Database
DATABASE_URL=postgresql://...

# Twilio SMS
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_SMS_NUMBER=...

# Payments
ESEWA_MERCHANT_CODE=...
KHALTI_PUBLIC_KEY=...

# Email
BREVO_API_KEY=...

# Storage
BLOB_READ_WRITE_TOKEN=...
```

---

## Running Tests

```bash
# All tests
npm run test

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

---

## Deployment

### Vercel (Automatic)
1. Push to GitHub main branch
2. Vercel auto-deploys
3. Live in 2-3 minutes

### Manual
```bash
# Build
npm run build

# Start prod server
npm start
```

---

## Monitoring

### Error Tracking

```typescript
import { logError } from "@/lib/monitoring";

try {
  // code
} catch (err) {
  await logError({
    level: "error",
    message: err.message,
    stack: err.stack,
    context: "MyFunction"
  });
}
```

### Performance Tracking

```typescript
import { logPerformanceMetric } from "@/lib/monitoring";

const start = Date.now();
// code
const duration = Date.now() - start;

await logPerformanceMetric({
  path: req.url,
  method: req.method,
  duration,
  statusCode: 200
});
```

---

## Debugging

### Check Logs
```bash
# Vercel logs
vercel logs

# Local console
# Appears in npm run dev output
```

### Database Debugging
```bash
# Connect directly
psql postgresql://...

# Query manually
SELECT * FROM hr_employees LIMIT 5;
```

---

## Common Tasks

### Add New Admin Feature

1. Create page: `app/admin/feature/page.tsx`
2. Create component: `components/admin/Feature.tsx`
3. Create API: `app/api/admin/feature/route.ts`
4. Use requireAdminPermission for auth
5. Test locally
6. Push to GitHub (auto-deploys)

### Add SMS Notification

```typescript
import { sendOrderConfirmationSMS } from "@/lib/sms-gateway";

await sendOrderConfirmationSMS({
  customerPhone: "+977...",
  customerName: "John",
  orderId: "ORD-123",
  totalAmount: 5000,
  estimatedDelivery: "2026-08-10"
});
```

### Create Alert

```typescript
import { createManualPaymentAlert } from "@/lib/admin-alerts";

await createManualPaymentAlert({
  orderId: "ORD-123",
  customerName: "John",
  amount: 5000,
  method: "cod"
});
```

---

## Performance Best Practices

1. **Use Server Components** when possible
2. **Minimize Client-side Logic** - keep it simple
3. **Cache Queries** - use appropriate TTLs
4. **Lazy Load** - use React.lazy for components
5. **Optimize Images** - use next/image
6. **Monitor Performance** - check /admin/monitoring

---

## Code Style

### TypeScript
```typescript
// Interfaces over types
interface User {
  id: string;
  name: string;
}

// Use async/await
async function getUser(id: string) {
  return await queryPostgres(...);
}
```

### Naming
- `camelCase` for variables/functions
- `PascalCase` for components/classes
- `UPPER_CASE` for constants

### Comments
- No obvious comments
- Document the "why", not "what"
- Link to issues/PRs when relevant

---

## Testing

### Write Tests

```typescript
// __tests__/example.test.ts
describe('Example', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
```

### Run Tests
```bash
npm test
npm run test:unit
npm run test:integration
```

---

## CI/CD

GitHub Actions configured in `.github/workflows/`:
- Runs on every push
- Lints code
- Runs tests
- Deploys to Vercel

---

## Getting Help

1. Check **docs/** folder
2. Check **github.com/krishoee-skc/krishoe-website** issues
3. Review **/admin/monitoring** for errors
4. Check **API.md** for endpoint docs
5. Email: design.cad.tsa@gmail.com

---

**Version**: 1.0  
**Last Updated**: 2026-08-06
