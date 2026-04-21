/**
 * Thai OPD Assist — fever in children / fever without focus.
 * Goal: structured assessment without defaulting to sepsis or antibiotics; escalate on danger signs.
 */
import { detectDominantTheme, getSystemKeywordScores } from "./caseClinicalProfile";
import { anyNonNegatedRegexMatch, hasAnyKeywordNonNegated, scoreKeysNegationAware } from "./clinicalNegation";

/** Activates framework when present (negation-aware); includes antipyretics + infection suspicion */
export const FEVER_CHILD_FRAMEWORK_ACTIVATION_KEYS = [
  "fever",
  "febrile",
  "pyrexia",
  "ไข้",
  "ไข้สูง",
  "temperature",
  "อุณหภูมิ",
  "high temp",
  "hyperthermia",
  "chill",
  "rigor",
  "หนาวสั่น",
  "สั่น",
  "paracetamol",
  "acetaminophen",
  "ibuprofen",
  "ยาแก้ไข้",
  "antipyretic",
  "ทาเย็น",
  "suspected infection",
  "suspect infection",
  "possible infection",
  "source of infection",
  "focus of infection",
  "ลักษณะการติดเชื้อ",
  "สงสัยติดเชื้อ",
  "ติดเชื้อ",
  "septic workup",
  "blood culture",
];

/** Explicit “no fever” — suppress framework if no affirmative fever-related cues */
const EXPLICIT_NO_FEVER_DENIAL_KEYS = [
  "no fever",
  "afebrile",
  "ไม่มีไข้",
  "ไม่มี ไข้",
  "ปฏิเสธไข้",
  "denies fever",
  "ไม่ขึ้นไข้",
  "a febrile",
];

/** Subset used to allow framework when “no fever” is mentioned but antipyretic / infection / chills etc. remain */
const AFFIRMATIVE_FEVER_RELATED_KEYS = [
  "fever",
  "febrile",
  "ไข้",
  "ไข้สูง",
  "pyrexia",
  "temperature",
  "อุณหภูมิ",
  "high temp",
  "hyperthermia",
  "chill",
  "rigor",
  "หนาวสั่น",
  "paracetamol",
  "acetaminophen",
  "ibuprofen",
  "ยาแก้ไข้",
  "antipyretic",
  "suspected infection",
  "suspect infection",
  "possible infection",
  "source of infection",
  "focus of infection",
  "ลักษณะการติดเชื้อ",
  "สงสัยติดเชื้อ",
  "ติดเชื้อ",
  "septic workup",
  "blood culture",
];

export type FeverChildOpdFramework =
  | {
      active: true;
      factsAlreadyPresent: string[];
      askNext: string[];
      examNext: string[];
      importantNegatives: string[];
      differentialExamples: string[];
      reasoningRules: string[];
      outputStyleHints: string[];
      /** WHO/IMCI-style danger signs — escalate toward urgent/ER care */
      dangerSignsPresent: boolean;
      dangerSignMatches: string[];
      /** Another organ system likely primary (fever as secondary context) */
      secondaryToOtherSystem: boolean;
      secondarySystemNote: string | null;
      /** When danger signs or profile suggests urgent disposition */
      urgencyHint: "routine_opd" | "prefer_er_or_urgent";
    }
  | { active: false };

const HISTORY_ASK_TH: string[] = [
  "ระยะเวลาไข้ (duration)",
  "ไข้สูงสุดเท่าไร และวัดอย่างไร (axillary / tympanic / rectal)",
  "การกินน้ำ / ดูดนม / feeding",
  "กิจกรรม / ซึม / เล่นได้หรือไม่ (activity, lethargy)",
  "ปัสสาวะ / ผ้าอ้อม — urine output",
  "ชัก / febrile seizure history",
  "ไอ / น้ำมูก / เจ็บคอ (cough, URI, pharyngitis)",
  "อาเจียน / ท้องเสีย / ปวดท้อง (vomiting, diarrhea, abdominal pain)",
  "ปัสสาวะแสบ / กลั้น (dysuria, UTI)",
  "ผื่น (rash, exanthem)",
  "หู — otalgia, discharge (ear)",
  "สัมผัสผู้ป่วยในบ้าน / โรคระบาด (sick contact)",
  "ตอบสนองยาแก้ไข้ / antipyretic response",
  "โรคประจำตัว / ภูมิคุ้มกัน (immune compromise, asplenia, chemotherapy) — ถ้าเกี่ยว",
];

