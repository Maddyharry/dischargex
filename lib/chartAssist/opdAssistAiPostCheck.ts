import type { AssistMode } from "./cardTypes";
import type { CaseClinicalProfile } from "./caseClinicalProfile";
import type {
  ErPrimarySurveyJson,
  ObGyneBleedingSeverityJson,
  OpdAiClinicalNoteJson,
  OpdAiProblemJson,
  PsychRiskAssessmentJson,
} from "./opdAssistAiTypes";
import { inferObGynePathwayHints } from "./obGynePathways";
import { normalizeClinicalText } from "./parseCaseFacts";
import type { AssistantBundle } from "./structuredNote";
import type { StructuredOpdNote } from "./structuredNote";
import { stripBannedPlaceholders } from "./opdAssistAiFormat";
import { uniq } from "./cardTypes";
import type {
  MedicationSupportContextV1,
  OpdMedicationSafetyFlagsV1,
  OpdStructuredMedicationLineV1,
} from "./medicationSupportLayer";
import { normalizeClinicalInvestigationsV1 } from "./clinicalInvestigationV1";
import {
  normalizeConfidenceLevel,
  normalizeEvidenceSupportItems,
  normalizeUncertaintyReasons,
} from "./problemEvidenceV1";
import {
  detectUnsafePediatricMgKgInText,
  mergeMedicationSafetyFlags,
  normalizeMedicationLine,
} from "./medicationSupportLayer";

const MAX_CC = 320;
const MAX_PI = 12000;
const MAX_PE = 8000;
const MAX_PMH = 6000;
const MAX_PROBLEM_LIST = 2000;
const MAX_ADVICE = 4000;
const MAX_BLOCK = 8000;
const MAX_MEDS_PER_TIER = 6;

function mergeObGyneBleedingForPost(o: Record<string, unknown>, warnings: string[]): ObGyneBleedingSeverityJson {
  const raw = o.obGyneBleedingSeverity;
  if (!raw || typeof raw !== "object") {
    return { level: "unknown", quantifiedDetails: "—" };
  }
  const e = raw as Record<string, unknown>;
  let level = clamp(String(e.level ?? ""), 500, "obGyneBleedingSeverity.level", warnings);
  let quantifiedDetails = clamp(String(e.quantifiedDetails ?? ""), MAX_BLOCK, "obGyneBleedingSeverity.quantifiedDetails", warnings);
  level = stripBannedPlaceholders(level);
  quantifiedDetails = stripBannedPlaceholders(quantifiedDetails);
  return {
    level: level || "unknown",
    quantifiedDetails: quantifiedDetails || "—",
  };
}

function normalizeMedicationLines(
  raw: unknown,
  defaultTier: "suggested" | "finalized",
): OpdStructuredMedicationLineV1[] {
  if (!Array.isArray(raw)) return [];
  const out: OpdStructuredMedicationLineV1[] = [];
  for (const item of raw) {
    const n = normalizeMedicationLine(item, defaultTier);
    if (n) out.push(n);
    if (out.length >= MAX_MEDS_PER_TIER) break;
  }
  return out;
}

export type ClinicalNotePostCheckResult =
  | { ok: true; ai: OpdAiClinicalNoteJson; warnings: string[] }
  | { ok: false; warnings: string[] };

function clamp(s: string, max: number, label: string, warnings: string[]): string {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  warnings.push(`${label} truncated to ${max} chars`);
  return t.slice(0, max - 1) + "…";
}

