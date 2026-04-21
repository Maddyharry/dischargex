import type { AssistMode, CaseType, DominantTheme } from "./cardTypes";
import { hasAny } from "./cardTypes";
import { hasAnyKeywordNonNegated, scoreKeysNegationAware } from "./clinicalNegation";

const TRAUMA_KEYS = [
  "หัวกระแทก",
  "ศีรษะกระแทก",
  "head trauma",
  "อุบัติเหตุ",
  "แรงกระแทก",
  "mva",
  "ชน",
  "trauma",
  "fall",
  "ล้ม",
];

const SKIN_KEYS = [
  "ผื่น",
  "rash",
  "urticaria",
  "ลมพิษ",
  "คัน",
  "itch",
  "itchy",
  "itchy lesion",
  "lesion",
  "papule",
  "papules",
  "maculopapular",
  "vesicle",
  "vesicles",
  "pustule",
  "pustules",
  "crust",
  "crusting",
  "swelling",
  "erythema",
  "redness",
  "แดง",
  "บวม",
  "ผิวหนัง",
  "eczema",
  "dermatitis",
  "atopic",
  "flare",
  "สะเก็ดเงิน",
  "bulla",
  "macule",
  "petechiae",
  "แดงเป็นปื้น",
  "รอยแดง",
  "ผื่นขึ้น",
  "exanthem",
  "excoriation",
  "impetigo",
  "cellulitis",
  "abscess",
  "fluctuance",
  "insect bite",
  "bite",
  "burrow",
  "scabies",
  "mite",
  "แมลงกัด",
  "กัด",
  "ขาทั้งสอง",
  "both legs",
  "on legs",
  "แข้ง",
  "ผื่นที่ขา",
];

/** คำชี้ morphology / ผื่น — ใช้ตัดสิน skin-first เหนือ URI เมื่อคะแนนใกล้กัน */
const SKIN_MORPHOLOGY_KEYS = [
  "rash",
  "ผื่น",
  "papule",
  "papules",
  "vesicle",
  "vesicles",
  "pustule",
  "pustules",
  "crust",
  "itchy lesion",
  "urticaria",
  "ลมพิษ",
  "maculopapular",
  "exanthem",
  "eczema",
  "impetigo",
  "cellulitis",
  "insect bite",
  "burrow",
  "scabies",
  "excoriation",
];

const RESP_KEYS = [
  "ไอ",
  "เสมหะ",
  "น้ำมูก",
  "คัดจมูก",
  "wheeze",
  "rhonchi",
  "crackles",
  "หอบ",
  "ปอด",
  "pneumonia",
  "pneumon",
  "uri",
  "bronchiolitis",
  "bronchitis",
  "เสียงหายใจ",
  "ventolin",
  "neb",
  "พ่นยา",
  "cough",
  "runny",
  "dyspnea",
  "tachypnea",
  "shortness of breath",
  "respiratory distress",
  "หายใจลำบาก",
  "แรงหายใจ",
];

const GI_KEYS = [
  "ท้องเสีย",
  "ถ่าย",
  "อุจจาระ",
  "อาเจียน",
  "เลือดในอุจจาระ",
  "bloody stool",
  "diarrhea",
  "vomit",
  "ปวดท้อง",
  "ท้องผูก",
  "ท้องเดิน",
  "rlq",
  "ท้องขวาล่าง",
];

const FEVER_KEYS = ["ไข้", "ไข้สูง", "fever", "febrile", "อุณหภูมิ"];

/** GU / ทางเดินปัสสาวะ — แยกจาก MSK เมื่อเป็นปัญหาซ้อน (เช่น dysuria + ปวดหลัง) */
const GU_KEYS = [
  "dysuria",
  "ปัสสาวะแสบ",
  "ขัดปัสสาวะ",
  "uti",
  "อักเสบทางเดินปัสสาวะ",
  "cystitis",
  "urethritis",
  "pyuria",
  "hematuria",
  "เลือดปนในปัสสาวะ",
  "urinary tract",
  "frequency",
  "urgency",
  "nocturia",
  "suprapubic",
  "แสบขณะปัสสาวะ",
  "urinary retention",
];

