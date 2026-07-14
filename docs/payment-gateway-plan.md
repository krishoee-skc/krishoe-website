# KRISHOE Payment Gateway Plan

This phase adds sandbox-safe eSewa and Khalti payment routes without enabling
live money movement.

## Current Scope

- `POST /api/payments/esewa/initiate`
- `POST /api/payments/khalti/initiate`
- `GET|POST /api/payments/esewa/callback`
- `GET|POST /api/payments/khalti/callback`

The routes only mutate payment state when `PAYMENT_MODE=sandbox`. In `manual`
mode they stay disabled. In `live` mode callbacks are blocked until merchant
live credentials, production URLs, and provider-side verification are tested.

## Required Sandbox Env

```bash
PAYMENT_MODE=sandbox
ESEWA_MERCHANT_ID=...
ESEWA_SECRET_KEY=...
ESEWA_VERIFY_WITH_STATUS_CHECK=false
KHALTI_SECRET_KEY=...
```

Optional checkout URL overrides:

```bash
ESEWA_CHECKOUT_URL=...
ESEWA_STATUS_CHECK_URL=...
KHALTI_API_BASE_URL=https://dev.khalti.com/api/v2
```

## Sandbox Initiation

```bash
curl -X POST http://localhost:3002/api/payments/esewa/initiate \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"KRS-ORD-...\",\"amount\":1500}"
```

The response includes sandbox success and failure callback URLs. Those URLs are
for local testing only; they are not final provider checkout URLs.

For eSewa, the response also includes a `gatewayPayload` object containing:

- `formUrl`
- `method: POST`
- ePay v2 form fields
- HMAC-SHA256 base64 `signature`

The eSewa signature is generated from:

```text
total_amount=<amount>,transaction_uuid=<reference>,product_code=<merchant-code>
```

For Khalti, the route calls the official KPG initiate endpoint:

```text
POST https://dev.khalti.com/api/v2/epayment/initiate/
```

Khalti expects `amount` in paisa. The app stores KRISHOE payment history in
rupees, but sends `amount * 100` to Khalti and stores the returned `pidx` as the
payment reference while the payment is pending.

```bash
curl -X POST http://localhost:3002/api/payments/khalti/initiate \
  -H "Content-Type: application/json" \
  -d "{\"orderId\":\"KRS-ORD-...\",\"amount\":1500}"
```

## eSewa Callback Verification

The eSewa callback adapter accepts the official Base64 encoded `data` response.
It decodes the JSON payload, verifies the response signature using
`signed_field_names`, checks `product_code`, checks the order amount, and only
then updates the order/payment history.

When `ESEWA_VERIFY_WITH_STATUS_CHECK=true`, the adapter also calls the eSewa
status-check API before accepting a successful payment. The default status check
URL is the eSewa RC endpoint:

```text
https://rc.esewa.com.np/api/epay/transaction/status/
```

## Khalti Callback Verification

The Khalti callback adapter requires `pidx`, then calls the official KPG lookup
endpoint before updating an order:

```text
POST https://dev.khalti.com/api/v2/epayment/lookup/
```

Only `Completed` is mapped to `Paid`. `Expired`, `User canceled`, `Canceled`,
and `Failed` are mapped to `Failed`; `Refunded` and `Partially refunded` are
mapped to `Refunded`; all other states remain `Pending`. The lookup
`total_amount` is compared against the KRISHOE order total in paisa before a
transaction is recorded.

## Callback Idempotency

Callbacks generate a provider-scoped callback id from gateway fields such as
`pidx`, `refId`, `transaction_uuid`, or a payload hash. If the same callback id
is received again, the route returns the existing payment transaction and does
not update the order twice.

Postgres also protects this with:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_callback_id_unique_idx
  ON payment_transactions(payment_callback_id)
  WHERE payment_callback_id IS NOT NULL AND payment_callback_id <> '';
```

## Before Live

- Verify server-side before marking any live payment `Paid`.
- Keep callback idempotency enabled.
- Test duplicate callbacks, failed payments, cancelled payments, amount mismatch,
  and missing orders in preview before production.
- Replace sandbox URLs/keys with production merchant credentials only after
  successful provider dashboard testing.
