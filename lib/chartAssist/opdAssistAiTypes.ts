/** Hybrid OPD Assist — AI layer metadata (extends rule-based core). */
import type { AssistMode } from "./cardTypes";
import type { ClinicalInvestigationV1, OpdAssistInvestigationsStatsV1 } from "./clinicalInvestigationV1";
import type { OpdMedicationSafetyFlagsV1, OpdStructuredMedicationLineV1 } from "./medicationSupportLayer";
import type {
  ClinicalConfidenceLevelV1,
  EvidenceSupportItemV1,
} from "./problemEvidenceV1";

export type {
  ClinicalConfidenceLevelV1,
  ClinicalInvestigationV1,
  EvidenceSupportItemV1,
  OpdAssistInvestigationsStatsV1,
  OpdMedicationSafetyFlagsV1,
  OpdStructuredMedicationLineV1,
};

export type OpdAssistAiFallbackReason =
  | "disabled"
  | "no_api_key"
  | "post_check_failed"
  | "parse_error"
  | "request_error";

export type OpdAssistAiPhase1Meta = {
  used: boolean;
  model?: string;
  fallbackReason?: OpdAssistAiFallbackReason;
  warnings?: string[];
};

/** Rough observability for hybrid prompt size (user + system); ~4 chars/token heuristic */
export type OpdAssistPromptStats = {
  userPayloadCharCount: number;
  systemPromptCharCount: number;
  totalCharCount: number;
  approxTokens: number;
  problemBlockCount: number;
  mode: AssistMode;
};

export type OpdAssistAiBundle = {
  /** Full Thai OPD clinical note (CC through advice + per-problem blocks) */
  phase1: OpdAssistAiPhase1Meta;
};

/** One clinical problem — primary first in array */
export type OpdAiProblemJson = {
  /** Stable id from RULE_PROBLEM_BLOCK_IDS — used to align with rule-layer problem order */
  clinicalProblemId?: string;
  role: "primary" | "secondary";
  title: string;
  assessment: string;
  provisionalDiagnosis: string;
  /** 3–5 ranked differentials as bullet text */
  differential: string;
  plan: string;
  askNext: string[];
  examineNext: string[];
  /**
   * AI-assisted structured medication lines when treatment is suggested.
   * suggested = draft / not final prescription; finalized = clinician-confirmed (may still need verification).
   */
  suggestedMedications?: OpdStructuredMedicationLineV1[];
  finalizedMedications?: OpdStructuredMedicationLineV1[];
  /** Populated by rule layer post-check (allergy / duplicate hints) — may merge with model output */
  medicationSafetyFlags?: OpdMedicationSafetyFlagsV1;
  /** Qualitative fit to documented evidence — optional v1 */
  confidenceLevel?: ClinicalConfidenceLevelV1;
  /** Short reasons for uncertainty (gaps, conflict, pending data) */
  uncertaintyReasons?: string[];
  /** Discrete evidence lines; refId may match investigations[].investigationId or clinicalProblemId */
  evidenceSupport?: EvidenceSupportItemV1[];
};

/** ABCDE lines for ER primary survey — English keys; prose in Thai clinical style */
export type ErPrimarySurveyJson = {
  airway: string;
  breathing: string;
  circulation: string;
  disability: string;
  exposure: string;
};

/** Structured risk lines for PSYCH mode export */
export type PsychRiskAssessmentJson = {
  suicidalIdeation: string;
  suicidalPlan: string;
  selfHarmHistory: string;
  homicidalIdeation: string;
  psychosis: string;
  substanceUse: string;
};

/** Structured vaginal / uterine bleeding quantification for OB/GYN notes */
export type ObGyneBleedingSeverityJson = {
  /**
   * none | minimal | light | moderate | heavy | life_threatening | not_applicable | unknown
   * (English token or short Thai label — be consistent within the note)
   */
  level: string;
  /** Pads/hour, clots, estimated blood loss, orthostasis, transfusion — factual; use "—" if unknown */
  quantifiedDetails: string;
};

/**
 * Full JSON from the clinical documentation model.
 * (Name kept for backward compat with "phase1" pipeline.)
 */
export type OpdAiClinicalNoteJson = {
  cc: string;
  pi: string;
  pastHistoryMedsAllergy: string;
  pe: string;
  /** Short problem list line(s) */
  problemList: string;
  problems: OpdAiProblemJson[];
  patientAdvice: string;
  /**
   * When VISIT_MODE is ER — acute ED documentation (also fill cc/pi/pe/problems for compatibility).
   * Omitted in OPD; optional in ER if model returns legacy shape only.
   */
  erTriageConcern?: string;
  erPrimarySurvey?: ErPrimarySurveyJson;
  erImmediateManagement?: string;
  erReassessment?: string;
  erDisposition?: string;
  /**
   * When VISIT_MODE is TRAUMA — mechanism-first, survey-first (not routine OPD).
   */
  traumaMechanism?: string;
  traumaTimeOfInjury?: string;
  traumaPrimarySurvey?: ErPrimarySurveyJson;
  traumaSecondarySurvey?: string;
  traumaFocusedAssessment?: string;
  traumaImagingProcedure?: string;
  traumaPlan?: string;
  traumaDisposition?: string;
  /**
   * When VISIT_MODE is PSYCH — safety-first; not routine URI-style notes.
   */
  psychChiefConcern?: string;
  psychHpi?: string;
  psychRiskAssessment?: PsychRiskAssessmentJson;
  psychMentalStatusExam?: string;
  psychSynthesisAssessment?: string;
  psychPlan?: string;
  psychDispositionReferral?: string;
  /**
   * When VISIT_MODE is LABOR_ROOM or GYNE — triage-first OB/GYN acute documentation (not routine URI-style OPD).
   */
  /** Pregnant / not pregnant / unknown / postpartum / unable to assess — surfaced early in export */
  obGynePregnancyStatus?: string;
  /** GA / EGA or LMP-based estimate — key field; use "—" or unknown when not documented */
  obGyneGestationalAge?: string;
  /** Structured bleeding severity — not narrative-only */
  obGyneBleedingSeverity?: ObGyneBleedingSeverityJson;
  /**
   * Primary pathway token when applicable, e.g. early_pregnancy_bleeding_ectopic_miscarriage |
   * preeclampsia_severe_features | postpartum_urgent_ob | general_labor_obstetric | general_gynecologic_acute | none
   */
  obGyneClinicalPathway?: string;
  obGyneTriageSummary?: string;
  obGyneDisposition?: string;
  /**
   * Structured labs / imaging / ECG / bedside (v1). Optional — omit entirely for legacy model output.
   */
  investigations?: ClinicalInvestigationV1[];
};

/** @deprecated use OpdAiClinicalNoteJson */
export type OpdAiPhase1Json = {
  cc: string;
  pi: string;
  pe: string;
};
