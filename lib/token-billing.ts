type OpenAIUsageLike = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
};

export type TokenUsageSummary = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type TokenBillingSummary = TokenUsageSummary & {
  estimatedCostThb: number;
};

const PLAN_BUDGET_DEFAULT: Record<string, number> = {
  trial: 90,
  basic_monthly: 450,
  basic_yearly: 450,
  standard_monthly: 1300,
  standard_yearly: 1300,
  pro_monthly: 3600,
  pro_yearly: 3600,
};

function toNonNegativeInt(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function parseRate(value: string | undefined, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export function readUsageSummary(usage: OpenAIUsageLike | undefined | null): TokenUsageSummary {
  const inputTokens = toNonNegativeInt(usage?.input_tokens);
  const outputTokens = toNonNegativeInt(usage?.output_tokens);
  const totalFromApi = toNonNegativeInt(usage?.total_tokens);
  const totalTokens = totalFromApi > 0 ? totalFromApi : inputTokens + outputTokens;
  return { inputTokens, outputTokens, totalTokens };
}

/**
 * Hybrid model:
 * - bill by real token usage
 * - add platform markup + minimum fee per request
 */
export function estimateTokenBillingThb(usage: TokenUsageSummary): TokenBillingSummary {
  const inputRatePer1k = parseRate(process.env.TOKEN_INPUT_RATE_THB_PER_1K, 0.08);
  const outputRatePer1k = parseRate(process.env.TOKEN_OUTPUT_RATE_THB_PER_1K, 0.24);
  const platformMarkup = parseRate(process.env.TOKEN_PLATFORM_MARKUP_MULTIPLIER, 1.35);
  const minFeePerRequest = parseRate(process.env.TOKEN_MIN_FEE_THB, 0.25);

  const rawCost =
    (usage.inputTokens / 1000) * inputRatePer1k + (usage.outputTokens / 1000) * outputRatePer1k;
  const withMarkup = rawCost * platformMarkup;
  const estimatedCostThb = Math.max(minFeePerRequest, Number(withMarkup.toFixed(4)));

  return {
    ...usage,
    estimatedCostThb,
  };
}

export function getPlanTokenBudgetThb(planId: string): number {
  const key = String(planId || "trial").toLowerCase();
  const envKey = `TOKEN_BUDGET_${key.toUpperCase()}`;
  const fromEnv = Number(process.env[envKey]);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return PLAN_BUDGET_DEFAULT[key] ?? PLAN_BUDGET_DEFAULT.trial;
}

export function shouldEnforceLegacyCreditLimit() {
  return process.env.ENFORCE_CREDIT_LIMIT === "true";
}
