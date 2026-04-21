/**
 * ER-oriented poisoning / overdose overlay — stabilization-first documentation and tox-oriented prompts.
 * Rule layer only; does not replace poison center or local protocol.
 */
import type { AssistMode } from "./cardTypes";
import { anyNonNegatedRegexMatch, hasAnyKeywordNonNegated, scoreKeysNegationAware } from "./clinicalNegation";
import type { OpdProblemPackId } from "./opdProblemPacks";
import type { VisitModeReasonCode } from "./triggers";

export const POISONING_OVERDOSE_TRIGGER_KEYS = [
  "overdose",
  "poisoning",
  "poisoned",
  "toxic ingestion",
  "ingestion",
  "intoxication",
  "toxidrome",
  "acetaminophen",
  "paracetamol",
  "salicylate",
  "aspirin overdose",
  "tricyclic",
  "tca ",
  "tcas",
  "opioid",
  "naloxone",
  "narcan",
  "benzodiazepine",
  "organophosphate",
  "carbon monoxide",
  "co poisoning",
  "ethylene glycol",
  "methanol",
  "iron toxicity",
  "lithium toxicity",
  "digoxin toxicity",
  "beta blocker overdose",
  "calcium channel blocker",
  "ccb overdose",
  "pill overdose",
  "took too many",
  "unknown pills",
  "กินยาเกิน",
  "กินยาผิด",
  "สารพิษ",
  "ยาพิษ",
  "กินยาฆ่าตัวตาย",
  "ฆ่าตัวตายด้วยยา",
];

const SEVERE_ESCALATION_KEYS = [
  "unresponsive",
  "gcs",
  "respiratory depression",
  "respiratory arrest",
  "apneic",
  "seizure",
  "status epilepticus",
  "wide qrs",
  "qtc",
  "ventricular tachycardia",
  "vtach",
  "hypotension",
  "shock",
  "cardiac arrest",
  "intubated",
  "coma",
  "obtunded",
];

const ER_VISIT_REASONS_FOR_OVERLAY: readonly VisitModeReasonCode[] = ["er_poisoning_overdose"];

const ASK_NEXT: string[] = [
  "Suspected substance(s) — name, formulation, extended-release",
  "Time of exposure / ingestion — last known well",
  "Estimated amount / number of tablets or concentration",
  "Single agent vs multiple agents / polypharmacy",
  "Route — oral, nasal, IV, dermal, inhalational",
  "Intentional vs accidental — including access in children",
  "Alcohol or other co-ingestion",
  "Symptom evolution — onset, progression, vomiting, seizures",
  "Chronic medications and recent changes",
  "Containers, blister packs, or photos available",
];

const EXAM_NEXT: string[] = [
  "Airway, breathing, circulation (ABC)",
  "GCS / mental status",
  "Pupils — size, reactivity, symmetry",
  "RR, SpO₂, ETCO₂ if available",
  "BP, HR, temperature",
  "Skin — diaphoresis, track marks, burns, color",
  "Bowel sounds / urinary retention if anticholinergic or opioid concern",
  "ECG early — QRS, QT, rhythm",
  "Point-of-care glucose",
  "VBG/ABG, lactate, electrolytes as clinically appropriate",
  "Trauma signs if co-present or unclear history",
];

const PERTINENT_NEGATIVES: string[] = [
  "No airway compromise — if absent after assessment",
  "No aspiration concern — if absent",
  "No QRS/QT abnormality on ECG if checked",
  "No hypoglycemia if glucose checked",
  "No trauma signs — if absent",
];

const CLINICAL_RULES: string[] = [
  "Stabilization (ABC, monitoring, antidotes/supportive care per protocol) comes before syndrome labeling or tidy diagnosis-first narrative.",
  "When the agent is unknown — use toxidrome reasoning and re-evaluate as data arrive; avoid anchoring on one substance without support.",
  "Surface ECG and glucose early in undifferentiated poisoning / overdose.",
  "Severe, unstable, or unclear exposures — document poison center / toxicology consultation pathway per local practice.",
  "Opioid toxicity — prioritize ventilation and respiratory goals with naloxone titration; avoid framing care as only \"waking the patient up\".",
];

