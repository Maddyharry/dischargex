/**
 * ER-oriented dyspnea / hypoxemia overlay — escalate breathing complaints when emergency signs are present.
 * Rule layer only; does not replace clinical judgment.
 */
import type { AssistMode } from "./cardTypes";
import { anyNonNegatedRegexMatch, hasAnyKeywordNonNegated, scoreKeysNegationAware } from "./clinicalNegation";
import type { OpdProblemPackId } from "./opdProblemPacks";
import type { VisitModeReasonCode } from "./triggers";

/** Cues that can activate the overlay when paired with ER / escalation context (negation-aware) */
export const DYSPNEA_HYPOXEMIA_TRIGGER_KEYS = [
  "dyspnea",
  "shortness of breath",
  "wheeze",
  "wheezing",
  "stridor",
  "retraction",
  "retractions",
  "hypoxemia",
  "hypoxemic",
  "hypoxia",
  "hypoxic",
  "cyanosis",
  "cyanotic",
  "tachypnea",
  "low spo2",
  "low spo₂",
  "spo2",
  "spo₂",
  "oxygen saturation",
  "o2 sat",
  "venturi",
  "non-rebreather",
  "nrb",
  "high flow",
  "bipap",
  "cpap",
  "neb",
  "nebulizer",
  "bronchodilator",
  "severe cough",
  "หายใจลำบาก",
  "เหนื่อยหอบ",
  "หอบ",
  "เสียงหวีด",
  "เสียงวี้ด",
  "ซี่โครงบุ๋ม",
  "เข้าซี่โครง",
  "เขียว",
  "ปากเขียว",
  "ปากซีดเขียว",
  "ไซยาโนซิส",
  "ออกซิเจนต่ำ",
  "ความอิ่มตัวออกซิเจน",
];

/** Strong cues — open overlay even in non-ER mode when present (with breathing trigger) */
const SEVERE_BREATHING_ESCALATION_KEYS = [
  "severe dyspnea",
  "severe respiratory distress",
  "respiratory distress",
  "respiratory failure",
  "impending respiratory failure",
  "unable to speak in full sentences",
  "speaks in words only",
  "accessory muscle",
  "nasal flaring",
  "grunting",
  "central cyanosis",
  "altered mental status",
  "decreased loc",
  "loss of consciousness",
  "unresponsive",
  "gcs",
  "shock",
  "hypotension",
  "mottled",
  "poor perfusion",
  "lactate",
  "stridor",
  "upper airway obstruction",
  "choking",
  "foreign body aspiration",
  "หายใจไม่ออก",
  "หายใจไม่ขึ้น",
  "หายใจลำบากมาก",
  "เหนื่อยหอบมาก",
  "ซึม",
  "ไม่รู้สึกตัว",
  "ช็อก",
  "ความดันต่ำ",
];

const ER_VISIT_REASONS_FOR_OVERLAY: readonly VisitModeReasonCode[] = [
  "er_dyspnea_hypoxemia",
  "er_severe_dyspnea",
  "er_hypoxemia",
  "er_airway_severe",
];

const ASK_NEXT: string[] = [
  "Onset & progression — sudden vs gradual, worsening over minutes/hours",
  "Rest vs exertion — worse at rest suggests higher acuity",
  "Wheeze vs stridor — upper vs lower airway pattern",
  "Chest pain — pleuritic / cardiac / PE concern",
  "Fever / infection symptoms",
  "Response to bronchodilator / prior neb — partial vs none",
  "Aspiration / choking / foreign body — meal timing, gagging",
  "Allergy / anaphylaxis symptoms — urticaria, lip/tongue swelling, exposure",
  "Underlying asthma / COPD / CHF / ILD / OSA — baseline home O₂, recent steroids",
];

