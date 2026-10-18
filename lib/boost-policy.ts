import { getCreditsRequiredForCase } from "@/lib/billing-rules";

export type BoostGateInput = {
  requested: boolean;
  passesRequired: number;
  passesAvailable: number;
  subscriptionActive: boolean;
  usageKnown: boolean;
  usageSafe: boolean;
  dailyBlocked: boolean;
  periodBlocked: boolean;
  legacyCreditsBlocked?: boolean;
};

export type BoostGateResult = {
  authorized: boolean;
  blocked: boolean;
  canOffer: boolean;
  reason: "none" | "not_requested" | "inactive" | "usage_unknown" | "not_blocked" | "insufficient_passes";
};

export function getBoostPassesRequired(input: { totalInputChars: number; imageCount?: number }): number {
  if (!Number.isFinite(input.totalInputChars) || input.totalInputChars < 0) return 0;
  if (Number.isFinite(input.imageCount) && (input.imageCount ?? 0) > 0) return 2;
  return getCreditsRequiredForCase(input.totalInputChars);
}

/** Pure gate: stored passes never auto-activate; only an explicit request can authorize bypass. */
export function evaluateBoostGate(input: BoostGateInput): BoostGateResult {
  const blocked = input.dailyBlocked || input.periodBlocked || Boolean(input.legacyCreditsBlocked);
  if (!blocked) return { authorized: false, blocked: false, canOffer: false, reason: "not_blocked" };
  if (!input.subscriptionActive) return { authorized: false, blocked: true, canOffer: false, reason: "inactive" };
  if (!input.usageKnown || !input.usageSafe) return { authorized: false, blocked: true, canOffer: false, reason: "usage_unknown" };
  if (!Number.isInteger(input.passesRequired) || input.passesRequired <= 0) return { authorized: false, blocked: true, canOffer: false, reason: "not_blocked" };
  const enoughPasses = Number.isInteger(input.passesRequired) && input.passesRequired > 0 &&
    Number.isInteger(input.passesAvailable) && input.passesAvailable >= input.passesRequired;
  if (!input.requested) return { authorized: false, blocked: true, canOffer: true, reason: "not_requested" };
  if (!enoughPasses) return { authorized: false, blocked: true, canOffer: true, reason: "insufficient_passes" };
  return { authorized: true, blocked: true, canOffer: true, reason: "none" };
}

export function projectBoostCaseCost(input: {
  projectedSoFarThb: number;
  nextCallCostThb: number | null;
  passes: number;
  usageSafe: boolean;
}): { allowed: boolean; projectedTotalThb: number | null; allowanceThb: number; reason: "ok" | "unknown" | "over_limit" } {
  const allowanceThb = input.passes * 4.36;
  if (!input.usageSafe || input.nextCallCostThb === null ||
      !Number.isFinite(input.nextCallCostThb) || input.nextCallCostThb < 0 ||
      !Number.isFinite(input.projectedSoFarThb) || input.projectedSoFarThb < 0) {
    return { allowed: false, projectedTotalThb: null, allowanceThb, reason: "unknown" };
  }
  const projectedTotalThb = input.projectedSoFarThb + input.nextCallCostThb;
  if (!Number.isInteger(input.passes) || input.passes <= 0 || projectedTotalThb > allowanceThb) {
    return { allowed: false, projectedTotalThb, allowanceThb, reason: "over_limit" };
  }
  return { allowed: true, projectedTotalThb, allowanceThb, reason: "ok" };
}
