/**
 * Thai OPD Assist — dysuria / UTI-like symptoms (lower vs upper vs non-UTI mimics).
 */
import { detectDominantTheme } from "./caseClinicalProfile";
import { anyNonNegatedRegexMatch, hasAnyKeywordNonNegated, scoreKeysNegationAware } from "./clinicalNegation";

export const UTI_LIKE_ACTIVATION_KEYS = [
  "dysuria",
  "cystitis",
  "pyelonephritis",
  "urinary frequency",
  "voiding frequency",
  "frequency of urination",
  "urinary urgency",
  "voiding urgency",
  "enuresis",
  "bedwetting",
  "bed wetting",
  "nocturia",
  "incontinence",
  "malodorous urine",
  "cloudy urine",
  "dark urine",
  "strong smelling urine",
  "hematuria",
  "blood in urine",
  "เลือดปนในปัสสาวะ",
  "suprapubic",
  "suprapubic pain",
  "flank pain",
  "loin pain",
  "cva tenderness",
  "costovertebral",
  "ปัสสาวะแสบ",
  "ขัดปัสสาวะ",
  "กระหายน้ำบ่อย",
  "ถ่ายบ่อย",
  "ปัสสาวะบ่อย",
];

const EXPLICIT_NO_UTI_DENIAL_KEYS = [
  "no dysuria",
  "denies dysuria",
  "no urinary symptoms",
  "no uti",
  "ไม่มีปัสสาวะแสบ",
  "ไม่มีขัดปัสสาวะ",
  "ปฏิเสธปัสสาวะแสบ",
];

/** Affirmative urinary / UTI context — allows framework when denial also appears elsewhere */
const AFFIRMATIVE_UTI_KEYS = [
  "dysuria",
  "cystitis",
  "pyelonephritis",
  "urinary frequency",
  "urinary urgency",
  "hematuria",
  "blood in urine",
  "cloudy urine",
  "malodorous",
  "suprapubic",
  "flank pain",
  "loin",
  "cva",
  "ปัสสาวะแสบ",
  "ขัดปัสสาวะ",
  "enuresis",
  "bedwetting",
];

/** Word "UTI" / "uti" as its own token (avoids matching inside e.g. "routine") */
function hasStandaloneUtiToken(normalizedText: string): boolean {
  return anyNonNegatedRegexMatch(normalizedText, /\buti\b/i);
}

/** Strong non-urinary infection focus — suppress UTI framework if no affirmative GU and this dominates */
const ALT_FOCUS_INFECTION_KEYS = [
  "otitis",
  "pneumonia",
  "cellulitis",
  "pharyngitis",
  "tonsillitis",
  "skin infection",
  "abscess",
  "ไอ",
  "pneumon",
];

const UPPER_UTI_CONCERN_KEYS = [
  "fever",
  "chills",
  "rigor",
  "ไข้",
  "หนาวสั่น",
  "flank pain",
  "loin pain",
  "cva tenderness",
  "costovertebral",
  "pyelonephritis",
  "vomiting",
  "emesis",
  "อาเจียน",
  "systemic",
  "systemic illness",
  "toxic",
  "toxic appearing",
  "ill appearance",
  "malaise",
  "lethargy",
  "ซึมมาก",
  "hypotension",
  "sepsis",
];

/** Dysuria / painful voiding — negation-aware */
const DYSURIA_PRESENT_KEYS = [
  "dysuria",
  "painful urination",
  "pain with urination",
  "pain on urination",
  "ปัสสาวะแสบ",
  "ขัดปัสสาวะ",
  "แสบขณะปัสสาวะ",
];

/** Genital / local irritation mimics — prominent when score ≥2 or strong single cue */
const GENITAL_IRRITATION_KEYS = [
  "vulvovaginitis",
  "vaginal discharge",
  "vaginitis",
  "genital irritation",
  "labial",
  "labia",
  "balanitis",
  "vulvitis",
  "คันช่องคลอด",
  "ตกขาว",
  "อักเสบช่องคลอด",
  "แผลริม",
  "diaper dermatitis",
  "severe diaper",
];

export type UtiConcernTier = "lower" | "upper_suspected" | "unclear";

