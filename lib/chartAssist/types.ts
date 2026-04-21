import type { AssistCardResult, AssistMode, SafetySweep } from "./cardTypes";
import type { ReferenceSource, ReferenceTopic } from "./referenceCatalog";
import type { OpdStructuredMedicationLineV1 } from "./medicationSupportLayer";

export type ChartAssistUrgency = "routine" | "ed" | "trauma_ed";

export type MedicationDraftV1 = {
  status: "insufficient_context" | "generic_outline";
  lines: string[];
  missingFields: string[];
  /** Explicit field slots for forms — suggested tier; all unknown fields stay \"—\" */
  suggestedMedicationBlueprint?: OpdStructuredMedicationLineV1;
};

export type GuidelineHintV1 = {
  id: string;
  text: string;
  sourceIds: string[];
  topic: ReferenceTopic;
};

export type ChartRuleAnalysis = {
  mode: AssistMode;
  visitModeReason: string;
  urgency: ChartAssistUrgency;
  /** Short keyword-derived anchors */
  rawFacts: string[];
  safetySweep: SafetySweep;
  /** V1: URI/wheeze, bloody diarrhea, head injury when triggered */
  diseaseCards: AssistCardResult[];
  /** Working problem labels from cards — non-authoritative */
  problemList: string[];
  referenceHints: ReferenceSource[];
  guidelineHints: GuidelineHintV1[];
  medicationDraft: MedicationDraftV1;
  ruleVersion: string;
};
