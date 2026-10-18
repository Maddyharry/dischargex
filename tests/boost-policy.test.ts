import { describe, expect, it } from "vitest";
import { evaluateBoostGate, getBoostPassesRequired, projectBoostCaseCost } from "../lib/boost-policy";

const activeKnown = { subscriptionActive: true, usageKnown: true, usageSafe: true };

describe("Boost policy", () => {
  it("never authorizes daily or period bypass without explicit activation", () => {
    for (const blocked of [{ dailyBlocked: true, periodBlocked: false }, { dailyBlocked: false, periodBlocked: true }]) {
      expect(evaluateBoostGate({ ...activeKnown, ...blocked, requested: false, passesRequired: 1, passesAvailable: 5 })).toMatchObject({ authorized: false, blocked: true, canOffer: true, reason: "not_requested" });
    }
  });

  it("authorizes either daily or period bypass only with explicit activation and sufficient passes", () => {
    for (const blocked of [{ dailyBlocked: true, periodBlocked: false }, { dailyBlocked: false, periodBlocked: true }]) {
      expect(evaluateBoostGate({ ...activeKnown, ...blocked, requested: true, passesRequired: 1, passesAvailable: 1 }).authorized).toBe(true);
    }
  });

  it("fails closed for inactive or unknown/unsafe usage", () => {
    expect(evaluateBoostGate({ ...activeKnown, subscriptionActive: false, requested: true, dailyBlocked: true, periodBlocked: false, passesRequired: 1, passesAvailable: 1 }).canOffer).toBe(false);
    expect(evaluateBoostGate({ ...activeKnown, usageKnown: false, requested: true, dailyBlocked: true, periodBlocked: false, passesRequired: 1, passesAvailable: 1 }).authorized).toBe(false);
    expect(evaluateBoostGate({ ...activeKnown, usageSafe: false, requested: true, dailyBlocked: false, periodBlocked: true, passesRequired: 1, passesAvailable: 1 }).reason).toBe("usage_unknown");
  });

  it("requires two passes for image or long cases and denies insufficient balance", () => {
    expect(getBoostPassesRequired({ totalInputChars: 1000 })).toBe(1);
    expect(getBoostPassesRequired({ totalInputChars: 20_000 })).toBe(2);
    expect(getBoostPassesRequired({ totalInputChars: 100, imageCount: 1 })).toBe(2);
    const gate = (passesAvailable: number) => evaluateBoostGate({ ...activeKnown, requested: true, dailyBlocked: true, periodBlocked: false, passesRequired: 2, passesAvailable });
    expect(gate(1)).toMatchObject({ authorized: false, canOffer: true, reason: "insufficient_passes" });
    expect(gate(2).authorized).toBe(true);
  });

  it("offers a Boost before provider authorization when legacy base credits are short", () => {
    const blocked = { ...activeKnown, requested: false, dailyBlocked: false, periodBlocked: false, legacyCreditsBlocked: true, passesRequired: 1, passesAvailable: 1 };
    expect(evaluateBoostGate(blocked)).toMatchObject({ authorized: false, blocked: true, canOffer: true });
    expect(evaluateBoostGate({ ...blocked, requested: true }).authorized).toBe(true);
    expect(evaluateBoostGate({ ...blocked, requested: true, passesAvailable: 0 }).authorized).toBe(false);
  });

  it("keeps ordinary requests from consuming passes when no cap blocks", () => {
    expect(evaluateBoostGate({ ...activeKnown, requested: false, dailyBlocked: false, periodBlocked: false, legacyCreditsBlocked: false, passesRequired: 1, passesAvailable: 5 })).toMatchObject({ authorized: false, blocked: false, canOffer: false });
  });

  it("bounds cumulative OCR and model projections at 4.36 THB per pass", () => {
    const ocr = projectBoostCaseCost({ projectedSoFarThb: 0, nextCallCostThb: 3, passes: 1, usageSafe: true });
    expect(ocr.allowed).toBe(true);
    expect(projectBoostCaseCost({ projectedSoFarThb: 3, nextCallCostThb: 1.36, passes: 1, usageSafe: true }).allowed).toBe(true);
    expect(projectBoostCaseCost({ projectedSoFarThb: ocr.projectedTotalThb!, nextCallCostThb: 1.37, passes: 1, usageSafe: true }).reason).toBe("over_limit");
    expect(projectBoostCaseCost({ projectedSoFarThb: 0, nextCallCostThb: 8.72, passes: 2, usageSafe: true }).allowed).toBe(true);
    expect(projectBoostCaseCost({ projectedSoFarThb: 8.72, nextCallCostThb: 0.01, passes: 2, usageSafe: true }).allowed).toBe(false);
    expect(projectBoostCaseCost({ projectedSoFarThb: 0, nextCallCostThb: null, passes: 1, usageSafe: false }).reason).toBe("unknown");
  });
});
