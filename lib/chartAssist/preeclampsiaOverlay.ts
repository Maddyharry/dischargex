/**
 * Preeclampsia / hypertensive disorder of pregnancy overlay — structured triage fields; urgent OB pathway rules.
 * Rule layer only; does not replace hospital OB protocol.
 */
import type { AssistMode } from "./cardTypes";
import { hasAnyKeywordNonNegated, scoreKeysNegationAware } from "./clinicalNegation";
import {
  matchesPreeclampsiaSevereFeaturesPathway,
  matchesPregnancyOrObContext,
} from "./obGynePathways";
import type { OpdProblemPackId } from "./opdProblemPacks";

/** Named disease / syndrome keywords — activate without requiring separate “pregnancy” token */
export const PREECLAMPSIA_NAMED_TRIGGER_KEYS = [
  "preeclampsia",
  "pre-eclampsia",
  "eclampsia",
  "hellp",
  "hellp syndrome",
  "gestational hypertension",
  "hypertensive disorder of pregnancy",
  "proteinuria pregnancy",
  "ครรภ์เป็นพิษ",
  "ความดันสูงตอนท้อง",
];

/** Pregnancy + symptom that should surface preeclampsia workup fields (concern pack — not routine headache) */
const PREGNANCY_HTN_CONCERN_SYMPTOMS = [
  "headache",
  "migraine",
  "ปวดหัว",
  "blurred vision",
  "visual",
  "scotoma",
  "photophobia",
  "epigastric",
  "ruq",
  "right upper quadrant",
  "upper abdomen",
  "seizure",
  "eclamptic",
  "hypertension",
  "elevated bp",
  "high blood pressure",
  "bp 16",
  "bp 17",
  "bp 18",
  "160/",
  "170/",
  "180/",
  "140/90",
  "proteinuria",
  "edema",
  "บวม",
  "ตาพร่า",
  "ชัก",
];

const SURFACE_ALWAYS: string[] = [
  "Pregnancy status — explicit (pregnant / GA known / undelivered vs postpartum if relevant); obGynePregnancyStatus or equivalent structured field.",
  "Gestational age — obGyneGestationalAge (never buried only in free-text PI).",
  "Blood pressure — current and prior if documented; site, position, repeat; severe-range or trend (structured vitals).",
  "Headache — presence, severity, onset, change; distinguish from routine primary headache documentation.",
  "Visual symptoms — scotomata, blurring, photophobia, diplopia if documented (pertinent negatives if assessed).",
  "RUQ / epigastric pain — presence, severity, radiation (liver capsule stretch / severe features context).",
  "Seizure / eclampsia concern — history, post-ictal, magnesium if given (no invention).",
  "Fetal concern when applicable — FM, FHR category, NST/CTG if documented (no invention).",
];

const ASK_NEXT: string[] = [
  "GA / EDD / dating (US vs LMP)",
  "Headache — timing vs prior pregnancies; focal neuro symptoms",
  "Visual changes — onset, lateralizing eye symptoms",
  "RUQ/epigastric pain vs reflux; nausea/vomiting severity",
  "Prior PIH / preeclampsia; aspirin or antihypertensive use",
  "Urinary symptoms; edema progression",
  "Fetal movement; prior BP checks at home",
];

const EXAM_NEXT: string[] = [
  "BP — repeat, bilateral if indicated; orthostatic only if safe and protocol-appropriate",
  "Neuro — focal deficit, visual fields if indicated",
  "RUQ / epigastric tenderness; liver span per protocol",
  "Edema / reflexes / clonus per protocol",
  "FHR / CTG / NST per protocol",
  "Labs / urine protein — per local OB protocol when indicated",
];

const CLINICAL_RULES: string[] = [
  "Pregnancy + severe headache, visual symptoms, or severe-range / worsening BP → urgent obstetric assessment pathway (preeclampsia spectrum); obGyneClinicalPathway preeclampsia_severe_features when applicable.",
  "Do not document as a routine OPD headache note — lead with pregnancy status, GA, BP, and preeclampsia-severe-features screen; headache framework is secondary reference only.",
  "Seizure in pregnancy or concern for eclampsia — emergency obstetric pathway language; do not collapse into generic seizure OPD template without OB triage.",
];

export type PreeclampsiaOverlay =
  | { active: false }
  | {
      active: true;
      activationRationale: string[];
      surfaceAlways: string[];
      askNext: string[];
      examNext: string[];
      clinicalRules: string[];
      /** True when pregnancy + (severe headache / visual / severe BP / named spectrum) per rule layer */
      urgentObPathwayLikely: boolean;
      urgentObPathwayReasons: string[];
      /** Suppress primary use of generic headache OPD framework when this overlay is active */
      avoidRoutineHeadacheNoteFormat: boolean;
    };