/** MSK / ปวดหลัง — problem-oriented framework */
const MSK_KEYS = [
  "ปวดหลัง",
  "ปวดเอว",
  "low back",
  "lumbar",
  "radicular",
  "รากประสาท",
  "ชา",
  "numbness",
  "weakness",
  "อ่อนแรง",
  "motor",
  "sensory",
  "slr",
  "straight leg",
  "รีเฟล็กซ์",
  "reflex",
  "กระดูกสันหลัง",
  "spine",
  "herniat",
  "รูมาตอยด์",
  "ข้อ",
  "joint",
  "ขยับไม่ได้",
  "rom",
  "range of motion",
  "cauda",
  "กลั้นปัสสาวะไม่ได้",
];

/** สัญญาณระบบรุนแรง — ใช้ยกระดับการ์ด/ความปลอดภัย ไม่ใช่แค่มีไข้หรือ URI */
export function computeSystemicRedFlags(normalizedText: string): boolean {
  const t = normalizedText;
  if (
    hasAnyKeywordNonNegated(t, [
      "shock",
      "sepsis",
      "septic",
      "hypotension",
      "bp ต่ำ",
      "bpต่ำ",
      "ช็อก",
      "poor perfusion",
      "perfusion",
      "cap refill",
      "crt ",
      "crt:",
      "tachycardia",
      "ชีพจรเร็วมาก",
    ])
  ) {
    return true;
  }
  if (
    hasAnyKeywordNonNegated(t, [
      "hypox",
      "hypoxia",
      "spo2 8",
      "spo2 9",
      "o2 sat 8",
      "o2 sat 9",
      "oxygen",
    ])
  ) {
    return true;
  }
  if (hasAny(t, ["gcs", "avpu", "หมดสติ", "unresponsive", "ชัก", "seizure"])) {
    return true;
  }
  if (
    hasAny(t, ["ซึม", "letharg", "ไม่ตื่น", "ไม่รู้สึกตัว"]) &&
    hasAnyKeywordNonNegated(t, FEVER_KEYS)
  ) {
    return true;
  }
  return false;
}

/** คะแนนคีย์เวิร์ดต่อระบบ — ใช้จับหลายปัญหา / OPD framework (ไม่นับคำที่อยู่หลัง negation) */
export function getSystemKeywordScores(normalizedText: string): {
  skin: number;
  respiratory: number;
  gi: number;
  gu: number;
  msk: number;
  trauma: number;
  fever: number;
} {
  const t = normalizedText;
  return {
    skin: scoreKeysNegationAware(t, SKIN_KEYS),
    respiratory: scoreKeysNegationAware(t, RESP_KEYS),
    gi: scoreKeysNegationAware(t, GI_KEYS),
    gu: scoreKeysNegationAware(t, GU_KEYS),
    msk: scoreKeysNegationAware(t, MSK_KEYS),
    trauma: scoreKeysNegationAware(t, TRAUMA_KEYS),
    fever: scoreKeysNegationAware(t, FEVER_KEYS),
  };
}

/** มีข้อมูลผื่น/ผิวหนังพอให้ใช้ skin-first reasoning */
export function isSkinRashComplaint(normalizedText: string): boolean {
  return scoreKeysNegationAware(normalizedText, SKIN_KEYS) >= 1;
}

/** สัญญาณ scabies cluster จากบริบทครอบครัว (ไม่ใช่การวินิจฉัย) */
export function computeScabiesClusterSignals(normalizedText: string): {
  familyItchPositive: boolean;
  familyItchNegative: boolean;
} {
  const low = normalizedText.toLowerCase();

  const familyItchNegative =
    /ไม่มีคนในบ้านคัน|ไม่มีใครในบ้านคัน|คนในบ้านไม่คัน|no\s+family\s+itching|denies.{0,40}family.{0,25}itch|denies.{0,40}household.{0,25}itch/i.test(
      low,
    );

  const familyItchPositive =
    !familyItchNegative &&
    /คนในบ้านคัน|แม่(?:\s*ก็)?\s*คัน|พ่อ(?:\s*ก็)?\s*คัน|mother.{0,45}(?:also\s+)?(?:itchy|itch)|father.{0,45}(?:itchy|itch)|family.{0,40}(?:itchy|itch)|household.{0,35}(?:itchy|itch)|also\s+itchy|ร่วมคันในบ้าน/i.test(
      low,
    );

  return { familyItchPositive, familyItchNegative };
}

