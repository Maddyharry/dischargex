/**
 * OPD Assist — AI-first surface, hybrid guardrails (not AI-only).
 *
 * Physician experience: raw input → AI-native drafting (understanding, rewrite, problems, DDx, plans).
 * Engineering: deterministic rules wrap the model — context before, enforcement after.
 *
 * Keep in sync with `analyzeCase` (guardrail context), `opdAssistAi` (drafting), `opdAssistAiPostCheck` (enforcement).
 */

/** What the AI layer owns — primary interpretation and documentation (still constrained by rules, not unconstrained). */
export const AI_FIRST_RESPONSIBILITIES = [
  "Interpret messy raw clinical / dictation text (timeline, chief concern, clinical priorities)",
  "Rewrite into concise Thai physician-style CC / PI / PE and structured sections",
  "Group related findings into problems; rank primary vs secondary",
  "Propose provisional diagnosis and rank differentials",
  "Summarize investigation and follow-up intent when the text supports it",
] as const;

/** Deterministic rule layer — safety, policy, and auditability (runs before and/or after the model). */
export const RULE_GUARDRAIL_RESPONSIBILITIES = [
  "Negation-aware extraction and scoring (do not let the model flatten documented negations)",
  "Red flags, severity, and escalation triggers",
  "Visit mode switching and overlay / framework selection",
  "Required-field hints, minimum layout, and contradiction checks",
  "Antibiotic RDU / stewardship constraints",
  "Medication safety (normalization, allergy/duplicate flags, pediatric dosing guardrails)",
] as const;

/**
 * Legacy Layer A — builds guardrail *context* for the prompt (runs before AI in the pipeline).
 * Not a substitute for AI understanding; it constrains and enriches what the model sees.
 */
export const LAYER_A_RULE_PREPROCESSOR = [
  "Negation-aware keyword scoring and extraction",
  "Candidate problem detection (clinical profile + symptom packs)",
  "Visit mode detection (OPD / ER / TRAUMA / PSYCH / LABOR_ROOM / GYNE)",
  "Severity and escalation triggers",
  "Hard-fact and structured field hints (assistant bundle, structured note skeleton)",
  "Focused prompt selection (frameworks, overlays, disease cards)",
  "Minimum field / layout hints",
  "Contradiction detection (surfaced to user message)",
] as const;

/** Layer B — AI drafting (the physician-facing “intelligence” of the product). */
export const LAYER_B_AI_REASONING = [
  ...AI_FIRST_RESPONSIBILITIES,
  "Draft per-problem ask-next and examine-next",
  "Draft patient advice and disposition language when relevant",
] as const;

/** Layer C — post-hoc rule enforcement on model output. */
export const LAYER_C_RULE_POSTCHECK = [
  "Verify minimum fields and safe coercion",
  "Merge rule-derived medication safety flags",
  "Clamp lengths; strip banned placeholder phrasing",
  "Surface warnings when output diverges from guardrails",
] as const;

export const GLOBAL_RULES_FOR_AI = [
  "You are the primary interpreter of RAW_TEXT in the user message — RULE ENGINE blocks are authoritative guardrails (negation, mode, red flags, RDU); align your draft with them; do not invent conflicting facts.",
  "Use an explicit problem list; separate unrelated systems into separate problems.",
  "Surface the primary problem first; secondary problems follow in clinical priority.",
  "Respect documented negations — do not negate-stripping in your head.",
  "Do not default to sepsis, pneumonia, or shock without supporting evidence in the text or explicit rule flags.",
  "Do not undercall emergencies — when red flags or instability are documented or strongly implied, surface them clearly.",
  "Use provisional language when evidence is incomplete; separate fact from inference.",
  "Do not invent vitals, exam findings, labs, or imaging.",
] as const;

export const OUTPUT_BASE_SECTIONS_FOR_AI = [
  "CC — one short symptom-based line; duration if available; never age/weight as CC.",
  "PI — concise timeline narrative (not bullet dump).",
  "Past history / medication / allergy.",
  "PE — actual findings; pertinent negatives when documented.",
  "Problem list — primary first.",
  "Per problem: Assessment, provisional diagnosis, differential, plan, what to ask next, what to examine next.",
  "Advice / warning signs; disposition or follow-up when relevant (mode-specific disposition fields when ER/TRAUMA/PSYCH/OB-GYN).",
] as const;

export function formatHybridArchitectureForSystemPrompt(): string {
  return [
    "PRODUCT_MODEL — AI-first input understanding, not AI-only:",
    `- AI-led: ${AI_FIRST_RESPONSIBILITIES.join("; ")}.`,
    `- Rule guardrails (deterministic): ${RULE_GUARDRAIL_RESPONSIBILITIES.join("; ")}.`,
    "",
    "EXECUTION_ORDER (engineering):",
    "1) Rule preprocessor builds SYMPTOM_PACKS, frameworks, overlays, and RULE_* blocks — constraints for you, not a full chart.",
    "2) You (this model) produce the structured clinical JSON from RAW_TEXT + those blocks.",
    "3) Rule post-check normalizes output, merges medication safety, and may warn — your draft is still the primary narrative.",
    "",
    "LAYER_REFERENCE (same pipeline):",
    `Layer A — guardrail context: ${LAYER_A_RULE_PREPROCESSOR.join("; ")}.`,
    `Layer B — AI drafting: ${LAYER_B_AI_REASONING.join("; ")}.`,
    `Layer C — post-check: ${LAYER_C_RULE_POSTCHECK.join("; ")}.`,
    "",
    "GLOBAL_RULES:",
    ...GLOBAL_RULES_FOR_AI.map((r) => `- ${r}`),
    "",
    "BASE_OUTPUT (OPD-shaped JSON; mode-specific keys added when VISIT_MODE is not OPD):",
    ...OUTPUT_BASE_SECTIONS_FOR_AI.map((r) => `- ${r}`),
  ].join("\n");
}

/** Shorter block — prepend to non-OPD mode prompts so global rules stay consistent without repeating full architecture text. */
export function formatGlobalRulesOnlyForSystemPrompt(): string {
  return ["GLOBAL_RULES (all visit modes):", ...GLOBAL_RULES_FOR_AI.map((r) => `- ${r}`)].join("\n");
}
