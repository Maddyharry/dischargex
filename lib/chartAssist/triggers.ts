import type { AssistMode } from "./cardTypes";
import { hasAny } from "./cardTypes";
import { computeSystemicRedFlags } from "./caseClinicalProfile";
import { hasAnyKeywordNonNegated } from "./clinicalNegation";
import { matchesFeverWithDangerErEscalation } from "./feverChildOpdFramework";
import { matchesGiSevereDehydrationErEscalation } from "./giDehydrationOpdFramework";
import { matchesAbdominalPainErEscalation } from "./abdominalPainOpdFramework";

/** Mechanism / injury — negation-aware; RTA/MVA etc. */
const TRAUMA_VISIT_KEYS = [
  "หัวกระแทก",
  "ศีรษะกระแทก",
  "head trauma",
  "อุบัติเหตุ",
  "แรงกระแทก",
  "mva",
  "rta",
  "road traffic",
  "motor vehicle",
  "motor vehicle accident",
  "ชน",
  "ชนรถ",
  "ถูกชน",
  "อุบัติเหตุทางถนน",
  "trauma",
  "fall",
  "ล้ม",
  "pedestrian",
  "แรงกระแทกจากรถ",
];

/** Same list as trauma visit detection — for problem packs / traumaOpdFramework */
export const TRAUMA_VISIT_DETECTION_KEYS: readonly string[] = TRAUMA_VISIT_KEYS;

/** Psychiatric visit cues — negation-aware (exported for psychOpdFramework) */
const PSYCH_VISIT_KEYS = [
  "suicidal",
  "suicide",
  "suicide attempt",
  "kill myself",
  "คิดฆ่าตัวตาย",
  "อยากตาย",
  "ทำร้ายตัวเอง",
  "self-harm",
  "hallucination",
  "hallucinations",
  "auditory hallucination",
  "หูแว่ว",
  "หลอน",
  "violent behavior",
  "violence",
  "ทำร้ายผู้อื่น",
  "ทำร้าย",
  "aggressive",
  "psychosis",
  "manic",
  "mania",
  "acute psych",
];

export const PSYCH_VISIT_DETECTION_KEYS: readonly string[] = PSYCH_VISIT_KEYS;

export type VisitModeReasonCode =
  | "override"
  | "er_systemic_red_flags"
  | "er_dyspnea_hypoxemia"
  | "er_airway_severe"
  | "er_legacy_urgency"
  | "er_altered_mental_status"
  | "er_severe_dyspnea"
  | "er_hypoxemia"
  | "er_shock_perfusion"
  | "er_seizure"
  | "er_severe_dehydration"
  | "er_anaphylaxis"
  | "er_active_bleeding"
  | "er_poisoning_overdose"
  | "er_severe_trauma"
  | "trauma_mechanism"
  | "psychiatric_risk"
  | "opd_default"
  | "er_fever_danger_pediatric"
  | "er_gi_severe_dehydration"
  | "er_abdominal_surgical_concern"
  | "labor_room_presentation"
  | "gyne_presentation";

