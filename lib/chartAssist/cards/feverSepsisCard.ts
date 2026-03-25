import { AssistCardResult, ParsedCaseFact, hasAny, uniq } from "../cardTypes";

const TRIGGERS = [
  "ไข้สูง",
  "ไข้",
  "ซึม",
  "ช็อก",
  "shock",
  "poor perfusion",
  "cap refill",
  "crt ",
  "crt:",
  "bp ต่ำ",
  "hypotension",
  "sepsis",
  "septic",
  "ไม่กิน",
  "ปัสสาวะน้อย",
  "tachycardia",
];

export function shouldShowFeverSepsisCard(input: ParsedCaseFact) {
  const text = input.normalizedText;
  return (
    hasAny(text, TRIGGERS) ||
    !!input.facts?.fever ||
    !!input.facts?.drowsy ||
    (input.mode !== "OPD" && !!input.facts?.poorIntake)
  );
}

export function buildFeverSepsisCard(input: ParsedCaseFact): AssistCardResult {
  const text = input.normalizedText;
  const documented: string[] = [];
  const missing: string[] = [];
  const checkNext: string[] = [];
  const diagnosis: string[] = [];
  const avoidRoutine: string[] = [];
  const actionNow: string[] = [];
  const redFlags: string[] = [];
  const whyShown: string[] = [];
  const dispositionHints: string[] = [];
  const medicationClassSuggestions: string[] = [];

  if (input.facts?.fever || hasAny(text, ["ไข้", "ไข้สูง"])) {
    documented.push("มีไข้/ไข้สูง");
    whyShown.push("พบไข้");
  }
  if (hasAny(text, ["ซึม"]) || input.facts?.drowsy) {
    documented.push("มี altered mental status / ซึม");
    whyShown.push("พบซึม");
  }
  if (hasAny(text, ["ไม่กิน", "กินได้น้อย", "poor intake"]) || input.facts?.poorIntake) {
    documented.push("กินได้น้อย");
  }
  if (input.facts?.hr != null) documented.push(`HR ${input.facts.hr}`);
  if (input.facts?.bp) documented.push(`BP ${input.facts.bp}`);
  if (input.facts?.crtSec != null) documented.push(`CRT ${input.facts.crtSec} sec`);

  if (input.facts?.hr == null) missing.push("HR");
  if (!input.facts?.bp) missing.push("BP");
  if (input.facts?.crtSec == null) missing.push("capillary refill / perfusion");
  if (!hasAny(text, ["mental status", "avpu", "gcs", "ซึม", "เล่นได้"])) missing.push("mental status");
  if (!hasAny(text, ["urine output", "ปัสสาวะ", "ปัสสาวะน้อย"])) missing.push("urine output");
  if (!hasAny(text, ["source", "หู", "คอ", "ปอด", "ผื่น", "แผล", "ท้อง", "ปัสสาวะ"])) {
    missing.push("likely source of infection");
  }

  checkNext.push(
    "วัด HR/BP/CRT",
    "ประเมิน mental status",
    "ถาม/ประเมิน urine output",
    "หา source ของ infection",
    "ดู perfusion / skin / pulse quality",
    "ชั่งน้ำหนักถ้าต้องให้ fluid/ยา"
  );

  diagnosis.push(
    "Acute febrile illness",
    "Sepsis concern if perfusion/mental status abnormal",
    "Shock concern if hypotension/poor perfusion present"
  );

  avoidRoutine.push(
    "อย่าลดระดับความรุนแรงก่อนมี HR/BP/CRT/mental status",
    "อย่าฟันธง viral fever ถ้ายังไม่ได้ประเมิน perfusion และ source"
  );

  actionNow.push(
    "ประเมิน ABCD",
    "หา source ของ infection",
    "ประเมิน perfusion และ urine output",
    "senior review / ER escalation ถ้ามี sepsis concern"
  );

  medicationClassSuggestions.push(
    "antipyretic PRN",
    "fluid resuscitation if clinically indicated",
    "antimicrobial only after syndrome/source assessment"
  );

  if ((input.facts?.crtSec ?? 0) > 2) redFlags.push("CRT prolonged");
  if (hasAny(text, ["bp ต่ำ", "hypotension"])) redFlags.push("hypotension");
  if (hasAny(text, ["ซึม"]) || input.facts?.drowsy) redFlags.push("altered mental status");
  if (hasAny(text, ["ช็อก", "shock"])) redFlags.push("shock concern");
  if (hasAny(text, ["ปัสสาวะน้อย"])) redFlags.push("poor urine output");

  if (redFlags.length > 0) {
    dispositionHints.push("urgent ER management / observe / admit according to severity");
  } else {
    dispositionHints.push("close reassessment after vitals and focused exam");
  }

  return {
    id: "fever-sepsis",
    label: "Fever / Sepsis screen",
    severity: redFlags.length > 0 ? "urgent" : "warn",
    whyShown: uniq(whyShown),
    documented: uniq(documented),
    missing: uniq(missing),
    checkNext: uniq(checkNext),
    mostSupportedDiagnosisIdeas: uniq(diagnosis),
    avoidRoutine: uniq(avoidRoutine),
    actionNow: uniq(actionNow),
    dispositionHints: uniq(dispositionHints),
    redFlags: uniq(redFlags),
    medicationClassSuggestions: uniq(medicationClassSuggestions),
    referenceIds: [
      "thai-peds-severe-sepsis-shock",
      "thai-peds-acute-febrile-illness",
    ],
  };
}
