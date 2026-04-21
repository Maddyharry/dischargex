/**
 * OPD Assist — build order and module map (AI-first surface, hybrid guardrails).
 * Canonical architecture narrative: `opdAssistArchitecture.ts`.
 *
 * Execution order (engineering):
 * 1. Rule preprocessor — `analyzeCase.analyzeOpdCase` (always on): visit mode, negation-aware packs,
 *    frameworks/overlays, red flags, structured baseline, contradiction hints — feeds the AI user payload.
 * 2. AI drafting — `opdAssistAi.mergeOpdAssistAiPhase1`: interpret raw text, rewrite CC/PI/PE, problems, DDx, plans.
 * 3. Rule post-check — `opdAssistAiPostCheck`: normalize, medication safety, length clamps, warnings.
 *
 * Symptom/problem packs (`opdProblemPacks`) are resolved inside step 1 and passed to the model as SYMPTOM_PACKS;
 * they are roadmap templates, not a separate post-AI step.
 *
 * Physician-facing: step 2 is the primary “intelligent” output; steps 1 and 3 are guardrails.
 */

export const OPD_ASSIST_RULE_LAYER_MODULES = [
  "analyzeCase.ts",
  "caseClinicalProfile.ts",
  "clinicalNegation.ts",
  "opdRecordFramework.ts",
  "safetyOpd.ts",
  "structuredNote.ts",
  "clinicalTextExtract.ts",
] as const;

export const OPD_ASSIST_AI_LAYER_MODULES = ["opdAssistAi.ts", "opdAssistAiPostCheck.ts", "opdAssistAiFormat.ts"] as const;

export const OPD_ASSIST_SYMPTOM_PACK_MODULE = "opdProblemPacks.ts" as const;

/** Chart Assist Lab V1 (admin experimental) — pure rules, no LLM */
export const CHART_ASSIST_V1_MODULES = ["ruleEngine.ts", "types.ts", "guidelineHints.ts"] as const;
