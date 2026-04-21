/**
 * ER-oriented suspected anaphylaxis overlay — IM epinephrine + ABCs; not “rash only”.
 * Rule layer only; does not replace local protocol or clinical judgment.
 */
import type { AssistMode } from "./cardTypes";
import { anyNonNegatedRegexMatch, hasAnyKeywordNonNegated, scoreKeysNegationAware } from "./clinicalNegation";
import type { OpdProblemPackId } from "./opdProblemPacks";
import type { VisitModeReasonCode } from "./triggers";

/** High-signal single cues (negation-aware via scoring) */
export const ANAPHYLAXIS_DIRECT_KEYS = [
  "anaphylaxis",
  "anaphylactic",
  "anaphylactoid",
  "epipen",
  "epi-pen",
  "epinephrine given",
  "adrenaline given",
  "sudden allergic reaction",
  "severe allergic reaction",
  "acute allergic reaction",
  "allergic emergency",
  "tongue swelling",
  "lip swelling",
  "facial swelling",
  "throat closing",
  "airway swelling",
  "angioedema",
  "เอปินีฟริน",
  "ลมพิษรุนแรง",
  "แพ้รุนแรง",
  "ช็อกแพ้",
];

const SKIN_KEYS = [
  "urticaria",
  "hives",
  "ลมพิษ",
  "ผื่นลมพิษ",
  "ผื่นแพ้",
  "generalized rash",
  "wheal",
];

const RESPIRATORY_COMPROMISE_KEYS = [
  "wheeze",
  "wheezing",
  "stridor",
  "dyspnea",
  "shortness of breath",
  "respiratory distress",
  "hypoxemia",
  "hypoxic",
  "spo2",
  "spo₂",
  "หอบ",
  "หายใจลำบาก",
  "เสียงหวีด",
  "เสียงวี้ด",
];

const UPPER_AIRWAY_KEYS = [
  "throat tightness",
  "throat tight",
  "voice change",
  "hoarse",
  "dysphagia",
  "difficulty swallowing",
  "swallowing difficulty",
  "odynophagia",
  "กลืนลำบาก",
  "เจ็บคอแน่น",
];

const CIRCULATORY_KEYS = [
  "hypotension",
  "hypotensive",
  "shock",
  "syncope",
  "syncopal",
  "presyncope",
  "passed out",
  "mottled",
  "poor perfusion",
  "ช็อก",
  "ความดันต่ำ",
  "เป็นลม",
  "หมดสติ",
];

const EXPOSURE_KEYS = [
  "after eating",
  "after food",
  "after peanut",
  "after nuts",
  "after shellfish",
  "after egg",
  "after milk",
  "after medication",
  "after drug",
  "after antibiotic",
  "bee sting",
  "insect sting",
  "wasp",
  "jellyfish",
  "contrast",
  "latex",
  "exposure",
  "sting",
];

const GI_AFTER_ALLERGEN_KEYS = [
  "vomiting",
  "nausea",
  "abdominal pain",
  "abdominal cramp",
  "diarrhea",
  "อาเจียน",
  "คลื่นไส้",
  "ปวดท้อง",
  "ท้องเสีย",
];

const SEVERE_ESCALATION_KEYS = [
  "anaphylaxis",
  "respiratory distress",
  "hypotension",
  "shock",
  "stridor",
  "upper airway obstruction",
  "unresponsive",
  "coma",
  "epipen",
  "epinephrine given",
];

const ER_VISIT_REASONS_FOR_OVERLAY: readonly VisitModeReasonCode[] = ["er_anaphylaxis"];

const ASK_NEXT: string[] = [
  "Trigger exposure — food / drug / insect / contrast / latex / other",
  "Timing after exposure — minutes; progression speed",
  "Breathing difficulty — wheeze, stridor, work of breathing, SpO₂",
  "Throat tightness / voice change / swallowing difficulty",
  "Dizziness / syncope / presyncope",
  "GI symptoms — nausea, vomiting, abdominal pain, diarrhea",
  "Prior anaphylaxis or severe allergy history",
  "Prior epinephrine (IM) given or not — time, dose, response",
];