function normalizeProblem(p: unknown, warnings: string[]): OpdAiProblemJson | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  const role = o.role === "secondary" ? "secondary" : "primary";
  const title = String(o.title ?? "").trim();
  if (!title) return null;
  const MAX_ASK_EXAM = 5;
  const askNext = Array.isArray(o.askNext)
    ? o.askNext
        .map((x) => String(x).trim())
        .filter(Boolean)
        .slice(0, MAX_ASK_EXAM)
    : [];
  const examineNext = Array.isArray(o.examineNext)
    ? o.examineNext
        .map((x) => String(x).trim())
        .filter(Boolean)
        .slice(0, MAX_ASK_EXAM)
    : [];
  const suggestedMedications = normalizeMedicationLines(o.suggestedMedications, "suggested");
  const finalizedMedications = normalizeMedicationLines(o.finalizedMedications, "finalized");
  let medicationSafetyFlags: OpdMedicationSafetyFlagsV1 | undefined;
  if (o.medicationSafetyFlags && typeof o.medicationSafetyFlags === "object") {
    const mf = o.medicationSafetyFlags as Record<string, unknown>;
    const allergyConflicts = Array.isArray(mf.allergyConflicts)
      ? mf.allergyConflicts.map((x) => String(x).trim()).filter(Boolean).slice(0, 12)
      : [];
    const existingMedicationConflicts = Array.isArray(mf.existingMedicationConflicts)
      ? mf.existingMedicationConflicts.map((x) => String(x).trim()).filter(Boolean).slice(0, 12)
      : [];
    if (allergyConflicts.length || existingMedicationConflicts.length) {
      medicationSafetyFlags = { allergyConflicts, existingMedicationConflicts };
    }
  }
  let clinicalProblemId: string | undefined;
  if (typeof o.clinicalProblemId === "string") {
    const t = o.clinicalProblemId.trim();
    if (t) clinicalProblemId = t.length <= 128 ? t : `${t.slice(0, 127)}…`;
  }
  const confidenceLevel = normalizeConfidenceLevel(o.confidenceLevel, warnings);
  const uncertaintyReasons = normalizeUncertaintyReasons(o.uncertaintyReasons, warnings);
  const evidenceSupport = normalizeEvidenceSupportItems(o.evidenceSupport, warnings);
  return {
    ...(clinicalProblemId ? { clinicalProblemId } : {}),
    role,
    title,
    assessment: String(o.assessment ?? "").trim(),
    provisionalDiagnosis: String(o.provisionalDiagnosis ?? "").trim(),
    differential: String(o.differential ?? "").trim(),
    plan: String(o.plan ?? "").trim(),
    askNext,
    examineNext,
    ...(suggestedMedications.length ? { suggestedMedications } : {}),
    ...(finalizedMedications.length ? { finalizedMedications } : {}),
    ...(medicationSafetyFlags ? { medicationSafetyFlags } : {}),
    ...(confidenceLevel ? { confidenceLevel } : {}),
    ...(uncertaintyReasons?.length ? { uncertaintyReasons } : {}),
    ...(evidenceSupport?.length ? { evidenceSupport } : {}),
  };
}

/** When rule layer sent explicit layer-2 order, align AI problems[] and primary/secondary roles */
function reconcileProblemsToCanonicalOrder(
  problems: OpdAiProblemJson[],
  canonicalIds: string[],
  warnings: string[],
): OpdAiProblemJson[] {
  if (!canonicalIds.length || !problems.length) return problems;

  const hasAnyId = problems.some((p) => p.clinicalProblemId);
  if (!hasAnyId && problems.length === canonicalIds.length) {
    warnings.push(
      "problems[] omitted clinicalProblemId — roles set by model order; prefer ids from RULE_PROBLEM_BLOCK_IDS",
    );
    return problems.map((p, i) => ({
      ...p,
      role: i === 0 ? "primary" : "secondary",
    }));
  }

  if (!hasAnyId) {
    warnings.push("Cannot align problems[] to rule layer order — missing clinicalProblemId on all items");
    return problems;
  }

  const consumed = new Set<number>();
  const ordered: OpdAiProblemJson[] = [];

  for (const id of canonicalIds) {
    const idx = problems.findIndex((p, i) => !consumed.has(i) && p.clinicalProblemId === id);
    if (idx >= 0) {
      consumed.add(idx);
      ordered.push(problems[idx]);
    }
  }
  let appended = 0;
  for (let i = 0; i < problems.length; i++) {
    if (!consumed.has(i)) {
      ordered.push(problems[i]);
      appended += 1;
    }
  }
  if (appended) {
    warnings.push(
      `${appended} problem(s) had no matching clinicalProblemId for canonical order — appended after matched items`,
    );
  }

  return ordered.map((p, i) => ({
    ...p,
    role: i === 0 ? "primary" : "secondary",
  }));
}

