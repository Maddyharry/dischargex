/**
 * Early pregnancy pain / bleeding overlay — LMP/GA, pain lateralization, bleeding, hemodynamics, ectopic clues;
 * ectopic/miscarriage pathway; urgent GYNE/ER when unstable or peritonitis.
 * Rule layer only; does not replace hospital protocol.
 */
import type { AssistMode } from "./cardTypes";
import { hasAnyKeywordNonNegated } from "./clinicalNegation";
import {
  matchesBleedingCue,
  matchesEarlyPregnancyContext,
  matchesEarlyPregnancyPainBleedingPathway,
  matchesPainOrCrampCue,
} from "./obGynePathways";
import type { OpdProblemPackId } from "./opdProblemPacks";

const UNSTABLE_VITALS_KEYS = [
  "hypotension",
  "hypotensive",
  "shock",
  "hemorrhagic shock",
  "syncope",
  "unresponsive",
  "unstable",
  "tachycardia",
  "map ",
  "ความดันต่ำ",
  "ช็อก",
  "เป็นลม",
];

const PERITONISM_KEYS = [
  "peritonitis",
  "peritoneal",
  "rebound tenderness",
  "rebound",
  "guarding",
  "rigidity",
  "rigid abdomen",
  "acute abdomen",
  "surgical abdomen",
  "free fluid",
  "shoulder tip",
  "shoulder tip pain",
  "ปวดหัวไหล่",
  "ท้องแข็ง",
  "rebound บวก",
];

const ECTOPIC_RISK_CLUE_KEYS = [
  "prior ectopic",
  "previous ectopic",
  "tubal",
  "pelvic inflammatory disease",
  "pid",
  "iud",
  "intrauterine device",
  "ivf",
  "assisted reproduction",
  "multiple pregnancies",
  "smoking",
  "ครรภ์นอกมดลูก เคย",
  "ท่อนำไข่",
];

const SURFACE_ALWAYS: string[] = [
  "Pregnancy status — obGynePregnancyStatus or equivalent (never buried only in free-text PI).",
  "LMP / estimated GA / dating — LMP date, EDD, US vs LMP dating, obGyneGestationalAge.",
  "Pain — severity, onset, location, lateralization (unilateral vs diffuse), change over time; shoulder-tip pain if documented.",
  "Bleeding amount — obGyneBleedingSeverity { level, quantifiedDetails } (pads/h, clots, estimated loss, orthostasis).",
  "Hemodynamic status — BP/HR, orthostasis, perfusion, IV access / resuscitation if documented.",
  "Ectopic risk clues — prior ectopic, tubal surgery/PID, IUD, ART, smoking, etc. when documented (pertinent negatives if assessed).",
];

const ASK_NEXT: string[] = [
  "LMP / last normal period / dating uncertainty",
  "Pain severity (0–10) and side (RLQ vs LLQ vs diffuse)",
  "Bleeding pattern: onset, pads/h, clots, syncope",
  "Prior ectopic, PID, tubal surgery, IUD",
  "Rh status / anti-D",
  "β-hCG / TVS if documented or pending",
  "Passage of tissue; syncope",
];

const EXAM_NEXT: string[] = [
  "Maternal vitals — BP, HR, orthostatic if safe",
  "Abdomen — focal tenderness, guarding, rebound, peritoneal signs",
  "Pelvic — per protocol (avoid unnecessary digital if heavy bleeding + unstable)",
  "US / serial β-hCG pathway per protocol",
];

const CLINICAL_RULES: string[] = [
  "Early pregnancy pain + bleeding — must use ectopic pregnancy vs miscarriage (threatened/incomplete/complete) pathway language; obGyneClinicalPathway early_pregnancy_bleeding_ectopic_miscarriage when applicable.",
  "Unstable vitals, shock concern, or peritoneal signs (including shoulder-tip pain) — urgent GYN / ER pathway; lead obGyneTriageSummary with immediate concern before routine HPI.",
  "Do not document as generic AUB alone when pregnancy is possible — pregnancy status and GA are explicit fields.",
];

export type EarlyPregnancyPainBleedingOverlay =
  | { active: false }
  | {
      active: true;
      activationRationale: string[];
      surfaceAlways: string[];
      askNext: string[];
      examNext: string[];
      clinicalRules: string[];
      /** Pain + bleeding in early pregnancy → ectopic/miscarriage pathway */
      ectopicMiscarriagePathwayRequired: boolean;
      /** Unstable hemodynamics or peritonism → urgent GYNE/ER */
      immediateGyneErConcern: boolean;
      immediateConcernReasons: string[];
      /** Ectopic risk clues mentioned in text (advisory) */
      ectopicRiskCluesMatched: string[];
    };

function matchUnstableReasons(t: string): string[] {
  const out: string[] = [];
  if (hasAnyKeywordNonNegated(t, UNSTABLE_VITALS_KEYS)) out.push("unstable maternal hemodynamics / shock concern");
  return out;
}

function matchPeritonismReasons(t: string): string[] {
  const out: string[] = [];
  if (hasAnyKeywordNonNegated(t, PERITONISM_KEYS)) out.push("peritoneal signs / acute abdomen / shoulder-tip concern");
  return out;
}

