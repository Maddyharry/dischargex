export type AssistMode = "OPD" | "ER" | "TRAUMA" | "PSYCH" | "LABOR_ROOM" | "GYNE";
export type CardSeverity = "info" | "warn" | "urgent";

export type CaseType =
  | "dermatology"
  | "respiratory"
  | "gi"
  | "trauma"
  | "fever_without_focus"
  | "general";

export type DominantTheme =
  | "skin_rash"
  | "respiratory"
  | "gi"
  | "trauma"
  | "fever_systemic"
  | "unclear";

export type ParsedCaseFact = {
  rawText: string;
  normalizedText: string;
  mode: AssistMode;
  caseType?: CaseType;
  dominantTheme?: DominantTheme;
  hasSystemicRedFlags?: boolean;
  facts?: {
    fever?: boolean;
    cough?: boolean;
    sputum?: boolean;
    runnyNose?: boolean;
    wheeze?: boolean;
    rhonchi?: boolean;
    retraction?: boolean;
    poorFeeding?: boolean;
    poorIntake?: boolean;
    vomiting?: boolean;
    vomitingCount?: number | null;
    bloodyStool?: boolean;
    diarrhea?: boolean;
    abdominalPain?: boolean;
    drowsy?: boolean;
    loc?: boolean;
    headInjury?: boolean;
    seizure?: boolean;
    gcs?: number | null;
    spo2?: number | null;
    rr?: number | null;
    hr?: number | null;
    bp?: string | null;
    crtSec?: number | null;
    pupilChecked?: boolean;
    pupilsAbnormal?: boolean;
  };
};

export type AssistCardResult = {
  id: string;
  label: string;
  severity: CardSeverity;
  whyShown: string[];
  documented: string[];
  missing: string[];
  checkNext: string[];
  mostSupportedDiagnosisIdeas: string[];
  avoidRoutine: string[];
  actionNow: string[];
  dispositionHints: string[];
  redFlags: string[];
  medicationClassSuggestions: string[];
  referenceIds: string[];
};

export type SafetyFramework = "ABCD" | "ABCDE";

export type SafetyLetterBlock = {
  label: string;
  documented: string[];
  missing: string[];
  checkNext: string[];
  redFlags: string[];
};

export type SafetySweep = {
  framework: SafetyFramework;
  items: SafetyLetterBlock[];
};

export function hasAny(text: string, keywords: string[]) {
  return keywords.some((k) => text.includes(k));
}

export function uniq(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}
