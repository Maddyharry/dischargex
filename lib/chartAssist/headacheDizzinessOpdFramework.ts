/**
 * OPD/ER Assist — headache & dizziness / vertigo (neuro red flags first).
 */
import { anyNonNegatedRegexMatch, hasAnyKeywordNonNegated, scoreKeysNegationAware } from "./clinicalNegation";

/** Primary cues — negation-aware scoring */
export const HEADACHE_DIZZINESS_CORE_KEYS = [
  "headache",
  "migraine",
  "cephalgia",
  "dizziness",
  "dizzy",
  "vertigo",
  "lightheaded",
  "lightheadedness",
  "presyncope",
  "syncope",
  "near syncope",
  "near-syncope",
  "imbalance",
  "unsteady",
  "off balance",
  "spinning",
  "spinning sensation",
  "room spinning",
  "ปวดหัว",
  "ปวดศีรษะ",
  "เวียนหัว",
  "บ้านหมุน",
  "หมุน",
  "หน้ามืด",
  "เป็นลม",
  "หมดสติ",
  "ทรงตัวไม่ได้",
  "เดินเซ",
  "ล้มบ่อย",
];

const NAUSEA_VOMIT_KEYS = ["nausea", "nauseous", "vomiting", "vomit", "emesis", "อาเจียน", "คลื่นไส้"];

const HEADACHE_OR_DIZZ_FOR_PAIR = [
  "headache",
  "migraine",
  "dizziness",
  "vertigo",
  "lightheaded",
  "spinning",
  "ปวดหัว",
  "เวียนหัว",
  "บ้านหมุน",
  "หน้ามืด",
];

/** Sudden severe / neuro deficit — ER priority */
const ER_PRIORITY_KEYS = [
  "thunderclap",
  "worst headache",
  "worst headache of life",
  "sudden severe headache",
  "acute severe headache",
  "focal weakness",
  "hemiparesis",
  "numbness",
  "facial droop",
  "speech difficulty",
  "slurred speech",
  "aphasia",
  "dysarthria",
  "diplopia",
  "double vision",
  "neck stiffness",
  "neck stiff",
  "meningismus",
  "altered mental",
  "confusion",
  "decreased loc",
  "loss of consciousness",
  "gcs",
  "seizure",
  "new onset seizure",
  "papilledema",
  "focal deficit",
  "คอแข็ง",
  "ชา",
  "อ่อนแรงข้างเดียว",
  "พูดไม่ชัด",
  "ดับเบิลวิชัน",
  "ซึมผิดปกติ",
  "ชัก",
  "ปวดหัวรุนแรงกะทันหัน",
];

export type HeadacheDizzinessOpdFramework =
  | {
      active: true;
      factsAlreadyPresent: string[];
      askNext: string[];
      examNext: string[];
      importantNegatives: string[];
      differentialExamples: string[];
      reasoningRules: string[];
      outputStyleHints: string[];
      /** Sudden severe headache or neuro deficit / meningitic features — prioritize ER disposition */
      erPriorityConcern: boolean;
    }
  | { active: false };

const HEADACHE_HISTORY_TH: string[] = [
  "Headache — onset & duration",
  "location (unilateral/bifrontal/occipital)",
  "character / severity (throbbing, pressure, stabbing)",
  "first episode vs recurrent pattern",
  "sudden vs gradual onset",
  "fever",
  "nausea / vomiting",
  "visual symptoms / aura",
  "neck stiffness",
  "seizure",
  "focal weakness / numbness / speech symptoms",
  "morning worsening / awakening from sleep with headache",
  "trauma",
  "sleep / stress triggers",
];

const DIZZINESS_HISTORY_TH: string[] = [
  "Dizziness — vertigo vs lightheadedness vs imbalance",
  "duration & trigger",
  "positional change (lying/sitting/standing, head turn)",
  "nausea / vomiting",
  "hearing loss / tinnitus",
  "gait imbalance",
  "focal neurologic symptoms",
  "palpitations / syncope / near-syncope",
  "poor intake / dehydration",
  "medication history (ototoxic, sedating, antihypertensive)",
];

