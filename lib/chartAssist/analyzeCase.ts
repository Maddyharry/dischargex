/**
 * Guardrail context builder (Layer A) — deterministic signals for AI-first drafting, not a substitute for the model.
 * AI-led: `opdAssistAi.ts`; post-enforcement: `opdAssistAiPostCheck.ts` — see `opdAssistArchitecture.ts`.
 */
import type { AssistMode, ParsedCaseFact } from "./cardTypes";
import { uniq } from "./cardTypes";
import { buildCaseClinicalProfile } from "./caseClinicalProfile";
import { extractPeFindingsFromNormalizedText } from "./clinicalTextExtract";
import { buildParsedCaseFact, normalizeClinicalText } from "./parseCaseFacts";
import { detectVisitMode } from "./triggers";
import { getActiveDiseaseCards } from "./cardMatchers";
import { getRulePackMeta } from "./rulePackMeta";
import { buildConditionalSafetySweep } from "./safetyOpd";
import { applyProblemOrder, buildMinimumOpdRecord, buildOpdFramework } from "./opdRecordFramework";
import { findClinicalContradictions } from "./clinicalContradictionCheck";
import { buildDispositionSuggestions } from "./dispositionSuggestions";
import { resolveOpdProblemPacks } from "./opdProblemPacks";
import {
  assessEvidenceLevel,
  buildAssistantBundle,
  buildStructuredOpdNote,
} from "./structuredNote";
import { buildFeverChildOpdFramework } from "./feverChildOpdFramework";
import { buildAbdominalPainOpdFramework } from "./abdominalPainOpdFramework";
import { buildGiDehydrationOpdFramework } from "./giDehydrationOpdFramework";
import { buildUriRespiratoryOpdFramework } from "./uriRespiratoryOpdFramework";
import { buildTraumaOpdFramework } from "./traumaOpdFramework";
import { buildPsychOpdFramework } from "./psychOpdFramework";
import { buildDysuriaUtiOpdFramework } from "./dysuriaUtiOpdFramework";
import { buildHeadacheDizzinessOpdFramework } from "./headacheDizzinessOpdFramework";
import { buildBackMusculoskeletalOpdFramework } from "./backMusculoskeletalOpdFramework";
import { buildMedicationSupportContext } from "./medicationSupportLayer";
import { buildAntibioticRduOverlay } from "./antibioticRduOverlay";
import { buildLikelyAdmitBridge } from "./likelyAdmitBridge";
import { buildDyspneaHypoxemiaErOverlay } from "./dyspneaHypoxemiaErOverlay";
import { buildSeizureAlteredMentalStatusErOverlay } from "./seizureAlteredMentalStatusErOverlay";
import { buildAnaphylaxisErOverlay } from "./anaphylaxisErOverlay";
import { buildSepsisShockErOverlay } from "./sepsisShockErOverlay";
import { buildPoisoningOverdoseErOverlay } from "./poisoningOverdoseErOverlay";
import { buildErImmediateLifeThreatMeta } from "./erImmediateLifeThreat";
import { buildLaborRoomLaborEvaluationOverlay } from "./laborRoomLaborEvaluationOverlay";
import { buildAntepartumBleedingOverlay } from "./antepartumBleedingOverlay";
import { buildPreeclampsiaOverlay } from "./preeclampsiaOverlay";
import { buildEarlyPregnancyPainBleedingOverlay } from "./earlyPregnancyPainBleedingOverlay";
import { buildAbnormalUterineBleedingOverlay } from "./abnormalUterineBleedingOverlay";

export type OpdAssistRuleAnalysis = ReturnType<typeof analyzeOpdCase>;

export type { VisitModeReasonCode } from "./triggers";

export type AnalyzeOpdCaseOptions = {
  /** Client layer-2 order — re-applies before AI and rebuilds layer1 problem list */
  orderedProblemIds?: string[];
};