const EXAM_NEXT: string[] = [
  "Airway patency — swelling, voice, stridor, ability to handle secretions",
  "Breathing — wheeze, work of breathing, SpO₂ (room air vs oxygen)",
  "Circulation — BP/MAP, HR, CRT, skin perfusion",
  "Skin — urticaria distribution, angioedema (face, lips, tongue)",
  "Mental status — anxiety, confusion, level of alertness",
  "Progression — improving vs stable vs worsening after intervention",
];

const IMMEDIATE_MANAGEMENT: string[] = [
  "IM epinephrine is first-line for suspected anaphylaxis — document route/site and time per local protocol (adult vs pediatric dosing).",
  "Prioritize airway, breathing, circulation — positioning, oxygen, IV access, fluids when indicated; prepare for escalation.",
  "Urgent monitoring and reassessment — repeat exam after interventions; observe biphasic risk per protocol.",
  "Adjuncts (antihistamine, steroid, bronchodilator) do not replace epinephrine for anaphylaxis treatment narrative — document as adjuncts.",
];

const STEWARDSHIP_RULES: string[] = [
  "Do not document suspected anaphylaxis as simple cutaneous rash only when respiratory, circulatory, or significant mucosal involvement is present.",
  "Urticaria alone is not always anaphylaxis — but urticaria with respiratory OR circulatory compromise is high priority for ABCs and epinephrine consideration.",
  "Separate suspected anaphylaxis from isolated mild urticaria when the chart supports the distinction.",
];

const EMERGENCY_ESCALATION_RULES: string[] = [
  "Airway compromise — angioedema, stridor, severe throat symptoms, hypoxemia",
  "Circulatory collapse — hypotension, shock, syncope with allergic context",
  "Rapid progression or inadequate response to initial therapy",
  "Severe bronchospasm or respiratory distress",
];

export type AnaphylaxisErOverlay =
  | { active: false }
  | {
      active: true;
      activationRationale: string[];
      factsAlreadyPresent: string[];
      askNext: string[];
      examNext: string[];
      immediateManagementHints: string[];
      stewardshipRules: string[];
      emergencyEscalationMatched: string[];
      emergencyEscalationRules: string[];
      outputStyleHints: string[];
      emergencyEscalationLikely: boolean;
    };

function hasSkinCue(t: string): boolean {
  return scoreKeysNegationAware(t, SKIN_KEYS) >= 1;
}

function hasRespiratoryOrUpperAirway(t: string): boolean {
  return (
    hasAnyKeywordNonNegated(t, RESPIRATORY_COMPROMISE_KEYS) || hasAnyKeywordNonNegated(t, UPPER_AIRWAY_KEYS)
  );
}

function hasCirculatoryCue(t: string): boolean {
  return hasAnyKeywordNonNegated(t, CIRCULATORY_KEYS);
}

function hasExposureCue(t: string): boolean {
  return hasAnyKeywordNonNegated(t, EXPOSURE_KEYS) || anyNonNegatedRegexMatch(t, /\bafter\s+\w+/i);
}

function hasGiWithAllergenContext(t: string): boolean {
  const gi = hasAnyKeywordNonNegated(t, GI_AFTER_ALLERGEN_KEYS);
  const allergen = hasExposureCue(t) || hasAnyKeywordNonNegated(t, ["allergen", "allergy", "แพ้"]);
  const skinOrAllergy = hasSkinCue(t) || hasAnyKeywordNonNegated(t, ANAPHYLAXIS_DIRECT_KEYS);
  return gi && allergen && skinOrAllergy;
}

function hasUrticariaPlusSystemic(t: string): boolean {
  if (!hasSkinCue(t)) return false;
  return hasRespiratoryOrUpperAirway(t) || hasCirculatoryCue(t);
}

