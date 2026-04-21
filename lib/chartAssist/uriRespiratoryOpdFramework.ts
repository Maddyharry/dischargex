/**
 * Thai OPD Assist — URI / cough / sore throat framework.
 * Goal: support common outpatient respiratory complaints without defaulting to pneumonia/sepsis or routine antibiotics.
 */
import { anyNonNegatedRegexMatch, scoreKeysNegationAware } from "./clinicalNegation";

/** Cues that activate this framework (negation-aware scoring) */
export const URI_RESPIRATORY_DETECTION_KEYS = [
  "fever",
  "febrile",
  "ไข้",
  "ไข้สูง",
  "cough",
  "ไอ",
  "runny",
  "น้ำมูก",
  "rhinorrhea",
  "คัดจมูก",
  "sore throat",
  "เจ็บคอ",
  "pharyngitis",
  "pharyngeal",
  "injection",
  "tonsillar",
  "tonsil",
  "ทอนซิล",
  "คอแดง",
  "wheeze",
  "เสียงวี้ด",
  "หอบ",
  "dyspnea",
  "shortness of breath",
  "หายใจลำบาก",
  "stridor",
  "barking cough",
  "ไอเหมือนหมา",
];

export type UriRespiratoryOpdFramework =
  | {
      active: true;
      /** Short bullets: what the text already supports */
      factsAlreadyPresent: string[];
      askNext: string[];
      examNext: string[];
      importantNegatives: string[];
      differentialExamples: string[];
      reasoningRules: string[];
      outputStyleHints: string[];
    }
  | { active: false };

const HISTORY_ASK_NEXT_TH: string[] = [
  "onset / กำเริบเมื่อไร",
  "ระยะเวลาไข้ (ถ้ามี)",
  "ไข้สูงสุดเท่าไร (ถ้ามี)",
  "ลักษณะไอ — dry vs productive",
  "เสมหะ — สี/ปริมาณ",
  "เจ็บคอ / odynophagia",
  "หายใจลำบาก / dyspnea",
  "wheeze / เสียงหวีด",
  "การกิน / กิจกรรม (เด็ก: เล่นได้หรือไม่)",
  "อาเจียนหลังไอ",
  "สัมผัสผู้ป่วยในบ้าน / โรคระบาด",
  "เคยตอบสนอง bronchodilator หรือไม่",
  "ประวัติหอบหืด / wheeze ซ้ำ",
];

const EXAM_NEXT_TH: string[] = [
  "T, HR, RR, SpO₂ (room air หรือระบุ O₂)",
  "work of breathing",
  "retraction / nasal flaring",
  "pharynx — injection, exudate, tonsil",
  "cervical lymph node",
  "lung sounds — wheeze / crackles / rhonchi, เทียบสองข้าง",
  "สัญญาณขาดน้ำ",
];

const IMPORTANT_NEGATIVES_TH: string[] = [
  "ไม่มี retraction — ให้บันทึกเมื่อตรวจแล้วไม่มี",
  "ไม่มี hypoxemia / SpO₂ ปกติ — ให้บันทึก",
  "ไม่มี focal crackles — ให้บันทึกเมื่อฟังแล้วไม่มี",
  "ไม่มี stridor — ให้บันทึกเมื่อไม่มี",
  "ไม่มี drooling / น้ำลายไหลมาก — ถ้าไม่มีให้บันทึก",
  "ไม่มี altered mental status — ถ้าไม่มีให้บันทึก",
  "ไม่มี poor feeding / lethargy รุนแรง — เด็ก — ถ้าไม่มีให้บันทึก",
];

const DIFFERENTIAL_EXAMPLES_TH: string[] = [
  "Viral URI / common cold",
  "Acute pharyngitis",
  "Tonsillitis",
  "Allergic rhinitis",
  "Bronchiolitis (เด็กเล็ก)",
  "Wheezing episode / asthma",
  "Pneumonia — เมื่อมีหลักฐานสนับสนุน (ไม่ใช่แค่ไข้+ไอ)",
  "Croup — ถ้า barking cough / stridor",
];

