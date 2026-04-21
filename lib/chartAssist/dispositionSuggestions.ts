/**
 * Rule-based disposition hints from visit mode + severity + active problem packs (not a substitute for clinical judgment).
 */
import type { AssistMode } from "./cardTypes";
import type { CaseClinicalProfile } from "./caseClinicalProfile";
import type { OpdProblemPackId } from "./opdProblemPacks";

export function buildDispositionSuggestions(
  mode: AssistMode,
  profile: CaseClinicalProfile,
  activePackIds: readonly OpdProblemPackId[],
): string[] {
  const severe = profile.hasSystemicRedFlags;
  const packs = new Set(activePackIds);

  const lines: string[] = [];

  if (mode === "OPD") {
    if (severe) {
      lines.push("OPD: consider ED referral or short observation if instability / red flags persist.");
    } else {
      lines.push("OPD: routine discharge with PCP or clinic follow-up when appropriate.");
    }
    if (packs.has("dysuria") || packs.has("abdominal_pain")) {
      lines.push("OPD: return precautions if worse pain, fever, or unable to tolerate PO.");
    }
    return lines;
  }

  if (mode === "ER") {
    if (severe || packs.has("er_sepsis_shock") || packs.has("er_dyspnea_hypoxemia")) {
      lines.push("ER: admit / ICU step-up if persistent hypoxia, shock, or ongoing resuscitation needs.");
    } else if (packs.has("er_chest_pain")) {
      lines.push(
        "ER chest pain: document ECG + vitals + SpO₂ early; troponin / serial ECG per ACS pathway when suspected; observe vs admit vs cath lab / cardiology per protocol after risk stratification.",
      );
    } else if (packs.has("er_anaphylaxis")) {
      lines.push("ER: observe per protocol; discharge only after symptom resolution and low-risk criteria met.");
    } else {
      lines.push("ER: discharge with return precautions if stable and diagnosis addressed.");
    }
    if (packs.has("er_poisoning_overdose") || packs.has("er_seizure_ams")) {
      lines.push("ER: extended monitoring / tox consult when indicated; avoid premature discharge if risk remains.");
    }
    return lines;
  }

  if (mode === "TRAUMA") {
    if (severe || packs.has("tr_blunt_trauma") || packs.has("tr_neck_back_trauma")) {
      lines.push("TRAUMA: imaging / trauma surgery or spine service per mechanism and exam.");
    }
    if (packs.has("tr_minor_head_injury")) {
      lines.push("TRAUMA: discharge only if low-risk criteria; explicit return neuro precautions.");
    }
    if (packs.has("tr_fracture_sprain") || packs.has("tr_laceration_wound")) {
      lines.push("TRAUMA: procedure / splint / closure; ortho or wound follow-up as needed.");
    }
    if (lines.length === 0) {
      lines.push("TRAUMA: disposition per primary/secondary survey and imaging.");
    }
    return lines;
  }

  if (mode === "LABOR_ROOM") {
    if (
      severe ||
      packs.has("lr_antepartum_bleeding") ||
      packs.has("lr_postpartum_hemorrhage") ||
      packs.has("lr_preeclampsia")
    ) {
      lines.push(
        "LABOR/OB triage: admit / urgent OB–L&D review if hemodynamic instability, heavy bleeding, severe hypertension, or fetal concern per protocol.",
      );
    } else if (packs.has("lr_reduced_fetal_movement") || packs.has("lr_postpartum_fever")) {
      lines.push(
        "LABOR/OB triage: observation vs admit — document fetal assessment / infection workup; explicit OB disposition.",
      );
    } else {
      lines.push(
        "LABOR/OB triage: disposition per labor progress / institutional pathway — observe, L&D admit, or transfer as appropriate.",
      );
    }
    lines.push(
      "Document: GA/parity, vitals, bleeding amount, FHR/fetal status, and disposition (observe / admit L&D / urgent OB / transfer).",
    );
    return lines;
  }

  if (mode === "GYNE") {
    if (severe || packs.has("gy_acute_pelvic_pain_torsion") || packs.has("gy_early_pregnancy_bleeding")) {
      lines.push(
        "GYNE triage: urgent GYN / ED pathway if ectopic miscarriage risk, peritonitis, or hemodynamic compromise — admit or OR consult per protocol.",
      );
    } else if (packs.has("gy_postmenopausal_bleeding")) {
      lines.push("GYNE: urgent outpatient workup / referral — endometrial assessment pathway; admit if unstable.");
    } else {
      lines.push("GYNE: disposition explicit — treat in clinic vs urgent GYN review vs OR vs discharge with safety-net.");
    }
    lines.push(
      "Document: pregnancy status early, pain/bleeding severity, vitals, and referral/admit decision.",
    );
    return lines;
  }

  /* PSYCH */
  if (mode === "PSYCH") {
    if (severe || packs.has("psych_depression_si") || packs.has("psych_agitation_violence")) {
      lines.push("PSYCH: consider crisis / inpatient psychiatry if imminent risk or inability to contract for safety.");
    }
    if (packs.has("psych_psychosis") || packs.has("psych_substance_intoxWithdrawal")) {
      lines.push("PSYCH: medical clearance pathway; admit or obs unit if severe intoxication/withdrawal.");
    }
    if (packs.has("psych_panic_anxiety") && !severe) {
      lines.push("PSYCH: outpatient psych / counseling follow-up if low risk and safety net in place.");
    }
    if (lines.length === 0) {
      lines.push("PSYCH: disposition by risk assessment + MSE; document safety plan when discharging.");
    }
    return lines;
  }

  lines.push("Disposition: follow clinical context and local protocol.");
  return lines;
}