const EXAM_TH: string[] = [
  "Vital signs — BP, HR (orthostatic if relevant)",
  "Mental status / orientation",
  "Hydration",
  "Focused neurologic exam — strength, sensation, coordination",
  "Gait / cerebellar signs (finger-nose, heel-shin)",
  "Cranial nerves — especially eye movements, facial symmetry",
  "Neck stiffness / meningismus — if relevant",
  "ENT — hearing, otoscopy — if vertigo/hearing symptoms",
  "Orthostatic vital signs — if lightheadedness / syncope",
];

const IMPORTANT_NEGATIVES_TH: string[] = [
  "ไม่มี focal neurologic deficit — ให้บันทึกเมื่อตรวจแล้วไม่มี",
  "ไม่มี altered mental status — ให้บันทึกเมื่อไม่มี",
  "ไม่มี seizure — ให้บันทึกเมื่อไม่มี",
  "ไม่มี neck stiffness — ให้บันทึกเมื่อไม่มี",
  "ไม่มี severe vomiting — ให้บันทึกเมื่อไม่มี",
  "ไม่มี trauma — ให้บันทึกเมื่อไม่มี",
  "ไม่มี gait ataxia — ให้บันทึกเมื่อไม่มี",
  "ไม่มี diplopia / dysarthria — ให้บันทึกเมื่อไม่มี",
  "ไม่มี syncope — ให้บันทึกเมื่อไม่มี",
];

const DIFFERENTIAL_HEADACHE_TH: string[] = [
  "Tension-type headache",
  "Migraine",
  "Febrile illness–related headache",
  "Sinus-related headache",
  "Meningitis / encephalitis concern — if red flags",
  "Secondary intracranial cause — if sudden severe / focal / papilledema",
];

const DIFFERENTIAL_DIZZINESS_TH: string[] = [
  "BPPV",
  "Vestibular neuritis / labyrinthitis",
  "Orthostatic / dehydration-related dizziness",
  "Anxiety-related dizziness",
  "Central vertigo — if focal neuro / severe ataxia",
  "Systemic cause (anemia / hypoglycemia / arrhythmia)",
];

const REASONING_RULES_TH: string[] = [
  "จัดลำดับ neurologic red flags ก่อน benign diagnosis",
  "Sudden severe headache หรือ neurologic deficit — ER priority / disposition ตามความรุนแรง",
  "ห้ามติดป้าย benign vertigo ถ้ามี focal neuro signs / severe ataxia / diplopia",
  "ถ้า headache กับ dizziness เป็นคนละประเด็น — แยก problem / timeline ชัด",
];

const OUTPUT_STYLE_TH: string[] = [
  "บันทึก red flags และสิ่งที่ตรวจแล้วไม่มี (pertinent negatives)",
  "ไม่สรุป diagnosis รุนแรงจาก keyword อย่างเดียว — สอดคล้องกับ PE",
];

function detectErPriorityConcern(normalizedText: string): boolean {
  const t = normalizedText;
  if (hasAnyKeywordNonNegated(t, ER_PRIORITY_KEYS)) return true;
  if (anyNonNegatedRegexMatch(t, /\b(?:thunderclap|worst headache|sudden onset)\b/i)) return true;
  return false;
}

export function detectHeadacheDizzinessFrameworkActive(normalizedText: string): boolean {
  const t = normalizedText;
  if (scoreKeysNegationAware(t, HEADACHE_DIZZINESS_CORE_KEYS) >= 1) return true;
  const hasNauseaPair =
    hasAnyKeywordNonNegated(t, NAUSEA_VOMIT_KEYS) && hasAnyKeywordNonNegated(t, HEADACHE_OR_DIZZ_FOR_PAIR);
  return hasNauseaPair;
}

