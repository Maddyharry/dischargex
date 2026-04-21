/**
 * ER-oriented seizure / altered mental status overlay — prioritize ABCs, neuro exam, and stabilization.
 * Rule layer only; does not replace clinical judgment.
 */
import type { AssistMode } from "./cardTypes";
import { anyNonNegatedRegexMatch, hasAnyKeywordNonNegated, scoreKeysNegationAware } from "./clinicalNegation";
import type { OpdProblemPackId } from "./opdProblemPacks";
import type { VisitModeReasonCode } from "./triggers";

/** Primary cues — negation-aware scoring */
export const SEIZURE_AMS_TRIGGER_KEYS = [
  "seizure",
  "convulsion",
  "convulsive",
  "tonic clonic",
  "tonic-clonic",
  "febrile seizure",
  "status epilepticus",
  "epilepsy",
  "postictal",
  "post-ictal",
  "unresponsive",
  "obtunded",
  "stupor",
  "coma",
  "drowsy",
  "drowsiness",
  "lethargic",
  "lethargy",
  "somnolent",
  "somnolence",
  "altered mental status",
  "altered mental",
  "altered consciousness",
  "confusion",
  "confused",
  "disoriented",
  "disorientation",
  "gcs",
  "decreased loc",
  "loss of consciousness",
  "ชัก",
  "กระตุก",
  "ชักเกร็ง",
  "ซึม",
  "ง่วงซึม",
  "สับสน",
  "ไม่รู้สึกตัว",
  "ไม่ตอบสนอง",
  "หมดสติ",
  "เป็นลม",
];

/** Strong cues — help activate in OPD when escalation is plausible */
const SEVERE_SEIZURE_AMS_ESCALATION_KEYS = [
  "status epilepticus",
  "ongoing seizure",
  "continuous seizure",
  "recurrent seizure",
  "multiple seizures",
  "seizure cluster",
  "not back to baseline",
  "not returning to baseline",
  "persistent altered",
  "unresponsive",
  "coma",
  "gcs 3",
  "gcs 4",
  "gcs 5",
  "gcs 6",
  "gcs 7",
  "gcs 8",
  "severe encephalopathy",
  "overdose",
  "poisoning",
  "intoxication",
  "hypoglycemia",
  "blood sugar 20",
  "blood sugar 30",
  "shock",
  "respiratory arrest",
  "apneic",
  "not breathing",
  "hypoxemia",
];

const ER_VISIT_REASONS_FOR_OVERLAY: readonly VisitModeReasonCode[] = ["er_seizure", "er_altered_mental_status"];

const ASK_NEXT: string[] = [
  "Duration of event(s) and number of episodes — single vs recurrent",
  "Return to baseline — full recovery vs persistent confusion / focal deficit",
  "Fever — infection / febrile seizure context",
  "Trauma — fall, head strike, tongue bite, incontinence (witnessed features)",
  "Toxin / drug exposure — meds, alcohol, recreational drugs, accidental ingestion",
  "Seizure history — known epilepsy, AEDs, adherence, prior similar events",
  "Headache / neck stiffness / vomiting — CNS infection or mass concern",
  "Poor intake / hypoglycemia symptoms — sweating, tremor, diabetes meds/insulin",
];

const EXAM_NEXT: string[] = [
  "ABC — airway protection, breathing pattern, circulation / perfusion",
  "Mental status / GCS — eye, verbal, motor if protocol; orientation",
  "Pupils — size, symmetry, reactivity",
  "Focal neurologic deficit — face, arm, leg, speech, visual fields",
  "Neck stiffness / meningismus — if clinically safe to assess",
  "Temperature — core if indicated",
  "Hydration / perfusion — skin, CRT, BP, HR",
  "Trauma signs — scalp, facial, Battle sign, raccoon eyes if mechanism fits",
];

const EMERGENCY_ESCALATION_RULES: string[] = [
  "Ongoing seizure / status epilepticus — time-critical stabilization pathway",
  "Recurrent seizures without full recovery between",
  "Not returning to baseline — persistent altered MS or focal deficit",
  "Severely reduced consciousness — GCS concern, unrousable, coma",
  "Shock, respiratory compromise, or hypoxemia alongside AMS/seizure",
];

