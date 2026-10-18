const DIGEST_CONTAINERS = new Set([
  "specialistChatByMode", "coding", "opd_demo", "unknown", "specialistReplyMetrics",
  "specialistReplyMetricsByMode", "feedback", "decisionFunnel", "webAnalytics", "funnel",
  "business", "cohorts", "chatToPurchase", "pricingToPurchase", "conversionInsights",
  "dropoff", "entryPath", "lengthBuckets", "short", "medium", "long", "topEvents",
  "topCtaClicks", "topPages", "abLanding", "pricing", "landing", "chat",
]);
const DIGEST_NUMBERS = new Set([
  "periodDays", "totalTelemetry", "excludedAdminTelemetry", "replies", "helpful", "notHelpful",
  "acceptanceRate", "tokenCostThb", "count", "simpleDirectQuestionCount", "compactTargetAppliedCount",
  "simpleDirectQuestionRate", "compactTargetAppliedRate", "avgChars", "avgLines", "avgBullets",
  "avgHeadings", "avgWordsApprox", "charCountSum", "lineCountSum", "bulletCountSum", "headingCountSum",
  "approxWordCountSum", "tokenCostTotal", "views", "uniqueVisitors", "avgDurationSec", "assigned",
  "signupClicks", "signupCtr", "landingSessions", "landingToPricingSessions", "landingToPricingRate",
  "pricingViewUsers", "pricingViewAndPurchaseUsers", "pricingViewToPurchaseRate", "trialSignups",
  "trialActiveUsers", "purchases", "uniquePurchasers", "usersWithChatBeforePurchase", "chatBeforePurchaseRate",
  "avgChatBeforePurchase", "clickUsers", "purchasers", "purchaseRate", "strategy_changed",
  "request_more_alternatives", "apply_principal_alternative", "undo_principal_alternative",
]);

/** Keep only known aggregate metric fields and fixed structural containers. */
export function sanitizeTelemetryDigest(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeTelemetryDigest).filter((item) => item !== undefined);
  if (!value || typeof value !== "object") return undefined;
  const clean: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (DIGEST_NUMBERS.has(key)) {
      if (typeof child === "number" && Number.isFinite(child)) clean[key] = child;
      continue;
    }
    if (DIGEST_CONTAINERS.has(key)) {
      const sanitized = sanitizeTelemetryDigest(child);
      if (sanitized !== undefined) clean[key] = sanitized;
    }
  }
  return clean;
}
