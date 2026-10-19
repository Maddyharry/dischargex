import {
  estimateActualApiCostThbFromLedgerRows,
  forecastRevenue4xPeriodCostCapThb,
  isRevenue4xEligible,
  type ApiCostLedgerEstimate,
} from "./api-cost";
import { getPlanDefinition } from "./billing-rules";

export type UsagePolicyLedgerRow = {
  createdAt: Date | string;
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  totalTokens?: number | null;
  estimatedCostThb: number | null;
  cachedInputTokens?: number | null;
  source?: string;
  referenceId?: string | null;
};

export type UsagePolicyLedgerSourceRow = { source?: string; referenceId?: string | null };

/**
 * Select one representation per summary job. Actual-cost periods prefer provider calls;
 * legacy periods retain the original aggregate. Unmatched provider calls represent partial
 * failures and remain billable. OCR and all unrelated sources are kept independently.
 */
export function selectUsagePolicyLedgerRows<T extends UsagePolicyLedgerSourceRow>(
  rows: readonly T[],
  mode: "legacy_internal" | "revenue_4x",
): T[] {
  const aggregateSources = new Set(["summary_generate", "summary_recalc"]);
  const providerRefs = new Set(
    rows.filter((row) => row.source === "summary_provider_call" && row.referenceId)
      .map((row) => row.referenceId as string),
  );
  const aggregateRefs = new Set(
    rows.filter((row) => aggregateSources.has(row.source ?? "") && row.referenceId)
      .map((row) => row.referenceId as string),
  );

  return rows.filter((row) => {
    if (!row.referenceId) return true;
    if (mode === "revenue_4x" && aggregateSources.has(row.source ?? "")) {
      return !providerRefs.has(row.referenceId);
    }
    if (mode === "legacy_internal" && row.source === "summary_provider_call") {
      return !aggregateRefs.has(row.referenceId);
    }
    return true;
  });
}

export type UsagePolicyUserFields = {
  planId: string;
  subscriptionStatus: string | null;
  periodStartedAt: Date | string | null;
  expiresAt: Date | string | null;
  /** Existing TOKEN_BUDGET_* value, in legacy internal ledger units. */
  legacyCalendarMonthCapThb: number;
  /** null means query failure/unavailable; [] is a successful empty result. */
  ledgerRows: readonly UsagePolicyLedgerRow[] | null;
};

export type UsagePolicyCostEstimate = {
  status: "known" | "unknown";
  basis: "legacy_internal" | "actual_api_standard_rates";
  estimatedCostThb: number | null;
  knownSubtotalThb: number;
  unknownModelCount: number;
  invalidRowCount: number;
  safeForEnforcement: boolean;
  uncertainty: string[];
};

export type UsagePolicySnapshot = {
  mode: "legacy_internal" | "revenue_4x";
  capThb: number | null;
  spendThb: number | null;
  remainingThb: number | null;
  resetAt: string | null;
  allowed: boolean;
  status: "not_started" | "active" | "expired";
  /** Policy-basis estimate used for display/enforcement; legacy values are not API invoice cost. */
  costEstimate: UsagePolicyCostEstimate;
  /** Raw standard-rate estimate for diagnostics, also available to grandfathered users. */
  actualApiCostEstimate: UsagePolicyCostEstimate;
};

