/**
 * Transparent, per-call estimate of OpenAI text-token API cost in THB.
 * This module intentionally excludes platform markup and minimum request fees.
 */

export type ApiTokenUsage = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  cachedInputTokens?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
};

/** Rollout starts at midnight Thailand time; earlier paid periods are grandfathered. */
export const EFFECTIVE_FROM = "2026-10-19T00:00:00+07:00";

export function isRevenue5xEligible(
  periodStartedAt: Date | string | null | undefined,
): boolean {
  if (periodStartedAt == null) return false;
  const timestamp = periodStartedAt instanceof Date
    ? periodStartedAt.getTime()
    : Date.parse(periodStartedAt);
  return Number.isFinite(timestamp) && timestamp >= Date.parse(EFFECTIVE_FROM);
}

export type ActualApiCostEstimate =
  | {
      status: "known";
      model: string;
      modelAlias: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cachedInputTokens: number;
      estimatedCostUsd: number;
      estimatedCostThb: number;
      usdToThb: number;
      fxSource: "explicit" | "environment" | "default_assumption";
      fxAssumption: string | null;
      longContextMultiplierApplied: boolean;
      costBasis: "standard_rates_estimate";
    }
  | {
      status: "unknown";
      model: string;
      reason: "unsupported_model" | "invalid_usage" | "invalid_fx";
      estimatedCostThb: null;
    };

export type ApiCostEstimateOptions = {
  cachedInputTokens?: number;
  /** Explicit FX override. Otherwise API_COST_USD_TO_THB, then TOKEN_USD_TO_THB, then 36. */
  usdToThb?: number;
};

export type ApiCostLedgerRow = ApiTokenUsage & {
  model: string;
  /** Provenance distinguishes a single provider call from period/job aggregates. */
  source?: string;
  referenceId?: string | null;
};

export type ApiCostLedgerEstimate = {
  status: "known" | "unknown";
  /** Null unless every row has a supported model and valid usage. */
  estimatedCostThb: number | null;
  /** Subtotal of rows that could be priced; never represents the full total when status is unknown. */
  knownSubtotalThb: number;
  unknownModelCount: number;
  invalidRowCount: number;
  rowCount: number;
  uncertainty: string[];
  /** False when an incomplete or potentially long-context aggregate must not enforce a hard cap. */
  safeForEnforcement: boolean;
  usdToThb: number | null;
  fxSource: "explicit" | "environment" | "default_assumption" | null;
};

export type PlanBillingInterval = "monthly" | "yearly";

export type PlanApiCostCapForecast = {
  planPriceThb: number;
  billingInterval: PlanBillingInterval;
  revenueMultiple: 5;
  apiCostCapThb: number;
  periodLabel: "billing_month" | "billing_year";
};

type ModelRates = { input: number; cachedInput: number; output: number };

const USD_PER_MILLION_TOKENS: Readonly<Record<string, ModelRates>> = {
  "gpt-5.4": { input: 2.5, cachedInput: 0.25, output: 15 },
  "gpt-5.4-mini": { input: 0.75, cachedInput: 0.075, output: 4.5 },
  "gpt-5-mini": { input: 0.25, cachedInput: 0.025, output: 2 },
  "gpt-4.1-mini": { input: 0.4, cachedInput: 0.1, output: 1.6 },
  "gpt-4o-mini": { input: 0.15, cachedInput: 0.075, output: 0.6 },
  "gpt-4o": { input: 2.5, cachedInput: 1.25, output: 10 },
};

const MILLION = 1_000_000;
const GPT_54_LONG_CONTEXT_THRESHOLD = 272_000;
const GPT_54_LONG_CONTEXT_INPUT_MULTIPLIER = 2;
const GPT_54_LONG_CONTEXT_OUTPUT_MULTIPLIER = 1.5;
const DEFAULT_USD_TO_THB = 36;

function roundThb(value: number): number {
  return Number(value.toFixed(4));
}

function isValidDateSuffix(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}

