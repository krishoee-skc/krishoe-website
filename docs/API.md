# KRISHOE API Documentation

## Base URL

```
Production: https://krishoe-website.vercel.app
Development: http://localhost:3000
```

## Authentication

All API endpoints require admin permission. The app uses session-based authentication.

## Response Format

All API responses return JSON:

```json
{
  "success": true,
  "data": {...},
  "error": null
}
```

---

## Admin APIs

### Dashboard Data
**GET** `/api/admin/dashboard`

Returns quick stats for admin dashboard.

**Response:**
```json
{
  "success": true,
  "data": {
    "todayProduction": 450,
    "pendingPayments": 5,
    "newOrders": 12,
    "lowStockItems": 3,
    "topWorker": "राज कुमार"
  }
}
```

### Worker Analytics
**GET** `/api/admin/workers/metrics`

Returns performance metrics for all workers.

**Response:**
```json
{
  "success": true,
  "workers": [
    {
      "workerId": "1",
      "workerName": "राज कुमार",
      "todayPairs": 60,
      "todayEarnings": 720,
      "qualityRate": 98.5,
      "attendanceRate": 95
    }
  ]
}
```

### SMS Logs
**GET** `/api/admin/sms-logs`

Get SMS message history.

**Query Parameters:**
- `phone`: Filter by phone number
- `limit`: Number of records (default: 100)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "count": 42,
  "messages": [
    {
      "id": "sms-123",
      "phone_number": "+977...",
      "message_text": "Order confirmed",
      "status": "sent",
      "created_at": "2026-08-06T10:30:00Z"
    }
  ]
}
```

### Alert Center
**GET** `/api/admin/alerts`

Get system alerts.

**Query Parameters:**
- `action`: "count" | "stats" | "unread" (default: all)
- `type`: Filter by alert type
- `limit`: Number of records

**Response:**
```json
{
  "success": true,
  "unread_count": 3,
  "alerts": [
    {
      "id": "alert-123",
      "type": "manual_payment",
      "severity": "high",
      "title": "Manual Payment Needed",
      "message": "Order #ORD-123 needs payment",
      "read": false
    }
  ]
}
```

### Monitoring Data
**GET** `/api/admin/monitoring`

Get system monitoring data.

**Query Parameters:**
- `section`: "errors" | "performance" | "uptime" | "health" (default: all)
- `hours`: Time range in hours (default: 24)

**Response:**
```json
{
  "success": true,
  "monitoring": {
    "errors": {
      "totalErrors": 12,
      "errorsByLevel": {"error": 8, "warning": 4}
    },
    "performance": {
      "avgResponseTime": 245,
      "p95ResponseTime": 890,
      "errorRate": 0.5
    },
    "uptime": 99.95,
    "health": {
      "database": true,
      "api": true,
      "email": true,
      "sms": true
    }
  }
}
```

### Advanced Analytics
**GET** `/api/admin/analytics`

Get business analytics data.

**Query Parameters:**
- `section`: "sales" | "production" | "revenue" | "goals" | "workers" (default: all)

**Response:**
```json
{
  "success": true,
  "analytics": {
    "salesTrend": [...],
    "productionTrend": [...],
    "goals": [
      {
        "name": "Monthly Orders",
        "target": 150,
        "achieved": 120,
        "progress": 80
      }
    ]
  }
}
```

---

## Worker APIs

### Worker Dashboard
**GET** `/api/worker/dashboard`

Get worker dashboard data.

**Query Parameters:**
- `workerId`: Worker ID (required)

**Response:**
```json
{
  "success": true,
  "data": {
    "profile": {
      "name": "राज कुमार",
      "department": "Upper",
      "status": "Active"
    },
    "thisMonth": {
      "earnings": 25000,
      "pairs": 430,
      "attendance": 95
    }
  }
}
```

---

## Notification APIs

### Send SMS
**POST** `/api/notifications/sms/send`

Send SMS notification.

**Body:**
```json
{
  "type": "order_confirmed",
  "data": {
    "customerPhone": "+977...",
    "customerName": "John",
    "orderId": "ORD-123",
    "totalAmount": 5000,
    "estimatedDelivery": "2026-08-10"
  }
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "sms-abc123",
  "type": "order_confirmed",
  "sentAt": "2026-08-06T10:30:00Z"
}
```

### Mark Alert as Read
**POST** `/api/admin/alerts`

Mark alert as read or delete.

**Body:**
```json
{
  "action": "mark_read",
  "alertId": "alert-123"
}
```

---

## Order APIs

### Get Orders
**GET** `/api/orders`

Get all orders.

**Response:**
```json
{
  "source": "KRISHOE local order inbox",
  "count": 42,
  "orders": [
    {
      "id": "ORD-123",
      "name": "John Doe",
      "phone": "+977...",
      "total": "5,000",
      "status": "New",
      "paymentStatus": "Unpaid",
      "createdAt": "2026-08-06T10:30:00Z"
    }
  ]
}
```

---

## Error Handling

All errors return appropriate HTTP status codes:

```
400 Bad Request - Invalid parameters
401 Unauthorized - Not authenticated
403 Forbidden - No permission
404 Not Found - Resource not found
500 Internal Server Error - Server error
```

**Error Response:**
```json
{
  "success": false,
  "error": "Description of error"
}
```

---

## Rate Limiting

No rate limits currently enforced, but recommended to implement based on monitoring data.

---

## Webhook Events

Future: Order status updates, payment confirmations, production milestones.

---

## SDK

No official SDK yet. Use direct HTTP requests or look at the frontend code in `/components` for integration examples.

---

## Support

For API issues, check `/admin/monitoring` for error logs and contact admin.