const EXAM_NEXT: string[] = [
  "RR — count; work of breathing",
  "SpO₂ — room air vs specify FiO₂ / device",
  "Work of breathing — WOB severity, use of accessory muscles",
  "Retractions — subcostal / intercostal / suprasternal",
  "Nasal flaring / grunting / audible stridor",
  "Auscultation — wheeze / crackles / rhonchi; air entry bilaterally",
  "Cyanosis — central vs peripheral",
  "Mental status — alertness, confusion, fatigue",
  "Perfusion — pulses, CRT, skin, BP when shock concern",
];

const EMERGENCY_ESCALATION_RULES: string[] = [
  "Severe respiratory distress — accessory muscles, unable to speak full sentences, exhaustion",
  "Central cyanosis",
  "Obstructed / absent effective breathing — stridor with distress, severe upper airway compromise, apneic spells",
  "Hypoxemia — low SpO₂ despite supplemental O₂ or on RA when critically low",
  "Reduced consciousness — somnolence, confusion, GCS concern",
  "Shock / perfusion failure — hypotension, mottling, poor CRT, lactate elevation when measured",
];

const OUTPUT_STYLE: string[] = [
  "Lead with immediate concern / stabilization (airway, breathing, oxygenation) — not CC/PI-first OPD layout.",
  "State triage concern + ABCDE / primary survey before long chronologic HPI when unstable.",
  "Separate vitals + SpO₂ + device from narrative fluff; document response to neb/O₂ when given.",
];

export type DyspneaHypoxemiaErOverlay =
  | { active: false }
  | {
      active: true;
      /** Why overlay applied */
      activationRationale: string[];
      factsAlreadyPresent: string[];
      askNext: string[];
      examNext: string[];
      /** Which emergency rules appear supported by text (advisory) */
      emergencyEscalationMatched: string[];
      emergencyEscalationRules: string[];
      outputStyleHints: string[];
      /** True when text supports high-acuity breathing emergency — emphasize non-OPD structure */
      emergencyEscalationLikely: boolean;
    };

function hasBreathingTrigger(normalizedText: string): boolean {
  const t = normalizedText;
  if (scoreKeysNegationAware(t, DYSPNEA_HYPOXEMIA_TRIGGER_KEYS) >= 1) return true;
  if (anyNonNegatedRegexMatch(t, /\bspo2\b|\bspo₂\b|\bo2\s*sat\b/i) && /\d/.test(t)) return true;
  if (anyNonNegatedRegexMatch(t, /short\s+of\s+breath|shortness\s+of\s+breath/i)) return true;
  if (
    anyNonNegatedRegexMatch(t, /\bcough\b/i) &&
    anyNonNegatedRegexMatch(t, /\b(severe|distress|tiring|paroxysmal)\b/i)
  ) {
    return true;
  }
  return false;
}

