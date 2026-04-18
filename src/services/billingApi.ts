export type BillingCheckoutPayload = {
  tenantId: string;
  subscriptionId?: string;
  type: "renewal" | "upgrade" | "downgrade";
  billingCycle: "monthly" | "quarterly" | "annual";
  fromPlan: string;
  toPlan?: string;
  amount?: number;
};

function getBaseUrl() {
  return ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_BILLING_API_BASE_URL || "").replace(/\/$/, "");
}

export async function postBillingCheckout(payload: BillingCheckoutPayload) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new Error("VITE_BILLING_API_BASE_URL is not configured.");
  const response = await fetch(`${baseUrl}/billing/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Checkout failed (${response.status})`);
  }
  return response.json();
}

export async function postPaymentWebhook(eventType: "payment.success" | "payment.failed", billingRecordId: string, options?: { paymentId?: string; reason?: string }) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new Error("VITE_BILLING_API_BASE_URL is not configured.");
  const response = await fetch(`${baseUrl}/webhooks/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, billingRecordId, ...options }),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Webhook failed (${response.status})`);
  }
  return response.json();
}

export async function fetchBillingHistory(tenantId: string) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new Error("VITE_BILLING_API_BASE_URL is not configured.");
  const response = await fetch(`${baseUrl}/billing/history/${tenantId}`);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to fetch billing history (${response.status})`);
  }
  return response.json();
}

export async function patchSubscription(
  subscriptionId: string,
  payload: {
    action: "renew" | "upgrade" | "schedule_downgrade";
    planTo?: string;
    effectiveDate?: string;
    billingCycle?: "monthly" | "quarterly" | "annual";
    autoRenew?: boolean;
  },
) {
  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new Error("VITE_BILLING_API_BASE_URL is not configured.");
  const response = await fetch(`${baseUrl}/subscriptions/${subscriptionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Failed to patch subscription (${response.status})`);
  }
  return response.json();
}