const EXAM_NEXT_TH: string[] = [
  "T, HR, RR, BP, SpO₂ — ตามอายุและความรุนแรง",
  "general appearance — toxic vs well",
  "mental status / interaction (เด็ก)",
  "hydration — mucosa, tears, fontanelle (ทารก), CRT / perfusion",
  "ENT — pharynx, ears",
  "chest — work of breathing, auscultation",
  "abdomen — tenderness, guarding, organomegaly",
  "skin — rash morphology and distribution",
  "neck stiffness / meningismus — ถ้าชี้",
  "ตรวจตามโฟกัสที่สงสัย (source-focused exam)",
];

const IMPORTANT_NEGATIVES_TH: string[] = [
  "ไม่มีซึมมาก / lethargy — ให้บันทึกเมื่อไม่มี",
  "ไม่มีชัก — ให้บันทึกเมื่อไม่มี",
  "ไม่มีกินน้ำ/นมลดชัด — ให้บันทึกเมื่อไม่มี",
  "ไม่มีหายใจลำบาก / dyspnea — ให้บันทึกเมื่อไม่มี",
  "ไม่มี perfusion แย่ / CRT ยืด — ให้บันทึกเมื่อไม่มี",
  "ไม่มีโฟกัสการอักเสบชัด — ให้บันทึกเมื่อตรวจแล้วไม่มี",
  "ไม่มีคอแข็ง — ให้บันทึกเมื่อไม่มีและไม่สงสัย CNS",
  "ไม่มีผื่น — ถ้าตรวจผิวแล้วไม่มีให้บันทึก",
];

const DIFFERENTIAL_TH: string[] = [
  "Viral febrile illness",
  "Fever without focus (after appropriate exam)",
  "URI / viral upper respiratory infection",
  "Tonsillopharyngitis",
  "Pneumonia — เมื่อมีหลักฐานทางคลินิก/การตรวจ",
  "UTI / pyelonephritis — เมื่อมีอาการชี้",
  "Acute gastroenteritis (AGE)",
  "Viral exanthem",
];

const REASONING_RULES_TH: string[] = [
  "ห้าม default เป็น sepsis หรือให้ antibiotic ในทุกเคสไข้เด็ก — ใช้แหล่งโฟกัส + ภาพรวม + อายุ",
  "ใช้ appearance, hydration, danger signs และโฟกัส — ไม่ใช่แค่มีไข้",
  "ถ้าระบบอื่นเด่น (เช่น ผื่น primary, URI เด่น) — ให้ไข้เป็น secondary problem และไม่รวม diagnosis โดยไม่มีบริบท",
  "ถ้ามี danger sign — ลำดับความสำคัญไปทาง ER/ดูแลเร่งด่วน; ไม่ฝังไว้ท้ายโน้ต",
  "ถ้าข้อความระบุชัดว่าไม่มีไข้ — ไม่สร้างประเด็นไข้เป็นหลัก",
];

const OUTPUT_STYLE_TH: string[] = [
  "โทน OPD/เด็ก — ชัดเจนเรื่อง duration, max temp, การวัด, การดื่ม, กิจกรรม",
  "บันทึก pertinent negatives ที่ตรวจแล้ว — โดยเฉพาะเมื่อไม่มี danger sign",
];

type DangerRule = { label: string; keys: string[] };

