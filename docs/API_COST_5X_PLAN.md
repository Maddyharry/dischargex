# API cost estimate and 4x revenue cap

## Decision

The approved target is revenue equal to 4 times estimated actual API cost. Estimated API cost is capped at 25% of plan revenue for eligible billing periods. The policy starts at `2026-10-19T00:00:00+07:00`; paid periods that started earlier retain legacy entitlements and daily case caps through renewal.

The pure estimator and plan-price helper are exported from `lib/api-cost.ts`:

```ts
isRevenue4xEligible(periodStartedAt)
estimateActualApiCostThbByModel(usage, model, { cachedInputTokens?, usdToThb? })
estimateActualApiCostThbFromLedgerRows(rows, { usdToThb? })
forecastRevenue4xPeriodCostCapThb(planPriceThb)
forecastApiCostCapThbFromPlanPrice({ priceThb, billingInterval })
```

`lib/usage-policy.ts` exports `getUsagePolicySnapshot(userFields, now)` plus the
`UsagePolicyUserFields`, `UsagePolicyLedgerRow`, and `UsagePolicySnapshot` types.
It also exports `selectUsagePolicyLedgerRows(rows, mode)` so usage display,
admin reporting, and enforcement use the same source/reference deduplication.
The snapshot separates `costEstimate` (the active policy basis) from
`actualApiCostEstimate` (raw standard-rate diagnostic), and returns mode, cap,
spend, remaining, reset time, active/expired status, and `allowed`. Its ledger
input uses `null` for a failed/unavailable query and `[]` for a successful empty
query. Rows are evaluated over `[periodStart, periodEnd)` for new policy and the
current server-local calendar month for grandfathered legacy policy. A row at
the exact period end belongs to the next period, never both.

An unsupported model, malformed token usage, or invalid configured FX returns `status: "unknown"` with a reason and `estimatedCostThb: null`. It never substitutes zero for an unknown rate. Known costs exclude platform markup and minimum request fees.

## Standard-rate planning assumptions

Rates are USD per 1 million tokens. The estimator accepts exact plain model aliases and an optional valid `YYYY-MM-DD` model snapshot suffix. It does not infer rates from prefixes, so variants such as `gpt-5.4-pro` remain unknown.

| Model | Input | Cached input | Output |
| --- | ---: | ---: | ---: |
| `gpt-5.4` | 2.50 | 0.25 | 15.00 |
| `gpt-5.4-mini` | 0.75 | 0.075 | 4.50 |
| `gpt-5-mini` | 0.25 | 0.025 | 2.00 |
| `gpt-4.1-mini` | 0.40 | 0.10 | 1.60 |
| `gpt-4o-mini` | 0.15 | 0.075 | 0.60 |
| `gpt-4o` | 2.50 | 1.25 | 10.00 |

THB conversion reads `API_COST_USD_TO_THB`, then the existing `TOKEN_USD_TO_THB` setting. If neither is set, it uses 36 THB/USD and marks that value as a configurable planning assumption, not a live exchange rate. Results are rounded to four decimal places.

For an individual `gpt-5.4` call whose input token usage is above 272,000, the estimate conservatively doubles input rates and multiplies output rates by 1.5. Ledger rows with per-call provenance (`summary_provider_call`, `summary_image_ocr`, or `specialist_chat`) receive that multiplier; aggregate rows do not. Large aggregate `gpt-5.4` input rows are flagged as uncertain and unsafe for hard-cap enforcement. Missing cached-token detail is priced as uncached input. Unsupported models make the aggregate unknown, retain a priced subtotal for diagnostics, and expose an unknown-model count; the subtotal must not be treated as the total. An empty successful ledger read is known zero; the caller must treat database/query failures separately.

Ledger selection deduplicates only exact non-empty `referenceId` matches between
`summary_provider_call` and `summary_generate`/`summary_recalc`: revenue mode
prefers per-call usage, while grandfathered legacy mode preserves the aggregate.
Unmatched aggregates remain as historical fallbacks; unmatched per-call rows
remain to account for partial failures. OCR rows are separate and retained.

## Cost caps at the 4x target

Enforcement uses the full billing-period plan price divided by 4. A yearly subscription receives one cap for its full paid year; it is not divided by 12 for enforcement. Existing paid customers keep the legacy policy through their current period, then the 4x cap applies at the next renewal.

| Plan | Monthly price used | Monthly API cost cap | Yearly price used | Full-year API cost cap |
| --- | ---: | ---: | ---: | ---: |
| Basic | ฿299 | ฿74.75 | ฿2,990 | ฿747.50 |
| Standard | ฿590 | ฿147.50 | ฿5,990 | ฿1,497.50 |
| Pro | ฿1,090 | ฿272.50 | ฿10,990 | ฿2,747.50 |

These are forecasts from listed plan prices. The policy helper is pure and does
not modify entitlement budgets or database records. New enforcement must use
its full-period snapshot, apply the cutoff to the paid-period start, and preserve
grandfathered periods until renewal. Purchased legacy add-on credits remain a
separate unit and are not converted to baht or silently added to the cost cap.

Any pre-call check is a projection from known rate and usage data, not the provider's final bill. Reconcile the returned usage after each completed API call and update the period ledger; if model or usage data is unknown, do not treat the known subtotal as a safe cap total.

## Limits of historical estimates

The current internal ledger field `estimatedCostThb` includes a 1.35 platform markup and can use a legacy fallback formula. It is therefore not actual OpenAI API cost or an invoice amount. Existing historical usage records may not include image/OCR charges, retries, failed calls, or cached-token detail. Treat historical and prospective figures as estimates only, never as invoices.

Synthetic example only (not customer data): 10,000 input tokens and 1,000 output tokens on `gpt-5.4`, with no cached-token detail and the assumed FX of 36 THB/USD, estimate to about ฿1.44 at standard rates. This aggregate example does not apply the per-call long-context multiplier.

This module estimates token charges from usage and the listed standard rates. It does not claim to account for every provider-side charge or billing adjustment.