/** Ordered: first match wins — airway / anaphylaxis / shock before isolated dyspnea */
const ER_FIRST_PRESENTATION_RULES: readonly {
  reason: VisitModeReasonCode;
  keys: string[];
}[] = [
  {
    reason: "er_airway_severe",
    keys: [
      "stridor",
      "upper airway obstruction",
      "unable to speak",
      "พูดไม่ได้",
      "inability to swallow saliva",
      "drooling",
      "น้ำลายไหลมาก",
    ],
  },
  {
    reason: "er_anaphylaxis",
    keys: [
      "anaphylaxis",
      "anaphylactic",
      "anaphylactoid",
      "tongue swelling",
      "lip swelling",
      "throat closing",
      "airway swelling",
      "angioedema",
      "epinephrine given",
      "epipen",
      "เอปินีฟริน",
      "ลมพิษรุนแรง",
    ],
  },
  {
    reason: "er_shock_perfusion",
    keys: [
      "shock",
      "septic shock",
      "hypotension",
      "bp ต่ำ",
      "bpต่ำ",
      "map ",
      "poor perfusion",
      "mottled",
      "cold clammy",
      "lactate",
      "ช็อก",
      "perfusion",
      "cap refill",
      "crt ",
      "crt:",
    ],
  },
  {
    reason: "er_hypoxemia",
    keys: [
      "hypoxemia",
      "hypoxic",
      "hypoxia",
      "hypox",
      "spo2 8",
      "spo2 9",
      "spo2 88",
      "spo2 89",
      "spo2 90",
      "spo2 91",
      "o2 sat 8",
      "o2 sat 9",
      "o2 sat 88",
      "o2 sat 89",
      "oxygen saturation 8",
      "oxygen saturation 9",
    ],
  },
  {
    reason: "er_severe_dyspnea",
    keys: [
      "severe dyspnea",
      "respiratory distress",
      "respiratory failure",
      "severe shortness of breath",
      "unable to complete sentences",
      "หอบมาก",
      "หายใจลำบากมาก",
      "หายใจไม่ทัน",
      "เหนื่อยหอบมาก",
      "tachypnea",
      "accessory muscle",
      "retraction",
    ],
  },
  {
    reason: "er_seizure",
    keys: [
      "seizure",
      "convulsion",
      "status epilepticus",
      "tonic clonic",
      "ชัก",
      "กระตุกซ้ำ",
      "febrile seizure",
    ],
  },
  {
    reason: "er_altered_mental_status",
    keys: [
      "altered mental status",
      "altered mentation",
      "acute confusion",
      "encephalopathy",
      "gcs ",
      "gcs:",
      "avpu",
      "unresponsive",
      "หมดสติ",
      "ไม่รู้สึกตัว",
      "ไม่ตื่น",
      "ซึมมาก",
      "lethargic",
    ],
  },
  {
    reason: "er_active_bleeding",
    keys: [
      "hematemesis",
      "melena",
      "hematochezia",
      "hemoptysis",
      "active bleeding",
      "massive hemorrhage",
      "hemorrhagic shock",
      "เลือดออกมาก",
      "ถ่ายเป็นเลือด",
      "เสมหะเป็นเลือด",
      "vomiting blood",
      "rectal bleeding",
    ],
  },
  {
    reason: "er_poisoning_overdose",
    keys: [
      "overdose",
      "poisoning",
      "toxic ingestion",
      "intoxication",
      "ingestion",
      "กินยาเกิน",
      "กินยาผิด",
      "สารพิษ",
      "organophosphate",
      "opioid overdose",
    ],
  },
  {
    reason: "er_severe_dehydration",
    keys: [
      "severe dehydration",
      "dehydration shock",
      "sunken fontanelle",
      "sunken eyes",
      "ตาโหล่ง",
      "ขาดน้ำรุนแรง",
      "no tears",
      "ไม่มีน้ำตา",
      "poor skin turgor",
    ],
  },
];

const SEVERE_TRAUMA_ER_KEYS = [
  "open fracture",
  "penetrating trauma",
  "penetrating injury",
  "polytrauma",
  "multisystem trauma",
  "unstable pelvis",
  "pelvic fracture",
  "flail chest",
  "tension pneumothorax",
  "hemothorax",
  "hemorrhagic shock",
  "gcs 3",
  "gcs 4",
  "gcs 5",
  "gcs 6",
  "gcs 7",
  "gcs 8",
  "ไม่ตอบสนองหลังอุบัติเหตุ",
  "crush injury",
  "amputation",
];

/**
 * Explicit ER-first triggers (negation-aware). Does not include generic trauma mechanism — use `detectVisitMode`.
 */
export function matchesErFirstUrgency(normalizedText: string): VisitModeReasonCode | null {
  const t = normalizedText;
  for (const rule of ER_FIRST_PRESENTATION_RULES) {
    if (hasAnyKeywordNonNegated(t, rule.keys)) return rule.reason;
  }
  return null;
}

/**
 * Severe / unstable trauma → ER (not routine TRAUMA styling only).
 */