function extractFacts(t: string): string[] {
  const out: string[] = [];
  const add = (cond: boolean, line: string) => {
    if (cond) out.push(line);
  };
  add(anyNonNegatedRegexMatch(t, /headache|migraine|cephalgia|ปวดหัว|ปวดศีรษะ/i), "มีการกล่าวถึง headache");
  add(
    anyNonNegatedRegexMatch(t, /dizziness|vertigo|lightheaded|spinning|เวียนหัว|บ้านหมุน|หน้ามืด/i),
    "มีการกล่าวถึง dizziness / vertigo / lightheadedness",
  );
  add(anyNonNegatedRegexMatch(t, /syncope|presyncope|near syncope|เป็นลม|หมดสติ/i), "มีการกล่าวถึง syncope / near-syncope");
  add(anyNonNegatedRegexMatch(t, /imbalance|unsteady|ataxia|ทรงตัว|เดินเซ/i), "มีการกล่าวถึง imbalance / unsteady gait");
  add(
    anyNonNegatedRegexMatch(t, /nausea|vomit|อาเจียน|คลื่นไส้/i) &&
      anyNonNegatedRegexMatch(t, /headache|dizziness|vertigo|ปวดหัว|เวียน/i),
    "มี nausea/vomiting ร่วมกับ headache หรือ dizziness",
  );
  if (out.length === 0) {
    out.push("มีคีย์เวิร์ด headache / dizziness — เก็บ onset, red flags, และ PE");
  }
  return out.slice(0, 14);
}

export function buildHeadacheDizzinessOpdFramework(normalizedText: string): HeadacheDizzinessOpdFramework {
  if (!detectHeadacheDizzinessFrameworkActive(normalizedText)) {
    return { active: false };
  }

  const t = normalizedText;
  const askNext = [
    "— Headache —",
    ...HEADACHE_HISTORY_TH,
    "— Dizziness / vertigo —",
    ...DIZZINESS_HISTORY_TH,
  ];

  const differentialExamples = [
    ...DIFFERENTIAL_HEADACHE_TH.map((x) => `[Headache] ${x}`),
    ...DIFFERENTIAL_DIZZINESS_TH.map((x) => `[Dizziness] ${x}`),
  ];

  return {
    active: true,
    factsAlreadyPresent: extractFacts(t),
    askNext,
    examNext: [...EXAM_TH],
    importantNegatives: [...IMPORTANT_NEGATIVES_TH],
    differentialExamples,
    reasoningRules: [...REASONING_RULES_TH],
    outputStyleHints: [...OUTPUT_STYLE_TH],
    erPriorityConcern: detectErPriorityConcern(t),
  };
}

export function formatHeadacheDizzinessFrameworkForAi(f: HeadacheDizzinessOpdFramework): string {
  if (!f.active) return "(HEADACHE_DIZZINESS_FRAMEWORK inactive)";
  const lines = [
    "=== HEADACHE / DIZZINESS (OPD/ER) ===",
    f.erPriorityConcern ? "ER PRIORITY (rule-based): sudden severe headache or neuro red flags — disposition accordingly." : "",
    "",
    "Facts already present:",
    ...f.factsAlreadyPresent.map((x) => `- ${x}`),
    "",
    "Ask next (history):",
    ...f.askNext.map((x) => (x.startsWith("—") ? x : `- ${x}`)),
    "",
    "Examine next:",
    ...f.examNext.map((x) => `- ${x}`),
    "",
    "Important negatives to document if absent:",
    ...f.importantNegatives.map((x) => `- ${x}`),
    "",
    "Differential examples:",
    ...f.differentialExamples.map((x) => `- ${x}`),
    "",
    "Reasoning rules:",
    ...f.reasoningRules.map((x) => `- ${x}`),
    "",
    "Output style:",
    ...f.outputStyleHints.map((x) => `- ${x}`),
  ].filter((line) => line !== "");
  return lines.join("\n");
}
