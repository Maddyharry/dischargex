export type ConfidenceTier = "confirmed_from_chart" | "likely_supported" | "suggest_if_documented";

export type TrustLabel =
  | "supported_by_chart"
  | "inferred_from_treatment"
  | "weak_support"
  | "missing_documentation";

export type ExistenceConfidence = "explicit" | "strongly_supported" | "inferred" | "weak";

export type CodingLinkageConfidence = "explicit_linked" | "likely_linked" | "unlinked";

export type EvidenceSource =
  | "physician_dx"
  | "assessment_note"
  | "operative_note"
  | "lab_support"
  | "imaging_support"
  | "medication_support"
  | "discharge_plan";

export interface EvidenceRef {
  source: EvidenceSource | string;
  snippet?: string;
  section?: string;
}

export interface DiagnosisEngineItem {
  text: string;
  icd10?: string;
  icd10_tm?: string;
  icd9_cm?: string;
  role?: "principal" | "comorbidity" | "complication" | "other" | "external_cause";
  confidence: ConfidenceTier;
  evidence: EvidenceRef[];
  trust_label?: TrustLabel;
  existence_confidence?: ExistenceConfidence;
  coding_linkage_confidence?: CodingLinkageConfidence;
  why_not_principal?: string;
  active_treatments_found?: string[];
}

export interface ProcedureEngineItem {
  text: string;
  icd9_cm?: string;
  category?: "or_procedure" | "non_or_procedure" | "unknown";
  confidence: ConfidenceTier;
  evidence: EvidenceRef[];
  trust_label?: TrustLabel;
}

export interface LinkageEdge {
  source: string;
  relation: string;
  target: string;
  confidence: number;
  kind?: "explicit_wording" | "possible_linkage";
}

export interface ConceptNode {
  id: string;
  label: string;
  present: boolean;
  onset: "present_on_admission" | "developed_after_admission" | "unclear";
  evidence_strength: "strong" | "moderate" | "weak";
  active_management: "yes" | "no";
  likely_role: "principal" | "comorbidity" | "complication" | "other" | "external";
  candidate_code_group: "diagnosis" | "procedure" | "symptom_only" | "unsupported";
}

export interface ExtractionLayer {
  admit_date?: string;
  discharge_date?: string;
  discharge_type?: string;
  chief_problem_on_admission?: string;
  final_assessed_conditions?: string[];
  conditions_present_on_admission?: string[];
  conditions_arising_after_admission?: string[];
  symptoms_only?: string[];
  abnormal_labs?: string[];
  procedures?: string[];
  operations?: string[];
  investigations?: string[];
  treatments?: string[];
  discharge_medications?: string[];
  maternal_context?: Record<string, unknown>;
  newborn_context?: Record<string, unknown>;
  injury_context?: Record<string, unknown>;
  evidence_map?: Record<string, EvidenceRef[]>;
}

export interface CaseGraph {
  underlying_diseases?: string[];
  acute_admission_problems?: string[];
  organ_failures?: string[];
  metabolic_derangements?: string[];
  infections?: string[];
  opportunistic_conditions?: string[];
  procedures?: string[];
  resource_intensive_treatments?: string[];
  evidence?: Record<string, unknown>;
}

export interface DrgEstimationLayer {
  status: "estimated";
  disclaimer_th?: string;
  drivers: string[];
  possible_complexity_adders: Array<{
    item: string;
    tier: ConfidenceTier;
    note_th?: string;
  }>;
  audit_warnings: string[];
}

export interface ComplexCaseFallback {
  mode: "complex_case_fallback";
  top_principal_candidates?: string[];
  missing_documentation?: string[];
  possible_combination_categories?: string[];
  active_secondary_candidates?: string[];
  audit_risk_items?: string[];
}

/** คำแนะนำเติมข้อความใน order sheet (รวมผล lab/รังสีในหน้า) เพื่อรองรับรหัส (Pro / Trial) — AdjRW เป็นประมาณการเท่านั้น */
export interface ChartCaptureHint {
  target_diagnosis_text: string;
  target_icd10?: string;
  /** สิ่งที่ยังไม่พอใน input ปัจจุบัน */
  missing_in_input: string[];
  /** ตัวอย่างคำที่มักควรมีใน chart ถ้าต้องการรองรับรหัสนี้ */
  suggested_order_sheet_wording_th?: string;
  suggested_lab_or_imaging?: string[];
  /** ประมาณการผลต่อ AdjRW / complexity — ไม่รับประกัน */
  approx_adjrw_note_th?: string;
  tier: ConfidenceTier;
}

export interface DischargeEnginePayload {
  summary_text?: string;
  admit_date?: string;
  discharge_date?: string;
  principal_diagnosis: DiagnosisEngineItem;
  comorbidities: DiagnosisEngineItem[];
  complications: DiagnosisEngineItem[];
  other_diagnoses: DiagnosisEngineItem[];
  external_causes: DiagnosisEngineItem[];
  procedures_icd9: ProcedureEngineItem[];
  investigations?: string[];
  treatments?: string[];
  home_medications?: string[];
  drg_estimation: DrgEstimationLayer;
  /** Pro / Trial: แนะนำเติม chart เพื่อรองรับรหัส + ประมาณการ AdjRW */
  chart_capture_hints?: ChartCaptureHint[];
  documentation_gaps: string[];
  coder_notes: string[];
  why_this_principal_diagnosis?: string;
  linkage?: LinkageEdge[];
  extraction?: ExtractionLayer;
  case_graph?: CaseGraph;
  concepts?: ConceptNode[];
  classification?: {
    principal_candidate?: string[];
    comorbidity_candidates?: string[];
    complication_candidates?: string[];
    other_diagnosis_candidates?: string[];
    external_cause_candidates?: string[];
  };
  complex_case?: ComplexCaseFallback | Record<string, unknown>;
  active_pattern_packs?: string[];
}
