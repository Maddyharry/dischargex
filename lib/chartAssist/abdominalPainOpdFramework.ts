/**
 * Thai OPD/ER Assist — acute abdominal pain (surgical / urgent red flags first).
 */
import type { AssistMode } from "./cardTypes";
import { detectDominantTheme } from "./caseClinicalProfile";
import { anyNonNegatedRegexMatch, hasAnyKeywordNonNegated, scoreKeysNegationAware } from "./clinicalNegation";

export const ABDOMINAL_PAIN_ACTIVATION_KEYS = [
  "abdominal pain",
  "stomach ache",
  "stomachache",
  "belly pain",
  "tummy ache",
  "abdominal tenderness",
  "tenderness abdomen",
  "epigastric pain",
  "epigastric",
  "rlq pain",
  "llq pain",
  "ruq pain",
  "luq pain",
  "periumbilical",
  "colicky",
  "colic",
  "crampy abdominal",
  "guarding",
  "rebound",
  "peritonitis",
  "constipation",
  "constipated",
  "obstipation",
  "ท้องผูก",
  "ปวดท้อง",
  "กดเจ็บท้อง",
  "ท้องขวาล่าง",
  "ท้องน้อย",
  "lower abdominal pain",
  "suprapubic pain",
  "dysuria",
  "ปัสสาวะแสบ",
  "flank pain",
  "cva tenderness",
];

/** GI symptoms that activate only when abdominal context is present (handled in detector) */
const GI_COMBO_KEYS = ["vomit", "vomiting", "emesis", "diarrhea", "diarrhoea", "ท้องเสีย", "อาเจียน", "nausea", "คลื่นไส้"];

const TRAUMA_CONTEXT_KEYS = [
  "rta",
  "mva",
  "trauma",
  "fall",
  "ล้ม",
  "ชน",
  "อุบัติเหตุ",
  "motor vehicle",
  "blunt",
  "assault",
];

/** Urgent / surgical — escalate disposition & visit-mode bias toward ER */
const SURGICAL_RED_FLAG_RULES: { label: string; keys: string[] }[] = [
  {
    label: "Peritonism / rigidity / rebound",
    keys: [
      "peritonitis",
      "peritoneal",
      "rigid abdomen",
      "board-like",
      "rebound",
      "guarding",
      "rigidity",
      "involuntary guarding",
    ],
  },
  {
    label: "Bilious / feculent / severe vomiting",
    keys: [
      "bilious vomiting",
      "bilious vomit",
      "feculent",
      "coffee ground",
      "hematemesis",
      "vomiting blood",
      "อาเจียนเป็นสีเขียว",
      "อาเจียนเป็นเลือด",
    ],
  },
  {
    label: "Obstruction / distension / obstipation",
    keys: [
      "abdominal distension",
      "distended abdomen",
      "ท้องอืด",
      "unable to pass flatus",
      "no flatus",
      "small bowel obstruction",
      "sbo",
      "volvulus",
      "intussusception",
    ],
  },
  {
    label: "Ischemia / shock / severe pain",
    keys: [
      "severe abdominal pain",
      "worst abdominal pain",
      "ปวดท้องรุนแรง",
      "shock",
      "mottled",
      "poor perfusion",
      "lactate",
      "ช็อก",
      "mesenteric ischemia",
    ],
  },
  {
    label: "Torsion / surgical emergency keywords",
    keys: [
      "testicular torsion",
      "ovarian torsion",
      "torsion",
      "appendicitis",
      "appendix",
      "ไส้ติ่ง",
    ],
  },
];

export type AbdominalPainOpdFramework =
  | {
      active: true;
      factsAlreadyPresent: string[];
      askNext: string[];
      examNext: string[];
      importantNegatives: string[];
      differentialExamples: string[];
      reasoningRules: string[];
      outputStyleHints: string[];
      surgicalRedFlagsPresent: boolean;
      surgicalRedFlagMatches: string[];
      traumaContextPresent: boolean;
      urgencyHint: "routine_opd" | "prefer_er_or_urgent";
      secondaryToOtherSystem: boolean;
      secondarySystemNote: string | null;
    }
  | { active: false };

