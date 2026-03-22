import coreRules from "@/config/discharge/core_rules.json";
import exclusionRules from "@/config/discharge/exclusion_rules.json";
import combinationRules from "@/config/discharge/combination_rules.json";
import kidneyMetabolicFluid from "@/config/discharge/pattern_packs/kidney_metabolic_fluid.json";
import hivOpportunistic from "@/config/discharge/pattern_packs/hiv_opportunistic.json";
import organFailureOverlay from "@/config/discharge/pattern_packs/organ_failure_overlay.json";
import sepsisPack from "@/config/discharge/pattern_packs/sepsis_infection_organ_failure.json";
import chfPack from "@/config/discharge/pattern_packs/chf_fluid_electrolyte.json";
import dmPack from "@/config/discharge/pattern_packs/diabetes_infection_renal.json";
import strokePack from "@/config/discharge/pattern_packs/stroke_aspiration_pneumonia_uti.json";
import cirrhosisPack from "@/config/discharge/pattern_packs/cirrhosis_ascites_sbp_encephalopathy.json";
import malignancyPack from "@/config/discharge/pattern_packs/malignancy_infection_anemia_palliative.json";

export const PATTERN_PACKS = [
  kidneyMetabolicFluid,
  hivOpportunistic,
  organFailureOverlay,
  sepsisPack,
  chfPack,
  dmPack,
  strokePack,
  cirrhosisPack,
  malignancyPack,
] as const;

export function getRulesBundle() {
  return {
    core: coreRules,
    exclusion: exclusionRules,
    combination: combinationRules,
    patternPacks: PATTERN_PACKS,
  };
}

export function summarizeRulesForPrompt(maxChars = 12000): string {
  const bundle = getRulesBundle();
  const packs = bundle.patternPacks.map((p) => ({
    id: (p as { id?: string }).id,
    title: (p as { title?: string }).title,
    activation_hints: (p as { activation_hints?: string[] }).activation_hints,
    reasoning_notes: (p as { reasoning_notes?: string[] }).reasoning_notes,
  }));
  const payload = {
    core: bundle.core,
    exclusion: bundle.exclusion,
    combination: bundle.combination,
    pattern_packs: packs,
  };
  const s = JSON.stringify(payload, null, 0);
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars) + "\n...truncated...";
}
