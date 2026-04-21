/**
 * Thai OPD Assist — TRAUMA documentation framework (mechanism-first, survey-first).
 */
import { anyNonNegatedRegexMatch, scoreKeysNegationAware } from "./clinicalNegation";
import type { AssistMode } from "./cardTypes";
import { TRAUMA_VISIT_DETECTION_KEYS } from "./triggers";

export type TraumaOpdFramework =
  | {
      active: true;
      factsAlreadyPresent: string[];
      historyAskNext: string[];
      examFocusNext: string[];
      importantNegatives: string[];
      reasoningRules: string[];
    }
  | { active: false };

const HISTORY_TH: string[] = [
  "mechanism — แรง/ทิศทาง/ระยะ/ความเร็ว",
  "time of injury — เมื่อไร",
  "loss of consciousness — มี/ไม่มี นานเท่าไร",
  "vomiting หลังบาดเจ็บ",
  "seizure",
  "pain — ตำแหน่ง / ลักษณะ / ระดับ",
  "ambulation / weight bearing — เดินได้หรือไม่",
  "bleeding — ปริมาณ / หยุดหรือไม่",
  "helmet / seatbelt / airbag",
  "alcohol / substance",
  "anticoagulant / antiplatelet",
];

const EXAM_TH: string[] = [
  "airway / c-spine consideration",
  "breathing — RR, lung sounds, ซี่โครง",
  "circulation — BP, HR, bleeding control",
  "GCS / pupils — disability",
  "exposure — เปิดดูครบ อุณหภูมิ",
  "head / face / neck — ช้ำ, step-off, ลำคอ",
  "chest — flail, เสียงลม",
  "abdomen — tenderness, rebound, seatbelt sign",
  "pelvis — stability",
  "extremities — deformity, ROM",
  "tenderness / deformity / open wound",
  "neurovascular status — pulse, cap refill, sensation, motor",
  "wound — ขนาด, depth, contamination",
];

const NEGATIVES_TH: string[] = [
  "ไม่มี LOC — ถ้าไม่มีให้บันทึก",
  "ไม่มี vomiting — ถ้าไม่มีให้บันทึก",
  "ไม่มี neck tenderness / midline tenderness — ถ้าตรวจแล้วไม่มี",
  "ไม่มี abdominal tenderness peritonitis — ถ้าตรวจแล้วไม่มี",
  "ไม่มี distal neurovascular deficit — ถ้าตรวจแล้วไม่มี",
  "ไม่มี open fracture — ถ้าไม่มีให้บันทึก",
];

const REASONING_TH: string[] = [
  "บันทึกแบบ trauma — ไม่เรียงเหมือน OPD routine follow-up ล้วนๆ",
  "จัดลำดับตามภัยต่อชีวิตก่อน — airway/hemorrhage/ทรวงอก/ศีรษะ ตามบริบท",
  "หลัง primary/secondary survey ค่อย problem list — ไม่รวม mechanism กับ survey เข้าประโยคเดียวโดยไม่มีโครง",
  "หลายบาดเจ็บ — แยกเป็นหลายประเด็นใน problem list",
];

function extractFacts(normalized: string): string[] {
  const t = normalized;
  const out: string[] = [];
  const add = (ok: boolean, line: string) => {
    if (ok) out.push(line);
  };
  add(anyNonNegatedRegexMatch(t, /rta|mva|motor vehicle|อุบัติเหตุ|ชน|แรงกระแทก|fall|ล้ม|trauma/i), "มีการกล่าวถึงกลไก/อุบัติเหตุ");
  add(anyNonNegatedRegexMatch(t, /helmet|seat\s*belt|airbag|หมวกกันน็อค|เข็มขัด/i), "มีการกล่าวถึง helmet/seatbelt/airbag");
  add(anyNonNegatedRegexMatch(t, /loc|loss of consciousness|หมดสติ|ซึม/i), "มีการกล่าวถึง LOC/สติ");
  add(anyNonNegatedRegexMatch(t, /gcs|pupil|ชัก|seizure/i), "มีการกล่าวถึง GCS/neuro/ชัก");
  add(anyNonNegatedRegexMatch(t, /bleed|เลือด|wound|แผล|fracture|หัก/i), "มีการกล่าวถึงเลือด/แผล/กระดูก");
  if (out.length === 0) {
    out.push("มีคีย์เวิร์ด trauma — ระบุ mechanism และ survey ให้ชัด");
  }
  return out.slice(0, 14);
}

export function detectTraumaOpdFrameworkActive(normalizedText: string, visitMode: AssistMode): boolean {
  if (visitMode === "TRAUMA") return true;
  return scoreKeysNegationAware(normalizedText, [...TRAUMA_VISIT_DETECTION_KEYS]) >= 1;
}

export function buildTraumaOpdFramework(normalizedText: string, visitMode: AssistMode): TraumaOpdFramework {
  if (!detectTraumaOpdFrameworkActive(normalizedText, visitMode)) {
    return { active: false };
  }
  return {
    active: true,
    factsAlreadyPresent: extractFacts(normalizedText),
    historyAskNext: [...HISTORY_TH],
    examFocusNext: [...EXAM_TH],
    importantNegatives: [...NEGATIVES_TH],
    reasoningRules: [...REASONING_TH],
  };
}

export function formatTraumaFrameworkForAi(f: TraumaOpdFramework): string {
  if (!f.active) return "(TRAUMA_FRAMEWORK inactive)";
  return [
    "=== TRAUMA (mechanism-first / survey-first) ===",
    "Facts already present:",
    ...f.factsAlreadyPresent.map((x) => `- ${x}`),
    "",
    "History to ask / clarify:",
    ...f.historyAskNext.map((x) => `- ${x}`),
    "",
    "Exam focus:",
    ...f.examFocusNext.map((x) => `- ${x}`),
    "",
    "Important negatives to document if absent:",
    ...f.importantNegatives.map((x) => `- ${x}`),
    "",
    "Reasoning rules:",
    ...f.reasoningRules.map((x) => `- ${x}`),
  ].join("\n");
}