function hasStridorOrWheezeAfterExposure(t: string): boolean {
  const resp = anyNonNegatedRegexMatch(t, /\b(stridor|wheeze|wheezing)\b/i);
  const after = hasExposureCue(t) || anyNonNegatedRegexMatch(t, /\bafter\s+(eating|sting|food|medication|drug)\b/i);
  return resp && after;
}

/** Hypotension/syncope in an allergic / exposure / skin context — not isolated chronic hypotension */
function hasCirculatoryWithAllergicContext(t: string): boolean {
  if (!hasCirculatoryCue(t)) return false;
  return (
    hasSkinCue(t) ||
    hasExposureCue(t) ||
    scoreKeysNegationAware(t, ANAPHYLAXIS_DIRECT_KEYS) >= 1 ||
    anyNonNegatedRegexMatch(t, /\ballergic\s+reaction\b/i)
  );
}

function hasAnaphylaxisTrigger(normalizedText: string): boolean {
  const t = normalizedText;
  if (scoreKeysNegationAware(t, ANAPHYLAXIS_DIRECT_KEYS) >= 1) return true;
  if (hasUrticariaPlusSystemic(t)) return true;
  if (hasStridorOrWheezeAfterExposure(t)) return true;
  if (hasCirculatoryWithAllergicContext(t)) return true;
  if (hasGiWithAllergenContext(t)) return true;
  if (
    anyNonNegatedRegexMatch(t, /\ballergic\s+reaction\b/i) &&
    (hasRespiratoryOrUpperAirway(t) || hasCirculatoryCue(t))
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
    hasAnyKeywordNonNegated(t, ["stridor", "throat closing", "airway swelling", "upper airway obstruction", "inability to swallow saliva"]) ||
      (hasAnyKeywordNonNegated(t, ["angioedema", "tongue swelling", "lip swelling"]) && hasRespiratoryOrUpperAirway(t)),
    "airway / significant angioedema concern",
  );
  add(
    hasAnyKeywordNonNegated(t, ["hypotension", "shock", "mottled", "poor perfusion", "syncope", "unresponsive"]) &&
      (hasSkinCue(t) || hasAnyKeywordNonNegated(t, ANAPHYLAXIS_DIRECT_KEYS)),
    "circulatory compromise in allergic context",
  );
  add(
    hasAnyKeywordNonNegated(t, ["respiratory distress", "severe dyspnea", "hypoxemia", "hypoxic"]) &&
      (hasSkinCue(t) || hasAnyKeywordNonNegated(t, ANAPHYLAXIS_DIRECT_KEYS)),
    "respiratory compromise in allergic context",
  );
  add(hasAnyKeywordNonNegated(t, ["anaphylaxis", "epipen", "epinephrine given"]), "treated or explicit anaphylaxis pathway");

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
  add(hasAnyKeywordNonNegated(t, ANAPHYLAXIS_DIRECT_KEYS), "มีการกล่าวถึง anaphylaxis / severe allergy / epinephrine context");
  add(hasSkinCue(t), "มีการกล่าวถึง urticaria / skin involvement");
  add(hasRespiratoryOrUpperAirway(t), "มีการกล่าวถึง breathing หรือ upper airway symptoms");
  add(hasCirculatoryCue(t), "มีการกล่าวถึง circulatory symptoms");
  add(hasExposureCue(t), "มีการกล่าวถึง exposure / timing context");
  if (out.length === 0) out.push("มีคีย์เวิร์ดแพ้ / anaphylaxis — เก็บ trigger, timeline, และ ABC");
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
  if (activePackIds.includes("er_anaphylaxis") || activePackIds.includes("allergy_urticaria_anaphylaxis")) return true;
  if (emergencyMatches.length > 0) return true;
  return false;
}

