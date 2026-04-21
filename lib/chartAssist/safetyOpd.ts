import type { AssistMode, SafetySweep } from "./cardTypes";
import { hasAny } from "./cardTypes";
import type { CaseType } from "./cardTypes";
import type { CaseClinicalProfile } from "./caseClinicalProfile";
import { buildSafetySweep } from "./safetyEngine";

/** แสดง/เก็บ safety letter เฉพาะเมื่อมีข้อบ่งชี้หรือมีข้อมูลบันทึกแล้ว — ลด noise ใน OPD */
function letterHasOpdTrigger(
  label: string,
  t: string,
  caseType: CaseType,
): boolean {
  switch (label) {
    case "A":
      return hasAny(t, [
        "stridor",
        "airway",
        "ทางเดินหายใจ",
        "สำลัก",
        "choking",
        "พูดไม่ได้",
        "voice",
        "obstruction",
        "หายใจลำบากมาก",
      ]);
    case "B":
      return hasAny(t, [
        "cough",
        "ไอ",
        "wheeze",
        "rhonchi",
        "spo2",
        "o2",
        "rr ",
        "resp",
        "lung",
        "หอบ",
        "breath sound",
        "crackles",
        "ปอด",
      ]);
    case "C":
      return hasAny(t, [
        "bleed",
        "bleeding",
        "เลือด",
        "dehydrat",
        "shock",
        "ช็อก",
        "hypotension",
        "bp ",
        "ความดัน",
        "hr ",
        "pulse",
        "crt",
        "perfusion",
        "cap refill",
        "tachycardia",
        "ชีพจร",
      ]);
    case "D":
      return hasAny(t, [
        "gcs",
        "avpu",
        "seizure",
        "ชัก",
        "ซึม",
        "pupil",
        "รูม่านตา",
        "neuro",
        "focal",
        "ชา",
      ]);
    case "E":
      return caseType === "trauma" || hasAny(t, ["exposure", "mechanism", "แผลกว้าง", "เย็บแผล"]);
    default:
      return true;
  }
}

export function buildConditionalSafetySweep(
  normalizedText: string,
  mode: AssistMode,
  profile: CaseClinicalProfile,
): SafetySweep {
  const base = buildSafetySweep(normalizedText, mode);
  const t = normalizedText;

  if (mode === "TRAUMA" || mode === "ER" || mode === "PSYCH" || profile.hasSystemicRedFlags) {
    return base;
  }

  const items = base.items.filter((item) => {
    if (item.documented.length > 0) return true;
    return letterHasOpdTrigger(item.label, t, profile.caseType);
  });

  if (items.length === 0) {
    return { framework: base.framework, items: [] };
  }

  return { ...base, items };
}