const EMERGENCY_ESCALATION_RULES: string[] = [
  "Altered mental status with unknown ingestion",
  "Respiratory depression or apnea",
  "Hemodynamic instability or shock",
  "Seizures or dysrhythmia concern",
  "Wide QRS / serious ECG abnormality",
  "Serotonin syndrome / neuroleptic malignant pattern when suspected",
  "Multi-agent or unknown high-risk exposure",
];

const OUTPUT_STYLE: string[] = [
  "Lead with ABCs, vitals, glucose, and ECG status — not a routine OPD chronology first.",
  "Document substance, time, amount, route, co-ingestants, and treatments given (e.g. naloxone) with response.",
  "Separate facts from inference when history is incomplete.",
];

export type PoisoningOverdoseErOverlay =
  | { active: false }
  | {
      active: true;
      activationRationale: string[];
      factsAlreadyPresent: string[];
      askNext: string[];
      examNext: string[];
      pertinentNegatives: string[];
      clinicalRules: string[];
      emergencyEscalationMatched: string[];
      emergencyEscalationRules: string[];
      outputStyleHints: string[];
      emergencyEscalationLikely: boolean;
    };

function hasPoisoningTrigger(normalizedText: string): boolean {
  return scoreKeysNegationAware(normalizedText, POISONING_OVERDOSE_TRIGGER_KEYS) >= 1;
}

function matchEmergencyEscalation(normalizedText: string): string[] {
  const t = normalizedText;
  const out: string[] = [];
  const add = (cond: boolean, label: string) => {
    if (cond) out.push(label);
  };

  add(
    hasAnyKeywordNonNegated(t, [
      "unresponsive",
      "coma",
      "obtunded",
      "gcs",
      "altered mental",
      "decreased loc",
      "not waking",
    ]),
    "altered consciousness / coma pattern",
  );
  add(
    hasAnyKeywordNonNegated(t, [
      "respiratory depression",
      "apneic",
      "apnea",
      "respiratory arrest",
      "hypoventilation",
      "slow respirations",
    ]),
    "respiratory depression / ventilatory failure",
  );
  add(
    hasAnyKeywordNonNegated(t, ["seizure", "tonic clonic", "status epilepticus", "convulsion"]),
    "seizure activity",
  );
  add(
    hasAnyKeywordNonNegated(t, ["hypotension", "shock", "wide qrs", "vtach", "ventricular tachycardia", "torsades", "qtc"]),
    "cardiovascular instability / serious dysrhythmia concern",
  );
  add(hasAnyKeywordNonNegated(t, ["naloxone", "narcan"]), "naloxone given / opioid reversal context");
  add(hasAnyKeywordNonNegated(t, ["intubat", "rsi ", "cardiac arrest"]), "advanced airway or arrest context");
  add(
    hasAnyKeywordNonNegated(t, ["unknown pills", "unknown substance", "multiple agents", "polypharmacy", "ingestion unknown"]),
    "unknown agent / polypharmacy concern",
  );

  return [...new Set(out)];
}

function extractFacts(t: string): string[] {
  const out: string[] = [];
  const add = (cond: boolean, line: string) => {
    if (cond) out.push(line);
  };
  add(anyNonNegatedRegexMatch(t, /\boverdose|poisoning|ingestion|intoxication|toxidrome/i), "มี poisoning / overdose / ingestion context");
  add(anyNonNegatedRegexMatch(t, /\bopioid|heroin|fentanyl|naloxone|narcan/i), "มี opioid / naloxone context");
  add(anyNonNegatedRegexMatch(t, /\bacetaminophen|paracetamol|salicylate|tricyclic|tca\b/i), "มี high-risk agent cue");
  add(anyNonNegatedRegexMatch(t, /\btime|hours ago|minutes ago|ingested/i), "มี timing / exposure narrative");
  if (out.length === 0) out.push("มีคีย์เวิร์ด poisoning/overdose — เก็บ agent, time, amount, route, co-ingestants, และ response to treatment");
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
  if (activePackIds.includes("er_poisoning_overdose")) return true;
  if (emergencyMatches.length > 0) return true;
  return false;
}

