/**
 * Thai OPD Assist — diarrhea / vomiting / dehydration (esp. children).
 * Goal: structured GI assessment without missing dehydration; separate illness severity from hydration status.
 */
import { detectDominantTheme, getSystemKeywordScores } from "./caseClinicalProfile";
import { anyNonNegatedRegexMatch, hasAnyKeywordNonNegated, scoreKeysNegationAware } from "./clinicalNegation";

export const GI_DEHYDRATION_ACTIVATION_KEYS = [
  "diarrhea",
  "diarrhoea",
  "loose stool",
  "watery stool",
  "ท้องเสีย",
  "ท้องเดิน",
  "ถ่ายเหลว",
  "อุจจาระเหลว",
  "vomit",
  "vomiting",
  "emesis",
  "อาเจียน",
  "คลื่นไส้",
  "poor intake",
  "decreased intake",
  "not eating",
  "กินน้อย",
  "ไม่กิน",
  "ไม่ยอมกิน",
  "decreased urine",
  "oliguria",
  "anuria",
  "ปัสสาวะน้อย",
  "urine output",
  "ผ้าอ้อมแห้ง",
  "dry mouth",
  "dry mucosa",
  "mucous membrane",
  "thirst",
  "กระหายน้ำ",
  "ปากแห้ง",
  "weakness",
  "lethargy",
  "lethargic",
  "อ่อนเพลีย",
  "weak",
  "weakness",
  "ซึม",
  "dehydration",
  "dehydrated",
  "ขาดน้ำ",
  "ors",
  "oral rehydration",
];

export type DehydrationLevel = "none" | "some" | "severe";

export type GiDehydrationOpdFramework =
  | {
      active: true;
      factsAlreadyPresent: string[];
      askNext: string[];
      examNext: string[];
      importantNegatives: string[];
      differentialExamples: string[];
      reasoningRules: string[];
      outputStyleHints: string[];
      /** Rule-based dehydration tier from text cues (not a substitute for clinical exam) */
      dehydrationLevel: DehydrationLevel;
      dehydrationRationale: string[];
      /** Documented no blood in stool → lower dysentery weighting in differentials */
      dysenteryRiskReduced: boolean;
      urgencyHint: "routine_opd" | "prefer_er_or_urgent";
      secondaryToOtherSystem: boolean;
      secondarySystemNote: string | null;
    }
  | { active: false };

const HISTORY_TH: string[] = [
  "onset และระยะเวลา (onset and duration)",
  "ความถี่ถ่าย / ลักษณะอุจจาระ (stool frequency, consistency)",
  "ความถี่อาเจียน",
  "ดื่มได้หรือไม่ / ORS / นม (ability to drink, ORS, breast milk)",
  "ปัสสาวะ / ผ้าอ้อม (urine output)",
  "ไข้ (fever)",
  "เลือด/เมือกในอุจจาระ (blood/mucus in stool)",
  "ปวดท้อง (abdominal pain)",
  "ซึม/เล่นได้ (lethargy vs activity)",
  "สัมผัสอาหาร / คนในบ้านป่วย / โรคระบาด (exposure, food, sick contact)",
  "ORS หรือการรักษามาก่อน (ORS or prior treatment)",
  "โรคประจำตัว / ยา (underlying disease, meds)",
];

const EXAM_TH: string[] = [
  "T, HR, RR, BP — ตามอายุและความรุนแรง",
  "general appearance / mental status",
  "ตาโหล่ง sunken eyes (ถ้าประเมิน)",
  "น้ำตา / mucosa แห้ง (tears, dry mucosa)",
  "ดื่มได้ / กระหาย (drinking test / thirst)",
  "skin pinch / turgor — slowly vs very slowly",
  "CRT / perfusion / extremities อุ่นเย็น",
  "abdomen — tenderness, guarding, distension",
  "น้ำหนัก — ถ้ามี (weight if available)",
];

const IMPORTANT_NEGATIVES_TH: string[] = [
  "ไม่มีซึมมาก — ให้บันทึกเมื่อไม่มี",
  "ดื่มได้ดี / รับสารน้ำได้ — ให้บันทึกเมื่อเป็นไปตามจริง",
  "ไม่มีอาเจียนถี่ต่อเนื่อง — ให้บันทึกเมื่อไม่มี",
  "ไม่มีเลือด/เมือกในอุจจาระ — ให้บันทึกเมื่อไม่มี",
  "ไม่มี guarding / peritoneal — ให้บันทึกเมื่อตรวจแล้วไม่มี",
  "ไม่มีสัญญาณขาดน้ำรุนแรง — ให้บันทึกเมื่อไม่มี",
  "ไม่มี perfusion แย่ — ให้บันทึกเมื่อไม่มี",
];

