/**
 * ER-oriented shock / sepsis concern overlay — hypoperfusion, septic shock, sepsis-mimics.
 * Rule layer only; does not replace sepsis bundles or local protocol.
 */
import type { AssistMode } from "./cardTypes";
import { anyNonNegatedRegexMatch, hasAnyKeywordNonNegated, scoreKeysNegationAware } from "./clinicalNegation";
import type { OpdProblemPackId } from "./opdProblemPacks";
import type { VisitModeReasonCode } from "./triggers";

/** Broad triggers (negation-aware via scoring) */
export const SEPSIS_SHOCK_TRIGGER_KEYS = [
  "sepsis",
  "septic",
  "septic shock",
  "bacteremia",
  "fungemia",
  "endotoxin",
  "sirs",
  "qsofa",
  "sofa",
  "news score",
  "vasopressor",
  "norepinephrine",
  "noradrenaline",
  "vasopressin",
  "dopamine drip",
  "shock",
  "hypoperfusion",
  "hypotension",
  "hypotensive",
  "map ",
  "mean arterial",
  "lactate",
  "lactic acidosis",
  "mottled",
  "mottling",
  "poor perfusion",
  "delayed capillary",
  "capillary refill",
  "crt ",
  "oliguria",
  "anuria",
  "rigors",
  "chills",
  "tachycardia",
  "tachypnea",
  "febrile",
  "pyrexia",
  "urosepsis",
  "pneumonia sepsis",
  "abdominal sepsis",
  "line infection",
  "catheter infection",
  "cellulitis",
  "nec fasc",
  "necrotizing fasciitis",
  "meningitis",
  "ช็อก",
  "ความดันต่ำ",
  "bp ต่ำ",
  "ติดเชื้อในเลือด",
  "ไข้หนาวสั่น",
  "ปัสสาวะน้อย",
  "ซีดเย็น",
  "รอบปากเขียว",
];

const SEVERE_ESCALATION_KEYS = [
  "septic shock",
  "refractory shock",
  "vasopressor",
  "norepinephrine",
  "lactate 4",
  "lactate elevated",
  "map <",
  "map 6",
  "sbp <",
  "sbp 9",
  "hypotension",
  "unresponsive",
  "obtunded",
  "gcs",
  "anuria",
  "oliguria",
  "mottled",
  "cold clammy",
];

const ER_VISIT_REASONS_FOR_OVERLAY: readonly VisitModeReasonCode[] = [
  "er_shock_perfusion",
  "er_systemic_red_flags",
  "er_severe_dehydration",
  "er_fever_danger_pediatric",
  "er_gi_severe_dehydration",
];

const ASK_NEXT: string[] = [
  "Suspected infection source (lung, urine, abdomen, skin/soft tissue, line, CNS, other)",
  "Duration of fever / symptom onset",
  "Altered mental status — confusion, somnolence, agitation",
  "Feeding / drinking (especially pediatrics)",
  "Urine output — last void, catheter, oliguria",
  "Dyspnea or work of breathing",
  "Chills / rigors",
  "Immunocompromise — steroids, chemo, transplant, HIV, asplenia",
  "Recent procedures, lines, drains, wounds, hospitalization",
  "GI symptoms — diarrhea, vomiting, abdominal pain, melena",
  "Urinary symptoms — dysuria, flank, retention",
  "Respiratory symptoms — cough, sputum, pleuritic pain",
];

const EXAM_NEXT: string[] = [
  "Blood pressure / MAP — trend awareness; orthostasis if safe",
  "HR, RR, SpO₂, temperature",
  "Capillary refill / peripheral perfusion",
  "Pulse quality (bounding vs weak)",
  "Extremity temperature — warm vs cool, asymmetry",
  "Mental status — alertness, orientation, GCS if indicated",
  "Urine output history / bladder / Foley",
  "Source-focused exam — chest, abdomen, skin, joints, devices, neuro",
  "Lactate if workflow supports",
  "Glucose — hypoglycemia / hyperglycemia if indicated",
];

const PERTINENT_NEGATIVES: string[] = [
  "No hypotension — if absent",
  "No poor perfusion — if absent",
  "No altered mental status — if absent",
  "No oliguria — if absent",
  "No respiratory distress — if absent",
];