const HISTORY_TH: string[] = [
  "onset และ duration",
  "ตำแหน่งปวด / migration (location, migration)",
  "ลักษณะ — colicky vs constant vs worsening (character)",
  "เกี่ยวกับอาหาร / ถ่าย / ปัสสาวะ (relation to food, stool, urination)",
  "ไข้ (fever)",
  "อาเจียน — โดยเฉพาะ bilious / bloody (vomiting)",
  "ท้องเสีย / ท้องผูก / เลือด / เมือก (diarrhea, constipation, blood, mucus)",
  "อาการทางปัสสาวะ (urinary symptoms)",
  "เดินได้ / hop test / gait (ability to walk/hop)",
  "อัณฑะ / scrotal pain (testicular symptoms)",
  "ประจำเดือน / การตั้งครรภ์ / sexual history — ถ้าเกี่ยว",
  "trauma / toxin / DKA clues (trauma, toxins, DKA)",
];

const EXAM_TH: string[] = [
  "gait / comfort / movement",
  "vitals / hydration",
  "abdominal distension",
  "focal vs generalized tenderness",
  "guarding / rigidity / rebound / percussion tenderness",
  "masses / fecal loading / hernia",
  "CVA tenderness",
  "genital exam — เมื่อชี้",
  "แหล่งนอกช่องท้อง — chest, throat, hip, testes (extra-abdominal sources)",
];

const IMPORTANT_NEGATIVES_TH: string[] = [
  "ไม่มี guarding / rigidity — ให้บันทึกเมื่อไม่มี",
  "ไม่มี rebound / percussion tenderness — ให้บันทึกเมื่อไม่มี",
  "ไม่มี bilious vomiting — ให้บันทึกเมื่อไม่มี",
  "ไม่มี bloody stool — ให้บันทึกเมื่อไม่มี",
  "ไม่มี scrotal pain — ให้บันทึกเมื่อไม่มี",
  "ไม่มี abdominal distension — ให้บันทึกเมื่อไม่มี",
  "เดินได้ / hop ได้ — ให้บันทึกเมื่อปกติ",
  "ไม่มี urinary symptoms — ให้บันทึกเมื่อสอบถาม/ตรวจแล้วไม่มี",
];

const DIFFERENTIAL_TH: string[] = [
  "Acute gastroenteritis",
  "Constipation / fecal impaction",
  "Mesenteric adenitis",
  "UTI / pyelonephritis",
  "Appendicitis",
  "Intussusception (เด็ก)",
  "Bowel obstruction / volvulus",
  "Testicular / ovarian torsion — เมื่อชี้",
  "DKA — เมื่อชี้",
  "Pneumonia / pharyngitis / hip — extra-abdominal mimic",
];

const REASONING_RULES_TH: string[] = [
  "จัดลำดับ urgent/surgical clues ก่อน benign DDx — ไม่ฝังไว้ท้ายโน้ต",
  "อนุญาต serial exam / บันทึกชัดเมื่อสงสัย evolving abdomen",
  "ส่วนใหญ่ไม่เปิดการสืบค้นกว้างโดย default — สอดคล้อง guideline และความเสี่ยง",
  "ถ้า peritonism / bilious vomit / distension / shock / trauma — โทน ER หรือ TRAUMA primary survey ตามบริบท",
];

const OUTPUT_STYLE_TH: string[] = [
  "ระบุ site, migration, character, associated symptoms — ก่อนสรุป diagnosis เดียว",
  "บันทึก pertinent negatives ที่ตรวจแล้ว — โดยเฉพาะเมื่อไม่มีสัญญาณ surgical",
];

function collectSurgicalRedFlags(normalizedText: string): string[] {
  const t = normalizedText;
  const out: string[] = [];
  for (const rule of SURGICAL_RED_FLAG_RULES) {
    if (hasAnyKeywordNonNegated(t, rule.keys)) {
      out.push(rule.label);
    }
  }
  return out;
}

function extractFacts(t: string): string[] {
  const out: string[] = [];
  const add = (cond: boolean, line: string) => {
    if (cond) out.push(line);
  };
  add(anyNonNegatedRegexMatch(t, /abdominal|abdomen|stomach|belly|epigastric|rlq|llq|ท้อง|ปวดท้อง/i), "มีการกล่าวถึงปวด/ท้อง/ตำแหน่ง");
  add(anyNonNegatedRegexMatch(t, /tender|guarding|rebound|rigid|peritonitis/i), "มีการกล่าวถึง tenderness / peritonism");
  add(anyNonNegatedRegexMatch(t, /constipation|constipated|ท้องผูก|obstipation/i), "มีการกล่าวถึงท้องผูก");
  add(anyNonNegatedRegexMatch(t, /vomit|diarrhea|nausea|อาเจียน|ท้องเสีย/i), "มีการกล่าวถึงอาเจียน/ท้องเสีย");
  add(anyNonNegatedRegexMatch(t, /dysuria|flank|uti|ปัสสาวะ|cva/i), "มีการกล่าวถึง GU/flank");
  add(anyNonNegatedRegexMatch(t, /bilious|feculent|blood in stool|melena|hematochezia/i), "มีการกล่าวถึง alarm GI features");
  if (out.length === 0) {
    out.push("มีคีย์เวิร์ด abdominal — เก็บ site, onset, character ให้ชัด");
  }
  return out.slice(0, 16);
}

