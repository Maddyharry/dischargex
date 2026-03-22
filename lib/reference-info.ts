/**
 * Versioned reference set label for UI / disclaimers (update when rules change).
 */
export const REFERENCE_SET_NAME =
  "DischargeX reference pack v1 — ICD-10 / ICD-10-TM principles, Thai DRG orientation, internal coding rules";

/** ISO date when the reference text / rules were last reviewed for product copy. */
export const LAST_REVIEWED_DATE = "2026-03-22";

export function formatReferenceFooterLine() {
  return `Reference set used: ${REFERENCE_SET_NAME}\nLast reviewed: ${LAST_REVIEWED_DATE}`;
}
