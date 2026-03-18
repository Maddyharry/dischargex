import { describe, expect, it } from "vitest";
import {
  calculateRenewalStack,
  calculateUpgradeFinalAmount,
  calculateUpgradeCreditCarryover,
  getCreditsRequiredForCase,
  getPeriodBounds,
  normalizePlanId,
} from "../lib/billing-rules";

describe("billing rules", () => {
  it("normalizes legacy plan ids", () => {
    expect(normalizePlanId("basic")).toBe("basic_monthly");
    expect(normalizePlanId("pro")).toBe("pro_monthly");
    expect(normalizePlanId("unknown")).toBe("trial");
  });

  it("calculates prorated upgrade amount deterministically", () => {
    const result = calculateUpgradeFinalAmount({
      currentPlanId: "basic_monthly",
      targetPlanId: "standard_monthly",
      remainingDays: 20,
    });

    expect(result.remainingValue).toBe(199);
    expect(result.finalAmount).toBe(500);
  });

  it("stacks renewal time and credits for same plan", () => {
    const now = new Date("2026-03-10T00:00:00.000Z");
    const currentExpiryDate = new Date("2026-03-20T00:00:00.000Z");
    const result = calculateRenewalStack({
      currentExpiryDate,
      now,
      durationDays: 30,
      remainingCredits: 20,
      creditsPerCycle: 50,
    });

    expect(result.newExpiryDate.toISOString()).toBe("2026-04-19T00:00:00.000Z");
    expect(result.newCreditsRemaining).toBe(70);
  });

  it("carries over only 50% credits on upgrade", () => {
    expect(calculateUpgradeCreditCarryover({ remainingCredits: 0 })).toBe(0);
    expect(calculateUpgradeCreditCarryover({ remainingCredits: 1 })).toBe(0);
    expect(calculateUpgradeCreditCarryover({ remainingCredits: 2 })).toBe(1);
    expect(calculateUpgradeCreditCarryover({ remainingCredits: 21 })).toBe(10);
    expect(calculateUpgradeCreditCarryover({ remainingCredits: 21, carryoverRatio: 0.5 })).toBe(10);
  });

  it("uses yearly duration for yearly plans", () => {
    const start = new Date("2026-03-01T00:00:00.000Z");
    const { end } = getPeriodBounds(start, "pro_yearly");
    const diffDays = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

    expect(diffDays).toBe(365);
  });

  it("charges 2 credits for very long case", () => {
    expect(getCreditsRequiredForCase(5000)).toBe(1);
    expect(getCreditsRequiredForCase(20000)).toBe(2);
  });
});
