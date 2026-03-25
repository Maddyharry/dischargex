import type { AssistMode } from "./cardTypes";
import { hasAny } from "./cardTypes";

const TRAUMA_KEYS = [
  "หัวกระแทก",
  "ศีรษะกระแทก",
  "head trauma",
  "อุบัติเหตุ",
  "แรงกระแทก",
  "mva",
  "ชน",
  "trauma",
];

const ER_KEYS = [
  "ซึม",
  "หมดสติ",
  "ชัก",
  "หอบ",
  "shock",
  "sepsis",
  "bp ต่ำ",
  "hypotension",
  "spo2",
  "ถ่ายเป็นเลือด",
  "bloody",
  "อาเจียนซ้ำ",
  "severe pain",
  "ปวดมาก",
  "ไข้สูง",
  "ช็อก",
];

export function detectAssistMode(
  normalizedText: string,
  override: AssistMode | null
): AssistMode {
  if (override) return override;
  const t = normalizedText;
  if (hasAny(t, TRAUMA_KEYS)) return "TRAUMA";
  if (hasAny(t, ER_KEYS)) return "ER";
  return "OPD";
}
