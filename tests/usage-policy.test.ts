import { describe, expect, it } from "vitest";
import { EFFECTIVE_FROM } from "../lib/api-cost";
import {
  getUsagePolicySnapshot,
  selectUsagePolicyLedgerRows,
  type UsagePolicyUserFields,
} from "../lib/usage-policy";

const NOW = new Date("2026-10-20T12:00:00+07:00");
const BASE: UsagePolicyUserFields = {
  planId: "basic_monthly",
  subscriptionStatus: "active",
  periodStartedAt: EFFECTIVE_FROM,
  expiresAt: "2026-11-18T17:00:00.000Z",
  legacyCalendarMonthCapThb: 100,
  ledgerRows: [],
};

describe("getUsagePolicySnapshot", () => {
  it("uses the full monthly 5x cap and treats a successful empty ledger as zero", () => {
    const snapshot = getUsagePolicySnapshot(BASE, NOW);
    expect(snapshot).toMatchObject({
      mode: "revenue_5x", capThb: 59.8, spendThb: 0, remainingThb: 59.8,
      allowed: true, status: "active", costEstimate: { status: "known", basis: "actual_api_standard_rates" },
      actualApiCostEstimate: { status: "known", estimatedCostThb: 0 },
    });
  });

  it("grandfathers an existing paid billing period and sums legacy internal amounts", () => {
    const snapshot = getUsagePolicySnapshot({
      ...BASE,
      periodStartedAt: "2026-10-18T23:59:59+07:00",
      ledgerRows: [{
        createdAt: NOW, model: "unknown-but-legacy-does-not-reprice", inputTokens: 1,
        outputTokens: 2, estimatedCostThb: 12.345,
      }],
    }, NOW);
    expect(snapshot).toMatchObject({
      mode: "legacy_internal", capThb: 100, spendThb: 12.345,
      costEstimate: { basis: "legacy_internal", status: "known" },
      actualApiCostEstimate: { status: "unknown", unknownModelCount: 1 },
    });
  });

  it("does not infer cutoff eligibility when the paid period start is missing", () => {
    expect(getUsagePolicySnapshot({ ...BASE, periodStartedAt: null }, NOW).mode).toBe("legacy_internal");
  });

  it("uses the full annual price / 5 rather than a monthly slice", () => {
    const snapshot = getUsagePolicySnapshot({ ...BASE, planId: "standard_yearly" }, NOW);
    expect(snapshot.capThb).toBe(1198);
  });

  it("selects per-call rows for revenue mode and aggregate rows for legacy mode without double-counting", () => {
    const rows = [
      { source: "summary_generate", referenceId: "job-1", id: "aggregate" },
      { source: "summary_provider_call", referenceId: "job-1", id: "provider-1" },
      { source: "summary_provider_call", referenceId: "job-1", id: "provider-2" },
      { source: "summary_image_ocr", referenceId: "job-1", id: "ocr" },
      { source: "summary_generate", referenceId: "history-no-calls", id: "fallback" },
      { source: "summary_provider_call", referenceId: "partial-no-final", id: "partial" },
      { source: "summary_recalc", referenceId: null, id: "unlinked-aggregate" },
    ];
    expect(selectUsagePolicyLedgerRows(rows, "revenue_5x").map((row) => row.id)).toEqual([
      "provider-1", "provider-2", "ocr", "fallback", "partial", "unlinked-aggregate",
    ]);
    expect(selectUsagePolicyLedgerRows(rows, "legacy_internal").map((row) => row.id)).toEqual([
      "aggregate", "ocr", "fallback", "partial", "unlinked-aggregate",
    ]);
  });

  it("uses per-call actual cost instead of its matching aggregate in new policy", () => {
    const rows: UsagePolicyUserFields["ledgerRows"] = [
      { createdAt: "2026-10-20T01:00:00Z", source: "summary_generate", referenceId: "job-x", model: "gpt-5.4", inputTokens: 300_000, outputTokens: 0, estimatedCostThb: 27 },
      { createdAt: "2026-10-20T01:00:00Z", source: "summary_provider_call", referenceId: "job-x", model: "gpt-5.4", inputTokens: 300_000, outputTokens: 0, estimatedCostThb: 54 },
    ];
    const snapshot = getUsagePolicySnapshot({ ...BASE, ledgerRows: rows }, NOW);
    expect(snapshot).toMatchObject({ spendThb: 54, actualApiCostEstimate: { status: "known", safeForEnforcement: true } });
  });

  it("includes unmatched partial provider calls and fails closed when their model is unknown", () => {
    const snapshot = getUsagePolicySnapshot({
      ...BASE,
      ledgerRows: [{
        createdAt: NOW, source: "summary_provider_call", referenceId: "failed-job",
        model: null, inputTokens: 30, outputTokens: 20, estimatedCostThb: 0,
      }],
    }, NOW);
    expect(snapshot).toMatchObject({
      allowed: false,
      costEstimate: { status: "unknown", unknownModelCount: 1 },
    });
  });

  it("does not allow a future billing period before its start time", () => {
    const snapshot = getUsagePolicySnapshot({
      ...BASE,
      periodStartedAt: "2026-10-21T00:00:00+07:00",
      expiresAt: "2026-11-20T00:00:00+07:00",
    }, NOW);
    expect(snapshot).toMatchObject({ mode: "revenue_5x", status: "not_started", allowed: false });
  });

  it("fails closed when ledger query failed or a model is unknown", () => {
    expect(getUsagePolicySnapshot({ ...BASE, ledgerRows: null }, NOW)).toMatchObject({
      spendThb: null, remainingThb: null, allowed: false,
      costEstimate: { status: "unknown", safeForEnforcement: false },
    });
    expect(getUsagePolicySnapshot({
      ...BASE,
      ledgerRows: [{ createdAt: NOW, model: null, inputTokens: 1, outputTokens: 1, estimatedCostThb: 0 }],
    }, NOW)).toMatchObject({
      spendThb: null, allowed: false,
      costEstimate: { status: "unknown", unknownModelCount: 1 },
    });
  });

  it("excludes a ledger row exactly at the period end and displays eligible policy after expiry", () => {
    const periodEnd = new Date(BASE.expiresAt as string);
    const snapshot = getUsagePolicySnapshot({
      ...BASE,
      expiresAt: "2026-10-20T12:00:00+07:00",
      ledgerRows: [{
        createdAt: periodEnd, model: "unpriced-at-boundary", inputTokens: 0,
        outputTokens: 0, estimatedCostThb: 50,
      }],
    }, NOW);
    expect(snapshot).toMatchObject({ mode: "revenue_5x", status: "expired", allowed: false, capThb: 59.8, spendThb: 0 });
  });

  it("resets grandfathered spend at the server-local calendar-month boundary", () => {
    const snapshot = getUsagePolicySnapshot({
      ...BASE,
      periodStartedAt: "2026-10-18T00:00:00+07:00",
      ledgerRows: [{
        createdAt: "2026-09-29T12:00:00.000Z", model: null, inputTokens: 0,
        outputTokens: 0, estimatedCostThb: 4,
      }],
    }, NOW);
    expect(snapshot).toMatchObject({ mode: "legacy_internal", spendThb: 0, capThb: 100 });
    expect(snapshot.resetAt).not.toBeNull();
  });
});
