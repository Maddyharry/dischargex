/**
 * Likely-admit bridge — suggests documentation gaps relevant to inpatient handoff / admission narrative.
 * Rule layer only; activates when admission or high-acuity inpatient trajectory is plausible.
 */
import type { AssistMode } from "./cardTypes";
import type { CaseClinicalProfile } from "./caseClinicalProfile";
import { hasAnyKeywordNonNegated } from "./clinicalNegation";
import type { OpdProblemPackId } from "./opdProblemPacks";

const ADMIT_TRAJECTORY_KEYS = [
  "admit",
  "admission",
  "admitted",
  "hospitalize",
  "hospitalise",
  "inpatient",
  "ward",
  "icu",
  "boarder",
  "observation unit",
  "admit to",
  "รับไว้",
  "รับ admit",
  "ส่งเข้า",
  "ส่ง ward",
  "วอร์ด",
  "หอผู้ป่วยใน",
];

export type LikelyAdmitBridge =
  | { active: false }
  | {
      active: true;
      /** Why the bridge fired */
      activationRationale: string[];
      /** Assessments often needed when documenting toward admission — fill if not yet charted */
      suggestedMissingAssessments: string[];
      outputStyleHints: string[];
    };

const INPATIENT_DOC_CHECKLIST: string[] = [
  "Volume / dehydration — PO intake, IV access if needed, I/O or clinical hydration exam (skin, mucosa, orthostasis)",
  "Nutrition / malnutrition risk — weight change, appetite, diet; screening tools if protocol",
  "Urine output — last void, catheter status, oliguria/anuria, fluid balance",
  "Perfusion — BP/MAP, pulses, CRT; lactate or venous gas if sepsis/shock pathway",
  "Mental status — alertness, orientation; GCS if altered",
  "Severity / risk stratification — early warning or severity scores per local protocol where applicable",
  "Admission-oriented labs — CBC, renal/electrolytes, lactate, cultures, coagulation if bleeding risk",
  "Imaging baseline — CXR, CT, US as indicated by working diagnosis before transfer",
];

const STYLE: string[] = [
  "สำหรับ handoff — ระบุสิ่งที่ยังไม่ได้ทำ/รอผล ชัดเจน",
  "ไม่ทับซ้อนกับ disposition สุดท้ายของผู้ประเมิน — เป็น checklist ช่วยบันทึก",
];

export function detectLikelyAdmitBridgeActive(
  normalizedText: string,
  mode: AssistMode,
  profile: CaseClinicalProfile,
  dispositionSuggestions: string[],
  activePackIds: readonly OpdProblemPackId[],
): boolean {
  if (hasAnyKeywordNonNegated(normalizedText, ADMIT_TRAJECTORY_KEYS)) return true;
  if (dispositionSuggestions.some((s) => /admit|ICU|inpatient|psychiatry|obs unit|boarder|วอร์ด|รับไว้/i.test(s))) {
    return true;
  }
  if (
    mode === "ER" &&
    (profile.hasSystemicRedFlags ||
      activePackIds.includes("er_sepsis_shock") ||
      activePackIds.includes("er_dyspnea_hypoxemia") ||
      activePackIds.includes("er_chest_pain") ||
      activePackIds.includes("er_seizure_ams") ||
      activePackIds.includes("er_anaphylaxis"))
  ) {
    return true;
  }
  if (mode === "TRAUMA" && profile.hasSystemicRedFlags) return true;
  return false;
}

function buildRationale(
  normalizedText: string,
  mode: AssistMode,
  profile: CaseClinicalProfile,
  dispositionSuggestions: string[],
  activePackIds: readonly OpdProblemPackId[],
): string[] {
  const out: string[] = [];
  if (hasAnyKeywordNonNegated(normalizedText, ADMIT_TRAJECTORY_KEYS)) {
    out.push("ข้อความมีคำบ่ง admission / inpatient / ICU");
  }
  if (dispositionSuggestions.some((s) => /admit|ICU/i.test(s))) {
    out.push("RULE_DISPOSITION_SUGGESTIONS ชี้ทาง admit / ระดับสูง");
  }
  if (
    mode === "ER" &&
    (activePackIds.includes("er_sepsis_shock") ||
      activePackIds.includes("er_dyspnea_hypoxemia") ||
      activePackIds.includes("er_chest_pain") ||
      activePackIds.includes("er_seizure_ams") ||
      activePackIds.includes("er_anaphylaxis"))
  ) {
    out.push("ER pack สอดคล้องภาวะรุนแรง — บันทึกให้พร้อม handoff");
  }
  if (profile.hasSystemicRedFlags) {
    out.push("มี systemic red-flag context — เน้น perfusion / severity documentation");
  }
  if (out.length === 0) out.push("High-acuity trajectory — เติมรายการตรวจสำหรับ inpatient documentation");
  return out.slice(0, 6);
}

export function buildLikelyAdmitBridge(
  normalizedText: string,
  mode: AssistMode,
  profile: CaseClinicalProfile,
  dispositionSuggestions: string[],
  activePackIds: readonly OpdProblemPackId[],
): LikelyAdmitBridge {
  if (!detectLikelyAdmitBridgeActive(normalizedText, mode, profile, dispositionSuggestions, activePackIds)) {
    return { active: false };
  }
  return {
    active: true,
    activationRationale: buildRationale(normalizedText, mode, profile, dispositionSuggestions, activePackIds),
    suggestedMissingAssessments: [...INPATIENT_DOC_CHECKLIST],
    outputStyleHints: [...STYLE],
  };
}

export function formatLikelyAdmitBridgeForAi(b: LikelyAdmitBridge): string {
  if (!b.active) return "(LIKELY_ADMIT_BRIDGE inactive)";
  return [
    "=== LIKELY-ADMIT DOCUMENTATION BRIDGE (rule) ===",
    "",
    "Activation rationale:",
    ...b.activationRationale.map((x) => `- ${x}`),
    "",
    "Suggested assessments to document if not yet charted (inpatient-relevant):",
    ...b.suggestedMissingAssessments.map((x) => `- ${x}`),
    "",
    "Output style:",
    ...b.outputStyleHints.map((x) => `- ${x}`),
  ].join("\n");
}