const DANGER_SIGN_RULES: DangerRule[] = [
  {
    label: "Unable to drink / breastfeed / รับสารน้ำไม่ได้",
    keys: [
      "unable to drink",
      "not drinking",
      "refusing fluid",
      "ไม่ดื่ม",
      "ไม่ยอมกิน",
      "breastfeed",
      "ดูดนมไม่ได้",
      "won't drink",
      "poor feeding",
      "ไม่กินน้ำ",
    ],
  },
  {
    label: "Vomiting everything / อาเจียนรุนแรงทุกอย่าง",
    keys: [
      "vomiting everything",
      "vomits everything",
      "persistent vomiting",
      "อาเจียนทุกอย่าง",
      "อาเจียนไม่หยุด",
      "bilious vomiting",
    ],
  },
  {
    label: "Seizure / ชัก",
    keys: ["seizure", "febrile seizure", "convulsion", "status epilepticus", "ชัก", "กระตุก"],
  },
  {
    label: "Lethargy / unconscious / ซึมหรือไม่รู้สึกตัว",
    keys: [
      "lethargic",
      "unconscious",
      "unresponsive",
      "altered mental",
      "floppy",
      "ซึมมาก",
      "ไม่รู้สึกตัว",
      "หมดสติ",
      "ไม่ตื่น",
    ],
  },
  {
    label: "Severe respiratory distress / หายใจลำบากรุนแรง",
    keys: [
      "severe respiratory distress",
      "respiratory distress",
      "grunting",
      "retraction",
      "แรงหายใจรุนแรง",
      "หอบหนัก",
      "cyanosis",
      "ริมฝีปากซีด",
    ],
  },
  {
    label: "Poor perfusion / shock concern / perfusion แย่",
    keys: [
      "poor perfusion",
      "mottled",
      "cold extremities",
      "delayed capillary",
      "crt",
      "shock",
      "hypotension",
      "ช็อก",
      "ความดันต่ำ",
      "ชีพจรเวียนช้า",
    ],
  },
];

/** Suppress fever problem pack when explicit no-fever phrasing exists without affirmative fever-related cues */
export function shouldSuppressFeverProblemPack(normalizedText: string): boolean {
  const t = normalizedText;
  const noFever = hasAnyKeywordNonNegated(t, EXPLICIT_NO_FEVER_DENIAL_KEYS);
  const affirm = scoreKeysNegationAware(t, AFFIRMATIVE_FEVER_RELATED_KEYS) >= 1;
  return noFever && !affirm;
}

/** Fever cue + pediatric danger signs → ER escalation (used by visit mode detection) */
export function matchesFeverWithDangerErEscalation(normalizedText: string): boolean {
  const t = normalizedText;
  if (shouldSuppressFeverProblemPack(t)) return false;
  const feverCue =
    scoreKeysNegationAware(t, ["fever", "febrile", "ไข้", "ไข้สูง", "pyrexia", "temperature", "อุณหภูมิ"]) >= 1;
  if (!feverCue) return false;
  return collectDangerSigns(t).length > 0;
}

function collectDangerSigns(normalizedText: string): string[] {
  const t = normalizedText;
  const found: string[] = [];
  for (const rule of DANGER_SIGN_RULES) {
    if (hasAnyKeywordNonNegated(t, rule.keys)) {
      found.push(rule.label);
    }
  }
  return found;
}

function extractFactsAlreadyPresent(normalized: string): string[] {
  const t = normalized;
  const out: string[] = [];
  const add = (cond: boolean, line: string) => {
    if (cond) out.push(line);
  };
  add(anyNonNegatedRegexMatch(t, /fever|febrile|ไข้|pyrexia|temperature|อุณหภูมิ/i), "มีการกล่าวถึงไข้ / อุณหภูมิ");
  add(anyNonNegatedRegexMatch(t, /chill|rigor|หนาวสั่น|สั่น/i), "มีการกล่าวถึงหนาวสั่น / chills");
  add(
    anyNonNegatedRegexMatch(t, /paracetamol|acetaminophen|ibuprofen|antipyretic|ยาแก้ไข้/i),
    "มีการกล่าวถึงยาแก้ไข้ / antipyretic",
  );
  add(
    anyNonNegatedRegexMatch(t, /infection|ติดเชื้อ|suspected|สงสัย/i),
    "มีการกล่าวถึงการติดเชื้อหรือสงสัย focus",
  );
  add(anyNonNegatedRegexMatch(t, /vomit|อาเจียน|diarrhea|ท้องเสีย/i), "มีการกล่าวถึง GI symptoms");
  add(anyNonNegatedRegexMatch(t, /cough|ไอ|runny|น้ำมูก|เจ็บคอ/i), "มีการกล่าวถึงทางเดินหายใจ");
  add(anyNonNegatedRegexMatch(t, /rash|ผื่น/i), "มีการกล่าวถึงผื่น");
  add(anyNonNegatedRegexMatch(t, /dysuria|ปัสสาวะแสบ/i), "มีการกล่าวถึงทางเดินปัสสาวะ");
  if (out.length === 0) {
    out.push("มีคีย์เวิร์ดไข้/ยาแก้ไข้/การติดเชื้อ — เก็บ duration และการวัดอุณหภูมิให้ชัด");
  }
  return out.slice(0, 16);
}

