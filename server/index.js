import cors from "cors";
import express from "express";
import { z } from "zod";
import { readDb, writeDb, makeId } from "./lib/db.js";
import { addMonths, computeUpgradeProration, CYCLE_MONTHS, planAmountForCycle, todayIsoDate } from "./lib/billing.js";

const app = express();
app.use(cors());
app.use(express.json());

const checkoutSchema = z.object({
  tenantId: z.string().min(1),
  subscriptionId: z.string().optional(),
  type: z.enum(["renewal", "upgrade", "downgrade"]),
  billingCycle: z.enum(["monthly", "quarterly", "annual"]).default("annual"),
  fromPlan: z.string().min(1),
  toPlan: z.string().optional(),
  amount: z.number().nonnegative().optional(),
});

const webhookSchema = z.object({
  eventType: z.enum(["payment.success", "payment.failed"]),
  billingRecordId: z.string().min(1),
  paymentId: z.string().optional(),
  reason: z.string().optional(),
});

const patchSubscriptionSchema = z.object({
  action: z.enum(["renew", "upgrade", "schedule_downgrade"]),
  planTo: z.string().optional(),
  effectiveDate: z.string().optional(),
  billingCycle: z.enum(["monthly", "quarterly", "annual"]).optional(),
  autoRenew: z.boolean().optional(),
});

function getOrCreateSubscription(db, payload) {
  const now = new Date().toISOString();
  let sub = db.subscriptions.find((entry) => entry.id === payload.subscriptionId);
  if (!sub) {
    sub = {
      id: payload.subscriptionId || makeId("sub"),
      tenantId: payload.tenantId,
      planName: payload.fromPlan,
      billingCycle: payload.billingCycle,
      autoRenew: true,
      renewalDate: addMonths(now, CYCLE_MONTHS[payload.billingCycle] ?? 12),
      graceEndsAt: "",
      status: "active",
      retryCount: 0,
      nextRetryAt: "",
      scheduledDowngradePlanName: "",
      scheduledDowngradeAt: "",
      updatedAt: now,
    };
    db.subscriptions.push(sub);
  }
  return sub;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "billing-api", time: new Date().toISOString() });
});

app.post("/billing/checkout", (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }
  const db = readDb();
  const payload = parsed.data;
  const sub = getOrCreateSubscription(db, payload);

  const planTo = payload.toPlan || payload.fromPlan;
  const amount = payload.amount ?? (
    payload.type === "upgrade"
      ? computeUpgradeProration({
          fromPlan: payload.fromPlan,
          toPlan: planTo,
          billingCycle: payload.billingCycle,
          renewalDate: sub.renewalDate,
        })
      : planAmountForCycle(planTo, payload.billingCycle)
  );

  const record = {
    id: makeId("bill"),
    tenantId: payload.tenantId,
    subscriptionId: sub.id,
    type: payload.type,
    status: "pending",
    planFrom: payload.fromPlan,
    planTo,
    amount,
    currency: "INR",
    gateway: "manual",
    attemptCount: 1,
    dueDate: todayIsoDate(),
    createdAt: new Date().toISOString(),
    paidAt: "",
    failedAt: "",
    failureReason: "",
    gatewayRef: "",
  };
  db.billingRecords.unshift(record);
  writeDb(db);

  return res.status(201).json({
    billingRecord: record,
    checkoutId: record.id,
    checkoutUrl: `/billing/checkout/${record.id}`,
  });
});

app.post("/webhooks/payment", (req, res) => {
  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }
  const db = readDb();
  const payload = parsed.data;
  const record = db.billingRecords.find((row) => row.id === payload.billingRecordId);
  if (!record) {
    return res.status(404).json({ error: "Billing record not found" });
  }

  const sub = db.subscriptions.find((entry) => entry.id === record.subscriptionId);
  const now = new Date().toISOString();
  if (payload.eventType === "payment.success") {
    record.status = "paid";
    record.paidAt = now;
    record.gatewayRef = payload.paymentId || record.gatewayRef || makeId("pay");
    record.failureReason = "";
    if (sub) {
      sub.planName = record.planTo;
      sub.status = "active";
      sub.retryCount = 0;
      sub.nextRetryAt = "";
      sub.graceEndsAt = "";
      if (record.type === "renewal") {
        sub.renewalDate = addMonths(now, CYCLE_MONTHS[sub.billingCycle] ?? 12);
      }
      if (record.type === "downgrade") {
        sub.scheduledDowngradePlanName = "";
        sub.scheduledDowngradeAt = "";
      }
      sub.updatedAt = now;
    }
  } else {
    record.status = "failed";
    record.failedAt = now;
    record.failureReason = payload.reason || "Payment failed";
    if (sub) {
      sub.status = "renewal_due";
      sub.retryCount = Number(sub.retryCount || 0) + 1;
      sub.nextRetryAt = addMonths(now, 0).slice(0, 10);
      const graceEnd = new Date(now);
      graceEnd.setDate(graceEnd.getDate() + 7);
      sub.graceEndsAt = graceEnd.toISOString().slice(0, 10);
      sub.updatedAt = now;
    }
  }

  writeDb(db);
  return res.json({ ok: true, status: record.status, billingRecordId: record.id });
});

app.get("/billing/history/:tenantId", (req, res) => {
  const { tenantId } = req.params;
  const db = readDb();
  const history = db.billingRecords
    .filter((row) => row.tenantId === tenantId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const subscription = db.subscriptions.find((entry) => entry.tenantId === tenantId) || null;
  return res.json({ tenantId, subscription, history });
});

app.patch("/subscriptions/:id", (req, res) => {
  const parsed = patchSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
  }
  const db = readDb();
  const sub = db.subscriptions.find((entry) => entry.id === req.params.id);
  if (!sub) {
    return res.status(404).json({ error: "Subscription not found" });
  }

  const payload = parsed.data;
  const now = new Date().toISOString();
  if (payload.billingCycle) sub.billingCycle = payload.billingCycle;
  if (typeof payload.autoRenew === "boolean") sub.autoRenew = payload.autoRenew;

  if (payload.action === "renew") {
    sub.status = "active";
    sub.renewalDate = addMonths(now, CYCLE_MONTHS[sub.billingCycle] ?? 12);
    sub.retryCount = 0;
    sub.nextRetryAt = "";
    sub.graceEndsAt = "";
  }

  if (payload.action === "upgrade") {
    if (!payload.planTo) {
      return res.status(400).json({ error: "planTo is required for upgrade" });
    }
    const proratedAmount = computeUpgradeProration({
      fromPlan: sub.planName,
      toPlan: payload.planTo,
      billingCycle: sub.billingCycle,
      renewalDate: sub.renewalDate,
    });
    sub.planName = payload.planTo;
    sub.status = "active";
    sub.updatedAt = now;
    writeDb(db);
    return res.json({ ok: true, subscription: sub, proratedAmount });
  }

  if (payload.action === "schedule_downgrade") {
    if (!payload.planTo || !payload.effectiveDate) {
      return res.status(400).json({ error: "planTo and effectiveDate are required for scheduled downgrade" });
    }
    sub.scheduledDowngradePlanName = payload.planTo;
    sub.scheduledDowngradeAt = payload.effectiveDate;
  }

  sub.updatedAt = now;
  writeDb(db);
  return res.json({ ok: true, subscription: sub });
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Billing API listening on http://localhost:${port}`);
});