const CLINICAL_RULES: string[] = [
  "If hypoperfusion or septic shock concern is present — move immediate management (access, fluids, monitoring, source control planning, antibiotics per protocol) to the top of the note; not CC/PI-first OPD layout.",
  "Adults: support lactate measurement; early antibiotics when septic shock or high-likelihood sepsis; crystalloid resuscitation per institutional pathway; reassess perfusion and volume response.",
  "Children: support lactate when available; obtain cultures before antibiotics when feasible without meaningful delay; rapid antibiotics when suspected septic shock; bolus and reassess per pediatric sepsis pathway.",
  "Continuously re-evaluate for non-infectious mimics (hypovolemia, cardiogenic shock, obstruction, endocrine, toxin, anaphylaxis) when infection source is uncertain.",
];

const EMERGENCY_ESCALATION_RULES: string[] = [
  "Hypotension or MAP below threshold with infection concern",
  "Lactate elevation or rising lactate",
  "Altered mental status with systemic illness",
  "Oliguria / anuria with shock physiology",
  "Need for vasopressors or refractory hypotension",
  "Mottled / cold peripheries with tachycardia",
];

const OUTPUT_STYLE: string[] = [
  "Lead with circulation / perfusion and immediate stabilization — not benign OPD chronology first.",
  "Document vitals, lactate (if measured), fluid response, and antibiotic timing when sepsis suspected.",
  "Separate suspected source from undifferentiated shock when evidence is incomplete.",
];

export type SepsisShockErOverlay =
  | { active: false }
  | {
      active: true;
      activationRationale: string[];
      factsAlreadyPresent: string[];
      askNext: string[];
      examNext: string[];
      pertinentNegatives: string[];
      clinicalRulesAdultPediatric: string[];
      emergencyEscalationMatched: string[];
      emergencyEscalationRules: string[];
      outputStyleHints: string[];
      emergencyEscalationLikely: boolean;
    };

function hasSepsisShockTrigger(normalizedText: string): boolean {
  return scoreKeysNegationAware(normalizedText, SEPSIS_SHOCK_TRIGGER_KEYS) >= 1;
}

function matchEmergencyEscalation(normalizedText: string): string[] {
  const t = normalizedText;
  const out: string[] = [];
  const add = (cond: boolean, label: string) => {
    if (cond) out.push(label);
  };

  add(
    hasAnyKeywordNonNegated(t, ["septic shock", "refractory shock", "vasopressor", "norepinephrine", "noradrenaline"]),
    "septic shock / vasopressor need",
  );
  add(
    hasAnyKeywordNonNegated(t, ["hypotension", "hypotensive", "map ", "sbp ", "bp 8", "bp 9", "ความดันต่ำ", "bp ต่ำ"]) ||
      anyNonNegatedRegexMatch(t, /\bmap\s*[<>]?\s*\d{2}/i),
    "hypotension / MAP concern",
  );
  add(
    hasAnyKeywordNonNegated(t, ["lactate", "lactic acidosis", "elevated lactate"]) ||
      anyNonNegatedRegexMatch(t, /\blactate\s*\d/i),
    "lactate elevation / measured",
  );
  add(
    hasAnyKeywordNonNegated(t, ["altered mental", "confusion", "obtunded", "lethargic", "unresponsive", "gcs", "ซึม"]),
    "altered mental status",
  );
  add(hasAnyKeywordNonNegated(t, ["oliguria", "anuria", "low urine", "ปัสสาวะน้อย"]), "oliguria / anuria");
  add(
    hasAnyKeywordNonNegated(t, ["mottled", "poor perfusion", "cold clammy", "delayed capillary", "crt"]),
    "poor perfusion / mottling",
  );

  return [...new Set(out)];
}