export type DysuriaUtiOpdFramework =
  | {
      active: true;
      factsAlreadyPresent: string[];
      askNext: string[];
      examNext: string[];
      importantNegatives: string[];
      differentialExamples: string[];
      reasoningRules: string[];
      outputStyleHints: string[];
      utiConcernTier: UtiConcernTier;
      /** Dysuria / painful voiding documented (negation-aware) */
      dysuriaPresent: boolean;
      /** Strong non-urinary infection focus but no dysuria — lower UTI less likely */
      lowerUtiLikelihoodReduced: boolean;
      /** Local genital irritation / discharge prominent — weigh vulvovaginitis / mimic */
      genitalIrritationProminent: boolean;
      /** Suspected UTI in infant under ~3 months — urgent pediatric pathway (specialist / children’s hospital) */
      pediatricSpecialistEscalation: boolean;
      /** Alternative infection focus without strong urinary story — document carefully */
      alternativeFocusPossible: boolean;
    }
  | { active: false };

const HISTORY_TH: string[] = [
  "dysuria — character, timing",
  "frequency / urgency / nocturia",
  "malodorous / cloudy / dark urine",
  "visible hematuria",
  "fever / chills",
  "suprapubic pain",
  "flank / loin pain",
  "vomiting / systemic illness",
  "fluid intake",
  "previous UTI / recurrent UTI",
  "poor urine flow / stream",
  "constipation",
  "genital irritation / discharge — เมื่อเกี่ยว",
  "recent antibiotics",
];

const EXAM_TH: string[] = [
  "temperature / general appearance",
  "hydration / capillary refill",
  "suprapubic tenderness",
  "CVA / loin tenderness",
  "abdomen / bladder mass",
  "external genital — เมื่อเกี่ยว",
];

const IMPORTANT_NEGATIVES_TH: string[] = [
  "ไม่มีไข้ — ให้บันทึกเมื่อไม่มี",
  "ไม่มี flank pain / CVA tenderness — ให้บันทึกเมื่อไม่มี",
  "ไม่มีอาเจียน / systemic toxicity — ให้บันทึกเมื่อไม่มี",
  "ไม่มี hematuria — ให้บันทึกเมื่อไม่มี",
  "ไม่มี poor urine flow — ให้บันทึกเมื่อไม่มี",
  "ไม่มี abdominal / bladder mass — ให้บันทึกเมื่อไม่มี",
  "ไม่มี alternative focus ชัด — ถ้าตรวจแล้ว",
];

const DIFFERENTIAL_TH: string[] = [
  "Lower UTI / cystitis",
  "Upper UTI / pyelonephritis — เมื่อมีไข้/loin/CVA/ระบบ",
  "Vulvovaginitis / local irritation",
  "Dehydration — concentrated / dark urine",
  "Renal stone / non-UTI hematuria",
];

const REASONING_RULES_TH: string[] = [
  "ทารกอายุ <3 เดือน + สงสัย UTI — urgent pediatric pathway: ยกระดับสู่ pediatric specialist / โรงพยาบาลเด็ก ตามแนวทาง (ไม่ใช่ cystitis OPD ทั่วไป)",
  "แยก severity: อาการทางปัสสาวะอย่างเดียว (ไม่มีไข้/ระบบ/flank) → likely lower UTI path; มีไข้ / systemic illness / flank-loin-CVA → upper UTI path",
  "ถ้าไม่มี dysuria และมี infection focus อื่นชัด — ลดน้ำหนัก lower UTI; บันทึกเหตุผล",
  "ถ้า genital irritation / discharge เด่น — พิจารณา vulvovaginitis / local irritation มากกว่า UTI อย่างเดียว",
  "เก็บปัสสาวะก่อนให้ antibiotic เมื่อทำได้ — ถ้าเด็กป่วยหนักและเก็บไม่ทัน ไม่ delay การรักษา",
  "ถ้ามีโฟกัส infection อื่นชัดและไม่มี urinary clues — ไม่ต้องสร้าง UTI เป็นประเด็นหลัก",
];

const OUTPUT_STYLE_TH: string[] = [
  "แยก lower vs upper ตามอาการและ PE — อาการทางปัสสาวะอย่างเดียว vs ไข้/ระบบ/flank",
  "บันทึก pertinent negatives ที่ตรวจแล้ว — รวมถึงเมื่อไม่มี dysuria แต่มีประเด็นอื่น",
];

/** Upper-tract / systemic concern — `febrile` uses word boundary so `afebrile` does not match */
function hasUpperUtiConcern(t: string): boolean {
  if (hasAnyKeywordNonNegated(t, UPPER_UTI_CONCERN_KEYS)) return true;
  return anyNonNegatedRegexMatch(t, /\bfebrile\b/i);
}

