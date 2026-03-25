import type { AssistMode } from "./cardTypes";
import { uniq } from "./cardTypes";
import { buildParsedCaseFact, normalizeClinicalText } from "./parseCaseFacts";
import { detectAssistMode } from "./triggers";
import { buildSafetySweep } from "./safetyEngine";
import { getActiveDiseaseCards } from "./cardMatchers";
import { getRulePackMeta } from "./rulePackMeta";

export function analyzeOpdCase(rawText: string, modeOverride: AssistMode | null) {
  const normalized = normalizeClinicalText(rawText);
  const mode = detectAssistMode(normalized, modeOverride);
  const parsed = buildParsedCaseFact(rawText, mode);
  const safetySweep = buildSafetySweep(normalized, mode);
  const diseaseCards = getActiveDiseaseCards(parsed);
  const referenceIds = uniq(diseaseCards.flatMap((c) => c.referenceIds));
  const rulePack = getRulePackMeta();

  return {
    mode,
    safetySweep,
    diseaseCards,
    referenceIds,
    rulePack,
  };
}
