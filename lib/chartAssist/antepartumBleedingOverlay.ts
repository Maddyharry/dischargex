/**
 * Antepartum / pregnancy bleeding overlay — GA, bleeding, pain, hemodynamics, fetal status; pathway rules.
 * Rule layer only; does not replace hospital OB protocol.
 */
import type { AssistMode } from "./cardTypes";
import { hasAnyKeywordNonNegated, scoreKeysNegationAware } from "./clinicalNegation";
import type { OpdProblemPackId } from "./opdProblemPacks";

export const ANTEPARTUM_BLEEDING_TRIGGER_KEYS = [
  "antepartum bleeding",
  "ante partum",
  "antepartum hemorrhage",
  "aph",
  "abruption",
  "abruptio",
  "placenta previa",
  "previa",
  "third trimester bleeding",
  "second trimester bleeding",
  "vaginal bleeding pregnancy",
  "bleeding in pregnancy",
  "pregnancy bleeding",
  "first trimester bleeding",
  "threatened abortion",
  "incomplete abortion",
  "ectopic",
  "เลือดออกก่อนคลอด",
  "เลือดออกท้อง",
  "เลือดออกตอนท้อง",
  "ครรภ์นอกมดลูก",
  "แท้ง",
];

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

const EARLY_PREGNANCY_CUES = [
  "first trimester",
  "early pregnancy",
  "6 weeks",
  "7 weeks",
  "8 weeks",
  "9 weeks",
  "10 weeks",
  "12 weeks",
  "first trimester bleeding",
  "ectopic",
  "threatened abortion",
  "missed abortion",
  "incomplete abortion",
  "ครรภ์นอกมดลูก",
];

const LATER_PREGNANCY_CUES = [
  "third trimester",
  "28 weeks",
  "30 weeks",
  "32 weeks",
  "34 weeks",
  "36 weeks",
  "37 weeks",
  "38 weeks",
  "39 weeks",
  "40 weeks",
  "term",
  "antepartum",
  "placenta previa",
  "abruption",
  "เลือดออกก่อนคลอด",
];

const SURFACE_ALWAYS: string[] = [
  "Gestational age — obGyneGestationalAge (never buried only in free-text PI).",
  "Bleeding amount — obGyneBleedingSeverity { level, quantifiedDetails } (pads/h, clots, estimated loss).",
  "Pain severity — location, character, change; document explicitly.",
  "Hemodynamic status — BP/HR, orthostasis, perfusion, resuscitation given.",
  "Fetal concern when applicable — FHR category, FM, NST/CTG if documented (no invention).",
];

const ASK_NEXT: string[] = [
  "GA / EDD / dating (US vs LMP)",
  "Bleeding onset, amount, pattern, clots",
  "Pain — uterine vs atypical; shoulder tip (ectopic cue) if relevant",
  "Prior previa, abruption, cesarean, uterine surgery",
  "Rh status / anti-D",
  "Fetal movement; prior fetal assessment",
  "Anticoagulation, bleeding disorder",
];

const EXAM_NEXT: string[] = [
  "Maternal vitals — BP, HR, RR, SpO₂, orthostatic if safe",
  "Abdomen — tenderness, rigidity, uterine tone",
  "FHR / CTG per protocol; FM by history",
  "Speculum / cervical — only per protocol (avoid digital if previa suspected)",
];

const CLINICAL_RULES: string[] = [
  "Early pregnancy bleeding with pain — use early_pregnancy_bleeding_ectopic_miscarriage pathway language (ectopic vs miscarriage DDx; β-hCG/TVS pathway per protocol); not URI/OPD-only disposition.",
  "Later pregnancy / third-trimester–type antepartum bleeding — urgent obstetric review pathway; previa/abruption/placental causes in DDx per presentation.",
  "Unstable maternal vitals or suspected massive hemorrhage — lead obGyneTriageSummary and narrative with immediate concern and resuscitation before long benign HPI (immediate concern at top).",
];

export type PregnancyBleedingEraHint = "early" | "later" | "unknown";

export type AntepartumBleedingOverlay =
  | { active: false }
  | {
      active: true;
      activationRationale: string[];
      pregnancyEraHint: PregnancyBleedingEraHint;
      surfaceAlways: string[];
      askNext: string[];
      examNext: string[];
      clinicalRules: string[];
      immediateConcernFirst: boolean;
      immediateConcernReasons: string[];
    };

function inferPregnancyEra(t: string): PregnancyBleedingEraHint {
  const early = hasAnyKeywordNonNegated(t, EARLY_PREGNANCY_CUES);
  const later = hasAnyKeywordNonNegated(t, LATER_PREGNANCY_CUES);
  if (early && !later) return "early";
  if (later && !early) return "later";
  if (early && later) return "unknown";
  return "unknown";
}

