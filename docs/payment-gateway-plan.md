# KRISHOE eSewa and Khalti Operations Guide

KRISHOE supports `manual`, `sandbox`, and `live` payment modes. The same
server-side verification path is used in sandbox and live; only credentials and
provider base URLs change.

## Security model

- Only a signed-in customer who owns the order can initiate payment.
- The payable amount always comes from the saved order, never from the browser.
- Payments open only after staff changes the order to `Contacted` (stock and
  delivery confirmed).
- A pending attempt blocks a second attempt until its result is resolved. The
  authenticated order page can query the provider directly to reconcile an
  abandoned browser return without asking the customer to pay twice.
- Every eSewa success/failure callback requires all critical signed fields;
  merchant code, gateway-issued payment reference, order amount, and status API
  result are verified before settlement. Status checking is mandatory in live mode.
- Khalti callbacks are bound to the stored `pidx` and always confirmed through
  the server-side lookup API; only `Completed` becomes `Paid`.
- Callback IDs are unique and idempotent. A late failed/pending callback cannot
  downgrade an already paid or refunded order.
- Gateway/API responses use `Cache-Control: no-store` and secrets never reach
  the browser.

## Sandbox configuration

```bash
PAYMENT_MODE=sandbox
PAYMENT_PUBLIC_BASE_URL=https://your-preview-domain.example
ESEWA_MERCHANT_ID=EPAYTEST
ESEWA_SECRET_KEY=your-sandbox-secret
ESEWA_VERIFY_WITH_STATUS_CHECK=true
KHALTI_SECRET_KEY=your-sandbox-live-secret-key
```

Optional sandbox overrides:

```bash
ESEWA_CHECKOUT_URL=https://rc-epay.esewa.com.np/api/epay/main/v2/form
ESEWA_STATUS_CHECK_URL=https://rc.esewa.com.np/api/epay/transaction/status/
KHALTI_API_BASE_URL=https://dev.khalti.com/api/v2
```

Test duplicate callbacks, underpayment, cancellation, expiry, pending status,
missing orders, and provider timeout before enabling live mode.

## Live configuration

Obtain production credentials from the eSewa and Khalti merchant dashboards,
then configure:

```bash
PAYMENT_MODE=live
PAYMENT_PUBLIC_BASE_URL=https://your-final-domain.example
ESEWA_MERCHANT_ID=your-live-product-code
ESEWA_SECRET_KEY=your-live-secret
KHALTI_SECRET_KEY=your-live-secret-key
```

Unless overridden, live mode uses:

- eSewa form: `https://epay.esewa.com.np/api/epay/main/v2/form`
- eSewa status: `https://epay.esewa.com.np/api/epay/transaction/status/`
- Khalti API: `https://khalti.com/api/v2/`

Customer return endpoints:

- `GET|POST /api/payments/esewa/callback`
- `GET|POST /api/payments/khalti/callback`

Authenticated reconciliation endpoints used by the order page:

- `POST /api/payments/esewa/status`
- `POST /api/payments/khalti/status`

After provider verification the customer is redirected to their protected order
page, while the payment transaction appears in Admin → Payments for
reconciliation.

## Go-live checklist

1. Finish merchant KYC and enable production payments with both providers.
2. Store live secrets only in the production environment; never commit them.
3. Confirm the final domain and HTTPS callback URLs in both merchant dashboards.
4. Run one low-value real transaction per provider and reconcile provider,
   order, amount, transaction ID, and status in Admin → Payments.
5. Test cancellation and repeated callback delivery without dispatching goods.
6. Keep `PAYMENT_MODE=manual` until both real smoke tests pass, then change it
   to `live` and redeploy.
