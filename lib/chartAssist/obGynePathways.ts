/**
 * Rule-based OB/GYN pathway hints for LABOR_ROOM / GYNE — advisory; pairs with AI fields
 * obGyneClinicalPathway + structured triage fields.
 */
import type { AssistMode } from "./cardTypes";
import { hasAnyKeywordNonNegated } from "./clinicalNegation";

export function matchesEarlyPregnancyContext(t: string): boolean {
  return (
    hasAnyKeywordNonNegated(t, [
      "first trimester",
      "early pregnancy",
      "6 weeks pregnant",
      "7 weeks pregnant",
      "8 weeks pregnant",
      "9 weeks pregnant",
      "10 weeks pregnant",
      "11 weeks pregnant",
      "12 weeks pregnant",
      "threatened abortion",
      "ectopic",
      "ectopic pregnancy",
      "ครรภ์นอกมดลูก",
      "แท้ง",
    ]) || /\b(?:6|7|8|9|10|11|12)\s*weeks?\b/i.test(t)
  );
}

export function matchesBleedingCue(t: string): boolean {
  return hasAnyKeywordNonNegated(t, [
    "vaginal bleeding",
    "bleeding",
    "spotting",
    "hemorrhage",
    "เลือดออก",
    "ตกเลือด",
  ]);
}

export function matchesPainOrCrampCue(t: string): boolean {
  return hasAnyKeywordNonNegated(t, [
    "abdominal pain",
    "pelvic pain",
    "cramping",
    "uterine cramping",
    "cramp",
    "ปวดท้อง",
    "ปวดท้องน้อย",
    "ปวดหน่วง",
  ]);
}

/** Pain + bleeding in early pregnancy → ectopic / miscarriage workup pathway */
export function matchesEarlyPregnancyPainBleedingPathway(t: string): boolean {
  return matchesEarlyPregnancyContext(t) && matchesBleedingCue(t) && matchesPainOrCrampCue(t);
}

export function matchesPregnancyOrObContext(t: string): boolean {
  return hasAnyKeywordNonNegated(t, [
    "pregnant",
    "pregnancy",
    "gravida",
    "gestation",
    "gestational",
    "trimester",
    "preeclampsia",
    "pre-eclampsia",
    "eclampsia",
    "hellp",
    "ครรภ์",
    "ตั้งครรภ์",
    "ครรภ์เป็นพิษ",
  ]);
}

/** Severe / thunderclap headache, visual, or epigastric/RUQ — not generic mild headache alone */
function matchesSevereHeadacheOrVisual(t: string): boolean {
  return hasAnyKeywordNonNegated(t, [
    "severe headache",
    "thunderclap headache",
    "worst headache",
    "visual disturbance",
    "blurred vision",
    "scotoma",
    "scotomata",
    "seeing spots",
    "photophobia",
    "epigastric pain",
    "ruq pain",
    "right upper quadrant",
    "ปวดศีรษะรุนแรง",
    "ตาพร่า",
    "เห็นแสงวูบวาบ",
  ]);
}

function matchesHypertensionOrPreeclampsiaCue(t: string): boolean {
  return hasAnyKeywordNonNegated(t, [
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
    "preeclampsia",
    "pre-eclampsia",
    "proteinuria",
    "ครรภ์เป็นพิษ",
  ]);
}

/** Pregnancy / OB context + severe headache, visual, epigastric/RUQ, HTN, or named preeclampsia spectrum */
export function matchesPreeclampsiaSevereFeaturesPathway(t: string): boolean {
  if (!matchesPregnancyOrObContext(t)) return false;
  const neuroGi = matchesSevereHeadacheOrVisual(t);
  const htn = matchesHypertensionOrPreeclampsiaCue(t);
  const named = hasAnyKeywordNonNegated(t, ["preeclampsia", "pre-eclampsia", "eclampsia", "hellp", "ครรภ์เป็นพิษ"]);
  return neuroGi || htn || named;
}

function matchesPostpartumContext(t: string): boolean {
  return hasAnyKeywordNonNegated(t, [
    "postpartum",
    "postpartum hemorrhage",
    "pph",
    "after delivery",
    "หลังคลอด",
    "เลือดออกหลังคลอด",
    "puerperal",
  ]);
}

function matchesHeavyBleedingOrFeverPostpartum(t: string): boolean {
  const bleed = hasAnyKeywordNonNegated(t, [
    "heavy bleeding",
    "massive bleeding",
    "soaking",
    "large clots",
    "hypotension",
    "hemorrhagic shock",
    "เลือดออกมาก",
    "เลือดออกเยอะ",
  ]);
  const fever = hasAnyKeywordNonNegated(t, [
    "fever",
    "febrile",
    "pyrexia",
    "endometritis",
    "uterine tenderness",
    "purulent",
    "ไข้",
    "มีไข้",
    "ตกขาวเหลืองคล้ายหนอง",
  ]);
  return bleed || fever;
}

/** Postpartum heavy bleeding or postpartum fever → urgent obstetric pathway */
export function matchesPostpartumUrgentObPathway(t: string): boolean {
  if (!matchesPostpartumContext(t)) return false;
  return matchesHeavyBleedingOrFeverPostpartum(t);
}

/**
 * Returns human-readable hint lines for the AI user payload (rule layer only).
 */
export function inferObGynePathwayHints(normalizedText: string, mode: AssistMode): string[] {
  if (mode !== "LABOR_ROOM" && mode !== "GYNE") return [];
  const t = normalizedText;
  const out: string[] = [];

  if (matchesEarlyPregnancyPainBleedingPathway(t)) {
    out.push(
      "early_pregnancy_bleeding_ectopic_miscarriage: early pregnancy + pain + bleeding — prioritize ectopic pregnancy vs miscarriage (threatened/incomplete/complete); document β-hCG and TVS pathway, hemodynamics, and disposition per local OB protocol.",
    );
  }
  if (matchesPreeclampsiaSevereFeaturesPathway(t)) {
    out.push(
      "preeclampsia_severe_features: pregnancy-related hypertension / preeclampsia concern with severe headache, visual symptoms, epigastric/RUQ pain, or severe-range BP — urgent OB assessment; document BP, reflexes, labs per protocol; do not document as benign URI.",
    );
  }
  if (matchesPostpartumUrgentObPathway(t)) {
    out.push(
      "postpartum_urgent_ob: postpartum heavy bleeding or postpartum fever/infection concern — urgent obstetric pathway (quantify bleeding, vitals, source, antibiotics/surgery as indicated); explicit disposition.",
    );
  }

  return out;
}

export function formatObGynePathwayHintsForAi(hints: string[]): string {
  if (!hints.length) return "(RULE_OB_GYNE_PATHWAY_HINTS: none)";
  return [
    "RULE_OB_GYNE_PATHWAY_HINTS (advisory — set obGyneClinicalPathway to the matching token when clinically appropriate; align problems[] and plan):",
    ...hints.map((h) => `- ${h}`),
  ].join("\n");
}
