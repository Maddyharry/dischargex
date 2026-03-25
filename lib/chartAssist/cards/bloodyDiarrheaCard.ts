import { AssistCardResult, ParsedCaseFact, hasAny, uniq } from "../cardTypes";

const TRIGGERS = [
  "ถ่าย",
  "อุจจาระ",
  "เหลว",
  "ท้องเสีย",
  "ถ่ายเป็นเลือด",
  "มูกเลือด",
  "bloody stool",
  "bloody diarrhea",
  "dysentery",
  "ปวดท้อง",
  "กินได้น้อย",
  "ปัสสาวะน้อย",
  "อาเจียน",
];

export function shouldShowBloodyDiarrheaCard(input: ParsedCaseFact) {
  const text = input.normalizedText;
  return (
    hasAny(text, TRIGGERS) ||
    !!input.facts?.bloodyStool ||
    (!!input.facts?.diarrhea && !!input.facts?.abdominalPain)
  );
}

export function buildBloodyDiarrheaCard(input: ParsedCaseFact): AssistCardResult {
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

  if (hasAny(text, ["ท้องเสีย", "ถ่ายเหลว", "เหลว"]) || input.facts?.diarrhea) {
    documented.push("มีอาการท้องเสีย");
    whyShown.push("พบอาการท้องเสีย");
  }
  if (
    hasAny(text, ["ถ่ายเป็นเลือด", "มูกเลือด", "bloody stool", "bloody diarrhea"]) ||
    input.facts?.bloodyStool
  ) {
    documented.push("มี bloody stool");
    whyShown.push("พบ bloody stool");
  }
  if (hasAny(text, ["ปวดท้อง"]) || input.facts?.abdominalPain) {
    documented.push("มี abdominal pain");
  }
  if (hasAny(text, ["อาเจียน"]) || input.facts?.vomiting) {
    documented.push("มีอาเจียน");
  }
  if (hasAny(text, ["กินได้น้อย", "poor intake"]) || input.facts?.poorIntake) {
    documented.push("กินได้น้อย");
  }
  if (input.facts?.fever || hasAny(text, ["ไข้"])) {
    documented.push("มีไข้");
  }

  if (input.facts?.hr == null) missing.push("HR");
  if (!input.facts?.bp && !hasAny(text, ["bp", "ความดัน"])) missing.push("BP");
  if (input.facts?.crtSec == null) missing.push("capillary refill / perfusion");
  if (!hasAny(text, ["ปัสสาวะ", "urine output", "ปัสสาวะน้อย"])) {
    missing.push("urine output");
  }
  if (!hasAny(text, ["กดเจ็บท้อง", "abdominal tenderness", "ท้องอืด", "distension"])) {
    missing.push("abdominal tenderness / distension");
  }
  if (!hasAny(text, ["ถ่าย", "ครั้ง"])) missing.push("stool frequency");
  if (!hasAny(text, ["toxic", "ซึม", "เล่นได้"])) missing.push("general appearance / toxic look");

  checkNext.push(
    "ประเมิน dehydration severity",
    "วัด HR/BP/CRT",
    "ถาม urine output",
    "ตรวจ abdominal tenderness / distension",
    "ถามจำนวนครั้งของ bloody stool",
    "ถามไข้ / exposure / recent antibiotic"
  );

  diagnosis.push(
    "Acute bloody diarrhea / dysentery",
    "Invasive infectious diarrhea",
    "Consider STEC / hemorrhagic colitis if pattern fits",
    "Simple AGE less likely if bloody stool present"
  );

  avoidRoutine.push(
    "ไม่ควร auto-label เป็น simple AGE",
    "ไม่ควรแนะนำ antibiotic routine ทุกเคส",
    "ไม่ควรแนะนำ anti-diarrheal routine"
  );

  actionNow.push(
    "ประเมิน dehydration และ perfusion ก่อน",
    "ORS ถ้าดื่มได้",
    "IV fluid ถ้าขาดน้ำมาก / ดื่มไม่ได้ / มี shock concern",
    "พิจารณา stool testing เมื่อมีข้อบ่งชี้"
  );

  medicationClassSuggestions.push(
    "ORS",
    "IV crystalloid if clinically indicated",
    "avoid routine anti-diarrheal",
    "antibiotic only if clinically indicated"
  );

  if (hasAny(text, ["ซึม", "อ่อนเพลียมาก", "ไม่เล่น"])) {
    redFlags.push("general condition ไม่ดี");
  }
  if (hasAny(text, ["ปัสสาวะน้อย"])) {
    redFlags.push("อาจมี dehydration");
  }
  if (hasAny(text, ["ท้องอืด", "กดเจ็บมาก", "ปวดมาก"])) {
    redFlags.push("abdominal red flag");
  }
  if (input.facts?.crtSec != null && input.facts.crtSec > 2) {
    redFlags.push("poor perfusion");
  }

  if (redFlags.length > 0) {
    dispositionHints.push("พิจารณา observe / admit / ER management ตาม severity");
  } else {
    dispositionHints.push("close follow-up if stable and intake acceptable");
  }

  return {
    id: "bloody-diarrhea",
    label: "Bloody diarrhea / AGE with red flags",
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
      "thai-peds-acute-diarrhea",
      "thai-rdu-hospital-manual",
      "idsa-infectious-diarrhea-2017",
    ],
  };
}