export function matchesSevereTraumaEr(normalizedText: string): boolean {
  return hasAnyKeywordNonNegated(normalizedText, SEVERE_TRAUMA_ER_KEYS);
}

/**
 * Visit mode detection — runs before problem packs / multi-problem reasoning.
 * Priority: ER-first urgent triggers > pediatric/GI/abdominal ER escalations > systemic red flags > dyspnea+hypox > legacy ER > severe trauma (ER) > LABOR_ROOM > GYNE > generic trauma > psychiatric > OPD.
 * Mode does not replace the problem list; it steers style and safety emphasis.
 */
export function detectVisitMode(
  normalizedText: string,
  override: AssistMode | null,
): { mode: AssistMode; reason: VisitModeReasonCode } {
  if (override) {
    return { mode: override, reason: "override" };
  }
  const t = normalizedText;

  const erFirst = matchesErFirstUrgency(t);
  if (erFirst) {
    return { mode: "ER", reason: erFirst };
  }

  if (matchesFeverWithDangerErEscalation(t)) {
    return { mode: "ER", reason: "er_fever_danger_pediatric" };
  }

  if (matchesGiSevereDehydrationErEscalation(t)) {
    return { mode: "ER", reason: "er_gi_severe_dehydration" };
  }

  if (matchesAbdominalPainErEscalation(t)) {
    return { mode: "ER", reason: "er_abdominal_surgical_concern" };
  }

  if (computeSystemicRedFlags(t)) {
    return { mode: "ER", reason: "er_systemic_red_flags" };
  }

  if (matchesDyspneaWithHypoxemia(t)) {
    return { mode: "ER", reason: "er_dyspnea_hypoxemia" };
  }

  /** Legacy ER keyword set — kept for compatibility; still avoids bare “URI” false ER */
  if (matchesLegacyErUrgency(t)) {
    return { mode: "ER", reason: "er_legacy_urgency" };
  }

  if (matchesSevereTraumaEr(t)) {
    return { mode: "ER", reason: "er_severe_trauma" };
  }

  if (matchesLaborRoomVisit(t)) {
    return { mode: "LABOR_ROOM", reason: "labor_room_presentation" };
  }

  if (matchesGyneVisit(t)) {
    return { mode: "GYNE", reason: "gyne_presentation" };
  }

  if (matchesTraumaVisit(t)) {
    return { mode: "TRAUMA", reason: "trauma_mechanism" };
  }

  if (matchesPsychiatricVisit(t)) {
    return { mode: "PSYCH", reason: "psychiatric_risk" };
  }

  return { mode: "OPD", reason: "opd_default" };
}

/** @deprecated use detectVisitMode — returns mode only */
export function detectAssistMode(normalizedText: string, override: AssistMode | null): AssistMode {
  return detectVisitMode(normalizedText, override).mode;
}

function matchesDyspneaWithHypoxemia(t: string): boolean {
  const dysp = hasAnyKeywordNonNegated(t, [
    "dyspnea",
    "หอบมาก",
    "respiratory distress",
    "หายใจลำบากมาก",
    "severe shortness of breath",
    "shortness of breath",
  ]);
  const hypox = hasAnyKeywordNonNegated(t, [
    "hypox",
    "hypoxia",
    "hypoxemia",
    "spo2 8",
    "spo2 9",
    "spo2 90",
    "spo2 89",
    "spo2 88",
    "o2 sat 8",
    "o2 sat 9",
  ]);
  return dysp && hypox;
}

function matchesTraumaVisit(t: string): boolean {
  return hasAnyKeywordNonNegated(t, [...TRAUMA_VISIT_DETECTION_KEYS]);
}

function matchesPsychiatricVisit(t: string): boolean {
  return hasAnyKeywordNonNegated(t, [...PSYCH_VISIT_DETECTION_KEYS]);
}