function isDysuriaPresentNegationAware(normalizedText: string): boolean {
  return hasAnyKeywordNonNegated(normalizedText, DYSURIA_PRESENT_KEYS);
}

function detectGenitalIrritationProminent(normalizedText: string): boolean {
  const t = normalizedText;
  if (scoreKeysNegationAware(t, GENITAL_IRRITATION_KEYS) >= 2) return true;
  if (
    hasAnyKeywordNonNegated(t, ["vulvovaginitis", "vaginal discharge", "balanitis"]) &&
    hasAnyKeywordNonNegated(t, ["severe", "marked", "prominent", "มาก", "รุนแรง", "แดงมาก"])
  ) {
    return true;
  }
  return false;
}

/** Heuristic: neonate / young infant when UTI suspected */
function detectPediatricSpecialistEscalation(normalizedText: string): boolean {
  const t = normalizedText;
  if (
    /\b(?:neonate|newborn)\b/i.test(t) ||
    /\b(?:1|2|3)\s*(?:day|week|month)s?\s*(?:old|of age)?\b/i.test(t) ||
    /อายุ\s*(?:1|2|3)\s*(?:วัน|สัปดาห์|เดือน)/i.test(t) ||
    /ทารก\s*(?:1|2|3)/i.test(t) ||
    hasAnyKeywordNonNegated(t, ["2 month old", "3 month old", "1 month old", "6 week old", "4 week old", "8 week old"])
  ) {
    return true;
  }
  return /under\s*3\s*month|less than\s*3\s*month|younger than\s*3\s*month|เด็กอายุไม่ถึง\s*3\s*เดือน/i.test(t);
}

function classifyUtiTier(
  normalizedText: string,
  opts: { lowerUtiLikelihoodReduced: boolean },
): UtiConcernTier {
  const t = normalizedText;
  if (hasUpperUtiConcern(t)) return "upper_suspected";

  const lowerCue =
    hasAnyKeywordNonNegated(t, [
      "dysuria",
      "urinary frequency",
      "voiding frequency",
      "frequency of urination",
      "urinary urgency",
      "voiding urgency",
      "suprapubic",
      "ปัสสาวะแสบ",
      "ขัดปัสสาวะ",
      "cystitis",
    ]) ||
    hasStandaloneUtiToken(t) ||
    scoreKeysNegationAware(t, ["hematuria", "cloudy urine", "malodorous"]) >= 1;

  if (lowerCue && !opts.lowerUtiLikelihoodReduced) return "lower";
  if (lowerCue && opts.lowerUtiLikelihoodReduced) return "unclear";
  return "unclear";
}

export function shouldSuppressDysuriaUtiFramework(normalizedText: string): boolean {
  const t = normalizedText;
  const denial = hasAnyKeywordNonNegated(t, EXPLICIT_NO_UTI_DENIAL_KEYS);
  const affirmGu = scoreKeysNegationAware(t, AFFIRMATIVE_UTI_KEYS) >= 1 || hasStandaloneUtiToken(t);
  if (denial && !affirmGu) return true;
  const altStrong = scoreKeysNegationAware(t, ALT_FOCUS_INFECTION_KEYS) >= 2;
  if (altStrong && !affirmGu) return true;
  return false;
}

export function detectDysuriaUtiFrameworkActive(normalizedText: string): boolean {
  if (shouldSuppressDysuriaUtiFramework(normalizedText)) return false;
  return scoreKeysNegationAware(normalizedText, UTI_LIKE_ACTIVATION_KEYS) >= 1;
}

function extractFacts(t: string): string[] {
  const out: string[] = [];
  const add = (cond: boolean, line: string) => {
    if (cond) out.push(line);
  };
  add(
    anyNonNegatedRegexMatch(t, /dysuria|cystitis|ปัสสาวะแสบ|ขัดปัสสาวะ/i) || hasStandaloneUtiToken(t),
    "มีการกล่าวถึง dysuria / UTI",
  );
  add(
    anyNonNegatedRegexMatch(
      t,
      /urinary\s+frequency|voiding\s+frequency|urinary\s+urgency|voiding\s+urgency|nocturia|bedwetting|enuresis|ปัสสาวะบ่อย|กระหายน้ำบ่อย/i,
    ),
    "มีการกล่าวถึง frequency/urgency/enuresis",
  );
  add(anyNonNegatedRegexMatch(t, /hematuria|blood in urine|เลือดปน/i), "มีการกล่าวถึง hematuria");
  add(anyNonNegatedRegexMatch(t, /cloudy|malodorous|dark urine/i), "มีการกล่าวถึงลักษณะปัสสาวะ");
  add(anyNonNegatedRegexMatch(t, /suprapubic|flank|loin|cva/i), "มีการกล่าวถึง suprapubic / flank / CVA");
  return out.slice(0, 14);
}