function date(value: Date | string | null): Date | null {
  if (value === null) return null;
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function calendarMonth(now: Date) {
  // Keep parity with the existing server-local calendar-month legacy quota.
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

function inWindow(value: Date | null, start: Date, end: Date): boolean {
  return value !== null && value.getTime() >= start.getTime() && value.getTime() < end.getTime();
}

function unknownEstimate(
  basis: UsagePolicyCostEstimate["basis"],
  reason: string,
  counts: { unknownModelCount?: number; invalidRowCount?: number } = {},
  subtotal = 0,
): UsagePolicyCostEstimate {
  return {
    status: "unknown", basis, estimatedCostThb: null, knownSubtotalThb: subtotal,
    unknownModelCount: counts.unknownModelCount ?? 0,
    invalidRowCount: counts.invalidRowCount ?? 0,
    safeForEnforcement: false, uncertainty: [reason],
  };
}

function rawEstimate(
  rows: readonly UsagePolicyLedgerRow[] | null,
  start: Date | null,
  end: Date | null,
  mode: UsagePolicySnapshot["mode"],
): UsagePolicyCostEstimate {
  if (rows === null) return unknownEstimate("actual_api_standard_rates", "Token ledger read failed or is unavailable.");
  if (!start || !end || end.getTime() <= start.getTime()) {
    return unknownEstimate("actual_api_standard_rates", "Paid-period bounds are unavailable or invalid.");
  }
  const invalidTimestamp = rows.some((row) => date(row.createdAt) === null);
  const periodRows = selectUsagePolicyLedgerRows(
    rows.filter((row) => inWindow(date(row.createdAt), start, end)),
    mode,
  );
  const estimate: ApiCostLedgerEstimate = estimateActualApiCostThbFromLedgerRows(
    periodRows.map((row) => ({
      model: row.model ?? "",
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      totalTokens: row.totalTokens ?? undefined,
      cachedInputTokens: row.cachedInputTokens ?? undefined,
      source: row.source,
      referenceId: row.referenceId,
    })),
  );
  if (!invalidTimestamp) {
    return {
      status: estimate.status,
      basis: "actual_api_standard_rates",
      estimatedCostThb: estimate.estimatedCostThb,
      knownSubtotalThb: estimate.knownSubtotalThb,
      unknownModelCount: estimate.unknownModelCount,
      invalidRowCount: estimate.invalidRowCount,
      safeForEnforcement: estimate.safeForEnforcement,
      uncertainty: estimate.uncertainty,
    };
  }
  return unknownEstimate(
    "actual_api_standard_rates",
    "A ledger timestamp is invalid; period inclusion cannot be determined.",
    { unknownModelCount: estimate.unknownModelCount, invalidRowCount: estimate.invalidRowCount + 1 },
    estimate.knownSubtotalThb,
  );
}

function legacyEstimate(rows: readonly UsagePolicyLedgerRow[] | null, start: Date, end: Date, capValid: boolean): UsagePolicyCostEstimate {
  if (rows === null) return unknownEstimate("legacy_internal", "Token ledger read failed or is unavailable.");
  const invalidTimestampCount = rows.filter((row) => date(row.createdAt) === null).length;
  let spend = 0;
  let invalidRows = invalidTimestampCount;
  const selectedRows = selectUsagePolicyLedgerRows(
    rows.filter((row) => inWindow(date(row.createdAt), start, end)),
    "legacy_internal",
  );
  for (const row of selectedRows) {
    const createdAt = date(row.createdAt);
    if (!createdAt) { invalidRows += 1; continue; }
    if (typeof row.estimatedCostThb !== "number" || !Number.isFinite(row.estimatedCostThb) || row.estimatedCostThb < 0) {
      invalidRows += 1;
      continue;
    }
    spend += row.estimatedCostThb;
  }
  if (invalidRows || !capValid) {
    return unknownEstimate("legacy_internal", `${invalidRows} invalid ledger rows or an invalid legacy cap.`, { invalidRowCount: invalidRows }, spend);
  }
  return {
    status: "known", basis: "legacy_internal", estimatedCostThb: spend,
    knownSubtotalThb: spend, unknownModelCount: 0, invalidRowCount: 0,
    safeForEnforcement: true,
    uncertainty: ["Legacy estimatedCostThb uses internal markup/minimum-fee units, not actual API cost."],
  };
}

/** Pure subscription usage-policy snapshot. Empty ledger means known zero; null means fail closed. */
export function getUsagePolicySnapshot(userFields: UsagePolicyUserFields, now: Date): UsagePolicySnapshot {
  const validNow = Number.isFinite(now.getTime());
  const plan = getPlanDefinition(userFields.planId);
  const periodStart = date(userFields.periodStartedAt);
  const periodEnd = date(userFields.expiresAt);
  const activeSubscription = userFields.subscriptionStatus === "active" || userFields.subscriptionStatus === "pending_change";
  const notStarted = validNow && periodStart !== null && now.getTime() < periodStart.getTime();
  const isActive = validNow && !notStarted && periodEnd !== null && now.getTime() < periodEnd.getTime() &&
    (!plan.isPaid || activeSubscription);

  // Mode is tied to the paid period start, not current subscription status, so expired/cancelled
  // eligible periods retain their correct historical policy for customer/admin display.
  const mode = plan.isPaid && periodStart !== null && isRevenue4xEligible(periodStart)
    ? "revenue_4x" as const
    : "legacy_internal" as const;

  const month = validNow ? calendarMonth(now) : null;
  const rawWindowStart = mode === "revenue_4x" ? periodStart : month?.start ?? null;
  const rawWindowEnd = mode === "revenue_4x" ? periodEnd : month?.end ?? null;
  const actualApiCostEstimate = rawEstimate(userFields.ledgerRows, rawWindowStart, rawWindowEnd, mode);

  let capThb: number | null;
  let resetAt: string | null;
  let costEstimate: UsagePolicyCostEstimate;
  if (mode === "revenue_4x") {
    capThb = forecastRevenue4xPeriodCostCapThb(plan.priceThb);
    resetAt = periodEnd?.toISOString() ?? null;
    if (!periodStart || !periodEnd || periodEnd.getTime() <= periodStart.getTime()) {
      costEstimate = unknownEstimate("actual_api_standard_rates", "Paid-period bounds are unavailable or invalid.");
    } else {
      costEstimate = actualApiCostEstimate;
    }
  } else {
    capThb = Number.isFinite(userFields.legacyCalendarMonthCapThb) && userFields.legacyCalendarMonthCapThb >= 0
      ? userFields.legacyCalendarMonthCapThb : null;
    resetAt = month?.end.toISOString() ?? null;
    costEstimate = month
      ? legacyEstimate(userFields.ledgerRows, month.start, month.end, capThb !== null)
      : unknownEstimate("legacy_internal", "Current server-local calendar month is unavailable.");
  }

  const spendThb = costEstimate.status === "known" ? costEstimate.estimatedCostThb : null;
  const remainingThb = spendThb === null || capThb === null ? null : Math.max(0, capThb - spendThb);
  const allowed = isActive && costEstimate.status === "known" && costEstimate.safeForEnforcement &&
    capThb !== null && spendThb !== null && spendThb < capThb;
  return {
    mode, capThb, spendThb, remainingThb, resetAt,
    allowed, status: notStarted ? "not_started" : isActive ? "active" : "expired", costEstimate, actualApiCostEstimate,
  };
}
