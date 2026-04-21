/**
 * Maps symptom packs and assist overlays/frameworks to guideline / official reference IDs
 * (see `referenceCatalog.ts`). Used for compact physician-facing reference blocks in the lab UI.
 */
import type { OpdProblemPackId } from "./opdProblemPacks";

const RDU = "thai-rdu-hospital-manual";
const THAI_RESP = "thai-peds-respiratory-infections-2019";
const THAI_FEVER = "thai-peds-acute-febrile-illness";
const THAI_DIARRHEA = "thai-peds-acute-diarrhea";
const THAI_UTI = "thai-peds-uti-2m-5y";
const THAI_SEPSIS = "thai-peds-severe-sepsis-shock";
const THAI_TRAUMA = "thai-trauma-abcde";
const THAI_HEAD = "thai-head-injury-traumatic-patients";
const NICE_HEAD = "nice-head-injury-ct-1h";
const IDSA_DIARRHEA = "idsa-infectious-diarrhea-2017";
const NICE_SEPSIS = "nice-sepsis-ng51-2016";
const UK_ANAPH = "uk-resus-anaphylaxis-2021";
const WHO_POISON = "who-poisoning-fact-sheet-2018";
const ACOG_PE = "acog-gestational-htn-preeclampsia-2019";
const WHO_PPH = "who-postpartum-hemorrhage-2018";
const RCOG_APH = "rcog-green-top-63-antepartum-haemorrhage-2011";
const NICE_ECT = "nice-ectopic-miscarriage-ng126";
const FIGO_AUB = "figo-abnormal-uterine-bleeding-2011";

const DEFAULT_PACK_REFS: readonly string[] = [RDU];

const PACK_TO_REF: Partial<Record<OpdProblemPackId, readonly string[]>> = {
  skin_rash: [RDU, "thai-peds-cpg-index"],
  fever: [THAI_FEVER, THAI_SEPSIS],
  uri_cough: [THAI_RESP, RDU],
  wheeze_dyspnea: [THAI_RESP, "thai-peds-asthma", "thai-peds-viral-induced-wheeze"],
  diarrhea_vomiting: [THAI_DIARRHEA, IDSA_DIARRHEA],
  abdominal_pain: [RDU, IDSA_DIARRHEA],
  dysuria: [THAI_UTI, RDU],
  headache_dizziness: [NICE_HEAD, THAI_HEAD],
  back_neck_pain: [THAI_TRAUMA, NICE_HEAD],
  wound_abscess_cellulitis: ["thai-peds-cpg-index", RDU],
  sore_throat: [THAI_RESP, RDU],
  ear_pain: [THAI_RESP, RDU],
  red_eye: [RDU],
  chest_palpitations: [RDU],
  allergy_urticaria_anaphylaxis: [UK_ANAPH, RDU],
  ortho_acute_limb_sprain: [THAI_TRAUMA, RDU],
  ortho_fracture_concern: [THAI_TRAUMA, THAI_HEAD],
  ortho_hot_swollen_joint: [RDU, THAI_FEVER],
  ortho_knee_pain: [THAI_TRAUMA, RDU],
  ortho_shoulder_pain: [THAI_TRAUMA, RDU],
  ortho_pediatric_limp: [THAI_TRAUMA, THAI_FEVER],
  er_dyspnea_hypoxemia: [THAI_RESP, NICE_SEPSIS],
  er_sepsis_shock: [THAI_SEPSIS, NICE_SEPSIS],
  er_dehydration: [THAI_DIARRHEA, THAI_SEPSIS],
  er_chest_pain: [NICE_SEPSIS, RDU],
  er_anaphylaxis: [UK_ANAPH, RDU],
  er_seizure_ams: [THAI_HEAD, NICE_HEAD],
  er_poisoning_overdose: [WHO_POISON, IDSA_DIARRHEA],
  tr_minor_head_injury: [THAI_HEAD, NICE_HEAD],
  tr_laceration_wound: [THAI_TRAUMA, RDU],
  tr_fracture_sprain: [THAI_TRAUMA, RDU],
  tr_blunt_trauma: [THAI_TRAUMA, THAI_HEAD],
  tr_neck_back_trauma: [THAI_TRAUMA, NICE_HEAD],
  psych_depression_si: [RDU],
  psych_psychosis: [RDU],
  psych_agitation_violence: [RDU],
  psych_substance_intoxWithdrawal: [WHO_POISON, RDU],
  psych_panic_anxiety: [RDU],
  lr_labor_evaluation: [WHO_PPH, RCOG_APH],
  lr_antepartum_bleeding: [RCOG_APH, WHO_PPH],
  lr_preeclampsia: [ACOG_PE, NICE_SEPSIS],
  lr_reduced_fetal_movement: [ACOG_PE, RCOG_APH],
  lr_postpartum_hemorrhage: [WHO_PPH, RCOG_APH],
  lr_postpartum_fever: [NICE_SEPSIS, THAI_SEPSIS],
  gy_early_pregnancy_bleeding: [NICE_ECT, RCOG_APH],
  gy_abnormal_uterine_bleeding: [FIGO_AUB, RDU],
  gy_vaginal_discharge_pid: [THAI_UTI, RDU],
  gy_acute_pelvic_pain_torsion: [NICE_ECT, RCOG_APH],
  gy_dysmenorrhea_chronic_pelvic_pain: [FIGO_AUB, RDU],
  gy_postmenopausal_bleeding: [FIGO_AUB, RCOG_APH],
  gy_vulvar_bartholin: [RDU],
};