export function detectAbdominalPainFrameworkActive(normalizedText: string): boolean {
  const t = normalizedText;
  if (scoreKeysNegationAware(t, ABDOMINAL_PAIN_ACTIVATION_KEYS) >= 1) return true;
  const gi = scoreKeysNegationAware(t, GI_COMBO_KEYS) >= 1;
  const abd = anyNonNegatedRegexMatch(
    t,
    /abdominal|abdomen|stomach|belly|epigastric|rlq|llq|ruq|luq|suprapubic|ท้อง|ปวดท้อง|lower belly/i,
  );
  return gi && abd;
}

export function matchesAbdominalPainErEscalation(normalizedText: string): boolean {
  if (!detectAbdominalPainFrameworkActive(normalizedText)) return false;
  return collectSurgicalRedFlags(normalizedText).length > 0;
}

function secondaryNote(dominant: ReturnType<typeof detectDominantTheme>): string | null {
  if (dominant === "respiratory") return "ทางเดินหายใจ — พิจารณา mimic (pneumonia, pharyngitis referral)";
  if (dominant === "gi") return "GI — แยก AGE vs surgical abdomen ตามบริบท";
  if (dominant === "fever_systemic") return "ไข้ — อาจซ้อน infection intra-abdominal";
  return null;
}

export function buildAbdominalPainOpdFramework(
  normalizedText: string,
  opts?: { hasSystemicRedFlags?: boolean; visitMode?: AssistMode },
): AbdominalPainOpdFramework {
  if (!detectAbdominalPainFrameworkActive(normalizedText)) {
    return { active: false };
  }

  const t = normalizedText;
  const dominant = detectDominantTheme(normalizedText);
  /** Respiratory-dominant theme can mimic abdominal pain in children */
  const secondaryToOtherSystem = dominant === "respiratory";

  const redMatches = collectSurgicalRedFlags(t);
  const surgicalRedFlagsPresent = redMatches.length > 0;
  const traumaContextPresent = hasAnyKeywordNonNegated(t, TRAUMA_CONTEXT_KEYS);

  const systemic = Boolean(opts?.hasSystemicRedFlags);
  const urgencyHint: "routine_opd" | "prefer_er_or_urgent" =
    surgicalRedFlagsPresent || systemic || traumaContextPresent ? "prefer_er_or_urgent" : "routine_opd";

  return {
    active: true,
    factsAlreadyPresent: extractFacts(t),
    askNext: [...HISTORY_TH],
    examNext: [...EXAM_TH],
    importantNegatives: [...IMPORTANT_NEGATIVES_TH],
    differentialExamples: [...DIFFERENTIAL_TH],
    reasoningRules: [...REASONING_RULES_TH],
    outputStyleHints: [...OUTPUT_STYLE_TH],
    surgicalRedFlagsPresent,
    surgicalRedFlagMatches: redMatches,
    traumaContextPresent,
    urgencyHint,
    secondaryToOtherSystem,
    secondarySystemNote: secondaryToOtherSystem ? secondaryNote(dominant) : null,
  };
}

export function formatAbdominalPainFrameworkForAi(f: AbdominalPainOpdFramework): string {
  if (!f.active) return "(ABDOMINAL_PAIN_FRAMEWORK inactive)";
  const lines = [
    "=== ABDOMINAL PAIN (acute — OPD/ER) ===",
    `Urgency: ${f.urgencyHint}`,
    f.traumaContextPresent ? "Trauma context: consider TRAUMA primary survey + abdomen as secondary survey focus." : "",
    f.surgicalRedFlagMatches.length
      ? `Surgical / urgent red flags: ${f.surgicalRedFlagMatches.join("; ")}`
      : "",
    f.secondaryToOtherSystem && f.secondarySystemNote ? `Secondary context: ${f.secondarySystemNote}` : "",
    "",
    "Facts already present:",
    ...f.factsAlreadyPresent.map((x) => `- ${x}`),
    "",
    "Ask next (history):",
    ...f.askNext.map((x) => `- ${x}`),
    "",
    "Examine next:",
    ...f.examNext.map((x) => `- ${x}`),
    "",
    "Important negatives to document if absent:",
    ...f.importantNegatives.map((x) => `- ${x}`),
    "",
    "Differential examples (rank by red flags; not exhaustive):",
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
