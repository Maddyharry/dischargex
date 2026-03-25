/**
 * Manual-first guideline maintenance (V1).
 * Update this file when references/rules change; no auto-monitoring in V1.
 */
export const RULE_PACK_VERSION = "1.0.0";
export const RULE_PACK_REVIEWED_AT = "2025-03-25";
export const RULE_PACK_REVIEWED_BY = "Clinical admin (manual)";
export const REVIEW_MODE = "manual-first" as const;

/** Catalog source IDs this rule pack was reviewed against. */
export const BASED_ON_SOURCE_IDS: string[] = [
  "thai-peds-cpg-index",
  "thai-trauma-abcde",
  "thai-rdu-hospital-manual",
  "thai-head-injury-traumatic-patients",
  "thai-head-injury-transfer",
  "thai-peds-acute-diarrhea",
  "thai-peds-respiratory-infections-2019",
  "thai-peds-bronchiolitis",
  "thai-peds-viral-induced-wheeze",
  "thai-peds-asthma",
  "thai-peds-severe-sepsis-shock",
  "thai-peds-acute-febrile-illness",
  "thai-peds-uti-2m-5y",
  "nice-head-injury-ct-1h",
  "idsa-infectious-diarrhea-2017",
];

export function getRulePackMeta() {
  return {
    ruleVersion: RULE_PACK_VERSION,
    reviewedAt: RULE_PACK_REVIEWED_AT,
    reviewedBy: RULE_PACK_REVIEWED_BY,
    reviewMode: REVIEW_MODE,
    basedOnSourceIds: BASED_ON_SOURCE_IDS,
  };
}
