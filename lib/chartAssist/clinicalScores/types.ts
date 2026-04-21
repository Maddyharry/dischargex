import type { OpdProblemPackId } from "../opdProblemPacks";

export type ClinicalScoreFieldKind = "number" | "select" | "boolean";

export type ClinicalScoreFieldDef = {
  id: string;
  label: string;
  kind: ClinicalScoreFieldKind;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  helpText?: string;
};

/** Deterministic compute output — displayed only when state is `ready`. */
export type ClinicalScoreComputed =
  | {
      kind: "numeric";
      total: number;
      breakdown?: Record<string, number>;
      secondaryLines?: string[];
    }
  | {
      kind: "graded";
      grade: string;
      gradeLabel: string;
      numericParts?: number[];
      secondaryLines?: string[];
    }
  | {
      kind: "composite";
      lines: { label: string; value: string }[];
    };

export type ClinicalScoreCardState = "not_applicable" | "incomplete" | "ready";

export type ClinicalScoreDefinition = {
  id: string;
  label: string;
  /** Symptom/problem pack ids that must be active (rule layer) for this score to appear. */
  triggerProblems: readonly OpdProblemPackId[];
  requiredFields: readonly ClinicalScoreFieldDef[];
  optionalFields: readonly ClinicalScoreFieldDef[];
  referenceIds: readonly string[];
  compute: (inputs: Record<string, number | boolean | string>) => ClinicalScoreComputed;
  interpret: (computed: ClinicalScoreComputed) => string;
};

export type ClinicalScoreEvaluation = {
  state: ClinicalScoreCardState;
  missingFieldIds: string[];
  computed?: ClinicalScoreComputed;
  interpretation?: string;
};
