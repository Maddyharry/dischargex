import { hasAny } from "./cardTypes";

/** บรรทัดที่น่าจะเป็นอายุ/น้ำหนัก/เพศ ไม่ใช่ CC */
function demographicHeuristic(line: string): number {
  const t = line.trim();
  let score = 0;
  if (/\d+(\.\d+)?\s*kg\b/i.test(t)) score += 3;
  if (/\b\d+\s*(year|yr|y\.?o\.?|month|mo\b|ขวบ|ควบ|เดือน)\b/i.test(t)) score += 3;
  if (/\b\d+\s*y\b/i.test(t)) score += 2;
  if (/\b(boy|girl|male|female|ชาย|หญิง|ด\.ช\.|ด\.ญ\.)\b/i.test(t)) score += 1;
  if (/^[\d.,\s]+(kg|year|yr|ขวบ)?$/i.test(t)) score += 2;
  return score;
}

/** คำชี้ไปทางอาการ (ไม่ใช่ demographic เพียงอย่างเดียว) */
const SYMPTOM_CUES = [
  "fever",
  "febrile",
  "ไข้",
  "rash",
  "ผื่น",
  "คัน",
  "itch",
  "cough",
  "ไอ",
  "wheeze",
  "rhonchi",
  "น้ำมูก",
  "เจ็บ",
  "pain",
  "ปวด",
  "อาเจียน",
  "ท้องเสีย",
  "diarrhea",
  "vomit",
  "ซึม",
  "ชัก",
  "หอบ",
  "เสมหะ",
  "เจ็บคอ",
  "sore throat",
  "swelling",
  "บวม",
  "แดง",
  "bleed",
  "เลือด",
  "headache",
  "ปวดหัว",
  "leg",
  "ขา",
  "arm",
  "แขน",
  "exanthem",
  "urticaria",
  "ลมพิษ",
];

function symptomHeuristic(line: string): number {
  const low = line.toLowerCase();
  let s = 0;
  for (const k of SYMPTOM_CUES) {
    if (low.includes(k)) s += 1;
  }
  return s;
}

function pickChiefComplaintLine(rawText: string, fallbackFirstLine: string): string {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return "";

  let best = "";
  let bestScore = -Infinity;
  for (const line of lines) {
    const sym = symptomHeuristic(line);
    const demo = demographicHeuristic(line);
    const score = sym * 2 - demo;
    if (score > bestScore) {
      bestScore = score;
      best = line;
    }
  }

  if (bestScore >= 1 && best) return best;

  const fb = fallbackFirstLine.trim();
  if (fb && symptomHeuristic(fb) > demographicHeuristic(fb)) return fb;

  for (const line of lines) {
    if (symptomHeuristic(line) > 0) return line;
  }
  return lines[lines.length - 1] ?? fb;
}

/** ดึงสิ่งที่น่าจะเป็น PE / ผลการตรวจจากข้อความดิบ — ไม่พึ่งแค่ ABCD sweep */
export function extractPeFindingsFromNormalizedText(t: string): string[] {
  const out: string[] = [];

  const vitalSnips: [string[], string][] = [
    [["spo2", "o2 sat", "oxygen"], "SpO₂ / oxygen"],
    [["bp", "ความดัน"], "BP"],
    [["hr", "pulse", "ชีพจร"], "Pulse / HR"],
    [["rr", "resp rate"], "RR"],
    [["temp", "อุณหภูมิ", "ไข้"], "Temp / fever"],
  ];
  for (const [keys, label] of vitalSnips) {
    if (hasAny(t, keys)) out.push(label);
  }

  if (hasAny(t, ["rhonchi", "rhonchus"])) out.push("Rhonchi");
  if (hasAny(t, ["wheeze", "wheezing", "เสียงวี้ด"])) out.push("Wheeze");
  if (hasAny(t, ["crackles", "crepitation"])) out.push("Crackles");
  if (hasAny(t, ["clear lung", "lungs clear", "ปอดชัด"])) out.push("Lungs clear to auscultation");
  if (hasAny(t, ["retraction", "chest indrawing", "อกบุ๋ม"])) out.push("Retraction / increased work of breathing");

  if (hasAny(t, ["ผื่น", "rash", "urticaria", "ลมพิษ", "แดงเป็นปื้น"])) out.push("Skin rash / lesions described");
  if (hasAny(t, ["แผล", "wound", "abscess", "ฝี", "หนอง"])) out.push("Wound / abscess / purulence");

  if (hasAny(t, ["tender", "กดเจ็บ", "guarding", "rlq", "ปวดท้อง"])) out.push("Abdominal exam / tenderness");

  if (hasAny(t, ["gcs", "avpu", "pupil", "รูม่านตา"])) out.push("Neuro / pupils");
  if (hasAny(t, ["alert", "ตื่นดี", "active"])) out.push("Alert / appropriate interaction");

  /** ทางเดินหายใจบน / คอ — ดึงตามที่พิมพ์ */
  if (
    hasAny(t, [
      "pharyng",
      "pharynx",
      "pharyn",
      "injected",
      "inject throat",
      "throat inj",
      "tonsill",
      "ทอนซิล",
      "เจ็บคอ",
      "คอแดง",
      "erythema",
      "แดงที่คอ",
    ])
  ) {
    out.push("Pharynx: erythema / injected — as documented");
  }

  return Array.from(new Set(out));
}