export function buildPoisoningOverdoseErOverlay(
  normalizedText: string,
  mode: AssistMode,
  visitReason: VisitModeReasonCode,
  activePackIds: readonly OpdProblemPackId[],
): PoisoningOverdoseErOverlay {
  if (!hasPoisoningTrigger(normalizedText)) {
    return { active: false };
  }

  const emergencyMatched = matchEmergencyEscalation(normalizedText);
  const severeKeywords = scoreKeysNegationAware(normalizedText, SEVERE_ESCALATION_KEYS) >= 1;
  const emergencyLikely = emergencyMatched.length > 0 || severeKeywords;

  if (!shouldActivateOverlay(mode, visitReason, activePackIds, emergencyMatched) && !emergencyLikely) {
    return { active: false };
  }

  const rationale: string[] = [];
  if (mode === "ER") rationale.push("Visit mode ER — poisoning/overdose overlay applies");
  if (mode === "TRAUMA") rationale.push("Visit mode TRAUMA — consider co-ingestion/tox when history or exam suggests");
  if (visitReason === "er_poisoning_overdose") {
    rationale.push("Visit detection: er_poisoning_overdose");
  }
  if (activePackIds.includes("er_poisoning_overdose")) {
    rationale.push("ER symptom pack matched: er_poisoning_overdose");
  }
  if (emergencyMatched.length) {
    rationale.push("Text supports escalation — prioritize ABCs, monitoring, and immediate management");
  } else if (severeKeywords) {
    rationale.push("Severe poisoning cues — avoid diagnosis-first OPD-only structure");
  }
  if (rationale.length === 0) rationale.push("Suspected poisoning or overdose with documentation support");

  return {
    active: true,
    activationRationale: rationale,
    factsAlreadyPresent: extractFacts(normalizedText),
    askNext: [...ASK_NEXT],
    examNext: [...EXAM_NEXT],
    pertinentNegatives: [...PERTINENT_NEGATIVES],
    clinicalRules: [...CLINICAL_RULES],
    emergencyEscalationMatched: emergencyMatched,
    emergencyEscalationRules: [...EMERGENCY_ESCALATION_RULES],
    outputStyleHints: [...OUTPUT_STYLE],
    emergencyEscalationLikely: emergencyLikely,
  };
}

export function formatPoisoningOverdoseErOverlayForAi(o: PoisoningOverdoseErOverlay): string {
  if (!o.active) return "(POISONING_OVERDOSE_ER_OVERLAY inactive)";
  const lines = [
    "=== POISONING / OVERDOSE — ER OVERLAY ===",
    o.emergencyEscalationLikely
      ? "URGENCY: Lead with ABCs, monitoring, and immediate stabilization — NOT routine OPD narrative first."
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
    "Clinical rules:",
    ...o.clinicalRules.map((x) => `- ${x}`),
    "",
    "Emergency escalation — patterns suggested by text:",
    ...(o.emergencyEscalationMatched.length
      ? o.emergencyEscalationMatched.map((x) => `- ${x}`)
      : ["- (none strongly flagged — still complete ABCs, glucose, ECG early)"]),
    "",
    "Emergency escalation — full rule list:",
    ...o.emergencyEscalationRules.map((x) => `- ${x}`),
    "",
    "Output style:",
    ...o.outputStyleHints.map((x) => `- ${x}`),
  ].filter((line) => line !== "");
  return lines.join("\n");
}