const DIFFERENTIAL_TH: string[] = [
  "Acute gastroenteritis (AGE)",
  "AGE with some dehydration",
  "Severe dehydration",
  "Dysentery / invasive bacterial diarrhea — เมื่อมีเลือด/เมือก/ระบบ",
  "Food-related / toxin-mediated gastroenteritis — ตามบริบท",
  "Surgical abdomen — ถ้าปวดท้อง/PE ชี้ (appendicitis, intussusception, etc.)",
];

const REASONING_RULES_TH: string[] = [
  "อย่า under-call ขาดน้ำ เมื่อกินน้อย + ปัสสาวะน้อย + perfusion ผิดปกติ — ให้บันทึกและยกระดับการดูแล",
  "อย่า over-call severe เมื่อเด็กดื่มได้ดีและยัง active — แยก illness กับระดับขาดน้ำ",
  "แยก GI illness กับความรุนแรงของ dehydration เป็นคนละส่วนเมื่อมีประโยชน์",
  "ถ้ามีสัญญาณ severe dehydration — ลำดับความสำคัญไปทาง ER/urgent; ไม่ฝังไว้ท้ายโน้ต",
];

const OUTPUT_STYLE_TH: string[] = [
  "ระบุ stool frequency, vomit frequency, ดื่มได้หรือไม่, ปัสสาวะ — ก่อนสรุป diagnosis เดียว",
  "บันทึก pertinent negatives ที่ตรวจแล้ว — โดยเฉพาะเมื่อไม่มีสัญญาณขาดน้ำรุนแรง",
];

/** Severe dehydration / danger — non-negated hit pushes tier to severe */
const SEVERE_DEHYDRATION_KEYS = [
  "unconscious",
  "unresponsive",
  "unable to drink",
  "won't drink",
  "not drinking",
  "refusing fluid",
  "ไม่ดื่ม",
  "ไม่ยอมดื่ม",
  "ดื่มไม่ได้",
  "lethargic",
  "floppy",
  "ซึมมาก",
  "หมดสติ",
  "shock",
  "mottled",
  "poor perfusion",
  "delayed capillary",
  "cold extremities",
  "ช็อก",
  "vomiting everything",
  "อาเจียนทุกอย่าง",
  "very slow skin pinch",
  "skin pinch very slow",
  "skin pinch returns very slowly",
];

/** Some dehydration — moderate cues */
const SOME_DEHYDRATION_KEYS = [
  "sunken eyes",
  "ตาโหล่ง",
  "dry mouth",
  "dry mucosa",
  "ปากแห้ง",
  "thirst",
  "กระหาย",
  "decreased urine",
  "oliguria",
  "ปัสสาวะน้อย",
  "ผ้าอ้อมแห้ง",
  "skin pinch slow",
  "turgor poor",
  "poor turgor",
  "dehydration",
  "dehydrated",
  "ขาดน้ำ",
  "restless",
  "irritable",
  "drinks eagerly",
  "กระหายมาก",
  "drinking poorly",
  "ดื่มน้อย",
];

/** Supports “no significant dehydration” when documented */
const ADEQUATE_HYDRATION_KEYS = [
  "drinks well",
  "drinking well",
  "good intake",
  "eating well",
  "active",
  "playing",
  "normal urine",
  "wet diaper",
  "ผ้าอ้อมเปียก",
  "ดื่มได้ดี",
  "กินได้ดี",
  "เล่นได้",
  "no dehydration",
  "ไม่ขาดน้ำ",
  "mild dehydration only",
];

/** Strong intake — explicitly down-tiers dehydration classification when no hard severe signs */
const STRONG_FEEDING_ADEQUATE_KEYS = [
  "กินได้ดี",
  "ดื่มได้ดี",
  "ดื่มได้ดีมาก",
  "eating well",
  "drinking well",
  "drinks well",
  "good oral intake",
];

const HARD_SEVERE_FOR_FEEDING_OVERRIDE = [
  "shock",
  "unresponsive",
  "unconscious",
  "unable to drink",
  "ช็อก",
  "ดื่มไม่ได้",
  "ซึมมาก",
  "หมดสติ",
  "mottled",
  "poor perfusion",
];

/** Negated blood in stool — lowers dysentery likelihood in narrative/differential weighting */
const NO_BLOOD_IN_STOOL_KEYS = [
  "ไม่มีเลือดในอุจจาระ",
  "ไม่มีเลือดปน",
  "ไม่มีเลือดในอุจจาระเลย",
  "no blood in stool",
  "no blood in the stool",
  "no bloody stool",
  "stool without blood",
];