/** Accept only exact public model aliases, optionally followed by a real YYYY-MM-DD snapshot suffix. */
export function resolveApiCostModelAlias(model: string): string | null {
  const normalized = String(model ?? "").trim().toLowerCase();
  if (Object.hasOwn(USD_PER_MILLION_TOKENS, normalized)) return normalized;

  const dated = /^(gpt-(?:5\.4(?:-mini)?|5-mini|4\.1-mini|4o(?:-mini)?))-(\d{4}-\d{2}-\d{2})$/.exec(
    normalized,
  );
  if (!dated || !isValidDateSuffix(dated[2])) return null;
  return Object.hasOwn(USD_PER_MILLION_TOKENS, dated[1]) ? dated[1] : null;
}

function getUsageNumber(usage: ApiTokenUsage, camelKey: keyof ApiTokenUsage, snakeKey: keyof ApiTokenUsage): number | null {
  const value = usage[camelKey] ?? usage[snakeKey];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

function resolveFx(options: ApiCostEstimateOptions): {
  value: number;
  source: "explicit" | "environment" | "default_assumption";
} | null {
  if (options.usdToThb !== undefined) {
    return Number.isFinite(options.usdToThb) && options.usdToThb > 0
      ? { value: options.usdToThb, source: "explicit" }
      : null;
  }

  const configured = process.env.API_COST_USD_TO_THB || process.env.TOKEN_USD_TO_THB;
  if (configured !== undefined && configured.trim() !== "") {
    const value = Number(configured);
    return Number.isFinite(value) && value > 0 ? { value, source: "environment" } : null;
  }
  return { value: DEFAULT_USD_TO_THB, source: "default_assumption" };
}

/**
 * Estimate the actual per-call token cost, without markup or minimum fee.
 * Supply this call's usage only; do not use monthly aggregate usage for long-context pricing.
 */
export function estimateActualApiCostThbByModel(
  usage: ApiTokenUsage,
  model: string,
  options: ApiCostEstimateOptions = {},
): ActualApiCostEstimate {
  const modelAlias = resolveApiCostModelAlias(model);
  if (!modelAlias) {
    return { status: "unknown", model, reason: "unsupported_model", estimatedCostThb: null };
  }

  const inputTokens = getUsageNumber(usage, "inputTokens", "input_tokens");
  const outputTokens = getUsageNumber(usage, "outputTokens", "output_tokens");
  const suppliedTotal = usage.totalTokens ?? usage.total_tokens;
  const totalTokens = suppliedTotal === undefined || suppliedTotal === null
    ? (inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null)
    : typeof suppliedTotal === "number" && Number.isSafeInteger(suppliedTotal) && suppliedTotal >= 0
      ? suppliedTotal
      : null;
  const cachedInputTokens = options.cachedInputTokens ?? 0;
  if (
    inputTokens === null ||
    outputTokens === null ||
    totalTokens === null ||
    !Number.isSafeInteger(inputTokens + outputTokens) ||
    !Number.isSafeInteger(cachedInputTokens) ||
    cachedInputTokens < 0 ||
    cachedInputTokens > inputTokens
  ) {
    return { status: "unknown", model, reason: "invalid_usage", estimatedCostThb: null };
  }

  const fx = resolveFx(options);
  if (!fx) return { status: "unknown", model, reason: "invalid_fx", estimatedCostThb: null };

  const rates = USD_PER_MILLION_TOKENS[modelAlias];
  const longContextMultiplierApplied = modelAlias === "gpt-5.4" && inputTokens > GPT_54_LONG_CONTEXT_THRESHOLD;
  const inputMultiplier = longContextMultiplierApplied ? GPT_54_LONG_CONTEXT_INPUT_MULTIPLIER : 1;
  const outputMultiplier = longContextMultiplierApplied ? GPT_54_LONG_CONTEXT_OUTPUT_MULTIPLIER : 1;
  const uncachedInputTokens = inputTokens - cachedInputTokens;
  const estimatedCostUsd =
    ((uncachedInputTokens * rates.input * inputMultiplier) +
      (cachedInputTokens * rates.cachedInput * inputMultiplier) +
      (outputTokens * rates.output * outputMultiplier)) /
    MILLION;
  const fxAssumption = fx.source === "default_assumption"
    ? "USD/THB 36 is a configurable planning assumption, not a live exchange rate."
    : null;

  return {
    status: "known",
    model,
    modelAlias,
    inputTokens,
    outputTokens,
    totalTokens,
    cachedInputTokens,
    estimatedCostUsd,
    estimatedCostThb: roundThb(estimatedCostUsd * fx.value),
    usdToThb: fx.value,
    fxSource: fx.source,
    fxAssumption,
    longContextMultiplierApplied,
    costBasis: "standard_rates_estimate",
  };
}

/**
 * Estimate a billing-period ledger without applying per-call long-context multipliers.
 * Ledger rows may aggregate multiple calls; large gpt-5.4 rows are flagged as uncertain.
 * Missing cached-token detail is priced as entirely uncached (conservative).
 */
export function estimateActualApiCostThbFromLedgerRows(
  rows: readonly ApiCostLedgerRow[],
  options: Pick<ApiCostEstimateOptions, "usdToThb"> = {},
): ApiCostLedgerEstimate {
  const fx = resolveFx(options);
  let knownUsd = 0;
  let unknownModelCount = 0;
  let invalidRowCount = 0;
  const uncertainty = new Set<string>();

  for (const row of rows) {
    const alias = resolveApiCostModelAlias(row.model);
    if (!alias) {
      unknownModelCount += 1;
      continue;
    }
    const inputTokens = getUsageNumber(row, "inputTokens", "input_tokens");
    const outputTokens = getUsageNumber(row, "outputTokens", "output_tokens");
    const cachedInputTokens = row.cachedInputTokens ?? 0;
    if (
      inputTokens === null || outputTokens === null ||
      !Number.isSafeInteger(cachedInputTokens) || cachedInputTokens < 0 || cachedInputTokens > inputTokens
    ) {
      invalidRowCount += 1;
      continue;
    }
    const isPerCall = row.source === "summary_provider_call" || row.source === "summary_image_ocr" || row.source === "specialist_chat";
    if (isPerCall) {
      const perCall = estimateActualApiCostThbByModel({
        inputTokens,
        outputTokens,
        totalTokens: row.totalTokens ?? undefined,
        cachedInputTokens,
      }, row.model, fx ? { usdToThb: fx.value } : {});
      if (perCall.status === "unknown") {
        invalidRowCount += 1;
        continue;
      }
      // Sum unrounded USD values; round the aggregate once below.
      knownUsd += perCall.estimatedCostUsd;
      continue;
    }
    if (alias === "gpt-5.4" && inputTokens > GPT_54_LONG_CONTEXT_THRESHOLD) {
      uncertainty.add("Large gpt-5.4 ledger row may combine calls; per-call long-context charges cannot be determined from aggregate tokens.");
    }
    const rates = USD_PER_MILLION_TOKENS[alias];
    knownUsd += (
      (inputTokens - cachedInputTokens) * rates.input +
      cachedInputTokens * rates.cachedInput +
      outputTokens * rates.output
    ) / MILLION;
  }

  if (fx === null) uncertainty.add("USD/THB configuration is invalid.");
  const knownSubtotalThb = fx ? roundThb(knownUsd * fx.value) : 0;
  const status = fx !== null && unknownModelCount === 0 && invalidRowCount === 0
    ? "known"
    : "unknown";
  return {
    status,
    estimatedCostThb: status === "known" ? knownSubtotalThb : null,
    knownSubtotalThb,
    unknownModelCount,
    invalidRowCount,
    rowCount: rows.length,
    uncertainty: [...uncertainty],
    safeForEnforcement: status === "known" && uncertainty.size === 0,
    usdToThb: fx?.value ?? null,
    fxSource: fx?.source ?? null,
  };
}

/** Full paid billing-period cap at a 5x revenue-to-cost target. */
export function forecastRevenue5xPeriodCostCapThb(planPriceThb: number): number | null {
  if (!Number.isFinite(planPriceThb) || planPriceThb < 0) return null;
  return roundThb(planPriceThb / 5);
}

/** Forecast the maximum API cost at a 5x revenue-to-cost ratio. */
export function forecastApiCostCapThbFromPlanPrice(input: {
  priceThb: number;
  billingInterval: PlanBillingInterval;
}): PlanApiCostCapForecast {
  if (!Number.isFinite(input.priceThb) || input.priceThb < 0) {
    throw new RangeError("priceThb must be a finite non-negative amount");
  }
  const divisor = 5;
  return {
    planPriceThb: input.priceThb,
    billingInterval: input.billingInterval,
    revenueMultiple: 5,
    apiCostCapThb: roundThb(input.priceThb / divisor),
    periodLabel: input.billingInterval === "yearly" ? "billing_year" : "billing_month",
  };
}
