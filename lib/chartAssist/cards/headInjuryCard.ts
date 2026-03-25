import { AssistCardResult, ParsedCaseFact, hasAny, uniq } from "../cardTypes";

const TRIGGERS = [
  "หัวกระแทก",
  "ศีรษะกระแทก",
  "head injury",
  "head trauma",
  "ล้ม",
  "อุบัติเหตุ",
  "ซึม",
  "อาเจียน",
  "หมดสติ",
  "loss of consciousness",
  "ชัก",
  "seizure",
  "ปวดหัว",
  "แผลศีรษะ",
];

export function shouldShowHeadInjuryCard(input: ParsedCaseFact) {
  const text = input.normalizedText;
  return (
    hasAny(text, TRIGGERS) ||
    !!input.facts?.headInjury ||
    (!!input.facts?.drowsy && !!input.facts?.vomiting)
  );
}

export function buildHeadInjuryCard(input: ParsedCaseFact): AssistCardResult {
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

  if (hasAny(text, ["หัวกระแทก", "ศีรษะกระแทก", "head injury", "head trauma"]) || input.facts?.headInjury) {
    documented.push("มี head injury / trauma");
    whyShown.push("พบ head trauma");
  }
  if (hasAny(text, ["ซึม"]) || input.facts?.drowsy) {
    documented.push("มี altered mental status / drowsiness");
    whyShown.push("พบ drowsiness");
  }
  if (hasAny(text, ["อาเจียน"]) || input.facts?.vomiting) {
    documented.push(
      input.facts?.vomitingCount != null
        ? `อาเจียน ${input.facts.vomitingCount} ครั้ง`
        : "มีอาเจียน"
    );
    whyShown.push("มี post-trauma vomiting");
  }
  if (hasAny(text, ["หมดสติ", "loss of consciousness"]) || input.facts?.loc) {
    documented.push("มี/สงสัย LOC");
    whyShown.push("มี LOC clue");
  }
  if (hasAny(text, ["ชัก", "seizure"]) || input.facts?.seizure) {
    documented.push("มี seizure");
    whyShown.push("มี seizure clue");
  }
  if (input.facts?.gcs != null) {
    documented.push(`GCS ${input.facts.gcs}`);
  }
  if (input.facts?.pupilChecked) {
    documented.push(
      input.facts?.pupilsAbnormal ? "pupil abnormal" : "pupil checked"
    );
  }

  if (input.facts?.gcs == null && !hasAny(text, ["gcs", "avpu"])) missing.push("GCS / AVPU");
  if (!input.facts?.pupilChecked && !hasAny(text, ["pupil", "รูม่านตา"])) missing.push("pupils");
  if (input.facts?.vomitingCount == null && hasAny(text, ["อาเจียน"])) missing.push("vomiting count");
  if (!hasAny(text, ["หมดสติ", "loss of consciousness"])) missing.push("LOC history");
  if (!hasAny(text, ["mechanism", "ตกจาก", "ชน", "ความสูง", "รถ", "แรงกระแทก"])) {
    missing.push("mechanism severity");
  }
  if (!hasAny(text, ["focal", "แขนขาอ่อนแรง", "neuro deficit"])) {
    missing.push("focal neurological deficit");
  }
  if (!hasAny(text, ["skull fracture", "กะโหลก", "แผลศีรษะ", "hematoma"])) {
    missing.push("skull fracture signs / scalp findings");
  }

  checkNext.push(
    "ประเมิน ABC ก่อน",
    "บันทึก GCS/AVPU",
    "ตรวจ pupils",
    "นับ vomiting count",
    "ถาม LOC และ mechanism",
    "ตรวจ neuro deficit / skull signs"
  );

  diagnosis.push(
    "Head injury with red flags",
    "Concussion",
    "Clinically important traumatic brain injury cannot be excluded"
  );

  avoidRoutine.push(
    "ไม่ควรรีบ finalize เป็น mild head injury ถ้ายังไม่มี GCS/pupils/vomiting count/mechanism",
    "อย่ารีบ discharge ถ้ายังมี drowsiness / repeated vomiting / abnormal neuro findings"
  );

  actionNow.push(
    "ABC first",
    "neuro observation",
    "CT / referral decision support",
    "senior review / transfer consideration if red flags present"
  );

  if (hasAny(text, ["ซึม"]) || input.facts?.drowsy) redFlags.push("drowsiness");
  if ((input.facts?.vomitingCount ?? 0) >= 2) redFlags.push("repeated vomiting");
  if (input.facts?.gcs != null && input.facts.gcs < 15) redFlags.push("GCS < 15");
  if (input.facts?.pupilsAbnormal) redFlags.push("abnormal pupils");
  if (hasAny(text, ["ชัก", "seizure"]) || input.facts?.seizure) redFlags.push("post-traumatic seizure");
  if (hasAny(text, ["แขนขาอ่อนแรง", "focal deficit"])) redFlags.push("focal neurological deficit");

  if (redFlags.length > 0) {
    dispositionHints.push("observe / image / admit / refer according to risk");
  } else {
    dispositionHints.push("continue observation if history still incomplete");
  }

  return {
    id: "head-injury",
    label: "Head injury",
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
      "thai-head-injury-traumatic-patients",
      "thai-head-injury-transfer",
      "nice-head-injury-ct-1h",
    ],
  };
}
