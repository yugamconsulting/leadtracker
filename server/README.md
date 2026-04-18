# Billing API (Phase 1-3 Backend Scaffold)

This API provides the backend endpoints for license billing flows.

## Run locally

```bash
node server/index.js
```

Server starts at `http://localhost:8787` by default.

## Endpoints

### POST `/billing/checkout`
Creates a billing record for renewal/upgrade/downgrade checkout.

### POST `/webhooks/payment`
Processes payment success/failure callbacks and updates subscription status.

### GET `/billing/history/:tenantId`
Returns billing history + current subscription for a tenant.

### PATCH `/subscriptions/:id`
Manual renew, immediate upgrade, or scheduled downgrade.

## Frontend wiring

Set this env var in your app deployment:

`VITE_BILLING_API_BASE_URL=http://localhost:8787`

When set, the frontend billing flow uses backend endpoints first, then falls back to demo webhook mode when not configured.