/** Strong obstetric / labor triage cues — not isolated early pregnancy bleeding (GYNE pathway) */
const LABOR_ROOM_STRONG_KEYS = [
  "postpartum",
  "postpartum hemorrhage",
  "pph",
  "postpartum fever",
  "endometritis",
  "เลือดออกหลังคลอด",
  "หลังคลอด",
  "preeclampsia",
  "pre-eclampsia",
  "eclampsia",
  "gestational hypertension",
  "hellp",
  "ครรภ์เป็นพิษ",
  "reduced fetal movement",
  "decreased fetal movement",
  "fetal movement decreased",
  "ลูกดิ้นน้อย",
  "antepartum bleeding",
  "placenta previa",
  "abruption",
  "placental abruption",
  "third trimester bleeding",
  "labor room",
  "intrapartum",
  "เปิดปากมดลูก",
  "ตัวคลอด",
  "ห้องคลอด",
];

const LABOR_CONTRACTION_KEYS = [
  "labor", "labour", "contraction", "uterine contraction", "คลอด", "เจ็บครรภ์", "ส่งครรภ์",
];

const GYNE_PRESENTATION_KEYS = [
  "pelvic inflammatory disease",
  "bartholin",
  "bartholin cyst",
  "bartholin abscess",
  "postmenopausal bleeding",
  "ovarian torsion",
  "adnexal torsion",
  "adnexal mass",
  "dysmenorrhea",
  "chronic pelvic pain",
  "endometriosis",
  "abnormal uterine bleeding",
  "aub",
  "ectopic pregnancy",
  "early pregnancy bleeding",
  "first trimester bleeding",
  "threatened abortion",
  "missed abortion",
  "incomplete abortion",
  "miscarriage",
  "vaginal discharge",
  "cervicitis",
  "purulent discharge",
  "vulvar abscess",
  "เลือดออกหลังวัยทอง",
  "ตกขาว",
  "ขั้วรังไข่บิด",
  "ครรภ์นอกมดลูก",
  "แท้ง",
];

function matchesEarlyPregnancyBleedingGyne(t: string): boolean {
  const early =
    hasAnyKeywordNonNegated(t, [
      "early pregnancy",
      "first trimester",
      "ectopic",
      "ectopic pregnancy",
      "threatened abortion",
      "miscarriage",
      "6 weeks pregnant",
      "7 weeks",
      "8 weeks",
      "9 weeks",
      "10 weeks",
      "12 weeks",
      "ครรภ์นอกมดลูก",
      "แท้ง",
    ]) || /\b(?:6|7|8|9|10|11|12)\s*weeks?\b/i.test(t);
  const bleed = hasAnyKeywordNonNegated(t, [
    "vaginal bleeding",
    "bleeding",
    "spotting",
    "เลือดออก",
    "ปวดท้อง",
  ]);
  return early && bleed;
}

export function matchesLaborRoomVisit(t: string): boolean {
  if (hasAnyKeywordNonNegated(t, LABOR_ROOM_STRONG_KEYS)) return true;
  if (hasAnyKeywordNonNegated(t, LABOR_CONTRACTION_KEYS)) {
    if (matchesEarlyPregnancyBleedingGyne(t) && !hasAnyKeywordNonNegated(t, ["term", "third trimester", "37 weeks", "38 weeks", "39 weeks", "40 weeks"])) {
      return false;
    }
    return true;
  }
  if (matchesEarlyPregnancyBleedingGyne(t)) return false;
  return false;
}

export function matchesGyneVisit(t: string): boolean {
  if (matchesLaborRoomVisit(t)) return false;
  if (hasAnyKeywordNonNegated(t, GYNE_PRESENTATION_KEYS)) return true;
  if (matchesEarlyPregnancyBleedingGyne(t)) return true;
  return false;
}

const LEGACY_ER_KEYS = [
  "ซึม",
  "หมดสติ",
  "ชัก",
  "หอบมาก",
  "shock",
  "bp ต่ำ",
  "hypotension",
  "ถ่ายเป็นเลือด",
  "bloody",
  "อาเจียนซ้ำ",
  "severe pain",
  "ปวดมาก",
  "ช็อก",
  "sepsis",
  "hypox",
  "hypoxia",
  "spo2 8",
  "spo2 9",
  "o2 sat 8",
  "o2 sat 9",
];

