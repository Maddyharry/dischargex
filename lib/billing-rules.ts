export type PlanId =
  | "trial"
  | "basic_monthly"
  | "basic_yearly"
  | "standard_monthly"
  | "standard_yearly"
  | "pro_monthly"
  | "pro_yearly";

export type PlanTier = "trial" | "basic" | "standard" | "pro";
export type BillingCycle = "monthly" | "yearly";

export type PaymentType = "new" | "renewal" | "upgrade" | "downgrade" | "addon";

export type PlanDefinition = {
  id: PlanId;
  tier: PlanTier;
  billingCycle: BillingCycle;
  priceThb: number;
  durationDays: number;
  creditsPerCycle: number;
  creditCycleDays: number;
  isPaid: boolean;
};

export const PLAN_CONFIG: Record<PlanId, PlanDefinition> = {
  trial: {
    id: "trial",
    tier: "trial",
    billingCycle: "monthly",
    priceThb: 0,
    durationDays: 7,
    creditsPerCycle: 10,
    creditCycleDays: 30,
    isPaid: false,
  },
  basic_monthly: {
    id: "basic_monthly",
    tier: "basic",
    billingCycle: "monthly",
    priceThb: 299,
    durationDays: 30,
    creditsPerCycle: 50,
    creditCycleDays: 30,
    isPaid: true,
  },
  basic_yearly: {
    id: "basic_yearly",
    tier: "basic",
    billingCycle: "yearly",
    priceThb: 2990,
    durationDays: 365,
    creditsPerCycle: 50,
    creditCycleDays: 30,
    isPaid: true,
  },
  standard_monthly: {
    id: "standard_monthly",
    tier: "standard",
    billingCycle: "monthly",
    priceThb: 699,
    durationDays: 30,
    creditsPerCycle: 120,
    creditCycleDays: 30,
    isPaid: true,
  },
  standard_yearly: {
    id: "standard_yearly",
    tier: "standard",
    billingCycle: "yearly",
    priceThb: 6990,
    durationDays: 365,
    creditsPerCycle: 120,
    creditCycleDays: 30,
    isPaid: true,
  },
  pro_monthly: {
    id: "pro_monthly",
    tier: "pro",
    billingCycle: "monthly",
    priceThb: 1490,
    durationDays: 30,
    creditsPerCycle: 250,
    creditCycleDays: 30,
    isPaid: true,
  },
  pro_yearly: {
    id: "pro_yearly",
    tier: "pro",
    billingCycle: "yearly",
    priceThb: 14900,
    durationDays: 365,
    creditsPerCycle: 250,
    creditCycleDays: 30,
    isPaid: true,
  },
};

export type AddonCreditOption = {
  credits: number;
  priceThb: number;
};

export const ADDON_OPTIONS: AddonCreditOption[] = [
  { credits: 50, priceThb: 200 },
  { credits: 100, priceThb: 350 },
];