export function analyzeOpdCase(
  rawText: string,
  modeOverride: AssistMode | null,
  options?: AnalyzeOpdCaseOptions,
) {
  const normalized = normalizeClinicalText(rawText);
  const visit = detectVisitMode(normalized, modeOverride);
  const mode = visit.mode;
  const profile = buildCaseClinicalProfile(normalized, mode);
  const parsed: ParsedCaseFact = {
    ...buildParsedCaseFact(rawText, mode),
    caseType: profile.caseType,
    dominantTheme: profile.dominantTheme,
    hasSystemicRedFlags: profile.hasSystemicRedFlags,
  };
  const safetySweep = buildConditionalSafetySweep(normalized, mode, profile);
  const diseaseCards = getActiveDiseaseCards(parsed);
  const referenceIds = uniq(diseaseCards.flatMap((c) => c.referenceIds));
  const rulePack = getRulePackMeta();
  const peExtracted = extractPeFindingsFromNormalizedText(normalized);
  const assistantBundle = buildAssistantBundle(
    rawText,
    mode,
    safetySweep,
    diseaseCards,
    referenceIds,
    profile,
  );
  const structuredNote = buildStructuredOpdNote(
    rawText,
    mode,
    safetySweep,
    diseaseCards,
    assistantBundle,
    profile,
    peExtracted,
  );
  const evidenceLevel = assessEvidenceLevel(safetySweep, diseaseCards, rawText.length);
  let opdFramework = buildOpdFramework({
    rawText,
    normalizedText: normalized,
    mode,
    profile,
    safety: safetySweep,
    diseaseCards,
    bundle: assistantBundle,
    structuredNote,
    peFromText: peExtracted,
  });

  if (options?.orderedProblemIds?.length) {
    const layer2 = applyProblemOrder(opdFramework.layer2, options.orderedProblemIds);
    const layer1 = buildMinimumOpdRecord({
      rawText,
      normalizedText: normalized,
      structuredNote,
      bundle: assistantBundle,
      safety: safetySweep,
      peFromText: peExtracted,
      problemBlocks: layer2,
      profile,
    });
    opdFramework = { layer1, layer2 };
  }

  const appliedProblemOrder = opdFramework.layer2.map((b) => b.id);

  const problemPackResolution = resolveOpdProblemPacks(normalized, mode);
  const clinicalContradictions = findClinicalContradictions(normalized);
  const dispositionSuggestions = buildDispositionSuggestions(
    mode,
    profile,
    problemPackResolution.activeMatches.map((m) => m.packId),
  );
  const uriRespiratoryFramework = buildUriRespiratoryOpdFramework(normalized);
  const feverChildFramework = buildFeverChildOpdFramework(normalized, {
    hasSystemicRedFlags: profile.hasSystemicRedFlags,
  });
  const giDehydrationFramework = buildGiDehydrationOpdFramework(normalized, {
    hasSystemicRedFlags: profile.hasSystemicRedFlags,
  });
  const abdominalPainFramework = buildAbdominalPainOpdFramework(normalized, {
    hasSystemicRedFlags: profile.hasSystemicRedFlags,
    visitMode: mode,
  });
  const traumaFramework = buildTraumaOpdFramework(normalized, mode);
  const psychFramework = buildPsychOpdFramework(normalized, mode);
  const dysuriaUtiFramework = buildDysuriaUtiOpdFramework(normalized);
  const headacheDizzinessFramework = buildHeadacheDizzinessOpdFramework(normalized);
  const backMusculoskeletalFramework = buildBackMusculoskeletalOpdFramework(normalized);
  const medicationSupportContext = buildMedicationSupportContext(
    normalized,
    opdFramework.layer1.drugAllergy,
    opdFramework.layer1.pastHistoryAndMeds,
  );
  const antibioticRduOverlay = buildAntibioticRduOverlay(normalized);
  const likelyAdmitBridge = buildLikelyAdmitBridge(
    normalized,
    mode,
    profile,
    dispositionSuggestions,
    problemPackResolution.activeMatches.map((m) => m.packId),
  );
  const dyspneaHypoxemiaErOverlay = buildDyspneaHypoxemiaErOverlay(
    normalized,
    mode,
    visit.reason,
    problemPackResolution.activeMatches.map((m) => m.packId),
  );
  const seizureAlteredMentalStatusErOverlay = buildSeizureAlteredMentalStatusErOverlay(
    normalized,
    mode,
    visit.reason,
    problemPackResolution.activeMatches.map((m) => m.packId),
  );
  const anaphylaxisErOverlay = buildAnaphylaxisErOverlay(
    normalized,
    mode,
    visit.reason,
    problemPackResolution.activeMatches.map((m) => m.packId),
  );
  const sepsisShockErOverlay = buildSepsisShockErOverlay(
    normalized,
    mode,
    visit.reason,
    problemPackResolution.activeMatches.map((m) => m.packId),
  );
  const poisoningOverdoseErOverlay = buildPoisoningOverdoseErOverlay(
    normalized,
    mode,
    visit.reason,
    problemPackResolution.activeMatches.map((m) => m.packId),
  );
  const erImmediateLifeThreat = buildErImmediateLifeThreatMeta(
    mode,
    visit.reason,
    profile,
    problemPackResolution.activeMatches.map((m) => m.packId),
    {
      anaphylaxisErOverlay,
      seizureAlteredMentalStatusErOverlay,
      dyspneaHypoxemiaErOverlay,
      sepsisShockErOverlay,
      poisoningOverdoseErOverlay,
    },
  );
  const laborRoomLaborEvaluationOverlay = buildLaborRoomLaborEvaluationOverlay(
    normalized,
    mode,
    visit.reason,
    problemPackResolution.activeMatches.map((m) => m.packId),
  );
  const antepartumBleedingOverlay = buildAntepartumBleedingOverlay(
    normalized,
    mode,
    problemPackResolution.activeMatches.map((m) => m.packId),
  );
  const preeclampsiaOverlay = buildPreeclampsiaOverlay(
    normalized,
    mode,
    problemPackResolution.activeMatches.map((m) => m.packId),
  );
  const earlyPregnancyPainBleedingOverlay = buildEarlyPregnancyPainBleedingOverlay(
    normalized,
    mode,
    problemPackResolution.activeMatches.map((m) => m.packId),
  );
  const abnormalUterineBleedingOverlay = buildAbnormalUterineBleedingOverlay(
    normalized,
    mode,
    problemPackResolution.activeMatches.map((m) => m.packId),
  );

  return {
    mode,
    visitModeReason: visit.reason,
    safetySweep,
    diseaseCards,
    referenceIds,
    rulePack,
    structuredNote,
    assistantBundle,
    evidenceLevel,
    caseProfile: profile,
    opdFramework,
    appliedProblemOrder,
    problemPackResolution,
    clinicalContradictions,
    dispositionSuggestions,
    uriRespiratoryFramework,
    feverChildFramework,
    giDehydrationFramework,
    abdominalPainFramework,
    traumaFramework,
    psychFramework,
    dysuriaUtiFramework,
    headacheDizzinessFramework,
    backMusculoskeletalFramework,
    medicationSupportContext,
    antibioticRduOverlay,
    likelyAdmitBridge,
    dyspneaHypoxemiaErOverlay,
    seizureAlteredMentalStatusErOverlay,
    anaphylaxisErOverlay,
    sepsisShockErOverlay,
    poisoningOverdoseErOverlay,
    erImmediateLifeThreat,
    laborRoomLaborEvaluationOverlay,
    antepartumBleedingOverlay,
    preeclampsiaOverlay,
    earlyPregnancyPainBleedingOverlay,
    abnormalUterineBleedingOverlay,
  };
}
