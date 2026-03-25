import { AssistCardResult, ParsedCaseFact, hasAny, uniq } from "../cardTypes";

const TRIGGERS = [
  "ไอ",
  "เสมหะ",
  "น้ำมูก",
  "คัดจมูก",
  "wheeze",
  "wheezing",
  "rhonchi",
  "rhonchus",
  "เสียงวี้ด",
  "ventolin",
  "salbutamol",
  "neb",
  "nebulization",
  "พ่นยา",
  "bronchiolitis",
  "bronchitis",
];

export function shouldShowUriWheezeCard(input: ParsedCaseFact) {
  const text = input.normalizedText;
  return (
    hasAny(text, TRIGGERS) ||
    !!input.facts?.cough ||
    !!input.facts?.wheeze ||
    !!input.facts?.rhonchi
  );
}

export function buildUriWheezeCard(input: ParsedCaseFact): AssistCardResult {
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

  if (hasAny(text, ["ไอ"]) || input.facts?.cough) {
    documented.push("มีไอ");
    whyShown.push("พบอาการไอ");
  }
  if (hasAny(text, ["เสมหะ"]) || input.facts?.sputum) {
    documented.push("มีเสมหะ");
    whyShown.push("พบเสมหะ");
  }
  if (hasAny(text, ["น้ำมูก", "คัดจมูก"]) || input.facts?.runnyNose) {
    documented.push("มีอาการทางจมูก");
  }
  if (hasAny(text, ["rhonchi", "rhonchus"]) || input.facts?.rhonchi) {
    documented.push("มี rhonchi");
    whyShown.push("พบ lower airway clue");
  }
  if (hasAny(text, ["wheeze", "wheezing", "เสียงวี้ด"]) || input.facts?.wheeze) {
    documented.push("มี wheeze");
    whyShown.push("พบ wheeze");
  }
  if (hasAny(text, ["ventolin", "salbutamol", "neb", "nebulization", "พ่นยา"])) {
    documented.push("มีการ trial bronchodilator/nebulization");
    whyShown.push("มีข้อมูลการพ่นยา");
  }
  if (input.facts?.fever || hasAny(text, ["ไข้"])) {
    documented.push("มีประวัติไข้");
  }

  if (input.facts?.rr == null) missing.push("RR");
  if (input.facts?.spo2 == null) missing.push("SpO2");
  if (
    input.facts?.retraction == null &&
    !hasAny(text, ["retraction", "chest indrawing", "อกบุ๋ม"])
  ) {
    missing.push("work of breathing / retraction");
  }
  if (!hasAny(text, ["feeding", "กินได้", "กินน้อย", "เล่นได้", "activity"])) {
    missing.push("feeding / activity");
  }

  checkNext.push(
    "ฟังปอดซ้ำ",
    "ประเมิน RR",
    "วัด SpO2",
    "ดู retraction / nasal flaring",
    "ถาม feeding / activity",
    "ถามไข้กลับหรือไม่"
  );

  const hasLowerAirway =
    !!input.facts?.wheeze ||
    !!input.facts?.rhonchi ||
    hasAny(text, ["wheeze", "wheezing", "rhonchi", "rhonchus", "เสียงวี้ด"]);

  const hasUriPattern =
    (hasAny(text, ["น้ำมูก", "คัดจมูก"]) || !!input.facts?.runnyNose) &&
    !hasLowerAirway;

  if (hasUriPattern) diagnosis.push("Viral URI");
  if (hasLowerAirway && hasAny(text, ["ไอ", "เสมหะ"])) diagnosis.push("Acute bronchitis");
  if (hasLowerAirway) diagnosis.push("Bronchiolitis / viral-induced wheeze");
  diagnosis.push("Pneumonia less likely unless fever/tachypnea/hypoxemia/focal findings");

  avoidRoutine.push(
    "ไม่ควรแนะนำ antibiotic routine ใน simple viral URI",
    "ไม่ควรฟันธง pneumonia ถ้ายังไม่มี fever/tachypnea/hypoxemia/focal crackles",
    "อย่าเด้ง bronchodilator เป็น routine ถ้าคล้าย bronchiolitis แต่ไม่มีหลักฐานตอบสนอง"
  );

  actionNow.push(
    "ประคับประคองตามอาการ",
    "ประเมิน lower airway signs เพิ่ม",
    "ถ้ามี bronchodilator trial ให้ดู clinical response",
    "ทบทวน diagnosis ใหม่ถ้ามี wheeze/rhonchi/retraction/SpO2 ต่ำ"
  );

  medicationClassSuggestions.push(
    "antipyretic PRN",
    "nasal saline / nasal toilet",
    "bronchodilator trial only if clinically indicated"
  );

  if (input.facts?.spo2 != null && input.facts.spo2 < 95) {
    redFlags.push("SpO2 ต่ำ");
  }
  if (input.facts?.retraction || hasAny(text, ["retraction", "อกบุ๋ม"])) {
    redFlags.push("มี increased work of breathing");
  }
  if (hasAny(text, ["ซึม", "กินไม่ได้", "กินน้อยมาก"])) {
    redFlags.push("general condition แย่ลง");
  }

  if (redFlags.length > 0) {
    dispositionHints.push("พิจารณา observe / ER escalation ตาม severity");
  } else {
    dispositionHints.push("ติดตามอาการและ return precautions");
  }

  return {
    id: "uri-wheeze",
    label: "URI / Cough / Wheeze",
    severity: redFlags.length > 0 ? "warn" : "info",
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
      "thai-peds-respiratory-infections-2019",
      "thai-peds-bronchiolitis",
      "thai-peds-viral-induced-wheeze",
      "thai-rdu-hospital-manual",
    ],
  };
}