const PLAN_ALIAS: Record<string, PlanId> = {
  trial: "trial",
  basic: "basic_monthly",
  standard: "standard_monthly",
  pro: "pro_monthly",
  basic_monthly: "basic_monthly",
  basic_yearly: "basic_yearly",
  standard_monthly: "standard_monthly",
  standard_yearly: "standard_yearly",
  pro_monthly: "pro_monthly",
  pro_yearly: "pro_yearly",
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizePlanId(rawPlan: string | null | undefined): PlanId {
  const key = String(rawPlan || "trial").trim().toLowerCase();
  return PLAN_ALIAS[key] ?? "trial";
}

export function getPlanDefinition(rawPlan: string | null | undefined): PlanDefinition {
  const normalized = normalizePlanId(rawPlan);
  return PLAN_CONFIG[normalized];
}

export function getPeriodBounds(periodStart: Date, rawPlan: string | null | undefined) {
  const plan = getPlanDefinition(rawPlan);
  const start = new Date(periodStart.getTime());
  const end = new Date(start.getTime() + plan.durationDays * DAY_MS);
  return { start, end };
}

export function getCreditCycleBounds(
  periodStart: Date,
  rawPlan: string | null | undefined,
  now: Date
) {
  const plan = getPlanDefinition(rawPlan);
  const elapsedMs = Math.max(0, now.getTime() - periodStart.getTime());
  const elapsedDays = Math.floor(elapsedMs / DAY_MS);
  const cycleIndex = Math.floor(elapsedDays / plan.creditCycleDays);

  const cycleStart = new Date(periodStart.getTime() + cycleIndex * plan.creditCycleDays * DAY_MS);
  const cycleEnd = new Date(cycleStart.getTime() + plan.creditCycleDays * DAY_MS);
  return { cycleStart, cycleEnd, cycleIndex };
}

export function daysLeftUntil(targetDate: Date, now: Date): number {
  if (now.getTime() >= targetDate.getTime()) return 0;
  return Math.ceil((targetDate.getTime() - now.getTime()) / DAY_MS);
}

export function planRank(rawPlan: string | null | undefined): number {
  const tier = getPlanDefinition(rawPlan).tier;
  if (tier === "trial") return 0;
  if (tier === "basic") return 1;
  if (tier === "standard") return 2;
  return 3;
}

export function comparePlanPriceThb(
  aPlanId: string | null | undefined,
  bPlanId: string | null | undefined
): number {
  const a = getPlanDefinition(aPlanId).priceThb;
  const b = getPlanDefinition(bPlanId).priceThb;
  return a === b ? 0 : a > b ? 1 : -1;
}

export function classifyPaidPlanChange(params: {
  currentPlanId: string | null | undefined;
  targetPlanId: string | null | undefined;
  activeSubscription: boolean;
}): PaymentType {
  const current = normalizePlanId(params.currentPlanId);
  const target = normalizePlanId(params.targetPlanId);
  if (!params.activeSubscription || !isPaidPlan(current)) return "new";
  if (target === current) return "renewal";

  const rankDiff = planRank(target) - planRank(current);
  if (rankDiff > 0) return "upgrade";
  if (rankDiff < 0) return "downgrade";

  // Same tier: decide by price (e.g., monthly -> yearly is typically more expensive)
  const priceCmp = comparePlanPriceThb(target, current);
  if (priceCmp > 0) return "upgrade";
  if (priceCmp < 0) return "downgrade";
  return "renewal";
}

export function roundThb(value: number): number {
  return Math.round(value);
}

export function calculateUpgradeFinalAmount(params: {
  currentPlanId: string | null | undefined;
  targetPlanId: string | null | undefined;
  remainingDays: number;
}): { remainingValue: number; finalAmount: number } {
  const currentPlan = getPlanDefinition(params.currentPlanId);
  const targetPlan = getPlanDefinition(params.targetPlanId);
  const remainingValue =
    (Math.max(0, params.remainingDays) / currentPlan.durationDays) * currentPlan.priceThb;
  const finalAmount = Math.max(0, roundThb(targetPlan.priceThb - remainingValue));
  return { remainingValue: roundThb(remainingValue), finalAmount };
}

export function calculateUpgradeCreditCarryover(params: {
  remainingCredits: number;
  carryoverRatio?: number; // default 0.5
}): number {
  const ratio = params.carryoverRatio ?? 0.5;
  const remaining = Number.isFinite(params.remainingCredits) ? Math.max(0, params.remainingCredits) : 0;
  const r = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0.5;
  return Math.floor(remaining * r);
}

export function calculateRenewalStack(params: {
  currentExpiryDate: Date;
  now: Date;
  durationDays: number;
  remainingCredits: number;
  creditsPerCycle: number;
}) {
  const renewalStart =
    params.currentExpiryDate.getTime() > params.now.getTime() ? params.currentExpiryDate : params.now;
  const newExpiryDate = new Date(renewalStart.getTime() + params.durationDays * DAY_MS);
  const newCreditsRemaining = params.remainingCredits + params.creditsPerCycle;
  return {
    newExpiryDate,
    newCreditsRemaining,
  };
}

export function getAddonPrice(credits: number): number | null {
  const option = ADDON_OPTIONS.find((entry) => entry.credits === credits);
  return option ? option.priceThb : null;
}

export function getLongCaseThresholdChars(): number {
  const fromEnv = Number(process.env.LONG_CASE_CHAR_THRESHOLD || "12000");
  if (Number.isFinite(fromEnv) && fromEnv >= 1000) return Math.floor(fromEnv);
  return 12000;
}

export function getCreditsRequiredForCase(totalInputChars: number): number {
  return totalInputChars >= getLongCaseThresholdChars() ? 2 : 1;
}

export function isPaidPlan(rawPlan: string | null | undefined): boolean {
  return getPlanDefinition(rawPlan).isPaid;
}