export function detectDominantTheme(normalizedText: string): DominantTheme {
  const t = normalizedText;
  if (hasAny(t, TRAUMA_KEYS)) return "trauma";
  const skin = scoreKeysNegationAware(t, SKIN_KEYS);
  const resp = scoreKeysNegationAware(t, RESP_KEYS);
  const gi = scoreKeysNegationAware(t, GI_KEYS);
  const feverish = hasAnyKeywordNonNegated(t, FEVER_KEYS);
  const skinMorphCue = hasAnyKeywordNonNegated(t, SKIN_MORPHOLOGY_KEYS);

  // Skin-first: ผื่น/รูปผื่น — ไม่ให้ URI หรือไข้ครองเพียงเพราะไอ/ไข้ร่วม (secondary ได้)
  if (skin >= 1 && skin >= gi && (skin > resp || skin >= 2 || skinMorphCue)) {
    return "skin_rash";
  }
  if (resp >= gi && resp >= skin && resp >= 1) return "respiratory";
  if (gi >= resp && gi >= skin && gi >= 1) return "gi";
  if (feverish && skin < 2 && resp < 2 && gi < 2) return "fever_systemic";
  return "unclear";
}

/**
 * จำแนกประเภทเคสก่อนสร้างโน้ต — ใช้คีย์เวิร์ดเบา ไม่ใช่การวินิจฉัย
 */
export function detectCaseType(
  normalizedText: string,
  mode: AssistMode,
  dominant: DominantTheme,
): CaseType {
  const t = normalizedText;
  if (mode === "TRAUMA" || dominant === "trauma" || hasAny(t, TRAUMA_KEYS)) return "trauma";
  if (dominant === "skin_rash" || scoreKeysNegationAware(t, SKIN_KEYS) >= 2) return "dermatology";
  if (dominant === "gi" || scoreKeysNegationAware(t, GI_KEYS) >= 2) return "gi";
  if (dominant === "respiratory" || scoreKeysNegationAware(t, RESP_KEYS) >= 2) return "respiratory";

  const feverish = hasAnyKeywordNonNegated(t, FEVER_KEYS);
  const localized =
    scoreKeysNegationAware(t, RESP_KEYS) >= 1 ||
    scoreKeysNegationAware(t, GI_KEYS) >= 1 ||
    scoreKeysNegationAware(t, SKIN_KEYS) >= 1;
  if (feverish && !localized && dominant === "fever_systemic") return "fever_without_focus";
  if (feverish && !localized) return "fever_without_focus";

  return "general";
}

export type CaseClinicalProfile = {
  caseType: CaseType;
  dominantTheme: DominantTheme;
  hasSystemicRedFlags: boolean;
};

export function buildCaseClinicalProfile(normalizedText: string, mode: AssistMode): CaseClinicalProfile {
  const dominantTheme = detectDominantTheme(normalizedText);
  const hasSystemicRedFlags = computeSystemicRedFlags(normalizedText);
  const caseType = detectCaseType(normalizedText, mode, dominantTheme);
  return { caseType, dominantTheme, hasSystemicRedFlags };
}

/** URI เด่นโดยไม่มีพิษรุนแรง — ไม่ควรเปิดการ์ด fever/sepsis */
export function looksLikeUncomplicatedUriOpd(normalizedText: string): boolean {
  const t = normalizedText;
  const uriCue = hasAny(t, ["ไอ", "น้ำมูก", "คัดจมูก", "wheeze", "rhonchi", "เสียงวี้ด", "ventolin", "neb"]);
  const giCue = scoreKeysNegationAware(t, GI_KEYS) >= 1;
  const skinCue = scoreKeysNegationAware(t, SKIN_KEYS) >= 2;
  if (!uriCue || giCue || skinCue) return false;
  if (computeSystemicRedFlags(t)) return false;
  if (
    hasAnyKeywordNonNegated(t, ["ไข้สูง"]) ||
    hasAny(t, ["ซึม", "ไม่กิน", "ปัสสาวะน้อย"]) ||
    hasAnyKeywordNonNegated(t, ["shock", "sepsis"])
  ) {
    return false;
  }
  return true;
}
