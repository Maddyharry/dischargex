/**
 * Shared documentation expectations for LABOR_ROOM and GYNE visit modes
 * (rule layer + AI prompts + lab UI — not clinical protocol).
 */
export const OB_GYNE_SHARED_DOCUMENTATION_RULES: readonly string[] = [
  "Surface pregnancy status early (structured field; not buried only in narrative).",
  "When pregnant: surface gestational age / dating early (GA/EGA or LMP-based estimate).",
  "Surface hemodynamic status early when relevant (BP/HR/perfusion concern in triage summary).",
  "Bleeding: use structured severity (level + quantified details — pads/h, clots, estimated loss, orthostasis).",
  "Disposition must be explicit (observe / urgent OB or GYN / admit L&D or OR / transfer / discharge with safety-net).",
  "Unstable OB/GYNE presentations: switch to urgent pathway in disposition and triage summary (not routine outpatient follow-up alone).",
];