export function buildAnaphylaxisErOverlay(
  normalizedText: string,
  mode: AssistMode,
  visitReason: VisitModeReasonCode,
  activePackIds: readonly OpdProblemPackId[],
): AnaphylaxisErOverlay {
  if (!hasAnaphylaxisTrigger(normalizedText)) {
    return { active: false };
  }

  const emergencyMatched = matchEmergencyEscalation(normalizedText);
  const severeKeywords = hasAnyKeywordNonNegated(normalizedText, SEVERE_ESCALATION_KEYS);
  const emergencyLikely = emergencyMatched.length > 0 || severeKeywords;

  if (!shouldActivateOverlay(mode, visitReason, activePackIds, emergencyMatched) && !emergencyLikely) {
    return { active: false };
  }

  const rationale: string[] = [];
  if (mode === "ER") rationale.push("Visit mode ER — suspected anaphylaxis overlay applies");
  if (mode === "TRAUMA") rationale.push("Visit mode TRAUMA — consider anaphylactoid / exposure in context");
  if (ER_VISIT_REASONS_FOR_OVERLAY.includes(visitReason)) rationale.push(`Visit detection: ${visitReason}`);
  if (activePackIds.includes("er_anaphylaxis")) rationale.push("ER symptom pack matched: er_anaphylaxis");
  if (activePackIds.includes("allergy_urticaria_anaphylaxis")) {
    rationale.push("Problem pack matched: allergy_urticaria_anaphylaxis");
  }
  if (hasUrticariaPlusSystemic(normalizedText)) {
    rationale.push("Skin involvement plus respiratory or circulatory features — prioritize over rash-only narrative");
  }
  if (emergencyMatched.length) rationale.push("Text supports emergency escalation patterns");
  if (rationale.length === 0) rationale.push("Allergic / anaphylaxis presentation with escalation context");

  const outputStyleHints = [
    "Lead with triage concern + ABC + immediate management (epinephrine IM when indicated) — not routine OPD CC/PI first.",
    "Document exposure, timing, and response to treatment; state reassessment plan.",
  ];

  return {
    active: true,
    activationRationale: rationale,
    factsAlreadyPresent: extractFacts(normalizedText),
    askNext: [...ASK_NEXT],
    examNext: [...EXAM_NEXT],
    immediateManagementHints: [...IMMEDIATE_MANAGEMENT],
    stewardshipRules: [...STEWARDSHIP_RULES],
    emergencyEscalationMatched: emergencyMatched,
    emergencyEscalationRules: [...EMERGENCY_ESCALATION_RULES],
    outputStyleHints,
    emergencyEscalationLikely: emergencyLikely,
  };
}

export function formatAnaphylaxisErOverlayForAi(o: AnaphylaxisErOverlay): string {
  if (!o.active) return "(ANAPHYLAXIS_ER_OVERLAY inactive)";
  const lines = [
    "=== SUSPECTED ANAPHYLAXIS — ER OVERLAY ===",
    o.emergencyEscalationLikely
      ? "URGENCY: Suspected anaphylaxis — IM epinephrine first-line per protocol; ABC before long HPI."
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
    "Immediate management (rule hints — align with local protocol):",
    ...o.immediateManagementHints.map((x) => `- ${x}`),
    "",
    "Stewardship / documentation rules:",
    ...o.stewardshipRules.map((x) => `- ${x}`),
    "",
    "Emergency escalation — patterns suggested by text:",
    ...(o.emergencyEscalationMatched.length
      ? o.emergencyEscalationMatched.map((x) => `- ${x}`)
      : ["- (none strongly flagged — still complete airway, breathing, circulation, skin)"]),
    "",
    "Emergency escalation — full rule list:",
    ...o.emergencyEscalationRules.map((x) => `- ${x}`),
    "",
    "Output style:",
    ...o.outputStyleHints.map((x) => `- ${x}`),
  ].filter((line) => line !== "");
  return lines.join("\n");
}
