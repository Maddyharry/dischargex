/**
 * Thai OPD Assist — PSYCH documentation framework (safety-first, not URI-style).
 */
import { scoreKeysNegationAware } from "./clinicalNegation";
import type { AssistMode } from "./cardTypes";
import { PSYCH_VISIT_DETECTION_KEYS } from "./triggers";

/** Extra cues for framework activation when visit mode is still OPD */
const PSYCH_FRAMEWORK_EXTRA_KEYS = [
  "depression",
  "depressed",
  "anxiety",
  "panic",
  "insomnia",
  "mood",
  "bipolar",
  "schizo",
  "ptsd",
  "ocd",
  "ซึมเศร้า",
  "วิตกกังวล",
  "นอนไม่หลับ",
  "เครียด",
  "พฤติกรรม",
];

export type PsychOpdFramework =
  | {
      active: true;
      factsAlreadyPresent: string[];
      historyAskNext: string[];
      mentalStatusPrompts: string[];
      riskPrompts: string[];
      importantNegatives: string[];
      reasoningRules: string[];
    }
  | { active: false };

const HISTORY_TH: string[] = [
  "onset and duration",
  "depressive symptoms",
  "anxiety symptoms",
  "insomnia",
  "hallucinations",
  "delusions",
  "suicidal ideation",
  "suicidal plan / intent",
  "self-harm history",
  "homicidal ideation",
  "agitation / violence",
  "substance / alcohol use",
  "medication history (psychotropic)",
  "recent psychosocial stressors",
  "support system",
];

const MSE_TH: string[] = [
  "appearance / behavior",
  "speech",
  "mood / affect",
  "thought process",
  "thought content",
  "perception",
  "orientation / cognition",
  "insight / judgment",
];

const RISK_TH: string[] = [
  "suicide risk",
  "violence risk",
  "psychosis risk",
  "intoxication / withdrawal risk",
  "inability to care for self",
];

const NEGATIVES_TH: string[] = [
  "no current SI — ถ้าไม่มีให้บันทึกเมื่อสอบถามแล้ว",
  "no plan / intent — ถ้าไม่มีให้บันทึก",
  "no HI — ถ้าไม่มีให้บันทึก",
  "no agitation precluding interview — ถ้าไม่มี",
];

const REASONING_TH: string[] = [
  "ไม่เขียนแบบ URI/หวัด — โครง safety-first และ disposition ชัด",
  "ความปลอดภัยก่อน — risk assessment + MSE ก่อนคำแนะนำทั่วไป",
  "ถ้า SI/HI/violence risk สูง — escalate ชัดใน risk section และ plan",
  "หลายประเด็น — แยก problem list; medical vs psychiatric เมื่อมีทั้งคู่",
];

const ALL_PSYCH_KEYS = [...PSYCH_VISIT_DETECTION_KEYS, ...PSYCH_FRAMEWORK_EXTRA_KEYS];

function extractFacts(normalized: string): string[] {
  const t = normalized;
  const out: string[] = [];
  const push = (line: string) => out.push(line);
  if (/suicid|ฆ่าตัว|อยากตาย|self-harm|ทำร้ายตัวเอง/i.test(t)) push("มีการกล่าวถึง self-harm / suicidal risk");
  if (/hallucin|หูแว่ว|หลอน|delusion/i.test(t)) push("มีการกล่าวถึง psychosis spectrum");
  if (/violence|aggressive|ทำร้าย|ตี|ทุบ/i.test(t)) push("มีการกล่าวถึง agitation / violence");
  if (/depress|anxiety|insomnia|ซึม|วิตก|นอนไม่หลับ/i.test(t)) push("มีการกล่าวถึง mood / anxiety / sleep");
  if (out.length === 0) out.push("มีคีย์เวิร์ดจิตเวช/พฤติกรรม — ระบุ HPI และ risk ให้ชัด");
  return out.slice(0, 14);
}

export function detectPsychOpdFrameworkActive(normalizedText: string, visitMode: AssistMode): boolean {
  if (visitMode === "PSYCH") return true;
  return scoreKeysNegationAware(normalizedText, ALL_PSYCH_KEYS) >= 1;
}

export function buildPsychOpdFramework(normalizedText: string, visitMode: AssistMode): PsychOpdFramework {
  if (!detectPsychOpdFrameworkActive(normalizedText, visitMode)) {
    return { active: false };
  }
  return {
    active: true,
    factsAlreadyPresent: extractFacts(normalizedText),
    historyAskNext: [...HISTORY_TH],
    mentalStatusPrompts: [...MSE_TH],
    riskPrompts: [...RISK_TH],
    importantNegatives: [...NEGATIVES_TH],
    reasoningRules: [...REASONING_TH],
  };
}

export function formatPsychFrameworkForAi(f: PsychOpdFramework): string {
  if (!f.active) return "(PSYCH_FRAMEWORK inactive)";
  return [
    "=== PSYCH (safety-first) ===",
    "Facts already present:",
    ...f.factsAlreadyPresent.map((x) => `- ${x}`),
    "",
    "History prompts:",
    ...f.historyAskNext.map((x) => `- ${x}`),
    "",
    "Mental status examination prompts:",
    ...f.mentalStatusPrompts.map((x) => `- ${x}`),
    "",
    "Risk assessment prompts:",
    ...f.riskPrompts.map((x) => `- ${x}`),
    "",
    "Important negatives (when assessed absent):",
    ...f.importantNegatives.map((x) => `- ${x}`),
    "",
    "Reasoning rules:",
    ...f.reasoningRules.map((x) => `- ${x}`),
  ].join("\n");
}
