/**
 * Flags likely charting contradictions: both affirmative and denial cues for the same concept,
 * using negation-aware matching for the positive side and phrase keys for explicit denials.
 */
import { hasAnyKeywordNonNegated } from "./clinicalNegation";

type ContradictionRule = {
  /** Stable id for logs / tests */
  id: string;
  /** Symptoms or findings asserted as present (negation-aware) */
  positiveKeys: string[];
  /** Explicit denial / negative status phrases (negation-aware) */
  denialKeys: string[];
};

const RULES: ContradictionRule[] = [
  {
    id: "fever_status",
    positiveKeys: ["fever", "febrile", "pyrexia", "ไข้สูง", "มีไข้"],
    denialKeys: ["no fever", "afebrile", "ไม่มีไข้", "ไม่มี ไข้", "ปฏิเสธไข้", "denies fever"],
  },
  {
    id: "dyspnea_status",
    positiveKeys: ["dyspnea", "shortness of breath", "หายใจลำบาก", "เหนื่อยหอบ", "tachypnea"],
    denialKeys: ["no dyspnea", "ไม่เหนื่อยหอบ", "ไม่มีหายใจลำบาก", "denies dyspnea", "no sob"],
  },
  {
    id: "chest_pain_status",
    positiveKeys: ["chest pain", "เจ็บหน้าอก", "แน่นหน้าอก", "substernal pain"],
    denialKeys: ["no chest pain", "ไม่มีเจ็บหน้าอก", "denies chest pain", "ไม่เจ็บหน้าอก"],
  },
  {
    id: "suicidal_ideation",
    positiveKeys: ["suicidal ideation", "คิดฆ่าตัวตาย", "อยากตาย"],
    denialKeys: ["no suicidal ideation", "denies suicidal", "ไม่คิดฆ่าตัวตาย", "ปฏิเสธคิดฆ่าตัวตาย"],
  },
];

/**
 * Returns human-readable flags when both positive and denial keyword families match (non-negated).
 */
export function findClinicalContradictions(normalizedText: string): string[] {
  const t = normalizedText;
  const out: string[] = [];
  for (const rule of RULES) {
    const pos = hasAnyKeywordNonNegated(t, rule.positiveKeys);
    const neg = hasAnyKeywordNonNegated(t, rule.denialKeys);
    if (pos && neg) {
      out.push(
        `${rule.id}: affirmative and denial cues both present — reconcile before finalizing the note`,
      );
    }
  }
  return out;
}