function matchEmergencyEscalation(normalizedText: string): string[] {
  const t = normalizedText;
  const out: string[] = [];
  const add = (cond: boolean, label: string) => {
    if (cond) out.push(label);
  };

  add(
    hasAnyKeywordNonNegated(t, [
      "severe respiratory distress",
      "respiratory distress",
      "respiratory failure",
      "severe dyspnea",
      "unable to speak",
      "speaks in words",
      "accessory muscle",
      "exhausted breathing",
    ]) ||
      anyNonNegatedRegexMatch(t, /\brespiratory\s+distress\b/i) ||
      anyNonNegatedRegexMatch(t, /\bsevere\s+dyspnea\b/i),
    "severe respiratory distress / severe dyspnea",
  );
  add(
    hasAnyKeywordNonNegated(t, ["central cyanosis", "cyanosis", "cyanotic", "ปากเขียว", "เขียว"]) ||
      anyNonNegatedRegexMatch(t, /\bcyanos/i),
    "cyanosis",
  );
  add(
    hasAnyKeywordNonNegated(t, [
      "stridor",
      "upper airway obstruction",
      "choking",
      "foreign body",
      "obstructed airway",
      "inability to swallow saliva",
      "drooling",
      "apnea",
      "apneic",
      "not breathing",
    ]) || anyNonNegatedRegexMatch(t, /\bairway\s+obstruction\b/i),
    "obstructed / critical airway pattern",
  );
  add(
    hasAnyKeywordNonNegated(t, ["hypoxemia", "hypoxemic", "hypoxia", "hypoxic", "low spo2", "low spo₂"]) ||
      anyNonNegatedRegexMatch(t, /\bspo2\s*(?:of\s*)?(?:8\d|9[0-2])\b/i) ||
      anyNonNegatedRegexMatch(t, /\bspo₂\s*(?:of\s*)?(?:8\d|9[0-2])\b/i) ||
      anyNonNegatedRegexMatch(t, /\b(?:oxygen\s+saturation|o2\s*sat)\s*(?:of\s*)?(?:8\d|9[0-2])\b/i) ||
      anyNonNegatedRegexMatch(t, /\b(?:8\d|9[0-2])\s*%\s*(?:on\s+)?(?:ra|room\s+air)\b/i),
    "hypoxemia / critical SpO₂ pattern",
  );
  add(
    hasAnyKeywordNonNegated(t, [
      "altered mental",
      "confusion",
      "decreased loc",
      "loss of consciousness",
      "unresponsive",
      "lethargic",
      "obtunded",
      "gcs",
      "ซึม",
      "ไม่รู้สึกตัว",
    ]),
    "reduced consciousness / altered MS",
  );
  add(
    hasAnyKeywordNonNegated(t, [
      "shock",
      "hypotension",
      "mottled",
      "poor perfusion",
      "lactate",
      "map",
      "ช็อก",
      "ความดันต่ำ",
    ]),
    "shock / perfusion concern",
  );

  return uniqStrings(out);
}

function uniqStrings(a: string[]): string[] {
  return [...new Set(a)];
}

function extractFacts(t: string): string[] {
  const out: string[] = [];
  const add = (cond: boolean, line: string) => {
    if (cond) out.push(line);
  };
  add(anyNonNegatedRegexMatch(t, /\bdyspnea|shortness of breath|หายใจลำบาก|เหนื่อยหอบ/i), "มีการกล่าวถึง dyspnea / SOB");
  add(anyNonNegatedRegexMatch(t, /\bwheeze|wheezing|หอบ|เสียงหวีด/i), "มีการกล่าวถึง wheeze");
  add(anyNonNegatedRegexMatch(t, /\bstridor|เสียงวีดคอ/i), "มีการกล่าวถึง stridor / upper airway sound");
  add(anyNonNegatedRegexMatch(t, /\bretraction|ซี่โครงบุ๋ม|เข้าซี่โครง/i), "มีการกล่าวถึง retraction / increased WOB");
  add(
    anyNonNegatedRegexMatch(t, /\bhypox|spo2|spo₂|o2 sat|oxygen saturation|ออกซิเจน/i),
    "มีการกล่าวถึง oxygenation / SpO₂ / hypoxemia",
  );
  add(anyNonNegatedRegexMatch(t, /\bcyanos|เขียว|ปากเขียว/i), "มีการกล่าวถึง cyanosis");
  add(anyNonNegatedRegexMatch(t, /\bcough.*(?:severe|distress)|severe cough/i), "มี severe cough / distress context");
  if (out.length === 0) out.push("มีคีย์เวิร์ดทางเดินหายใจ — เก็บ onset, SpO₂, และ work of breathing");
  return out.slice(0, 14);
}

function shouldActivateOverlay(
  mode: AssistMode,
  visitReason: VisitModeReasonCode,
  activePackIds: readonly OpdProblemPackId[],
  emergencyMatches: readonly string[],
): boolean {
  if (mode === "ER" || mode === "TRAUMA") return true;
  if (ER_VISIT_REASONS_FOR_OVERLAY.includes(visitReason)) return true;
  if (activePackIds.includes("er_dyspnea_hypoxemia")) return true;
  if (emergencyMatches.length > 0) return true;
  return false;
}

