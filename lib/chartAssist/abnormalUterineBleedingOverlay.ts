/**
 * Acute abnormal uterine bleeding (AUB) overlay — pregnancy clarification, hemodynamics first,
 * heavy bleed + instability → urgent pathway; nonpregnant AUB not framed as routine dysmenorrhea.
 * Rule layer only; does not replace hospital protocol.
 */
import type { AssistMode } from "./cardTypes";
import { hasAnyKeywordNonNegated, scoreKeysNegationAware } from "./clinicalNegation";
import { hasEarlyPregnancyPainBleedingOverlayTrigger } from "./earlyPregnancyPainBleedingOverlay";
import type { OpdProblemPackId } from "./opdProblemPacks";

/** Match symptom pack + free-text triggers */
export const AUB_TRIGGER_KEYS = [
  "abnormal uterine bleeding",
  "aub",
  "heavy menstrual bleeding",
  "menorrhagia",
  "metrorrhagia",
  "intermenstrual bleeding",
  "breakthrough bleeding",
  "acute vaginal bleeding",
  "prolonged bleeding",
  "irregular bleeding",
  "เลือดประจำเดือนมาก",
  "ประจำเดือนมากผิดปกติ",
  "เลือดออกทางช่องคลอด",
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

const HEAVY_BLEED_KEYS = [
  "heavy bleeding",
  "massive bleeding",
  "soaking",
  "large clots",
  "hemorrhage",
  "เลือดออกมาก",
  "เลือดออกเยอะ",
  "heavy menstrual",
  "menorrhagia",
  "ประจำเดือนมาก",
];

const NONPREGNANT_HINT_KEYS = [
  "not pregnant",
  "nonpregnant",
  "non-pregnant",
  "negative pregnancy test",
  "upt negative",
  "bhcg negative",
  "β-hcg negative",
  "ไม่ได้ท้อง",
  "ไม่ท้อง",
  "ตรวจแล้วไม่ท้อง",
];

const SURFACE_ALWAYS: string[] = [
  "Pregnancy status — clarify early (pregnant / not pregnant / unknown / postpartum); obGynePregnancyStatus + UPT/β-hCG if discussed — never only deep in PI.",
  "Hemodynamic status — BP/HR, orthostasis, perfusion, IV access / resuscitation if documented (lead triage when unstable).",
  "Bleeding amount — obGyneBleedingSeverity { level, quantifiedDetails } (pads/h, clots, estimated loss, orthostasis).",
  "Cycle / pattern — LMP, cycle length, intermenstrual vs postcoital vs acute change, contraception if relevant.",
  "Anemia symptoms — fatigue, dyspnea, chest pain, pallor if documented.",
  "Bleeding risk / anticoagulation — anticoagulants, bleeding disorder, fibroids, prior AUB if documented.",
];

const ASK_NEXT: string[] = [
  "UPT / β-hCG — pregnancy must be ruled in or out before anchoring nonpregnant AUB DDx",
  "Bleeding amount — pads/h, clots, syncope",
  "LMP / cycle pattern",
  "Contraception / hormones / IUD",
  "Fibroids, polyp history, coagulation disorder",
  "Anticoagulation, NSAID, bleeding medications",
];

const EXAM_NEXT: string[] = [
  "Vitals — BP, HR, orthostatic if safe; hemodynamic stability first",
  "Anemia signs — pallor, tachycardia, symptomatic anemia",
  "Pelvic — per protocol when stable",
  "Hgb / labs — per protocol when indicated",
];

const CLINICAL_RULES: string[] = [
  "Pregnancy status must be clarified early — UPT/β-hCG pathway; do not write nonpregnant primary dysmenorrhea narrative until pregnancy excluded or documented negative.",
  "Hemodynamic stability and resuscitation documentation come before long benign HPI when bleeding is heavy or vitals are unstable.",
  "Heavy bleeding with hemodynamic instability — urgent pathway (GYN/ER); obGyneDisposition and obGyneTriageSummary must reflect urgency.",
  "Nonpregnant acute AUB — do not merge into routine primary dysmenorrhea note format; use acute bleeding / AUB structure and DDx (anovulatory, fibroid, polyp, coagulopathy, etc.) per context.",
];

export type AbnormalUterineBleedingOverlay =
  | { active: false }
  | {
      active: true;
      activationRationale: string[];
      surfaceAlways: string[];
      askNext: string[];
      examNext: string[];
      clinicalRules: string[];
      /** Heavy bleeding pattern + unstable vitals → urgent pathway */
      urgentPathwayLikely: boolean;
      urgentPathwayReasons: string[];
      /** Text suggests explicitly nonpregnant / negative UPT (advisory) */
      nonPregnantAubHint: boolean;
      /** Do not use routine dysmenorrhea / chronic pelvic pain OPD template as primary frame */
      avoidRoutineDysmenorrheaNoteFormat: boolean;
    };

function unstableReasons(t: string): string[] {
  const out: string[] = [];
  if (hasAnyKeywordNonNegated(t, UNSTABLE_VITALS_KEYS)) out.push("unstable hemodynamics / shock concern");
  return out;
}

function heavyBleedCue(t: string): boolean {
  return hasAnyKeywordNonNegated(t, HEAVY_BLEED_KEYS);
}

function nonPregnantHint(t: string): boolean {
  return hasAnyKeywordNonNegated(t, NONPREGNANT_HINT_KEYS);
}

export function hasAbnormalUterineBleedingOverlayTrigger(
  t: string,
  activePackIds: readonly OpdProblemPackId[],
): boolean {
  if (activePackIds.includes("gy_abnormal_uterine_bleeding")) return true;
  return scoreKeysNegationAware(t, AUB_TRIGGER_KEYS) >= 1;
}

export function buildAbnormalUterineBleedingOverlay(
  normalizedText: string,
  mode: AssistMode,
  activePackIds: readonly OpdProblemPackId[],
): AbnormalUterineBleedingOverlay {
  if (mode !== "LABOR_ROOM" && mode !== "GYNE") {
    return { active: false };
  }

  /** Early pregnancy pain/bleeding overlay takes precedence when triggered */
  if (hasEarlyPregnancyPainBleedingOverlayTrigger(normalizedText, activePackIds)) {
    return { active: false };
  }

  if (!hasAbnormalUterineBleedingOverlayTrigger(normalizedText, activePackIds)) {
    return { active: false };
  }

  const unstable = unstableReasons(normalizedText);
  const heavy = heavyBleedCue(normalizedText);
  /** Instability with acute AUB context → urgent; heavy bleeding + instability emphasized when both detected */
  const urgentPathwayLikely = unstable.length > 0;
  const urgentPathwayReasons: string[] = [];
  if (urgentPathwayLikely) {
    urgentPathwayReasons.push(
      heavy
        ? "Heavy bleeding pattern + hemodynamic instability concern — urgent GYN/ER pathway"
        : "Hemodynamic instability with acute bleeding presentation — urgent GYN/ER pathway",
    );
  }

  const rationale: string[] = [];
  if (activePackIds.includes("gy_abnormal_uterine_bleeding")) {
    rationale.push("Symptom pack matched: gy_abnormal_uterine_bleeding");
  }
  if (!activePackIds.includes("gy_abnormal_uterine_bleeding")) {
    rationale.push("Acute abnormal uterine bleeding keywords");
  }
  if (nonPregnantHint(normalizedText)) rationale.push("Nonpregnant / negative UPT cues in text");
  if (urgentPathwayLikely) {
    rationale.push(
      heavy
        ? "Heavy bleeding pattern + hemodynamic instability — urgent pathway"
        : "Hemodynamic instability with acute AUB — urgent pathway",
    );
  }

  return {
    active: true,
    activationRationale: rationale,
    surfaceAlways: [...SURFACE_ALWAYS],
    askNext: [...ASK_NEXT],
    examNext: [...EXAM_NEXT],
    clinicalRules: [...CLINICAL_RULES],
    urgentPathwayLikely,
    urgentPathwayReasons: [...new Set(urgentPathwayReasons)],
    nonPregnantAubHint: nonPregnantHint(normalizedText),
    avoidRoutineDysmenorrheaNoteFormat: true,
  };
}

export function formatAbnormalUterineBleedingOverlayForAi(o: AbnormalUterineBleedingOverlay): string {
  if (!o.active) return "(ABNORMAL_UTERINE_BLEEDING_OVERLAY inactive)";
  const lines = [
    "=== ACUTE ABNORMAL UTERINE BLEEDING (AUB) (overlay) ===",
    o.urgentPathwayLikely
      ? "PATHWAY: Urgent — hemodynamic instability with acute AUB; lead obGyneTriageSummary with stabilization and bleeding quantification before routine HPI (heavy bleeding + instability when both apply)."
      : "PATHWAY: Clarify pregnancy status early; document hemodynamics and structured bleeding severity.",
    o.nonPregnantAubHint
      ? "CONTEXT HINT: nonpregnant / negative UPT language present — still avoid collapsing into routine dysmenorrhea-only note; use acute AUB framing."
      : "",
    o.avoidRoutineDysmenorrheaNoteFormat
      ? "NOTE FORMAT: Do NOT merge nonpregnant acute AUB into a routine primary dysmenorrhea / chronic pelvic pain OPD template as the primary structure."
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
    "Urgent pathway (reasons):",
    ...(o.urgentPathwayReasons.length
      ? o.urgentPathwayReasons.map((x) => `- ${x}`)
      : ["- (pattern not fully met — still document vitals and bleeding quantification)"]),
    "",
    "Activation rationale:",
    ...o.activationRationale.map((x) => `- ${x}`),
  ].filter((line) => line !== "");
  return lines.join("\n");
}
