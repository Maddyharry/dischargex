/**
 * LABOR_ROOM — labor pain / labor evaluation overlay (rule layer).
 * Surfaces obstetric triage content; does not replace institutional L&D protocol.
 */
import type { AssistMode } from "./cardTypes";
import { hasAnyKeywordNonNegated, scoreKeysNegationAware } from "./clinicalNegation";
import type { OpdProblemPackId } from "./opdProblemPacks";
import type { VisitModeReasonCode } from "./triggers";

export const LABOR_EVALUATION_TRIGGER_KEYS = [
  "labor",
  "labour",
  "contraction",
  "uterine contraction",
  "latent labor",
  "active labor",
  "false labor",
  "braxton",
  "cervical exam",
  "cervix",
  "dilation",
  "effacement",
  "ตัวคลอด",
  "ปวดคลอด",
  "เปิดปากมดลูก",
  "คลอด",
  "ห้องคลอด",
  "labor room",
  "intrapartum",
  "ส่งครรภ์",
  "เจ็บครรภ์",
  "ครรภ์ครบกำหนด",
];

const URGENT_PATHWAY_KEYS = [
  "vaginal bleeding",
  "heavy bleeding",
  "ante partum",
  "antepartum bleeding",
  "aph",
  "abruption",
  "previa",
  "เลือดออก",
  "reduced fetal movement",
  "decreased fetal movement",
  "absent fetal movement",
  "no fetal movement",
  "fetal movement reduced",
  "ลูกดิ้นน้อย",
  "ไม่ดิ้น",
  "ลูกไม่ดิ้น",
  "severe pain",
  "severe abdominal pain",
  "ปวดท้องรุนแรง",
  "hypotension",
  "shock",
  "unstable",
  "unresponsive",
  "tachycardia",
  "ความดันต่ำ",
  "ช็อก",
];

const SURFACE_EARLY: string[] = [
  "Pregnancy status — document in obGynePregnancyStatus (not only in PI).",
  "Gestational age — obGyneGestationalAge (weeks+days or best estimate).",
  "Parity / gravidity — include prior cesarean or classical scar when relevant.",
  "Contraction pattern — frequency, duration, intensity trend.",
  "Membrane status — intact / ROM, time, fluid color if known.",
  "Vaginal bleeding — quantify; link to obGyneBleedingSeverity.",
  "Fetal movement — maternal report; reduced/absent as red flag.",
  "Maternal vitals — BP, HR, RR, T, SpO₂ as available.",
  "Fetal status — FHR / CTG category if documented (no invention).",
];

const ASK_NEXT: string[] = [
  "Pregnancy status & gestational age (LMP / US / EDD)",
  "Parity, gravidity, prior cesarean / uterine surgery",
  "Contraction frequency, duration, and change over time",
  "Membrane rupture — time, fluid amount/color",
  "Vaginal bleeding — amount, pads, clots",
  "Fetal movement compared to baseline",
  "Prenatal care location / GBS / Rh / complications",
  "Pain location and severity; rule out non-labor causes if atypical",
];

const EXAM_NEXT: string[] = [
  "Maternal vitals — BP, HR, RR, temperature, SpO₂",
  "Uterine activity — palpation / tocography per protocol",
  "Fetal heart rate / CTG when indicated",
  "Bleeding assessment if present — quantify",
  "Cervical exam — when protocol allows (dilation, effacement, station)",
  "Maternal assessment for preeclampsia if headache/visual/epigastric/BP concern",
];

const CLINICAL_RULES: string[] = [
  "Labor-room notes must not read like URI or generic OPD (CC/PI as the only frame without obstetric structured fields).",
  "obGyneDisposition must be explicit — e.g. latent labor / active labor / observe / urgent OB review / refer / L&D admit / transfer — match local workflow.",
  "If vaginal bleeding, absent or reduced fetal movement, severe or atypical pain, or unstable maternal vitals — document urgent obstetric pathway and escalation (not expectant OPD disposition alone).",
];

const DISPOSITION_HINTS: string[] = [
  "latent labor — expectant / education / reassess",
  "active labor — admit L&D or equivalent per protocol",
  "observe — short-stay monitoring with clear reassessment triggers",
  "urgent OB review — concerning features; document handoff",
  "refer — higher-level unit if indicated",
];

export type LaborRoomLaborEvaluationOverlay =
  | { active: false }
  | {
      active: true;
      activationRationale: string[];
      surfaceEarly: string[];
      askNext: string[];
      examNext: string[];
      clinicalRules: string[];
      dispositionHints: string[];
      urgentPathwayLikely: boolean;
      urgentPathwayMatched: string[];
    };

function hasLaborEvaluationTrigger(normalizedText: string): boolean {
  return scoreKeysNegationAware(normalizedText, LABOR_EVALUATION_TRIGGER_KEYS) >= 1;
}