/**
 * ดึงประโยค/บรรทัดที่อธิบาย PE โดยตรงจากข้อความต้นฉบับ (ไม่สรุปทิ้งถ้ามีข้อมูล)
 */
export function extractPeVerbatimFromRaw(rawText: string): string[] {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];

  const looksLikePeLine = (l: string) => {
    if (/^(cc|chief|hpi|pi|history|pmh|allerg)\s*[:：]/i.test(l)) return false;
    if (
      /^pe\s*[:：]|physical\s+exam|ตรวจร่างกาย|vital\s*[:：]|o\s*\/\s*s\s*[:：]|objective\s*[:：]/i.test(l)
    ) {
      return true;
    }
    if (
      /(pharyng|pharynx|pharyn|injected|tonsill|ทอนซิล|เจ็บคอ|คอแดง|erythema|wheeze|rhonchi|crackles|retraction|spo2|o2\s*sat|lung exam|clear to auscultation|otoscopy|skin exam|auscultation|otorrhea|rhinorrhea exam)/i.test(
        l,
      )
    ) {
      return true;
    }
    return false;
  };

  for (const l of lines) {
    if (looksLikePeLine(l)) out.push(l.replace(/^pe\s*[:：]\s*/i, "").trim());
  }

  const full = rawText;
  const snippetRes = [
    /pharyn[xg]?\s+(is\s+)?inject(ed|ion)/i,
    /inject(ed|ion)\s+(of\s+)?pharyn[xg]?/i,
    /injected\s+throat/i,
    /throat\s*[:.]?\s*erythema/i,
  ];
  for (const re of snippetRes) {
    const m = full.match(re);
    if (m && m[0]) out.push(m[0].trim());
  }

  return Array.from(new Set(out.filter(Boolean)));
}

/** CC หนึ่งบรรทัด — เน้นอาการ ไม่ใช่ demographic */
export function buildConciseCC(rawText: string, dominantLine: string): string {
  const picked = pickChiefComplaintLine(rawText, dominantLine);
  const one = picked.replace(/\s+/g, " ").trim();
  if (!one) return "— (ระบุอาการสำคัญเป็นประโยคสั้น ไม่ใช่แค่อายุ/น้ำหนัก)";
  return one.length > 120 ? `${one.slice(0, 117)}…` : one;
}

/** บรรทัดที่เป็นแค่ demographic — ไม่ใส่ซ้ำใน PI ถ้ามีบรรทัดอาการอื่น */
function isDemographicOnlyLine(line: string): boolean {
  return demographicHeuristic(line) >= 3 && symptomHeuristic(line) === 0;
}

/**
 * PI แบบ timeline หลายประโยคสั้น — ไม่ยัดเป็นประโยคเดียวยาว และไม่ซ้ำ demographic ถ้ามีอาการชัด
 */
export function buildTimelinePI(rawText: string): string {
  const t = rawText.trim();
  if (!t) return "Not documented.";
  const lines = t
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\d+[\.\)]\s*/, "").trim())
    .filter(Boolean);

  const withSymptom = lines.filter((l) => !isDemographicOnlyLine(l) || symptomHeuristic(l) > 0);
  const narrativeLines = withSymptom.length ? withSymptom : lines;

  if (narrativeLines.length <= 1) return narrativeLines[0] ?? t;

  const sentences: string[] = [];
  let i = 0;
  while (i < narrativeLines.length) {
    const chunk = narrativeLines.slice(i, i + 2).join(" ");
    sentences.push(chunk.replace(/\s+/g, " ").trim());
    i += 2;
  }

  return sentences.join(". ").replace(/\s+\./g, ".").replace(/\.+$/, "") + ".";
}