export function buildDysuriaUtiOpdFramework(normalizedText: string): DysuriaUtiOpdFramework {
  if (!detectDysuriaUtiFrameworkActive(normalizedText)) {
    return { active: false };
  }

  const t = normalizedText;
  const dominant = detectDominantTheme(normalizedText);
  const altStrong = scoreKeysNegationAware(t, ALT_FOCUS_INFECTION_KEYS) >= 2;
  const dysuriaPresent = isDysuriaPresentNegationAware(t);
  const lowerUtiLikelihoodReduced = altStrong && !dysuriaPresent;
  const genitalIrritationProminent = detectGenitalIrritationProminent(t);
  const utiConcernTier = classifyUtiTier(t, { lowerUtiLikelihoodReduced });
  const pediatricSpecialistEscalation = detectPediatricSpecialistEscalation(t);
  const alternativeFocusPossible =
    dominant === "respiratory" || dominant === "skin_rash" || dominant === "gi" || altStrong;

  const factsAlreadyPresent = enrichFactsWithContext(
    extractFacts(t),
    dysuriaPresent,
    lowerUtiLikelihoodReduced,
    genitalIrritationProminent,
  );

  const reasoningRules = [...REASONING_RULES_TH];

  return {
    active: true,
    factsAlreadyPresent,
    askNext: [...HISTORY_TH],
    examNext: [...EXAM_TH],
    importantNegatives: [...IMPORTANT_NEGATIVES_TH],
    differentialExamples: [...DIFFERENTIAL_TH],
    reasoningRules,
    outputStyleHints: [...OUTPUT_STYLE_TH],
    utiConcernTier,
    dysuriaPresent,
    lowerUtiLikelihoodReduced,
    genitalIrritationProminent,
    pediatricSpecialistEscalation,
    alternativeFocusPossible,
  };
}

function enrichFactsWithContext(
  base: string[],
  dysuriaPresent: boolean,
  lowerUtiLikelihoodReduced: boolean,
  genitalIrritationProminent: boolean,
): string[] {
  const out = [...base];
  if (dysuriaPresent) out.push("มีคำบ่ง dysuria / painful voiding");
  else out.push("ไม่พบคำบ่ง dysuria ชัด — ชั่งกับอาการอื่น");
  if (lowerUtiLikelihoodReduced) {
    out.push("มี infection focus อื่นแรงและไม่มี dysuria — lower UTI less likely");
  }
  if (genitalIrritationProminent) {
    out.push("มีข้อมูล genital irritation / discharge — พิจารณา mimic แยกจาก UTI");
  }
  if (out.length === 0) {
    out.push("มีคีย์เวิร์ดทางปัสสาวะ — เก็บอาการและ systemic features ให้ชัด");
  }
  return out.slice(0, 16);
}

export function formatDysuriaUtiFrameworkForAi(f: DysuriaUtiOpdFramework): string {
  if (!f.active) return "(DYSURIA_UTI_FRAMEWORK inactive)";
  const lines = [
    "=== DYSURIA / UTI-LIKE SYMPTOMS ===",
    `UTI concern tier (rule-based): ${f.utiConcernTier}`,
    `Severity path: upper = fever/systemic illness/flank-loin-CVA; lower = urinary symptoms without those features (when tier=lower).`,
    `Dysuria documented: ${f.dysuriaPresent ? "yes" : "no"}`,
    f.lowerUtiLikelihoodReduced
      ? "Alternative-cause check: dysuria absent + strong non-urinary infection focus — lower UTI likelihood reduced (tier may be unclear)."
      : "",
    f.genitalIrritationProminent
      ? "Genital irritation/discharge prominent — consider vulvovaginitis / local irritation as non-UTI urinary mimic."
      : "",
    f.pediatricSpecialistEscalation
      ? "URGENT PEDIATRIC PATHWAY: suspected UTI age <3 months — escalate per specialist/children’s hospital; not routine OPD cystitis."
      : "",
    f.alternativeFocusPossible ? "Note: possible alternative infection focus — weigh urinary clues vs dominant theme." : "",
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