function namedKeywordHit(t: string): boolean {
  return scoreKeysNegationAware(t, PREECLAMPSIA_NAMED_TRIGGER_KEYS) >= 1;
}

function pregnancyPlusConcernSymptoms(t: string): boolean {
  return matchesPregnancyOrObContext(t) && hasAnyKeywordNonNegated(t, PREGNANCY_HTN_CONCERN_SYMPTOMS);
}

export function hasPreeclampsiaOverlayTrigger(
  normalizedText: string,
  activePackIds: readonly OpdProblemPackId[],
): boolean {
  if (activePackIds.includes("lr_preeclampsia")) return true;
  if (namedKeywordHit(normalizedText)) return true;
  if (matchesPreeclampsiaSevereFeaturesPathway(normalizedText)) return true;
  if (pregnancyPlusConcernSymptoms(normalizedText)) return true;
  return false;
}

export function buildPreeclampsiaOverlay(
  normalizedText: string,
  mode: AssistMode,
  activePackIds: readonly OpdProblemPackId[],
): PreeclampsiaOverlay {
  if (mode !== "LABOR_ROOM" && mode !== "GYNE") {
    return { active: false };
  }

  if (!hasPreeclampsiaOverlayTrigger(normalizedText, activePackIds)) {
    return { active: false };
  }

  const urgentByPathway = matchesPreeclampsiaSevereFeaturesPathway(normalizedText);
  const urgentObPathwayReasons: string[] = [];
  if (urgentByPathway) {
    urgentObPathwayReasons.push(
      "Rule: pregnancy context with severe headache/visual/epigastric-RUQ/severe-range BP or named preeclampsia spectrum → urgent OB pathway",
    );
  }
  if (namedKeywordHit(normalizedText)) {
    urgentObPathwayReasons.push("Named hypertensive disorder of pregnancy / severe-feature keywords in text");
  }

  const rationale: string[] = [];
  if (activePackIds.includes("lr_preeclampsia")) rationale.push("Symptom pack matched: lr_preeclampsia");
  if (!activePackIds.includes("lr_preeclampsia") && namedKeywordHit(normalizedText)) {
    rationale.push("Preeclampsia / gestational HTN named keywords");
  }
  if (matchesPreeclampsiaSevereFeaturesPathway(normalizedText)) {
    rationale.push("OB pathway rule: preeclampsia severe-features pattern (pregnancy + neuro/visual/HTN/named)");
  } else if (pregnancyPlusConcernSymptoms(normalizedText)) {
    rationale.push("Pregnancy + headache / visual / BP / RUQ / seizure concern — surface preeclampsia triage fields");
  }

  return {
    active: true,
    activationRationale: rationale,
    surfaceAlways: [...SURFACE_ALWAYS],
    askNext: [...ASK_NEXT],
    examNext: [...EXAM_NEXT],
    clinicalRules: [...CLINICAL_RULES],
    urgentObPathwayLikely: urgentByPathway || namedKeywordHit(normalizedText),
    urgentObPathwayReasons: [...new Set(urgentObPathwayReasons)],
    avoidRoutineHeadacheNoteFormat: true,
  };
}

export function formatPreeclampsiaOverlayForAi(o: PreeclampsiaOverlay): string {
  if (!o.active) return "(PREECLAMPSIA_OVERLAY inactive)";
  const lines = [
    "=== PREECLAMPSIA / HYPERTENSIVE DISORDER OF PREGNANCY (overlay) ===",
    o.urgentObPathwayLikely
      ? "PATHWAY: Urgent obstetric assessment — pregnancy with severe headache, visual symptoms, severe/worsening BP, RUQ/epigastric pain, seizure/eclampsia concern, or named preeclampsia spectrum."
      : "PATHWAY: Document preeclampsia-spectrum triage fields; escalate if severe features develop or vitals worsen.",
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
    "NOTES FOR MODEL:",
    "- Do NOT use the generic OPD headache note as the primary structure; pregnancy + BP + neuro/visual/GI fetal status drive the note.",
    o.avoidRoutineHeadacheNoteFormat
      ? "- HEADACHE_DIZZINESS_FRAMEWORK: treat as secondary; triage headline is hypertensive disorder of pregnancy / urgent OB when criteria met."
      : "",
    "",
    "Urgent OB pathway (likely reasons):",
    ...(o.urgentObPathwayReasons.length
      ? o.urgentObPathwayReasons.map((x) => `- ${x}`)
      : ["- (pattern not fully met — still complete BP, neuro/visual, fetal fields)"]),
    "",
    "Activation rationale:",
    ...o.activationRationale.map((x) => `- ${x}`),
  ].filter((line) => line !== "");
  return lines.join("\n");
}