function enrichProblemsWithMedicationSafety(
  problems: OpdAiProblemJson[],
  pastHistoryMedsAllergy: string,
  medicationSupportContext: MedicationSupportContextV1 | undefined,
  warnings: string[],
): OpdAiProblemJson[] {
  return problems.map((p) => {
    const ruleFlags = mergeMedicationSafetyFlags(
      p.suggestedMedications,
      p.finalizedMedications,
      pastHistoryMedsAllergy,
      pastHistoryMedsAllergy,
    );
    const prior = p.medicationSafetyFlags;
    const allergyConflicts = uniq([...(prior?.allergyConflicts ?? []), ...ruleFlags.allergyConflicts]);
    const existingMedicationConflicts = uniq([
      ...(prior?.existingMedicationConflicts ?? []),
      ...ruleFlags.existingMedicationConflicts,
    ]);
    const medicationSafetyFlags =
      allergyConflicts.length || existingMedicationConflicts.length
        ? { allergyConflicts, existingMedicationConflicts }
        : undefined;

    if (medicationSupportContext?.blockPediatricWeightBasedNumericalDosing) {
      const blob = JSON.stringify({
        s: p.suggestedMedications,
        f: p.finalizedMedications,
      });
      if (detectUnsafePediatricMgKgInText(blob, medicationSupportContext)) {
        warnings.push(
          `Medication: problem "${p.title}" — numeric mg/kg appears without reliable weight in chart text; verify before use`,
        );
      }
    }

    return {
      ...p,
      ...(medicationSafetyFlags ? { medicationSafetyFlags } : {}),
    };
  });
}

function mergePsychRiskAssessmentForPost(raw: unknown): PsychRiskAssessmentJson {
  const d: PsychRiskAssessmentJson = {
    suicidalIdeation: "",
    suicidalPlan: "",
    selfHarmHistory: "",
    homicidalIdeation: "",
    psychosis: "",
    substanceUse: "",
  };
  if (!raw || typeof raw !== "object") return d;
  const e = raw as Record<string, unknown>;
  (["suicidalIdeation", "suicidalPlan", "selfHarmHistory", "homicidalIdeation", "psychosis", "substanceUse"] as const).forEach(
    (k) => {
      d[k] = String(e[k] ?? "").trim();
    },
  );
  return d;
}

function mergeErPrimarySurveyForPost(raw: unknown): ErPrimarySurveyJson {
  const d: ErPrimarySurveyJson = {
    airway: "",
    breathing: "",
    circulation: "",
    disability: "",
    exposure: "",
  };
  if (!raw || typeof raw !== "object") return d;
  const e = raw as Record<string, unknown>;
  (["airway", "breathing", "circulation", "disability", "exposure"] as const).forEach((k) => {
    d[k] = String(e[k] ?? "").trim();
  });
  return d;
}

/**
 * Guardrail enforcement (Layer C) — deterministic checks on AI output; does not replace AI-first drafting.
 */
