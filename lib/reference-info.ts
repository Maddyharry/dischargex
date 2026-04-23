/**
 * Versioned reference set label for UI / disclaimers (update when rules change).
 */
export const REFERENCE_SET_NAME =
  "Thai clinical documentation reference set [R1-R6] — ICD-10 / ICD-10-TM / DRG audit-oriented guidance";

/** ISO date when the reference text / rules were last reviewed for product copy. */
export const LAST_REVIEWED_DATE = "2026-04-21";

export function formatReferenceFooterLine() {
  return `Reference set used: ${REFERENCE_SET_NAME}\nLast reviewed: ${LAST_REVIEWED_DATE}`;
}