const OUTPUT_STYLE: string[] = [
  "Lead with immediate concern / stabilization (ABC, airway protection, monitoring) — not CC/PI-first OPD layout.",
  "State triage concern + primary survey before long chronologic HPI when unstable.",
  "Document witnessed seizure features, postictal state, and neuro exam objectively — separate fact from inference.",
];

/** Syncope / faint — only when paired with concerning features (avoid routine benign syncope) */
const SYNCOPE_BASE = [
  "syncope",
  "presyncope",
  "fainting",
  "fainted",
  "passed out",
  "near syncope",
  "near-syncope",
  "เป็นลม",
];

const SYNCOPE_CONCERNING_FEATURES = [
  "head injury",
  "head strike",
  "trauma",
  "fall",
  "prolonged",
  "recurrent",
  "not recovered",
  "not back to baseline",
  "still confused",
  "chest pain",
  "palpitation",
  "palpitations",
  "exertional",
  "exercise",
  "tongue bite",
  "incontinence",
  "witnessed convulsion",
  "tonic",
  "jerking",
  "concerning",
  "worrisome",
  "exertional syncope",
];

export type SeizureAlteredMentalStatusErOverlay =
  | { active: false }
  | {
      active: true;
      activationRationale: string[];
      factsAlreadyPresent: string[];
      askNext: string[];
      examNext: string[];
      emergencyEscalationMatched: string[];
      emergencyEscalationRules: string[];
      outputStyleHints: string[];
      emergencyEscalationLikely: boolean;
    };

function hasConcerningSyncopePattern(normalizedText: string): boolean {
  const t = normalizedText;
  if (!hasAnyKeywordNonNegated(t, SYNCOPE_BASE)) return false;
  return hasAnyKeywordNonNegated(t, SYNCOPE_CONCERNING_FEATURES);
}

function hasSeizureAmsTrigger(normalizedText: string): boolean {
  const t = normalizedText;
  if (scoreKeysNegationAware(t, SEIZURE_AMS_TRIGGER_KEYS) >= 1) return true;
  if (hasConcerningSyncopePattern(t)) return true;
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
      "status epilepticus",
      "ongoing seizure",
      "continuous seizure",
      "still seizing",
    ]) || anyNonNegatedRegexMatch(t, /\bseizure\s+activity\s+ongoing\b/i),
    "ongoing seizure / status epilepticus pattern",
  );
  add(
    hasAnyKeywordNonNegated(t, [
      "recurrent seizure",
      "recurrent seizures",
      "multiple seizures",
      "second seizure",
      "seizure cluster",
    ]),
    "recurrent seizures",
  );
  add(
    hasAnyKeywordNonNegated(t, [
      "not back to baseline",
      "not returning to baseline",
      "persistent confusion",
      "persistent altered",
      "still obtunded",
      "not waking up",
    ]) || anyNonNegatedRegexMatch(t, /\bnot\s+back\s+to\s+baseline\b/i),
    "not returning to baseline",
  );
  add(
    hasAnyKeywordNonNegated(t, [
      "unresponsive",
      "coma",
      "comatose",
      "gcs 3",
      "gcs 4",
      "gcs 5",
      "gcs 6",
      "gcs 7",
      "gcs 8",
      "severe encephalopathy",
      "obtunded",
      "stupor",
      "ไม่รู้สึกตัว",
      "ไม่ตอบสนอง",
    ]) || anyNonNegatedRegexMatch(t, /\bgcs\s*(?:=|:)?\s*[3-8]\b/i),
    "severely reduced consciousness",
  );
  add(
    hasAnyKeywordNonNegated(t, [
      "shock",
      "hypotension",
      "respiratory arrest",
      "respiratory failure",
      "apneic",
      "not breathing",
      "hypoxemia",
      "hypoxic",
      "poor perfusion",
      "mottled",
    ]),
    "shock or breathing compromise",
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
  add(anyNonNegatedRegexMatch(t, /\bseizure|convulsion|status|epilep|postictal|ชัก|กระตุก/i), "มีการกล่าวถึง seizure / convulsion / postictal");
  add(
    anyNonNegatedRegexMatch(t, /\bunresponsive|coma|obtund|stupor|altered mental|confusion|disorient|gcs|ซึม|สับสน/i),
    "มีการกล่าวถึง AMS / reduced consciousness",
  );
  add(anyNonNegatedRegexMatch(t, /\bdrowsy|lethargic|somnol/i), "มีการกล่าวถึง drowsiness / lethargy");
  add(hasConcerningSyncopePattern(t), "มี syncope / faint พร้อม concerning features");
  add(anyNonNegatedRegexMatch(t, /\boverdose|poisoning|toxin|intoxicat/i), "มีการกล่าวถึง toxin / overdose context");
  if (out.length === 0) out.push("มีคีย์เวิร์ด seizure/AMS — เก็บ duration, baseline, และ neuro exam");
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
  if (activePackIds.includes("er_seizure_ams")) return true;
  if (emergencyMatches.length > 0) return true;
  return false;
}

