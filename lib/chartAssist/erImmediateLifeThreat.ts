/**
 * When the rule layer detects an immediate life-threat pattern in ER, narrative export order
 * switches to stabilization-first (see `formatErClinicalNoteLayout` life-threat variant).
 */
import type { AssistMode } from "./cardTypes";
import type { CaseClinicalProfile } from "./caseClinicalProfile";
import type { OpdProblemPackId } from "./opdProblemPacks";
import type { VisitModeReasonCode } from "./triggers";
import type { AnaphylaxisErOverlay } from "./anaphylaxisErOverlay";
import type { SeizureAlteredMentalStatusErOverlay } from "./seizureAlteredMentalStatusErOverlay";
import type { DyspneaHypoxemiaErOverlay } from "./dyspneaHypoxemiaErOverlay";
import type { SepsisShockErOverlay } from "./sepsisShockErOverlay";
import type { PoisoningOverdoseErOverlay } from "./poisoningOverdoseErOverlay";

export type ErImmediateLifeThreatMeta = {
  /** When true, AI + Thai export use life-threat section order */
  reorderNarrative: boolean;
  /** Why the rule fired (for prompt / debugging) */
  reasons: string[];
};

/** Visit reasons that already imply ED resuscitation-first documentation */
const VISIT_REASONS_LIFE_THREAT: readonly VisitModeReasonCode[] = [
  "er_airway_severe",
  "er_anaphylaxis",
  "er_shock_perfusion",
  "er_hypoxemia",
  "er_severe_dyspnea",
  "er_seizure",
  "er_active_bleeding",
  "er_poisoning_overdose",
  "er_systemic_red_flags",
  "er_fever_danger_pediatric",
  "er_gi_severe_dehydration",
  "er_abdominal_surgical_concern",
];

function overlayEscalated(o: { active: false } | { active: true; emergencyEscalationLikely: boolean }): boolean {
  return o.active && o.emergencyEscalationLikely;
}

export function buildErImmediateLifeThreatMeta(
  mode: AssistMode,
  visitReason: VisitModeReasonCode,
  profile: CaseClinicalProfile,
  activePackIds: readonly OpdProblemPackId[],
  overlays: {
    anaphylaxisErOverlay: AnaphylaxisErOverlay;
    seizureAlteredMentalStatusErOverlay: SeizureAlteredMentalStatusErOverlay;
    dyspneaHypoxemiaErOverlay: DyspneaHypoxemiaErOverlay;
    sepsisShockErOverlay: SepsisShockErOverlay;
    poisoningOverdoseErOverlay: PoisoningOverdoseErOverlay;
  },
): ErImmediateLifeThreatMeta {
  if (mode !== "ER") {
    return { reorderNarrative: false, reasons: [] };
  }

  const reasons: string[] = [];

  if (profile.hasSystemicRedFlags) {
    reasons.push("systemic red flags");
  }

  if (VISIT_REASONS_LIFE_THREAT.includes(visitReason)) {
    reasons.push(`visit reason: ${visitReason}`);
  }

  if (activePackIds.includes("er_chest_pain")) {
    reasons.push("er_chest_pain pack matched");
  }

  if (overlayEscalated(overlays.anaphylaxisErOverlay)) reasons.push("anaphylaxis overlay — escalation");
  if (overlayEscalated(overlays.seizureAlteredMentalStatusErOverlay)) reasons.push("seizure / AMS overlay — escalation");
  if (overlayEscalated(overlays.dyspneaHypoxemiaErOverlay)) reasons.push("dyspnea / hypoxemia overlay — escalation");
  if (overlayEscalated(overlays.sepsisShockErOverlay)) reasons.push("sepsis / shock overlay — escalation");
  if (overlayEscalated(overlays.poisoningOverdoseErOverlay)) reasons.push("poisoning / overdose overlay — escalation");

  const reorderNarrative = reasons.length > 0;
  return { reorderNarrative, reasons };
}