function matchEctopicRiskClues(t: string): string[] {
  const out: string[] = [];
  for (const key of ECTOPIC_RISK_CLUE_KEYS) {
    if (hasAnyKeywordNonNegated(t, [key])) out.push(key);
  }
  return [...new Set(out)];
}

export function hasEarlyPregnancyPainBleedingOverlayTrigger(
  t: string,
  activePackIds: readonly OpdProblemPackId[],
): boolean {
  if (activePackIds.includes("gy_early_pregnancy_bleeding")) return true;
  if (matchesEarlyPregnancyPainBleedingPathway(t)) return true;
  if (matchesEarlyPregnancyContext(t) && matchesBleedingCue(t)) return true;
  return false;
}

export function buildEarlyPregnancyPainBleedingOverlay(
  normalizedText: string,
  mode: AssistMode,
  activePackIds: readonly OpdProblemPackId[],
): EarlyPregnancyPainBleedingOverlay {
  if (mode !== "LABOR_ROOM" && mode !== "GYNE") {
    return { active: false };
  }

  if (!hasEarlyPregnancyPainBleedingOverlayTrigger(normalizedText, activePackIds)) {
    return { active: false };
  }

  const pathwayPainBleeding = matchesEarlyPregnancyPainBleedingPathway(normalizedText);
  const ectopicMiscarriagePathwayRequired =
    pathwayPainBleeding ||
    (matchesEarlyPregnancyContext(normalizedText) &&
      matchesBleedingCue(normalizedText) &&
      matchesPainOrCrampCue(normalizedText));

  const unstableReasons = matchUnstableReasons(normalizedText);
  const peritonismReasons = matchPeritonismReasons(normalizedText);
  const immediateConcernReasons = [...unstableReasons, ...peritonismReasons];
  const immediateGyneErConcern = immediateConcernReasons.length > 0;
  const ectopicRiskCluesMatched = matchEctopicRiskClues(normalizedText);

  const rationale: string[] = [];
  if (activePackIds.includes("gy_early_pregnancy_bleeding")) {
    rationale.push("Symptom pack matched: gy_early_pregnancy_bleeding");
  }
  if (pathwayPainBleeding) rationale.push("Rule: early pregnancy + pain + bleeding");
  if (matchesEarlyPregnancyContext(normalizedText) && matchesBleedingCue(normalizedText)) {
    rationale.push("Early pregnancy context + bleeding");
  }
  if (immediateGyneErConcern) {
    rationale.push("Unstable vitals and/or peritoneal concern — urgent GYNE/ER pathway language at top");
  }

  return {
    active: true,
    activationRationale: rationale,
    surfaceAlways: [...SURFACE_ALWAYS],
    askNext: [...ASK_NEXT],
    examNext: [...EXAM_NEXT],
    clinicalRules: [...CLINICAL_RULES],
    ectopicMiscarriagePathwayRequired,
    immediateGyneErConcern,
    immediateConcernReasons: [...new Set(immediateConcernReasons)],
    ectopicRiskCluesMatched,
  };
}

export function formatEarlyPregnancyPainBleedingOverlayForAi(o: EarlyPregnancyPainBleedingOverlay): string {
  if (!o.active) return "(EARLY_PREGNANCY_PAIN_BLEEDING_OVERLAY inactive)";
  const lines = [
    "=== EARLY PREGNANCY PAIN / BLEEDING (overlay) ===",
    o.ectopicMiscarriagePathwayRequired
      ? "PATHWAY: early_pregnancy_bleeding_ectopic_miscarriage — ectopic pregnancy vs miscarriage (threatened/incomplete/complete) pathway language; β-hCG / TVS per protocol."
      : "PATHWAY: Document early pregnancy bleeding workup fields; confirm pregnancy + GA; escalate if pain/bleeding pattern worsens.",
    o.immediateGyneErConcern
      ? "EXPORT ORDER: Unstable vitals or peritoneal signs — lead obGyneTriageSummary with immediate concern / resuscitation before long routine HPI."
      : "",
    "",
    "Always surface (structured keys + triage):",
    ...o.surfaceAlways.map((x) => `- ${x}`),
    "",
    "Ask next:",
    ...o.askNext.map((x) => `- ${x}`),
    "",
    "Examine next:",
    ...o.examNext.map((x) => `- ${x}`),
    "",
    "Clinical rules:",
    ...o.clinicalRules.map((x) => `- ${x}`),
    "",
    "Ectopic risk clues (from text; document + pertinent negatives):",
    ...(o.ectopicRiskCluesMatched.length
      ? o.ectopicRiskCluesMatched.map((x) => `- ${x}`)
      : ["- (none flagged — still ask prior ectopic/tubal/IUD/PID/ART if not documented)"]),
    "",
    "Immediate concern (reasons):",
    ...(o.immediateConcernReasons.length
      ? o.immediateConcernReasons.map((x) => `- ${x}`)
      : ["- (none flagged — still complete vitals and bleeding quantification)"]),
    "",
    "Activation rationale:",
    ...o.activationRationale.map((x) => `- ${x}`),
  ].filter((line) => line !== "");
  return lines.join("\n");
}