export function getReferenceIdsForPack(packId: OpdProblemPackId): string[] {
  const xs = PACK_TO_REF[packId];
  return xs?.length ? [...xs] : [...DEFAULT_PACK_REFS];
}

export type AssistOverlayRefKey =
  | "anaphylaxisEr"
  | "seizureAmsEr"
  | "dyspneaEr"
  | "sepsisEr"
  | "poisoningEr"
  | "laborEval"
  | "antepartumBleed"
  | "preeclampsia"
  | "earlyPregnancyPb"
  | "aub"
  | "abxRdu";

const OVERLAY_TO_REF: Record<AssistOverlayRefKey, readonly string[]> = {
  anaphylaxisEr: [UK_ANAPH, RDU],
  seizureAmsEr: [THAI_HEAD, NICE_HEAD],
  dyspneaEr: [THAI_RESP, NICE_SEPSIS],
  sepsisEr: [THAI_SEPSIS, NICE_SEPSIS],
  poisoningEr: [WHO_POISON, IDSA_DIARRHEA],
  laborEval: [WHO_PPH, RCOG_APH],
  antepartumBleed: [RCOG_APH, WHO_PPH],
  preeclampsia: [ACOG_PE, NICE_SEPSIS],
  earlyPregnancyPb: [NICE_ECT, RCOG_APH],
  aub: [FIGO_AUB, NICE_ECT],
  abxRdu: [RDU, "thai-peds-cpg-index"],
};

export function getReferenceIdsForAssistOverlay(key: AssistOverlayRefKey): string[] {
  return [...OVERLAY_TO_REF[key]];
}

export type AssistFrameworkRefKey =
  | "uriRespiratory"
  | "feverChild"
  | "giDehydration"
  | "abdominalPain"
  | "dysuriaUti"
  | "headacheDizziness"
  | "backMusculoskeletal"
  | "trauma"
  | "psych"
  | "likelyAdmit";

const FRAMEWORK_TO_REF: Record<AssistFrameworkRefKey, readonly string[]> = {
  uriRespiratory: [THAI_RESP, RDU],
  feverChild: [THAI_FEVER, THAI_SEPSIS],
  giDehydration: [THAI_DIARRHEA, IDSA_DIARRHEA],
  abdominalPain: [RDU, IDSA_DIARRHEA],
  dysuriaUti: [THAI_UTI, RDU],
  headacheDizziness: [NICE_HEAD, THAI_HEAD],
  backMusculoskeletal: [THAI_TRAUMA, NICE_HEAD],
  trauma: [THAI_TRAUMA, THAI_HEAD],
  psych: [RDU],
  likelyAdmit: [RDU, NICE_SEPSIS],
};

export function getReferenceIdsForFramework(key: AssistFrameworkRefKey): string[] {
  return [...FRAMEWORK_TO_REF[key]];
}