function matchUnstableReasons(t: string): string[] {
  const out: string[] = [];
  if (hasAnyKeywordNonNegated(t, UNSTABLE_VITALS_KEYS)) out.push("unstable maternal hemodynamics / shock concern");
  return out;
}

function hasAntepartumBleedingTrigger(normalizedText: string): boolean {
  return scoreKeysNegationAware(normalizedText, ANTEPARTUM_BLEEDING_TRIGGER_KEYS) >= 1;
}

export function buildAntepartumBleedingOverlay(
  normalizedText: string,
  mode: AssistMode,
  activePackIds: readonly OpdProblemPackId[],
): AntepartumBleedingOverlay {
  if (mode !== "LABOR_ROOM" && mode !== "GYNE") {
    return { active: false };
  }

  const packAntepartum = activePackIds.includes("lr_antepartum_bleeding");
  const packEarly = activePackIds.includes("gy_early_pregnancy_bleeding");
  const keywordHit = hasAntepartumBleedingTrigger(normalizedText);

  if (!packAntepartum && !packEarly && !keywordHit) {
    return { active: false };
  }

  const pregnancyEraHint = inferPregnancyEra(normalizedText);
  const unstableReasons = matchUnstableReasons(normalizedText);
  const painCue = hasAnyKeywordNonNegated(normalizedText, [
    "pain",
    "severe pain",
    "abdominal pain",
    "cramping",
    "ปวดท้อง",
    "ปวด",
  ]);
  const bleedingCue = hasAnyKeywordNonNegated(normalizedText, ["bleeding", "blood", "เลือด", "hemorrhage"]);

  const pathwayNotes: string[] = [];
  if (pregnancyEraHint === "early" && painCue && bleedingCue) {
    pathwayNotes.push("early pregnancy bleeding + pain — ectopic/miscarriage pathway");
  }
  if (pregnancyEraHint === "later" || (packAntepartum && pregnancyEraHint !== "early")) {
    pathwayNotes.push("later-pregnancy antepartum bleeding — urgent obstetric review pathway");
  }

  const immediateConcernFirst = unstableReasons.length > 0;
  const immediateConcernReasons = [...unstableReasons, ...pathwayNotes];

  const rationale: string[] = [];
  if (packAntepartum) rationale.push("Symptom pack matched: lr_antepartum_bleeding");
  if (packEarly) rationale.push("Symptom pack matched: gy_early_pregnancy_bleeding");
  if (keywordHit && !packAntepartum && !packEarly) rationale.push("Antepartum / pregnancy bleeding keywords");
  rationale.push(`Pregnancy era hint: ${pregnancyEraHint} (use clinical judgment)`);
  if (immediateConcernFirst) {
    rationale.push("Unstable vitals — lead obGyneTriageSummary with immediate concern / stabilization at top");
  }

  return {
    active: true,
    activationRationale: rationale,
    pregnancyEraHint,
    surfaceAlways: [...SURFACE_ALWAYS],
    askNext: [...ASK_NEXT],
    examNext: [...EXAM_NEXT],
    clinicalRules: [...CLINICAL_RULES],
    immediateConcernFirst,
    immediateConcernReasons: [...new Set(immediateConcernReasons)],
  };
}

export function formatAntepartumBleedingOverlayForAi(o: AntepartumBleedingOverlay): string {
  if (!o.active) return "(ANTEPARTUM_BLEEDING_OVERLAY inactive)";
  const lines = [
    "=== ANTEPARTUM / PREGNANCY BLEEDING (overlay) ===",
    o.pregnancyEraHint === "early"
      ? "PATHWAY HINT: early pregnancy — prioritize ectopic / miscarriage workup language when bleeding ± pain (early_pregnancy_bleeding_ectopic_miscarriage)."
      : o.pregnancyEraHint === "later"
        ? "PATHWAY HINT: later pregnancy — urgent obstetric review / L&D triage language; previa/abruption in DDx per context."
        : "PATHWAY HINT: confirm GA clinically — early vs later pregnancy drives ectopic/miscarriage vs urgent antepartum bleeding pathways.",
    o.immediateConcernFirst
      ? "EXPORT ORDER: Unstable vitals or life-threat bleeding — lead obGyneTriageSummary with immediate concern / resuscitation before long routine HPI."
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
    "Immediate concern (reasons):",
    ...(o.immediateConcernReasons.length
      ? o.immediateConcernReasons.map((x) => `- ${x}`)
      : ["- (none flagged — still document vitals, bleeding amount, and fetal status)"]),
    "",
    "Activation rationale:",
    ...o.activationRationale.map((x) => `- ${x}`),
  ].filter((line) => line !== "");
  return lines.join("\n");
}