export function buildDyspneaHypoxemiaErOverlay(
  normalizedText: string,
  mode: AssistMode,
  visitReason: VisitModeReasonCode,
  activePackIds: readonly OpdProblemPackId[],
): DyspneaHypoxemiaErOverlay {
  if (!hasBreathingTrigger(normalizedText)) {
    return { active: false };
  }

  const emergencyMatched = matchEmergencyEscalation(normalizedText);
  const severeKeywords =
    hasAnyKeywordNonNegated(normalizedText, SEVERE_BREATHING_ESCALATION_KEYS) ||
    anyNonNegatedRegexMatch(normalizedText, /\brespiratory\s+distress\b/i);

  const emergencyLikely = emergencyMatched.length > 0 || severeKeywords;

  if (!shouldActivateOverlay(mode, visitReason, activePackIds, emergencyMatched) && !emergencyLikely) {
    return { active: false };
  }

  const rationale: string[] = [];
  if (mode === "ER") rationale.push("Visit mode ER — breathing overlay applies");
  if (mode === "TRAUMA") rationale.push("Visit mode TRAUMA — document breathing alongside primary/secondary survey when respiratory cues present");
  if (ER_VISIT_REASONS_FOR_OVERLAY.includes(visitReason)) {
    rationale.push(`Visit detection: ${visitReason}`);
  }
  if (activePackIds.includes("er_dyspnea_hypoxemia")) {
    rationale.push("ER symptom pack matched: er_dyspnea_hypoxemia");
  }
  if (emergencyMatched.length) {
    rationale.push("Text supports emergency escalation features — prioritize ABCs and stabilization");
  } else if (severeKeywords) {
    rationale.push("Severe breathing / distress keywords — do not use routine OPD-only structure");
  }
  if (rationale.length === 0) rationale.push("Breathing complaint with escalation context");

  return {
    active: true,
    activationRationale: rationale,
    factsAlreadyPresent: extractFacts(normalizedText),
    askNext: [...ASK_NEXT],
    examNext: [...EXAM_NEXT],
    emergencyEscalationMatched: emergencyMatched,
    emergencyEscalationRules: [...EMERGENCY_ESCALATION_RULES],
    outputStyleHints: [...OUTPUT_STYLE],
    emergencyEscalationLikely: emergencyLikely,
  };
}

export function formatDyspneaHypoxemiaErOverlayForAi(o: DyspneaHypoxemiaErOverlay): string {
  if (!o.active) return "(DYSPNEA_HYPOXEMIA_ER_OVERLAY inactive)";
  const lines = [
    "=== DYSPNEA / HYPOXEMIA — ER OVERLAY ===",
    o.emergencyEscalationLikely
      ? "URGENCY: Lead with airway/breathing/oxygenation and stabilization — NOT routine OPD narrative first."
      : "",
    "",
    "Activation rationale:",
    ...o.activationRationale.map((x) => `- ${x}`),
    "",
    "Facts already present:",
    ...o.factsAlreadyPresent.map((x) => `- ${x}`),
    "",
    "Ask next (history):",
    ...o.askNext.map((x) => `- ${x}`),
    "",
    "Examine next:",
    ...o.examNext.map((x) => `- ${x}`),
    "",
    "Emergency escalation — patterns suggested by text:",
    ...(o.emergencyEscalationMatched.length
      ? o.emergencyEscalationMatched.map((x) => `- ${x}`)
      : ["- (none strongly flagged — still complete RR/SpO₂/WOB)"]),
    "",
    "Emergency escalation — full rule list (documentation prompts):",
    ...o.emergencyEscalationRules.map((x) => `- ${x}`),
    "",
    "Output style:",
    ...o.outputStyleHints.map((x) => `- ${x}`),
  ].filter((line) => line !== "");
  return lines.join("\n");
}