function matchUrgentPathway(normalizedText: string): string[] {
  const t = normalizedText;
  const out: string[] = [];
  const add = (cond: boolean, label: string) => {
    if (cond) out.push(label);
  };
  add(
    hasAnyKeywordNonNegated(t, [
      "vaginal bleeding",
      "heavy bleeding",
      "antepartum bleeding",
      "ante partum",
      "aph",
      "abruption",
      "previa",
      "เลือดออก",
      "bleeding in pregnancy",
    ]),
    "bleeding in pregnancy / APH concern",
  );
  add(
    hasAnyKeywordNonNegated(t, [
      "reduced fetal movement",
      "decreased fetal movement",
      "absent fetal movement",
      "no fetal movement",
      "ลูกดิ้นน้อย",
      "ไม่ดิ้น",
      "ลูกไม่ดิ้น",
    ]),
    "reduced or absent fetal movement",
  );
  add(
    hasAnyKeywordNonNegated(t, ["severe pain", "severe abdominal pain", "worst pain", "ปวดท้องรุนแรง", "ปวดมาก"]),
    "severe pain",
  );
  add(
    hasAnyKeywordNonNegated(t, ["hypotension", "shock", "unstable vitals", "unresponsive", "tachycardia", "ความดันต่ำ", "ช็อก"]),
    "maternal hemodynamic instability",
  );
  return [...new Set(out)];
}

export function buildLaborRoomLaborEvaluationOverlay(
  normalizedText: string,
  mode: AssistMode,
  visitReason: VisitModeReasonCode,
  activePackIds: readonly OpdProblemPackId[],
): LaborRoomLaborEvaluationOverlay {
  if (mode !== "LABOR_ROOM") {
    return { active: false };
  }

  const packHit = activePackIds.includes("lr_labor_evaluation");
  const visitHit = visitReason === "labor_room_presentation";
  const keywordHit = hasLaborEvaluationTrigger(normalizedText);
  if (!packHit && !visitHit && !keywordHit) {
    return { active: false };
  }

  const urgentMatched = matchUrgentPathway(normalizedText);
  const urgentKeywords = scoreKeysNegationAware(normalizedText, URGENT_PATHWAY_KEYS) >= 2;
  const urgentPathwayLikely = urgentMatched.length > 0 || urgentKeywords;

  const rationale: string[] = [];
  rationale.push("Visit mode LABOR_ROOM — labor evaluation overlay");
  if (visitReason === "labor_room_presentation") rationale.push("Visit detection: labor_room_presentation");
  if (activePackIds.includes("lr_labor_evaluation")) rationale.push("Symptom pack matched: lr_labor_evaluation");
  if (urgentPathwayLikely) {
    rationale.push("Text supports urgent obstetric pathway — explicit disposition and escalation");
  }

  return {
    active: true,
    activationRationale: rationale,
    surfaceEarly: [...SURFACE_EARLY],
    askNext: [...ASK_NEXT],
    examNext: [...EXAM_NEXT],
    clinicalRules: [...CLINICAL_RULES],
    dispositionHints: [...DISPOSITION_HINTS],
    urgentPathwayLikely,
    urgentPathwayMatched: urgentMatched,
  };
}

export function formatLaborRoomLaborEvaluationOverlayForAi(o: LaborRoomLaborEvaluationOverlay): string {
  if (!o.active) return "(LABOR_ROOM_LABOR_EVALUATION_OVERLAY inactive)";
  const lines = [
    "=== LABOR ROOM — LABOR PAIN / LABOR EVALUATION (overlay) ===",
    o.urgentPathwayLikely
      ? "URGENCY: Favor explicit urgent OB pathway language in obGyneDisposition and obGyneTriageSummary when bleeding, absent/reduced FM, severe pain, or unstable vitals are present."
      : "",
    "",
    "Surface early (structured keys + triage summary):",
    ...o.surfaceEarly.map((x) => `- ${x}`),
    "",
    "Ask next:",
    ...o.askNext.map((x) => `- ${x}`),
    "",
    "Examine next:",
    ...o.examNext.map((x) => `- ${x}`),
    "",
    "Clinical rules:",
    ...o.clinicalRules.map((x) => `- ${x}`),
    "",
    "Disposition vocabulary (examples — align with local protocol):",
    ...o.dispositionHints.map((x) => `- ${x}`),
    "",
    "Urgent pathway — patterns suggested by text:",
    ...(o.urgentPathwayMatched.length
      ? o.urgentPathwayMatched.map((x) => `- ${x}`)
      : ["- (none strongly flagged — still complete GA, vitals, FM, bleeding, contractions)"]),
    "",
    "Activation rationale:",
    ...o.activationRationale.map((x) => `- ${x}`),
  ].filter((line) => line !== "");
  return lines.join("\n");
}