function extractFacts(t: string): string[] {
  const out: string[] = [];
  const add = (cond: boolean, line: string) => {
    if (cond) out.push(line);
  };
  add(anyNonNegatedRegexMatch(t, /\bsepsis|septic|shock|bacteremia/i), "มีการกล่าวถึง sepsis / shock / infection concern");
  add(anyNonNegatedRegexMatch(t, /\bfever|febrile|pyrexia|ไข้/i), "มี fever context");
  add(anyNonNegatedRegexMatch(t, /\bhypotension|map |sbp |ความดันต่ำ/i), "มี hypotension / BP context");
  add(anyNonNegatedRegexMatch(t, /\blactate/i), "มี lactate");
  add(anyNonNegatedRegexMatch(t, /\boliguria|anuria|urine output/i), "มี urine output concern");
  if (out.length === 0) out.push("มีคีย์เวิร์ด shock/sepsis — เก็บ source, vitals, perfusion, และ response to treatment");
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
  if (activePackIds.includes("er_sepsis_shock")) return true;
  if (emergencyMatches.length > 0) return true;
  return false;
}

export function buildSepsisShockErOverlay(
  normalizedText: string,
  mode: AssistMode,
  visitReason: VisitModeReasonCode,
  activePackIds: readonly OpdProblemPackId[],
): SepsisShockErOverlay {
  if (!hasSepsisShockTrigger(normalizedText)) {
    return { active: false };
  }

  const emergencyMatched = matchEmergencyEscalation(normalizedText);
  const severeKeywords = scoreKeysNegationAware(normalizedText, SEVERE_ESCALATION_KEYS) >= 1;
  const emergencyLikely = emergencyMatched.length > 0 || severeKeywords;

  if (!shouldActivateOverlay(mode, visitReason, activePackIds, emergencyMatched) && !emergencyLikely) {
    return { active: false };
  }

  const rationale: string[] = [];
  if (mode === "ER") rationale.push("Visit mode ER — shock/sepsis overlay applies");
  if (mode === "TRAUMA") rationale.push("Visit mode TRAUMA — assess perfusion and secondary hits for infection/shock when cues present");
  if (ER_VISIT_REASONS_FOR_OVERLAY.includes(visitReason)) {
    rationale.push(`Visit detection: ${visitReason}`);
  }
  if (activePackIds.includes("er_sepsis_shock")) {
    rationale.push("ER symptom pack matched: er_sepsis_shock");
  }
  if (emergencyMatched.length) {
    rationale.push("Text supports hypoperfusion / sepsis escalation — prioritize circulation and immediate management");
  } else if (severeKeywords) {
    rationale.push("Severe shock / sepsis keywords — do not use routine OPD-only structure");
  }
  if (rationale.length === 0) rationale.push("Shock or sepsis concern with escalation context");

  return {
    active: true,
    activationRationale: rationale,
    factsAlreadyPresent: extractFacts(normalizedText),
    askNext: [...ASK_NEXT],
    examNext: [...EXAM_NEXT],
    pertinentNegatives: [...PERTINENT_NEGATIVES],
    clinicalRulesAdultPediatric: [...CLINICAL_RULES],
    emergencyEscalationMatched: emergencyMatched,
    emergencyEscalationRules: [...EMERGENCY_ESCALATION_RULES],
    outputStyleHints: [...OUTPUT_STYLE],
    emergencyEscalationLikely: emergencyLikely,
  };
}

export function formatSepsisShockErOverlayForAi(o: SepsisShockErOverlay): string {
  if (!o.active) return "(SEPSIS_SHOCK_ER_OVERLAY inactive)";
  const lines = [
    "=== SHOCK / SEPSIS CONCERN — ER OVERLAY ===",
    o.emergencyEscalationLikely
      ? "URGENCY: Lead with circulation, perfusion, and immediate management — NOT routine OPD narrative first."
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
    "Pertinent negatives (document if absent after assessment):",
    ...o.pertinentNegatives.map((x) => `- ${x}`),
    "",
    "Clinical rules (adult / pediatric):",
    ...o.clinicalRulesAdultPediatric.map((x) => `- ${x}`),
    "",
    "Emergency escalation — patterns suggested by text:",
    ...(o.emergencyEscalationMatched.length
      ? o.emergencyEscalationMatched.map((x) => `- ${x}`)
      : ["- (none strongly flagged — still complete vitals/perfusion/source exam)"]),
    "",
    "Emergency escalation — full rule list:",
    ...o.emergencyEscalationRules.map((x) => `- ${x}`),
    "",
    "Output style:",
    ...o.outputStyleHints.map((x) => `- ${x}`),
  ].filter((line) => line !== "");
  return lines.join("\n");
}
