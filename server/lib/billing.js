export const PLAN_PRICING_MONTHLY_INR = {
  starter: 1999,
  growth: 4999,
  scale: 9999,
  enterprise: 19999,
};

export const CYCLE_MONTHS = {
  monthly: 1,
  quarterly: 3,
  annual: 12,
};

export function normalizePlanKey(planName = "") {
  const key = String(planName).trim().toLowerCase();
  if (key in PLAN_PRICING_MONTHLY_INR) return key;
  if (key.includes("starter")) return "starter";
  if (key.includes("scale")) return "scale";
  if (key.includes("enterprise")) return "enterprise";
  return "growth";
}

export function planAmountForCycle(planName, billingCycle) {
  const key = normalizePlanKey(planName);
  const monthly = PLAN_PRICING_MONTHLY_INR[key] ?? PLAN_PRICING_MONTHLY_INR.growth;
  const months = CYCLE_MONTHS[billingCycle] ?? 12;
  return monthly * months;
}

export function addMonths(iso, months) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function computeUpgradeProration({ fromPlan, toPlan, billingCycle, renewalDate }) {
  const currentAmount = planAmountForCycle(fromPlan, billingCycle);
  const targetAmount = planAmountForCycle(toPlan, billingCycle);
  const delta = Math.max(0, targetAmount - currentAmount);
  if (delta === 0) return 0;
  const now = Date.now();
  const renewal = new Date(renewalDate).getTime();
  if (!Number.isFinite(renewal) || renewal <= now) return delta;
  const cycleMs = (CYCLE_MONTHS[billingCycle] ?? 12) * 30 * 24 * 60 * 60 * 1000;
  const remainingMs = Math.max(0, renewal - now);
  const ratio = Math.max(0, Math.min(1, remainingMs / cycleMs));
  return Math.round(delta * ratio);
}
