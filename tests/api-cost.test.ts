import { afterEach, describe, expect, it } from "vitest";
import {
  estimateActualApiCostThbByModel,
  estimateActualApiCostThbFromLedgerRows,
  forecastApiCostCapThbFromPlanPrice,
  forecastRevenue5xPeriodCostCapThb,
  EFFECTIVE_FROM,
  isRevenue5xEligible,
  resolveApiCostModelAlias,
} from "../lib/api-cost";

const originalApiFx = process.env.API_COST_USD_TO_THB;
const originalTokenFx = process.env.TOKEN_USD_TO_THB;

afterEach(() => {
  if (originalApiFx === undefined) delete process.env.API_COST_USD_TO_THB;
  else process.env.API_COST_USD_TO_THB = originalApiFx;
  if (originalTokenFx === undefined) delete process.env.TOKEN_USD_TO_THB;
  else process.env.TOKEN_USD_TO_THB = originalTokenFx;
});

describe("actual API cost estimates", () => {
  it("uses known standard rates with the default FX assumption and no markup or minimum fee", () => {
    delete process.env.API_COST_USD_TO_THB;
    delete process.env.TOKEN_USD_TO_THB;

    const result = estimateActualApiCostThbByModel(
      { inputTokens: 100_000, outputTokens: 100_000, totalTokens: 200_000 },
      "gpt-5.4",
    );

    expect(result.status).toBe("known");
    if (result.status !== "known") return;
    expect(result.estimatedCostUsd).toBe(1.75);
    expect(result.estimatedCostThb).toBe(63);
    expect(result.fxSource).toBe("default_assumption");
    expect(result.fxAssumption).toContain("planning assumption");
  });

  it("returns an explicit unknown result for unsupported models, including gpt-5.4-pro", () => {
    expect(estimateActualApiCostThbByModel({ inputTokens: 10, outputTokens: 10 }, "gpt-5.4-pro")).toEqual({
      status: "unknown",
      model: "gpt-5.4-pro",
      reason: "unsupported_model",
      estimatedCostThb: null,
    });
    expect(resolveApiCostModelAlias("gpt-5.4-pro")).toBeNull();
  });

  it("recognizes only exact aliases and valid dated snapshots", () => {
    expect(resolveApiCostModelAlias(" GPT-5.4-2026-03-05 ")).toBe("gpt-5.4");
    expect(resolveApiCostModelAlias("gpt-5.4-2026-02-30")).toBeNull();
    expect(resolveApiCostModelAlias("gpt-5.4-custom")).toBeNull();
  });

  it("prices cached input at the cached-input rate", () => {
    const result = estimateActualApiCostThbByModel(
      { inputTokens: 1_000_000, outputTokens: 0, totalTokens: 1_000_000 },
      "gpt-5.4-mini",
      { cachedInputTokens: 400_000, usdToThb: 36 },
    );

    expect(result.status).toBe("known");
    if (result.status !== "known") return;
    expect(result.estimatedCostUsd).toBeCloseTo(0.48, 10);
    expect(result.estimatedCostThb).toBe(17.28);
  });

  it("applies conservative gpt-5.4 long-context multipliers above 272k tokens per call", () => {
    const short = estimateActualApiCostThbByModel(
      { inputTokens: 272_000, outputTokens: 0, totalTokens: 272_000 },
      "gpt-5.4",
      { usdToThb: 36 },
    );
    const long = estimateActualApiCostThbByModel(
      { inputTokens: 272_001, outputTokens: 0, totalTokens: 272_001 },
      "gpt-5.4",
      { usdToThb: 36 },
    );

    expect(short.status).toBe("known");
    expect(long.status).toBe("known");
    if (short.status !== "known" || long.status !== "known") return;
    expect(short.longContextMultiplierApplied).toBe(false);
    expect(long.longContextMultiplierApplied).toBe(true);
    expect(long.estimatedCostThb).toBeGreaterThan(short.estimatedCostThb);
  });

  it("uses input tokens, not input plus output, for the gpt-5.4 long-context threshold", () => {
    const result = estimateActualApiCostThbByModel(
      { inputTokens: 272_000, outputTokens: 100_000, totalTokens: 372_000 },
      "gpt-5.4",
      { usdToThb: 36 },
    );
    expect(result.status).toBe("known");
    if (result.status === "known") expect(result.longContextMultiplierApplied).toBe(false);
  });

  it("rounds cost to four decimal places and returns unknown for malformed usage", () => {
    const rounded = estimateActualApiCostThbByModel(
      { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      "gpt-4o-mini",
      { usdToThb: 36 },
    );
    const invalid = estimateActualApiCostThbByModel({ inputTokens: -1, outputTokens: 1 }, "gpt-4o-mini");

    expect(rounded.status).toBe("known");
    if (rounded.status === "known") expect(rounded.estimatedCostThb).toBe(0);
    expect(invalid).toMatchObject({ status: "unknown", reason: "invalid_usage", estimatedCostThb: null });
  });
});

describe("5x revenue-to-API-cost caps", () => {
  it.each([
    ["Basic", 299, 59.8],
    ["Standard", 590, 118],
    ["Pro", 1_090, 218],
  ])("calculates the %s monthly cost cap", (_plan, priceThb, expected) => {
    expect(forecastApiCostCapThbFromPlanPrice({ priceThb, billingInterval: "monthly" })).toMatchObject({
      apiCostCapThb: expected,
      periodLabel: "billing_month",
      revenueMultiple: 5,
    });
  });

  it.each([
    ["Basic", 2_990, 598],
    ["Standard", 5_990, 1_198],
    ["Pro", 10_990, 2_198],
  ])("calculates the %s full-year billing-period cap", (_plan, priceThb, expected) => {
    expect(forecastApiCostCapThbFromPlanPrice({ priceThb, billingInterval: "yearly" })).toMatchObject({
      apiCostCapThb: expected,
      periodLabel: "billing_year",
      revenueMultiple: 5,
    });
  });

  it("starts eligibility exactly at the Thailand-time cutoff and keeps earlier periods grandfathered", () => {
    expect(EFFECTIVE_FROM).toBe("2026-10-19T00:00:00+07:00");
    expect(isRevenue5xEligible("2026-10-18T23:59:59+07:00")).toBe(false);
    expect(isRevenue5xEligible(EFFECTIVE_FROM)).toBe(true);
    expect(isRevenue5xEligible(null)).toBe(false);
    expect(isRevenue5xEligible("invalid-date")).toBe(false);
  });

  it("exposes full-period plan cap and rejects invalid prices", () => {
    expect(forecastRevenue5xPeriodCostCapThb(2_990)).toBe(598);
    expect(forecastRevenue5xPeriodCostCapThb(Number.NaN)).toBeNull();
  });

  it("fails closed on unknown ledger models and flags aggregate long-context uncertainty", () => {
    const result = estimateActualApiCostThbFromLedgerRows([
      { model: "gpt-5.4", inputTokens: 300_000, outputTokens: 0 },
      { model: "future-model", inputTokens: 1, outputTokens: 1 },
    ], { usdToThb: 36 });

    expect(result.status).toBe("unknown");
    expect(result.estimatedCostThb).toBeNull();
    expect(result.unknownModelCount).toBe(1);
    expect(result.knownSubtotalThb).toBe(27);
    expect(result.uncertainty.join(" ")).toContain("may combine calls");
    expect(result.safeForEnforcement).toBe(false);
  });

  it("applies the per-call long-context multiplier when ledger provenance proves one provider call", () => {
    const result = estimateActualApiCostThbFromLedgerRows([
      { model: "gpt-5.4", inputTokens: 300_000, outputTokens: 0, source: "summary_provider_call" },
    ], { usdToThb: 36 });
    expect(result).toMatchObject({ status: "known", estimatedCostThb: 54, safeForEnforcement: true });
    expect(result.uncertainty).toEqual([]);
  });

  it("treats an empty successful ledger read as zero known cost", () => {
    const result = estimateActualApiCostThbFromLedgerRows([], { usdToThb: 36 });
    expect(result).toMatchObject({
      status: "known",
      estimatedCostThb: 0,
      knownSubtotalThb: 0,
      rowCount: 0,
      safeForEnforcement: true,
    });
  });

  it("prices ledger input without cache detail as uncached and rounds only after summing", () => {
    const result = estimateActualApiCostThbFromLedgerRows([
      { model: "gpt-5.4-mini", inputTokens: 1, outputTokens: 0 },
      { model: "gpt-5.4-mini", inputTokens: 1, outputTokens: 0 },
    ], { usdToThb: 36 });

    expect(result.status).toBe("known");
    expect(result.estimatedCostThb).toBe(0.0001);
    expect(result.unknownModelCount).toBe(0);
  });
});
