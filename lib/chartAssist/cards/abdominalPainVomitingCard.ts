import { AssistCardResult, ParsedCaseFact, hasAny, uniq } from "../cardTypes";

const TRIGGERS = [
  "ปวดท้อง",
  "ท้องอืด",
  "อาเจียน",
  "vomiting",
  "abdominal pain",
  "rlq",
  "guarding",
  "rebound",
  "bilious",
  "กดเจ็บ",
  "กดเจ็บท้อง",
  "ปวดท้องมาก",
  "กินได้น้อย",
];

export function shouldShowAbdominalPainVomitingCard(input: ParsedCaseFact) {
  const text = input.normalizedText;
  return (
    hasAny(text, TRIGGERS) ||
    !!input.facts?.abdominalPain ||
    !!input.facts?.vomiting
  );
}

export function buildAbdominalPainVomitingCard(input: ParsedCaseFact): AssistCardResult {
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

  if (hasAny(text, ["ปวดท้อง", "abdominal pain"]) || input.facts?.abdominalPain) {
    documented.push("มี abdominal pain");
    whyShown.push("พบ abdominal pain");
  }
  if (hasAny(text, ["อาเจียน", "vomiting"]) || input.facts?.vomiting) {
    documented.push(
      input.facts?.vomitingCount != null
        ? `อาเจียน ${input.facts.vomitingCount} ครั้ง`
        : "มีอาเจียน"
    );
    whyShown.push("พบ vomiting");
  }
  if (hasAny(text, ["ท้องอืด", "distension"])) documented.push("มี abdominal distension");
  if (hasAny(text, ["กดเจ็บ", "tenderness"])) documented.push("มี abdominal tenderness");
  if (hasAny(text, ["กินได้น้อย", "poor intake"]) || input.facts?.poorIntake) {
    documented.push("กินได้น้อย");
  }
  if (input.facts?.fever || hasAny(text, ["ไข้"])) documented.push("มีไข้");

  if (!hasAny(text, ["rlq", "epigastric", "periumbilical", "location", "ตำแหน่ง"])) {
    missing.push("pain location");
  }
  if (!hasAny(text, ["guarding", "rebound", "peritonitis"])) {
    missing.push("guarding / rebound / peritonitis signs");
  }
  if (!hasAny(text, ["stool", "ถ่าย", "ท้องเสีย", "constipation", "ผายลม"])) {
    missing.push("stool / bowel pattern");
  }
  if (!hasAny(text, ["ปัสสาวะ", "dysuria", "hematuria"])) {
    missing.push("urinary symptoms");
  }
  if (input.facts?.hr == null) missing.push("HR");
  if (input.facts?.crtSec == null) missing.push("perfusion / dehydration");
  if (!hasAny(text, ["bilious", "น้ำดี", "เขียว"])) {
    missing.push("bilious vomiting or not");
  }

  checkNext.push(
    "ระบุตำแหน่งปวดท้อง",
    "ตรวจ guarding/rebound",
    "ถาม stool/urine symptoms",
    "ประเมิน dehydration/perfusion",
    "ดู distension / bowel obstruction clues",
    "นับ vomiting count"
  );

  diagnosis.push(
    "Acute abdominal pain with vomiting",
    "Dehydration concern if poor intake/vomiting",
    "Consider appendicitis / obstruction / surgical abdomen if focal or peritoneal signs"
  );

  avoidRoutine.push(
    "อย่าฟันธง AGE ถ้ายังไม่ได้ตรวจท้อง",
    "อย่ารีบให้กลับถ้ายังไม่ได้คัด peritonitis / obstruction clue"
  );

  actionNow.push(
    "focused abdominal exam",
    "ประเมิน hydration/perfusion",
    "reassess for surgical abdomen",
    "observe / surgical consult / ER escalation if red flags"
  );

  medicationClassSuggestions.push(
    "oral/IV fluid as indicated",
    "antiemetic only if clinically appropriate",
    "analgesia with reassessment"
  );

  if (hasAny(text, ["guarding", "rebound", "peritonitis"])) redFlags.push("peritoneal signs");
  if (hasAny(text, ["rlq"])) redFlags.push("focal RLQ pain");
  if (hasAny(text, ["bilious", "น้ำดี", "เขียว"])) redFlags.push("possible obstruction clue");
  if (hasAny(text, ["ท้องอืด", "distension"])) redFlags.push("distension");
  if (hasAny(text, ["ปวดมาก", "severe pain"])) redFlags.push("severe abdominal pain");

  if (redFlags.length > 0) {
    dispositionHints.push("ER/surgical evaluation should be considered");
  } else {
    dispositionHints.push("reassess after focused exam and hydration status");
  }

  return {
    id: "abdominal-pain-vomiting",
    label: "Abdominal pain / Vomiting",
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
      "thai-peds-acute-febrile-illness",
    ],
  };
}
