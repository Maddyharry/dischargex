/**
 * Phase A: the chart body is composed in `OpdAssistLabClient.tsx` (keeps hybrid wiring in one place).
 * Use this module for constants and future extraction of chart sub-panels.
 */

/** Physician-priority order for the structured chart (v1). */
export const OP_ASSIST_CHART_V1_ORDER = [
  "redFlags",
  "problemList",
  "assessmentDxPlan",
  "investigations",
  "frameworksCollapsed",
  "auditContradictionsDisposition",
  "symptomPacksAndScores",
  "layer2PerProblem",
  "layer1Minimum",
  "secondaryChartFieldsCcPi",
  "assistantBundleDetails",
] as const;