function extractFacts(normalized: string): string[] {
  const t = normalized;
  const out: string[] = [];
  const add = (cond: boolean, line: string) => {
    if (cond) out.push(line);
  };
  add(anyNonNegatedRegexMatch(t, /diarrhea|diarrhoea|ท้องเสีย|ถ่าย|loose stool|watery/i), "มีการกล่าวถึงท้องเสีย / ถ่าย");
  add(anyNonNegatedRegexMatch(t, /vomit|อาเจียน|emesis|nausea|คลื่นไส้/i), "มีการกล่าวถึงอาเจียน / คลื่นไส้");
  add(anyNonNegatedRegexMatch(t, /dehydration|dehydrated|ขาดน้ำ|dry mouth|thirst|ปากแห้ง/i), "มีการกล่าวถึงขาดน้ำ / ปากแห้ง / กระหาย");
  add(anyNonNegatedRegexMatch(t, /urine|oliguria|ปัสสาวะ|ผ้าอ้อม/i), "มีการกล่าวถึงปัสสาวะ / ผ้าอ้อม");
  add(anyNonNegatedRegexMatch(t, /intake|eating|drinking|กิน|ดื่ม|ors/i), "มีการกล่าวถึงการกิน/ดื่มหรือ ORS");
  add(anyNonNegatedRegexMatch(t, /letharg|lethargy|weak|ซึม|อ่อนเพลีย/i), "มีการกล่าวถึงซึม / อ่อนเพลีย");
  add(anyNonNegatedRegexMatch(t, /blood|mucus|เลือด|เมือก/i), "มีการกล่าวถึงเลือดหรือเมือกในอุจจาระ");
  if (out.length === 0) {
    out.push("มีคีย์เวิร์ด GI — เก็บความถี่ การดื่ม และปัสสาวะให้ชัด");
  }
  return out.slice(0, 16);
}

function collectMatchedKeys(t: string, keys: string[]): string[] {
  const found: string[] = [];
  for (const k of keys) {
    if (hasAnyKeywordNonNegated(t, [k])) found.push(k);
  }
  return found;
}

function applyFeedingIntakeReduction(
  t: string,
  level: DehydrationLevel,
  rationale: string[],
): { level: DehydrationLevel; rationale: string[] } {
  const strong = hasAnyKeywordNonNegated(t, STRONG_FEEDING_ADEQUATE_KEYS);
  if (!strong) return { level, rationale };

  const hasHard = HARD_SEVERE_FOR_FEEDING_OVERRIDE.some((h) => hasAnyKeywordNonNegated(t, [h]));

  if (level === "some") {
    return {
      level: "none",
      rationale: [
        ...rationale,
        "กินได้ดี/ดื่มได้ดี — ลดระดับขาดน้ำเชิงกลุ่ม (ไม่มีสัญญาณรุนแรงที่ขัดแย้ง)",
      ],
    };
  }
  if (level === "severe" && !hasHard) {
    return {
      level: "some",
      rationale: [
        ...rationale,
        "กินได้ดี/ดื่มได้ดี — ลดจาก severe → some หากไม่มี shock / ดื่มไม่ได้ / ซึมมาก / unresponsive — ยืนยันด้วยการตรวจ",
      ],
    };
  }
  if (level === "severe" && hasHard) {
    return {
      level: "severe",
      rationale: [
        ...rationale,
        "มีกินได้ดีแต่มีสัญญาณรุนแรง — reconcile ด้วยการตรวจ",
      ],
    };
  }
  return { level, rationale };
}

/**
 * Heuristic tier: severe > some > none; protective phrases reduce tier when no severe physical overlap.
 * "กินได้ดี" further down-tiers via `applyFeedingIntakeReduction`.
 */
export function classifyDehydrationFromText(normalizedText: string): {
  level: DehydrationLevel;
  rationale: string[];
} {
  const t = normalizedText;
  const rationale: string[] = [];

  const severeHits = collectMatchedKeys(t, SEVERE_DEHYDRATION_KEYS);
  const someHits = collectMatchedKeys(t, SOME_DEHYDRATION_KEYS);
  const protective = hasAnyKeywordNonNegated(t, ADEQUATE_HYDRATION_KEYS);

  let level: DehydrationLevel;

  if (severeHits.length > 0) {
    rationale.push(`Severe cues: ${[...new Set(severeHits)].slice(0, 8).join(", ")}`);
    if (protective) {
      rationale.push("Note: also mentions adequate intake/activity — reconcile with exam; do not ignore severe signs if present.");
    }
    level = "severe";
    return applyFeedingIntakeReduction(t, level, rationale);
  }

  const someUnique = someHits.filter((k) => !severeHits.includes(k));
  if (
    someUnique.length > 0 ||
    (hasAnyKeywordNonNegated(t, ["decreased urine", "oliguria", "ปัสสาวะน้อย"]) &&
      hasAnyKeywordNonNegated(t, ["dry mouth", "dry mucosa", "thirst", "ปากแห้ง"]))
  ) {
    rationale.push(
      someUnique.length
        ? `Some dehydration cues: ${[...new Set(someUnique)].slice(0, 10).join(", ")}`
        : "Combined decreased urine + dry mouth/thirst — classify as some dehydration pending exam",
    );
    if (protective) {
      rationale.push(
        "Adequate intake/activity also mentioned — keep tier at some unless exam shows no dehydration; do not under-call if oliguria/dry mucosa persist.",
      );
    }
    level = "some";
    return applyFeedingIntakeReduction(t, level, rationale);
  }

  if (protective) {
    rationale.push("Adequate drinking/activity/urine suggested — no significant dehydration by narrative.");
    level = "none";
    return { level, rationale };
  }

  rationale.push("GI symptoms without strong dehydration narrative — document exam to assign tier.");
  level = "none";
  return { level, rationale };
}