const REASONING_RULES_TH: string[] = [
  "ห้าม default เป็น pneumonia จากไข้ + ไอ อย่างเดียว — ต้องมีหลักฐานทางคลินิก/การตรวจที่สอดคล้อง",
  "ห้าม default ให้ antibiotic ใน viral URI ธรรมดา — ยกเว้นมีชี้ชัด (เช่น strep ตามแนวทาง, bacterial sinusitis ตามเกณฑ์)",
  "ใช้ RR / SpO₂ / work of breathing เป็นตัวกำหนดความรุนแรงและ disposition",
  "ถ้ามีประเด็นหลักอื่นที่เด่นกว่า (เช่น ผื่น primary) — ให้ URI เป็น secondary problem และไม่รวม diagnosis เข้าประเด็นเดียวโดยไม่มีบริบท",
];

const OUTPUT_STYLE_TH: string[] = [
  "โทนแพทย์ OPD ไทย — กระชับ",
  "CC สั้นชัด — อาการหลัก + ระยะเวลา (ถ้ามี)",
  "PI เป็น timeline — ลำดับเหตุการณ์",
  "PE เฉพาะสิ่งที่ตรวจจริง — ไม่สร้างผลตรวจ",
  "Plan ทำได้จริง — ยา/คำแนะนำ/นัด/return precautions ตามความรุนแรง",
];

function extractFactsAlreadyPresent(normalized: string): string[] {
  const t = normalized;
  const out: string[] = [];
  const add = (cond: boolean, line: string) => {
    if (cond) out.push(line);
  };
  add(anyNonNegatedRegexMatch(t, /ไข้|fever|febrile/i), "มีการกล่าวถึงไข้");
  add(anyNonNegatedRegexMatch(t, /ไอ|cough/i), "มีการกล่าวถึงไอ");
  add(anyNonNegatedRegexMatch(t, /น้ำมูก|runny|rhinorrhea|คัดจมูก/i), "มีการกล่าวถึงน้ำมูก/คัดจมูก");
  add(anyNonNegatedRegexMatch(t, /เจ็บคอ|sore throat|pharyngitis|odynophagia/i), "มีการกล่าวถึงเจ็บคอ/กลืนเจ็บ");
  add(anyNonNegatedRegexMatch(t, /pharyngeal|injection|คอแดง|tonsillar|tonsil|ทอนซิล/i), "มีการกล่าวถึงคอ/ทอนซิล/ฉีดคอ");
  add(anyNonNegatedRegexMatch(t, /wheeze|เสียงวี้ด|หอบ/i), "มีการกล่าวถึง wheeze/หอบ");
  add(anyNonNegatedRegexMatch(t, /dyspnea|shortness of breath|หายใจลำบาก/i), "มีการกล่าวถึงหายใจลำบาก/dyspnea");
  add(anyNonNegatedRegexMatch(t, /stridor|barking|ไอเหมือนหมา/i), "มีการกล่าวถึง stridor / ไอแหบ (croup spectrum)");
  if (out.length === 0) {
    out.push("มีคีย์เวิร์ดทางเดินหายใจ/URI — ระบุรายละเอียดเพิ่มในประวัติและการตรวจ");
  }
  return out.slice(0, 14);
}

export function detectUriRespiratoryOpdActive(normalizedText: string): boolean {
  return scoreKeysNegationAware(normalizedText, URI_RESPIRATORY_DETECTION_KEYS) >= 1;
}

export function buildUriRespiratoryOpdFramework(normalizedText: string): UriRespiratoryOpdFramework {
  if (!detectUriRespiratoryOpdActive(normalizedText)) {
    return { active: false };
  }
  return {
    active: true,
    factsAlreadyPresent: extractFactsAlreadyPresent(normalizedText),
    askNext: [...HISTORY_ASK_NEXT_TH],
    examNext: [...EXAM_NEXT_TH],
    importantNegatives: [...IMPORTANT_NEGATIVES_TH],
    differentialExamples: [...DIFFERENTIAL_EXAMPLES_TH],
    reasoningRules: [...REASONING_RULES_TH],
    outputStyleHints: [...OUTPUT_STYLE_TH],
  };
}

/** Compact text for AI user message */
export function formatUriRespiratoryFrameworkForAi(f: UriRespiratoryOpdFramework): string {
  if (!f.active) return "(URI/cough/sore throat framework inactive)";
  return [
    "=== URI / COUGH / SORE THROAT (Thai OPD) ===",
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
    "Differential examples (rank by evidence; do not default pneumonia):",
    ...f.differentialExamples.map((x) => `- ${x}`),
    "",
    "Reasoning rules:",
    ...f.reasoningRules.map((x) => `- ${x}`),
    "",
    "Output style:",
    ...f.outputStyleHints.map((x) => `- ${x}`),
  ].join("\n");
}