export function postCheckOpdAiClinicalNote(
  rawText: string,
  ruleNote: StructuredOpdNote,
  ai: unknown,
  _profile: CaseClinicalProfile,
  bundle: AssistantBundle,
  visitMode: AssistMode = "OPD",
  medicationSupportContext?: MedicationSupportContextV1,
  canonicalProblemOrder?: string[],
): ClinicalNotePostCheckResult {
  const warnings: string[] = [];
  if (!ai || typeof ai !== "object") {
    return { ok: false, warnings: ["AI output is not an object"] };
  }

  const o = ai as Record<string, unknown>;

  let cc = clamp(String(o.cc ?? ""), MAX_CC, "CC", warnings);
  let pi = clamp(String(o.pi ?? ""), MAX_PI, "PI", warnings);
  let pastHistoryMedsAllergy = clamp(String(o.pastHistoryMedsAllergy ?? ""), MAX_PMH, "PMH/Allergy", warnings);
  let pe = clamp(String(o.pe ?? ""), MAX_PE, "PE", warnings);
  let problemList = clamp(String(o.problemList ?? ""), MAX_PROBLEM_LIST, "problemList", warnings);
  let patientAdvice = clamp(String(o.patientAdvice ?? ""), MAX_ADVICE, "Advice", warnings);

  const rawProblems = Array.isArray(o.problems) ? o.problems : [];
  let problems: OpdAiProblemJson[] = [];
  for (const p of rawProblems) {
    const n = normalizeProblem(p, warnings);
    if (n) {
      problems.push({
        ...n,
        assessment: clamp(n.assessment, MAX_BLOCK, `Assessment:${n.title}`, warnings),
        provisionalDiagnosis: clamp(n.provisionalDiagnosis, 1200, `Dx:${n.title}`, warnings),
        differential: clamp(n.differential, MAX_BLOCK, `DDx:${n.title}`, warnings),
        plan: clamp(n.plan, MAX_BLOCK, `Plan:${n.title}`, warnings),
      });
    }
  }

  if (canonicalProblemOrder?.length && problems.length) {
    problems = reconcileProblemsToCanonicalOrder(problems, canonicalProblemOrder, warnings);
  }

  problems = enrichProblemsWithMedicationSafety(problems, pastHistoryMedsAllergy, medicationSupportContext, warnings);

  cc = stripBannedPlaceholders(cc);
  pi = stripBannedPlaceholders(pi);
  pastHistoryMedsAllergy = stripBannedPlaceholders(pastHistoryMedsAllergy);
  pe = stripBannedPlaceholders(pe);
  problemList = stripBannedPlaceholders(problemList);
  patientAdvice = stripBannedPlaceholders(patientAdvice);

  const rawLen = rawText.trim().length;
  const substantialInput = rawLen >= 40;
  if (substantialInput) {
    if (visitMode === "ER") {
      const triage = String(o.erTriageConcern ?? "").trim();
      const thin = cc.length < 3 && pi.length < 10 && triage.length < 5 && pe.length < 5;
      if (thin) {
        return {
          ok: false,
          warnings: ["AI returned nearly empty ER note despite substantial input — using rule-based note"],
        };
      }
    } else if (visitMode === "TRAUMA") {
      const mech = String(o.traumaMechanism ?? "").trim();
      const thin = cc.length < 3 && pi.length < 10 && mech.length < 5 && pe.length < 5;
      if (thin) {
        return {
          ok: false,
          warnings: ["AI returned nearly empty TRAUMA note despite substantial input — using rule-based note"],
        };
      }
    } else if (visitMode === "PSYCH") {
      const chief = String(o.psychChiefConcern ?? "").trim();
      const thin = cc.length < 3 && pi.length < 10 && chief.length < 5 && pe.length < 5;
      if (thin) {
        return {
          ok: false,
          warnings: ["AI returned nearly empty PSYCH note despite substantial input — using rule-based note"],
        };
      }
    } else if (visitMode === "LABOR_ROOM" || visitMode === "GYNE") {
      const triage = String(o.obGyneTriageSummary ?? "").trim();
      const ps = String(o.obGynePregnancyStatus ?? "").trim();
      const ga = String(o.obGyneGestationalAge ?? "").trim();
      const thin =
        cc.length < 3 &&
        pi.length < 10 &&
        triage.length < 5 &&
        pe.length < 5 &&
        ps.length < 2 &&
        ga.length < 2;
      if (thin) {
        return {
          ok: false,
          warnings: ["AI returned nearly empty LABOR_ROOM/GYNE note despite substantial input — using rule-based note"],
        };
      }
    } else if (cc.length < 3 && pi.length < 10) {
      return {
        ok: false,
        warnings: ["AI returned nearly empty CC/PI despite substantial input — using rule-based note"],
      };
    }
  }

  if (!cc.length && !pi.length && !pe.length && !pastHistoryMedsAllergy.length) {
    return { ok: false, warnings: ["AI returned empty clinical note"] };
  }

  if (bundle.redFlags.length && /ไม่พบความผิดปกติ|entirely normal|no abnormality/i.test(pe)) {
    warnings.push("PE claims globally normal while rule engine flagged red flags — review at bedside");
  }

  if (substantialInput && problems.length === 0) {
    if (visitMode === "ER") {
      warnings.push(
        "No structured problems[] — acceptable in ER if erImmediateManagement carries actions; consider re-prompt for DDx",
      );
    } else if (visitMode === "TRAUMA") {
      warnings.push(
        "No structured problems[] — acceptable if traumaMechanism/traumaPrimarySurvey carry the case; consider re-prompt for injury list",
      );
    } else if (visitMode === "PSYCH") {
      warnings.push(
        "No structured problems[] — acceptable if psychChiefConcern/psychRiskAssessment carry the case; consider re-prompt for problem list",
      );
    } else if (visitMode === "LABOR_ROOM" || visitMode === "GYNE") {
      warnings.push(
        "No structured problems[] — acceptable if obGyneTriageSummary carries the case; consider re-prompt for problem list",
      );
    } else {
      warnings.push("No structured problems[] — assessment/DDx/plan may be thin; consider re-prompt");
    }
  }

  if (!cc.length && ruleNote.cc.trim()) {
    cc = ruleNote.cc.trim();
    warnings.push("CC empty from AI — filled from rule-based CC");
  }
  if (!pi.length && ruleNote.pi.trim()) {
    pi = ruleNote.pi.trim();
    warnings.push("PI empty from AI — filled from rule-based PI");
  }
  if (!pe.length && ruleNote.pe.trim()) {
    pe = ruleNote.pe.trim();
    warnings.push("PE empty from AI — filled from rule-based PE");
  }
  if (!pastHistoryMedsAllergy.length && ruleNote.pastHistory.trim()) {
    pastHistoryMedsAllergy = ruleNote.pastHistory.trim();
    warnings.push("PMH/Allergy empty from AI — filled from rule baseline");
  }

  const investigationsNorm = normalizeClinicalInvestigationsV1(o.investigations, warnings);

  const out: OpdAiClinicalNoteJson = {
    cc,
    pi,
    pastHistoryMedsAllergy,
    pe,
    problemList,
    problems,
    patientAdvice,
    ...(investigationsNorm.length ? { investigations: investigationsNorm } : {}),
  };

  if (visitMode === "ER") {
    let erTriageConcern = clamp(String(o.erTriageConcern ?? ""), MAX_BLOCK, "erTriageConcern", warnings);
    erTriageConcern = stripBannedPlaceholders(erTriageConcern);
    if (!erTriageConcern.trim()) {
      erTriageConcern = cc;
      warnings.push("erTriageConcern empty — filled from cc");
    }
    const epm = mergeErPrimarySurveyForPost(o.erPrimarySurvey);
    (["airway", "breathing", "circulation", "disability", "exposure"] as const).forEach((k) => {
      epm[k] = stripBannedPlaceholders(clamp(epm[k], 2000, `erPrimarySurvey.${k}`, warnings));
    });
    let erImmediateManagement = clamp(String(o.erImmediateManagement ?? ""), MAX_BLOCK, "erImmediateManagement", warnings);
    erImmediateManagement = stripBannedPlaceholders(erImmediateManagement);
    let erReassessment = clamp(String(o.erReassessment ?? ""), MAX_BLOCK, "erReassessment", warnings);
    erReassessment = stripBannedPlaceholders(erReassessment);
    let erDisposition = clamp(String(o.erDisposition ?? ""), MAX_BLOCK, "erDisposition", warnings);
    erDisposition = stripBannedPlaceholders(erDisposition);
    if (!erDisposition.trim() && patientAdvice.trim()) {
      erDisposition = patientAdvice;
      warnings.push("erDisposition empty — filled from patientAdvice");
    }
    out.erTriageConcern = erTriageConcern;
    out.erPrimarySurvey = epm;
    out.erImmediateManagement = erImmediateManagement;
    out.erReassessment = erReassessment;
    out.erDisposition = erDisposition;
  }

  if (visitMode === "TRAUMA") {
    let traumaMechanism = clamp(String(o.traumaMechanism ?? ""), MAX_BLOCK, "traumaMechanism", warnings);
    traumaMechanism = stripBannedPlaceholders(traumaMechanism);
    if (!traumaMechanism.trim()) {
      traumaMechanism = cc;
      warnings.push("traumaMechanism empty — filled from cc");
    }
    let traumaTimeOfInjury = clamp(String(o.traumaTimeOfInjury ?? ""), 2000, "traumaTimeOfInjury", warnings);
    traumaTimeOfInjury = stripBannedPlaceholders(traumaTimeOfInjury);
    const tpm = mergeErPrimarySurveyForPost(o.traumaPrimarySurvey);
    (["airway", "breathing", "circulation", "disability", "exposure"] as const).forEach((k) => {
      tpm[k] = stripBannedPlaceholders(clamp(tpm[k], 2000, `traumaPrimarySurvey.${k}`, warnings));
    });
    let traumaSecondarySurvey = clamp(String(o.traumaSecondarySurvey ?? ""), MAX_BLOCK, "traumaSecondarySurvey", warnings);
    traumaSecondarySurvey = stripBannedPlaceholders(traumaSecondarySurvey);
    if (!traumaSecondarySurvey.trim() && pe.trim()) {
      traumaSecondarySurvey = pe;
      warnings.push("traumaSecondarySurvey empty — filled from pe");
    }
    let traumaFocusedAssessment = clamp(String(o.traumaFocusedAssessment ?? ""), MAX_BLOCK, "traumaFocusedAssessment", warnings);
    traumaFocusedAssessment = stripBannedPlaceholders(traumaFocusedAssessment);
    let traumaImagingProcedure = clamp(String(o.traumaImagingProcedure ?? ""), MAX_BLOCK, "traumaImagingProcedure", warnings);
    traumaImagingProcedure = stripBannedPlaceholders(traumaImagingProcedure);
    let traumaPlan = clamp(String(o.traumaPlan ?? ""), MAX_BLOCK, "traumaPlan", warnings);
    traumaPlan = stripBannedPlaceholders(traumaPlan);
    let traumaDisposition = clamp(String(o.traumaDisposition ?? ""), MAX_BLOCK, "traumaDisposition", warnings);
    traumaDisposition = stripBannedPlaceholders(traumaDisposition);
    if (!traumaDisposition.trim() && patientAdvice.trim()) {
      traumaDisposition = patientAdvice;
      warnings.push("traumaDisposition empty — filled from patientAdvice");
    }
    out.traumaMechanism = traumaMechanism;
    out.traumaTimeOfInjury = traumaTimeOfInjury;
    out.traumaPrimarySurvey = tpm;
    out.traumaSecondarySurvey = traumaSecondarySurvey;
    out.traumaFocusedAssessment = traumaFocusedAssessment;
    out.traumaImagingProcedure = traumaImagingProcedure;
    out.traumaPlan = traumaPlan;
    out.traumaDisposition = traumaDisposition;
  }

  if (visitMode === "PSYCH") {
    let psychChiefConcern = clamp(String(o.psychChiefConcern ?? ""), MAX_BLOCK, "psychChiefConcern", warnings);
    psychChiefConcern = stripBannedPlaceholders(psychChiefConcern);
    if (!psychChiefConcern.trim()) {
      psychChiefConcern = cc;
      warnings.push("psychChiefConcern empty — filled from cc");
    }
    let psychHpi = clamp(String(o.psychHpi ?? ""), MAX_PI, "psychHpi", warnings);
    psychHpi = stripBannedPlaceholders(psychHpi);
    if (!psychHpi.trim() && pi.trim()) {
      psychHpi = pi;
      warnings.push("psychHpi empty — filled from pi");
    }
    const pra = mergePsychRiskAssessmentForPost(o.psychRiskAssessment);
    (["suicidalIdeation", "suicidalPlan", "selfHarmHistory", "homicidalIdeation", "psychosis", "substanceUse"] as const).forEach(
      (k) => {
        pra[k] = stripBannedPlaceholders(clamp(pra[k], 2000, `psychRiskAssessment.${k}`, warnings));
      },
    );
    let psychMentalStatusExam = clamp(String(o.psychMentalStatusExam ?? ""), MAX_PE, "psychMentalStatusExam", warnings);
    psychMentalStatusExam = stripBannedPlaceholders(psychMentalStatusExam);
    if (!psychMentalStatusExam.trim() && pe.trim()) {
      psychMentalStatusExam = pe;
      warnings.push("psychMentalStatusExam empty — filled from pe");
    }
    let psychSynthesisAssessment = clamp(String(o.psychSynthesisAssessment ?? ""), MAX_BLOCK, "psychSynthesisAssessment", warnings);
    psychSynthesisAssessment = stripBannedPlaceholders(psychSynthesisAssessment);
    let psychPlan = clamp(String(o.psychPlan ?? ""), MAX_BLOCK, "psychPlan", warnings);
    psychPlan = stripBannedPlaceholders(psychPlan);
    let psychDispositionReferral = clamp(String(o.psychDispositionReferral ?? ""), MAX_BLOCK, "psychDispositionReferral", warnings);
    psychDispositionReferral = stripBannedPlaceholders(psychDispositionReferral);
    if (!psychDispositionReferral.trim() && patientAdvice.trim()) {
      psychDispositionReferral = patientAdvice;
      warnings.push("psychDispositionReferral empty — filled from patientAdvice");
    }
    out.psychChiefConcern = psychChiefConcern;
    out.psychHpi = psychHpi;
    out.psychRiskAssessment = pra;
    out.psychMentalStatusExam = psychMentalStatusExam;
    out.psychSynthesisAssessment = psychSynthesisAssessment;
    out.psychPlan = psychPlan;
    out.psychDispositionReferral = psychDispositionReferral;
  }

  if (visitMode === "LABOR_ROOM" || visitMode === "GYNE") {
    let obGynePregnancyStatus = clamp(String(o.obGynePregnancyStatus ?? ""), 2000, "obGynePregnancyStatus", warnings);
    obGynePregnancyStatus = stripBannedPlaceholders(obGynePregnancyStatus);
    if (!obGynePregnancyStatus.trim()) obGynePregnancyStatus = "—";

    let obGyneGestationalAge = clamp(String(o.obGyneGestationalAge ?? ""), 2000, "obGyneGestationalAge", warnings);
    obGyneGestationalAge = stripBannedPlaceholders(obGyneGestationalAge);
    if (!obGyneGestationalAge.trim()) obGyneGestationalAge = "—";

    out.obGyneBleedingSeverity = mergeObGyneBleedingForPost(o, warnings);

    let obGyneClinicalPathway = clamp(String(o.obGyneClinicalPathway ?? ""), 2000, "obGyneClinicalPathway", warnings);
    obGyneClinicalPathway = stripBannedPlaceholders(obGyneClinicalPathway);
    if (!obGyneClinicalPathway.trim()) obGyneClinicalPathway = "none";

    let obGyneTriageSummary = clamp(String(o.obGyneTriageSummary ?? ""), MAX_BLOCK, "obGyneTriageSummary", warnings);
    obGyneTriageSummary = stripBannedPlaceholders(obGyneTriageSummary);
    if (!obGyneTriageSummary.trim() && cc.trim()) {
      obGyneTriageSummary = cc;
      warnings.push("obGyneTriageSummary empty — filled from cc");
    }
    let obGyneDisposition = clamp(String(o.obGyneDisposition ?? ""), MAX_BLOCK, "obGyneDisposition", warnings);
    obGyneDisposition = stripBannedPlaceholders(obGyneDisposition);
    if (!obGyneDisposition.trim() && patientAdvice.trim()) {
      obGyneDisposition = patientAdvice;
      warnings.push("obGyneDisposition empty — filled from patientAdvice");
    }
    out.obGynePregnancyStatus = obGynePregnancyStatus;
    out.obGyneGestationalAge = obGyneGestationalAge;
    out.obGyneClinicalPathway = obGyneClinicalPathway;
    out.obGyneTriageSummary = obGyneTriageSummary;
    out.obGyneDisposition = obGyneDisposition;

    if (substantialInput) {
      const hints = inferObGynePathwayHints(normalizeClinicalText(rawText), visitMode);
      if (hints.length && obGyneClinicalPathway === "none") {
        warnings.push("obGyneClinicalPathway is none — rule hints suggest a named OB/GYN pathway; align token and problems[] when appropriate");
      }
    }
  }

  return { ok: true, ai: out, warnings };
}

/** @deprecated use postCheckOpdAiClinicalNote */
export function postCheckOpdAiPhase1(
  rawText: string,
  ruleNote: StructuredOpdNote,
  ai: { cc: string; pi: string; pe: string },
  profile: CaseClinicalProfile,
  bundle: AssistantBundle,
): { ok: true; cc: string; pi: string; pe: string; warnings: string[] } | { ok: false; warnings: string[] } {
  const full = postCheckOpdAiClinicalNote(
    rawText,
    ruleNote,
    {
      cc: ai.cc,
      pi: ai.pi,
      pastHistoryMedsAllergy: ruleNote.pastHistory,
      pe: ai.pe,
      problemList: "",
      problems: [],
      patientAdvice: ruleNote.patientAdvice,
    },
    profile,
    bundle,
    "OPD",
    undefined,
    undefined,
  );
  if (!full.ok) return full;
  return {
    ok: true,
    cc: full.ai.cc,
    pi: full.ai.pi,
    pe: full.ai.pe,
    warnings: full.warnings,
  };
}