/** Diarrhea/vomiting + severe dehydration tier → ER visit-mode bias */
export function matchesGiSevereDehydrationErEscalation(normalizedText: string): boolean {
  if (!detectGiDehydrationFrameworkActive(normalizedText)) return false;
  return classifyDehydrationFromText(normalizedText).level === "severe";
}

export function detectGiDehydrationFrameworkActive(normalizedText: string): boolean {
  return scoreKeysNegationAware(normalizedText, GI_DEHYDRATION_ACTIVATION_KEYS) >= 1;
}

function secondaryNote(dominant: ReturnType<typeof detectDominantTheme>): string | null {
  if (dominant === "respiratory") return "ทางเดินหายใจอาจเด่น — GI อาจ secondary (e.g. post-tussive vomit)";
  if (dominant === "skin_rash") return "ผื่นอาจเด่น — แยกจาก GI ตามบริบท";
  if (dominant === "fever_systemic") return "ไข้เด่น — GI อาจเป็นโฟกัสหรือส่วนหนึ่งของภาพรวม";
  return null;
}

export function buildGiDehydrationOpdFramework(
  normalizedText: string,
  opts?: { hasSystemicRedFlags?: boolean },
): GiDehydrationOpdFramework {
  if (!detectGiDehydrationFrameworkActive(normalizedText)) {
    return { active: false };
  }

  const dominant = detectDominantTheme(normalizedText);
  const scores = getSystemKeywordScores(normalizedText);
  const secondaryToOtherSystem =
    dominant !== "gi" &&
    dominant !== "unclear" &&
    scores.gi >= 1 &&
    (dominant === "respiratory" || dominant === "skin_rash" || dominant === "fever_systemic");

  const { level, rationale } = classifyDehydrationFromText(normalizedText);
  const systemic = Boolean(opts?.hasSystemicRedFlags);
  const urgencyHint: "routine_opd" | "prefer_er_or_urgent" =
    level === "severe" || systemic ? "prefer_er_or_urgent" : "routine_opd";

  const dysenteryRiskReduced = hasAnyKeywordNonNegated(normalizedText, NO_BLOOD_IN_STOOL_KEYS);
  const reasoningRules = [...REASONING_RULES_TH];
  if (dysenteryRiskReduced) {
    reasoningRules.push(
      "ไม่มีเลือดในอุจจาระ (documented) — ลดน้ำหนัก differential dysentery/invasive diarrhea เว้นแต่มีข้อมูลชี้อื่น",
    );
  }

  return {
    active: true,
    factsAlreadyPresent: extractFacts(normalizedText),
    askNext: [...HISTORY_TH],
    examNext: [...EXAM_TH],
    importantNegatives: [...IMPORTANT_NEGATIVES_TH],
    differentialExamples: [...DIFFERENTIAL_TH],
    reasoningRules,
    outputStyleHints: [...OUTPUT_STYLE_TH],
    dehydrationLevel: level,
    dehydrationRationale: rationale,
    dysenteryRiskReduced,
    urgencyHint,
    secondaryToOtherSystem,
    secondarySystemNote: secondaryToOtherSystem ? secondaryNote(dominant) : null,
  };
}

export function formatGiDehydrationFrameworkForAi(f: GiDehydrationOpdFramework): string {
  if (!f.active) return "(GI_DEHYDRATION_FRAMEWORK inactive)";
  const lines = [
    "=== DIARRHEA / VOMITING / DEHYDRATION (Thai OPD / urgent) ===",
    `DEHYDRATION_TIER (rule-based from text): ${f.dehydrationLevel.toUpperCase()}`,
    ...f.dehydrationRationale.map((x) => `  — ${x}`),
    `Urgency: ${f.urgencyHint}`,
    f.dysenteryRiskReduced ? "Dysentery/invasive diarrhea: lower weight — no blood in stool documented in text." : "",
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
