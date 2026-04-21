import {
  AssistCardResult,
  ParsedCaseFact,
  hasAny,
  uniq,
} from "../cardTypes";
import {
  computeSystemicRedFlags,
  looksLikeUncomplicatedUriOpd,
} from "../caseClinicalProfile";

const TOXICITY_TRIGGERS = [
  "ซึม",
  "ช็อก",
  "shock",
  "sepsis",
  "septic",
  "poor perfusion",
  "cap refill",
  "crt ",
  "crt:",
  "bp ต่ำ",
  "hypotension",
  "ไม่กิน",
  "ปัสสาวะน้อย",
  "tachycardia",
  "หมดสติ",
  "ชัก",
];

/**
 * แสดงเฉพาะเมื่อมีไข้/พิษระบบจริงหรือไข้ไม่มีโฟกัส — ไม่ใช่ทุกเคส URI ที่มีไข้
 */
export function shouldShowFeverSepsisCard(input: ParsedCaseFact): boolean {
  const text = input.normalizedText;
  const dominant = input.dominantTheme ?? "unclear";
  const caseType = input.caseType ?? "general";
  const red = input.hasSystemicRedFlags ?? computeSystemicRedFlags(text);

  if (dominant === "skin_rash" && !red) return false;
  if (caseType === "dermatology" && !red) return false;
  if (looksLikeUncomplicatedUriOpd(text)) return false;

  const febrile =
    hasAny(text, ["ไข้", "ไข้สูง", "fever", "febrile"]) ||
    !!input.facts?.fever ||
    !!input.facts?.drowsy;

  const strongToxicity = hasAny(text, TOXICITY_TRIGGERS) || red;

  if (!febrile && !strongToxicity) return false;

  if (strongToxicity) return true;

  if (caseType === "fever_without_focus" && febrile) return true;

  if (input.mode === "ER" && febrile && (strongToxicity || hasAny(text, ["ซึม", "ไม่กิน", "ปัสสาวะน้อย"]))) {
    return true;
  }

  if (input.mode === "OPD" || input.mode === "PSYCH") {
    return (
      febrile &&
      (strongToxicity ||
        hasAny(text, [
          "ซึม",
          "ไม่กิน",
          "ปัสสาวะน้อย",
          "shock",
          "sepsis",
          "bp ต่ำ",
          "cap refill",
          "perfusion",
        ]))
    );
  }

  return false;
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

  const systemicConcern =
    (input.hasSystemicRedFlags ?? computeSystemicRedFlags(text)) ||
    hasAny(text, TOXICITY_TRIGGERS);

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
  );

  if (systemicConcern) {
    diagnosis.push("Acute febrile illness with systemic concern — ประเมินแหล่งและความรุนแรง");
    diagnosis.push("พิจารณา sepsis/shock เมื่อมีภาวะ perfusion หรือ neuro ผิดปกติ (ตามหลักฐาน)");
    checkNext.push("ชั่งน้ำหนัก / ให้ fluid ตามดุลยพินิจ");
    actionNow.push("ประเมิน ABCD และ perfusion");
    actionNow.push("หา source ของ infection");
    actionNow.push("พิจารณา escalate / ER ถ้ามีข้อบ่งชี้");
    medicationClassSuggestions.push(
      "antipyretic PRN",
      "fluid resuscitation if clinically indicated",
      "antimicrobial only after syndrome/source assessment",
    );
  } else {
    diagnosis.push("Febrile illness — ควรหา source และระดับความรุนแรงก่อนสรุปภาวะรุนแรง");
    avoidRoutine.push("หลีกเลี่ยงการติดป้าย sepsis/shock หากยังไม่มีหลักฐาน perfusion หรือ toxicity");
    actionNow.push("เก็บ vital และประวัติให้ครบ");
    actionNow.push("ติดตามอาการตามความเหมาะสมใน OPD");
    medicationClassSuggestions.push("antipyretic PRN ตามดุลยพินิจ");
  }

  avoidRoutine.push(
    "อย่าลดระดับความรุนแรงก่อนมี HR/BP/CRT/mental status เมื่อสงสัยพิษระบบ",
  );

  if ((input.facts?.crtSec ?? 0) > 2) redFlags.push("CRT prolonged");
  if (hasAny(text, ["bp ต่ำ", "hypotension"])) redFlags.push("hypotension");
  if (hasAny(text, ["ซึม"]) || input.facts?.drowsy) redFlags.push("altered mental status");
  if (hasAny(text, ["ช็อก", "shock"])) redFlags.push("shock concern");
  if (hasAny(text, ["ปัสสาวะน้อย"])) redFlags.push("poor urine output");

  if (redFlags.length > 0) {
    dispositionHints.push("พิจารณา escalate / สังเกตอาการใกล้ชิดตามความรุนแรง");
  } else {
    dispositionHints.push("ติดตามใน OPD หากคงที่และไม่มี red flag");
  }

  const label = systemicConcern ? "Fever / systemic concern" : "Fever — clarify source & severity";

  return {
    id: "fever-sepsis",
    label,
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