export function buildSeizureAlteredMentalStatusErOverlay(
  normalizedText: string,
  mode: AssistMode,
  visitReason: VisitModeReasonCode,
  activePackIds: readonly OpdProblemPackId[],
): SeizureAlteredMentalStatusErOverlay {
  if (!hasSeizureAmsTrigger(normalizedText)) {
    return { active: false };
  }

  const emergencyMatched = matchEmergencyEscalation(normalizedText);
  const severeKeywords = hasAnyKeywordNonNegated(normalizedText, SEVERE_SEIZURE_AMS_ESCALATION_KEYS);

  const emergencyLikely = emergencyMatched.length > 0 || severeKeywords;

  if (!shouldActivateOverlay(mode, visitReason, activePackIds, emergencyMatched) && !emergencyLikely) {
    return { active: false };
  }

  const rationale: string[] = [];
  if (mode === "ER") rationale.push("Visit mode ER — seizure / AMS overlay applies");
  if (mode === "TRAUMA") rationale.push("Visit mode TRAUMA — neuro / AMS alongside mechanism and surveys");
  if (ER_VISIT_REASONS_FOR_OVERLAY.includes(visitReason)) {
    rationale.push(`Visit detection: ${visitReason}`);
  }
  if (activePackIds.includes("er_seizure_ams")) {
    rationale.push("ER symptom pack matched: er_seizure_ams");
  }
  if (emergencyMatched.length) {
    rationale.push("Text supports emergency escalation — lead with stabilization and monitoring");
  } else if (severeKeywords) {
    rationale.push("High-acuity neuro keywords — do not bury in routine OPD-only structure");
  }
  if (hasConcerningSyncopePattern(normalizedText)) {
    rationale.push("Concerning syncope pattern — distinguish from seizure; document witnesses and recovery");
  }
  if (rationale.length === 0) rationale.push("Seizure / AMS presentation with escalation context");

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

export function formatSeizureAlteredMentalStatusErOverlayForAi(o: SeizureAlteredMentalStatusErOverlay): string {
  if (!o.active) return "(SEIZURE_ALTERED_MENTAL_STATUS_ER_OVERLAY inactive)";
  const lines = [
    "=== SEIZURE / ALTERED MENTAL STATUS — ER OVERLAY ===",
    o.emergencyEscalationLikely
      ? "URGENCY: Lead with ABCs, immediate concern, and stabilization — NOT routine OPD narrative first."
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
      : ["- (none strongly flagged — still complete GCS, pupils, and focal exam)"]),
    "",
    "Emergency escalation — full rule list (documentation prompts):",
    ...o.emergencyEscalationRules.map((x) => `- ${x}`),
    "",
    "Output style:",
    ...o.outputStyleHints.map((x) => `- ${x}`),
  ].filter((line) => line !== "");
  return lines.join("\n");
}
