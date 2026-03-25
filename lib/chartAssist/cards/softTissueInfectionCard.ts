import { AssistCardResult, ParsedCaseFact, hasAny, uniq } from "../cardTypes";

const TRIGGERS = [
  "cellulitis",
  "abscess",
  "ฝี",
  "แผล",
  "หนอง",
  "บวมแดง",
  "แดงลาม",
  "กัด",
  "bite",
  "dog bite",
  "cat bite",
  "wound",
  "pus",
  "swelling",
];

export function shouldShowSoftTissueInfectionCard(input: ParsedCaseFact) {
  const text = input.normalizedText;
  return hasAny(text, TRIGGERS);
}

export function buildSoftTissueInfectionCard(input: ParsedCaseFact): AssistCardResult {
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

  if (hasAny(text, ["แผล", "wound"])) {
    documented.push("มี wound/skin lesion");
    whyShown.push("พบแผล/skin lesion");
  }
  if (hasAny(text, ["ฝี", "abscess", "หนอง", "pus"])) {
    documented.push("สงสัย abscess / pus");
    whyShown.push("พบ abscess clue");
  }
  if (hasAny(text, ["บวมแดง", "แดงลาม", "cellulitis", "swelling"])) {
    documented.push("มี cellulitis / soft tissue inflammation");
    whyShown.push("พบ soft tissue infection clue");
  }
  if (hasAny(text, ["กัด", "bite", "dog bite", "cat bite"])) {
    documented.push("มี bite wound");
    whyShown.push("พบ bite wound");
  }
  if (input.facts?.fever || hasAny(text, ["ไข้"])) documented.push("มีไข้");

  if (!hasAny(text, ["fluctuance", "คลำได้กดนุ่ม", "abscess"])) {
    missing.push("fluctuance / abscess or not");
  }
  if (!hasAny(text, ["spread", "ลาม", "แดงลาม"])) {
    missing.push("extent / spreading redness");
  }
  if (!hasAny(text, ["joint", "ข้อ", "movement", "ขยับ"])) {
    missing.push("joint involvement / ROM");
  }
  if (!hasAny(text, ["pulse", "cap refill", "ปลายมือปลายเท้า", "neurovascular"])) {
    missing.push("neurovascular status");
  }
  if (!hasAny(text, ["tetanus", "วัคซีนบาดทะยัก"])) {
    missing.push("tetanus history");
  }

  checkNext.push(
    "ดูว่าเป็น cellulitis หรือ abscess",
    "ประเมิน extent / spreading",
    "ดู joint involvement / ROM",
    "ตรวจ neurovascular status",
    "ถาม tetanus history",
    "พิจารณา drainage need ถ้ามี abscess"
  );

  diagnosis.push(
    "Soft tissue infection",
    "Cellulitis",
    "Abscess if fluctuance/pus present",
    "Bite wound needing wound-risk assessment"
  );

  avoidRoutine.push(
    "อย่า treat ทุกก้อนบวมแดงเป็น cellulitis ถ้ายังไม่ได้แยก abscess",
    "อย่าข้าม tetanus history ใน wound/bite case"
  );

  actionNow.push(
    "แยก cellulitis vs abscess",
    "local wound care",
    "consider drainage if abscess",
    "assess need for antibiotic based on syndrome/severity"
  );

  medicationClassSuggestions.push(
    "analgesia",
    "local wound care",
    "antibiotic only when clinically indicated",
    "tetanus-related action if needed"
  );

  if (hasAny(text, ["แดงลาม", "ลามเร็ว", "ปวดมาก"])) redFlags.push("progressive infection concern");
  if (hasAny(text, ["ข้อขยับไม่ได้", "joint", "septic"])) redFlags.push("possible joint involvement");
  if (hasAny(text, ["ซึม"]) || input.facts?.drowsy) redFlags.push("systemic illness concern");

  if (redFlags.length > 0) {
    dispositionHints.push("ER / urgent reassessment depending severity and site");
  } else {
    dispositionHints.push("OPD follow-up if stable and localized");
  }

  return {
    id: "soft-tissue-infection",
    label: "Soft tissue infection / Wound",
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
      "thai-rdu-hospital-manual",
      "thai-trauma-abcde",
    ],
  };
}
