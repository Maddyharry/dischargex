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

type ModelRateUsdPer1M = {
  input: number;
  output: number;
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

function resolveModelAlias(model: string) {
  const m = String(model || "").trim().toLowerCase();
  if (!m) return "";
  if (m.startsWith("gpt-5.5")) return "gpt-5.5";
  if (m.startsWith("gpt-5.4-mini")) return "gpt-5.4-mini";
  if (m.startsWith("gpt-5.4")) return "gpt-5.4";
  if (m.startsWith("gpt-5-mini")) return "gpt-5-mini";
  if (m.startsWith("gpt-4.1-mini")) return "gpt-4.1-mini";
  if (m.startsWith("gpt-4o-mini")) return "gpt-4o-mini";
  if (m.startsWith("gpt-4o")) return "gpt-4o";
  return m;
}

function parseModelRateFromEnv(alias: string): ModelRateUsdPer1M | null {
  const envKey = alias.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const input = Number(process.env[`TOKEN_MODEL_${envKey}_INPUT_USD_PER_1M`]);
  const output = Number(process.env[`TOKEN_MODEL_${envKey}_OUTPUT_USD_PER_1M`]);
  if (!Number.isFinite(input) || !Number.isFinite(output) || input < 0 || output < 0) return null;
  return { input, output };
}

function getDefaultModelRateUsdPer1M(alias: string): ModelRateUsdPer1M | null {
  const table: Record<string, ModelRateUsdPer1M> = {
    "gpt-5.5": { input: 5, output: 30 },
    "gpt-5.4": { input: 2.5, output: 15 },
    "gpt-5.4-mini": { input: 0.75, output: 4.5 },
    "gpt-5-mini": { input: 0.25, output: 2 },
    "gpt-4.1-mini": { input: 0.4, output: 1.6 },
    "gpt-4o-mini": { input: 0.15, output: 0.6 },
    "gpt-4o": { input: 2.5, output: 10 },
  };
  return table[alias] || null;
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
  return estimateTokenBillingThbByModel(usage);
}

/**
 * Model-aware billing:
 * - bill by real token usage
 * - apply model rate (USD/1M) when model is known
 * - convert FX and add platform markup + minimum fee per request
 * - fallback to legacy THB-per-1K rates for backward compatibility
 */
export function estimateTokenBillingThbByModel(usage: TokenUsageSummary, model?: string): TokenBillingSummary {
  const inputRatePer1k = parseRate(process.env.TOKEN_INPUT_RATE_THB_PER_1K, 0.08);
  const outputRatePer1k = parseRate(process.env.TOKEN_OUTPUT_RATE_THB_PER_1K, 0.24);
  const platformMarkup = parseRate(process.env.TOKEN_PLATFORM_MARKUP_MULTIPLIER, 1.35);
  const minFeePerRequest = parseRate(process.env.TOKEN_MIN_FEE_THB, 0.25);
  const usdToThb = parseRate(process.env.TOKEN_USD_TO_THB, 36);

  const modelAlias = resolveModelAlias(String(model || ""));
  const modelRate = modelAlias
    ? parseModelRateFromEnv(modelAlias) || getDefaultModelRateUsdPer1M(modelAlias)
    : null;
  const rawCost = modelRate
    ? ((usage.inputTokens / 1_000_000) * modelRate.input + (usage.outputTokens / 1_000_000) * modelRate.output) *
      usdToThb
    : (usage.inputTokens / 1000) * inputRatePer1k + (usage.outputTokens / 1000) * outputRatePer1k;
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