/**
 * Negation-aware activation; explicit “no fever” without affirmative related cues suppresses the framework.
 */
export function detectFeverChildFrameworkActive(normalizedText: string): boolean {
  const t = normalizedText;
  const score = scoreKeysNegationAware(t, FEVER_CHILD_FRAMEWORK_ACTIVATION_KEYS);
  if (score < 1) return false;
  const noFeverPhrase = hasAnyKeywordNonNegated(t, EXPLICIT_NO_FEVER_DENIAL_KEYS);
  const affirmScore = scoreKeysNegationAware(t, AFFIRMATIVE_FEVER_RELATED_KEYS);
  if (noFeverPhrase && affirmScore < 1) return false;
  return true;
}

function secondarySystemNote(dominant: ReturnType<typeof detectDominantTheme>): string | null {
  switch (dominant) {
    case "respiratory":
      return "ทางเดินหายใจอาจเป็น primary — ไข้เป็น secondary ตามบริบท";
    case "skin_rash":
      return "ผื่น/ผิวหนังอาจเป็น primary — ไข้เป็น secondary";
    case "gi":
      return "GI อาจเป็น primary — ไข้เป็น secondary";
    case "trauma":
      return "บาดเจ็บ/trauma เด่น — ไข้ตีความใน context";
    default:
      return null;
  }
}

export function buildFeverChildOpdFramework(
  normalizedText: string,
  opts?: { hasSystemicRedFlags?: boolean },
): FeverChildOpdFramework {
  if (!detectFeverChildFrameworkActive(normalizedText)) {
    return { active: false };
  }

  const dominant = detectDominantTheme(normalizedText);
  const scores = getSystemKeywordScores(normalizedText);
  const secondaryToOtherSystem =
    dominant !== "fever_systemic" &&
    dominant !== "unclear" &&
    scores.fever >= 1 &&
    (dominant === "respiratory" || dominant === "skin_rash" || dominant === "gi" || dominant === "trauma");

  const dangerMatches = collectDangerSigns(normalizedText);
  const dangerSignsPresent = dangerMatches.length > 0;
  const systemicUrgent = Boolean(opts?.hasSystemicRedFlags);

  const urgencyHint: "routine_opd" | "prefer_er_or_urgent" =
    dangerSignsPresent || systemicUrgent ? "prefer_er_or_urgent" : "routine_opd";

  return {
    active: true,
    factsAlreadyPresent: extractFactsAlreadyPresent(normalizedText),
    askNext: [...HISTORY_ASK_TH],
    examNext: [...EXAM_NEXT_TH],
    importantNegatives: [...IMPORTANT_NEGATIVES_TH],
    differentialExamples: [...DIFFERENTIAL_TH],
    reasoningRules: [...REASONING_RULES_TH],
    outputStyleHints: [...OUTPUT_STYLE_TH],
    dangerSignsPresent,
    dangerSignMatches: dangerMatches,
    secondaryToOtherSystem,
    secondarySystemNote: secondaryToOtherSystem ? secondarySystemNote(dominant) : null,
    urgencyHint,
  };
}

export function formatFeverChildFrameworkForAi(f: FeverChildOpdFramework): string {
  if (!f.active) return "(FEVER_CHILD / FEVER_WITHOUT_FOCUS framework inactive)";
  const lines = [
    "=== FEVER (CHILD / FEVER WITHOUT FOCUS) — Thai OPD ===",
    `Urgency: ${f.urgencyHint}${f.dangerSignsPresent ? " — DANGER SIGNS DOCUMENTED" : ""}`,
    f.secondaryToOtherSystem && f.secondarySystemNote
      ? `Secondary context: ${f.secondarySystemNote}`
      : "",
    f.dangerSignMatches.length
      ? `Danger sign matches: ${f.dangerSignMatches.join("; ")}`
      : "",
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
    "Differential examples (do not default sepsis/antibiotics):",
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