function matchesLegacyErUrgency(t: string): boolean {
  return hasAnyKeywordNonNegated(t, LEGACY_ER_KEYS);
}

/** Narrative + style hints for AI (Step 2) — does not replace problem list */
export function getVisitModeStyleGuidance(mode: AssistMode): string {
  switch (mode) {
    case "ER":
      return [
        "Visit mode: ER — ER-first reasoning.",
        "Priority: (1) life threats / instability (2) immediate stabilization & management (3) focused history & exam (4) disposition.",
        "Export: Triage concern → ABCDE / immediate concern → Focused history → Focused exam → Problem list → Immediate management → Reassessment → Disposition.",
        "Do not bury urgent concerns under routine OPD narrative; show immediate actions first; keep multiple problems separate and rank by urgency.",
        "Problem split: AGE vs dehydration severity may be two problems; fever + URI may be two or one syndrome — document per context.",
      ].join(" ");
    case "TRAUMA":
      return [
        "Visit mode: TRAUMA — mechanism-first, survey-first (not routine OPD).",
        "Export: Mechanism of injury → Time of injury → Primary survey A–E → Secondary survey → Problem list → Assessment → Plan (incl. imaging/procedure) → Disposition.",
        "Prioritize life-threatening injury first; problem list after primary/secondary survey.",
        "Multiple injuries: separate problems[]; do not merge incompatible tracks.",
      ].join(" ");
    case "PSYCH":
      return [
        "Visit mode: PSYCH — safety-first; not URI/routine OPD.",
        "Export: Chief psychiatric concern → HPI → Risk assessment → MSE → Problem list → Assessment → Plan → Disposition/referral.",
        "Prioritize risk (suicide, violence, psychosis, substance) and disposition; escalate clearly when high risk.",
        "Multiple problems: separate entries when medical + psychiatric; do not collapse into one URI-style note.",
      ].join(" ");
    case "LABOR_ROOM":
      return [
        "Visit mode: LABOR_ROOM — obstetric triage / labor evaluation; not URI or generic OPD.",
        "Surface early: pregnancy status; GA when pregnant; maternal hemodynamic status when relevant (BP/HR/perfusion).",
        "Bleeding: structured severity (level + quantified details — pads/h, clots, estimated loss) — not narrative-only.",
        "Disposition must be explicit (observe / urgent OB / L&D admit / OR / transfer / discharge with safety-net).",
        "Unstable or high-acuity OB presentations: urgent pathway first — not routine outpatient-style closure.",
        "Pathways when applicable: early pregnancy pain+bleeding (ectopic/miscarriage), preeclampsia severe features, postpartum urgent (heavy bleed or fever).",
        "Export: Pregnancy status → GA → Hemodynamics (when relevant) → Bleeding severity → Pathway → Clinical summary → CC/PI/PE → Problems → Disposition.",
      ].join(" ");
    case "GYNE":
      return [
        "Visit mode: GYNE — gynecologic acute; not URI or generic OPD.",
        "Surface early: pregnancy status; GA when pregnant; hemodynamic status when relevant (BP/HR/perfusion).",
        "Bleeding: structured severity; disposition explicit (clinic / urgent GYN / ED / OR / admit / observe).",
        "Unstable GYNE (hypotension, peritonism, heavy bleeding, suspected ectopic/torsion/sepsis): urgent pathway — not routine OPD closure.",
        "Pathways: early pregnancy pain+bleeding (ectopic/miscarriage), acute AUB, PID, torsion, postmenopausal bleeding per context.",
        "Export: Pregnancy status → GA → Hemodynamics (when relevant) → Bleeding severity → Pathway → Clinical summary → CC/PI/PE → Problems → disposition.",
      ].join(" ");
    default:
      return [
        "Visit mode: routine OPD.",
        "Problem-based outpatient note; follow-up proportional to severity.",
        "Escalate tone and prioritization when RULE_RED_FLAGS or systemicRedFlags are present.",
        "Problem split: AGE vs dehydration severity may be two problems; fever without focus + URI may be two problems or one viral syndrome — choose by context.",
      ].join(" ");
  }
}
