import type { AssistMode } from "./cardTypes";
import type { OpdAssistRuleAnalysis } from "./analyzeCase";
import type {
  ErPrimarySurveyJson,
  OpdAiClinicalNoteJson,
  OpdAiProblemJson,
  PsychRiskAssessmentJson,
} from "./opdAssistAiTypes";
import { formatMedicationLineBlockTh } from "./medicationSupportLayer";

function nl(s: string | undefined): string {
  return (s ?? "").trim() || "—";
}

/** Format differential block — ensure leading dashes per line */
function formatDifferentialBlock(text: string): string {
  const t = text.trim();
  if (!t) return "—";
  return t
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.startsWith("-") ? l : `- ${l}`))
    .join("\n");
}

function formatBulletList(items: string[]): string {
  if (!items.length) return "—";
  return items.map((x) => (x.trim().startsWith("-") ? x.trim() : `- ${x.trim()}`)).join("\n");
}

/** One block per visit — inserted after PE (or equivalent) when present */
export function formatInvestigationsSectionLines(ai: OpdAiClinicalNoteJson): string[] {
  const inv = ai.investigations;
  if (!inv?.length) return [];
  const lines: string[] = [];
  lines.push("Investigations (structured)");
  for (const x of inv) {
    const kindTag = x.urgent ? "[urgent] " : "";
    let head = `- ${kindTag}[${x.kind}] ${x.label}`;
    if (x.status) head += ` — ${x.status}`;
    if (x.priority) head += ` (${x.priority})`;
    lines.push(head);
    if (x.problemRefId) lines.push(`  problemRef: ${x.problemRefId}`);
    if (x.bodyPart) lines.push(`  site: ${x.bodyPart}`);
    if (x.summary) lines.push(`  summary: ${x.summary}`);
    if (x.impression) lines.push(`  impression: ${x.impression}`);
    if (x.keyFindings?.length) {
      lines.push("  key findings:");
      for (const k of x.keyFindings) lines.push(`    - ${k}`);
    }
    if (x.kind === "ecg") {
      if (x.rate) lines.push(`  rate: ${x.rate}`);
      if (x.rhythm) lines.push(`  rhythm: ${x.rhythm}`);
      if (x.sttSummary) lines.push(`  ST/QT: ${x.sttSummary}`);
    }
    if (x.rawText) lines.push(`  raw: ${x.rawText}`);
  }
  lines.push("");
  return lines;
}

function formatObGyneBleedingBlock(ai: OpdAiClinicalNoteJson): string {
  const b = ai.obGyneBleedingSeverity;
  if (!b) return "—";
  const level = nl(b.level);
  const det = nl(b.quantifiedDetails);
  if (level === "—" && det === "—") return "—";
  return [`- Severity level: ${level}`, `- Quantified details: ${det}`].join("\n");
}

export function formatProblemEvidenceOverlayLines(p: OpdAiProblemJson): string[] {
  if (!p.confidenceLevel && !p.uncertaintyReasons?.length && !p.evidenceSupport?.length) return [];
  const lines: string[] = [];
  lines.push("");
  if (p.confidenceLevel) {
    lines.push("Confidence");
    lines.push(p.confidenceLevel);
    lines.push("");
  }
  if (p.uncertaintyReasons?.length) {
    lines.push("Uncertainty");
    for (const u of p.uncertaintyReasons) lines.push(`- ${u}`);
    lines.push("");
  }
  if (p.evidenceSupport?.length) {
    lines.push("Evidence");
    for (const e of p.evidenceSupport) {
      const ref =
        e.refId !== undefined && e.refId !== null && String(e.refId).trim() !== ""
          ? ` [ref: ${String(e.refId).trim()}]`
          : "";
      lines.push(`- [${e.type}] ${e.relation}: ${e.text}${ref}`);
    }
    lines.push("");
  }
  return lines;
}

function formatProblemSection(p: OpdAiProblemJson, index: number): string[] {
  const n = index + 1;
  const lines: string[] = [];
  lines.push(`Problem ${n}: ${p.title.trim() || `ปัญหา ${n}`}`);
  lines.push("Assessment");
  lines.push(nl(p.assessment));
  lines.push(...formatProblemEvidenceOverlayLines(p));
  lines.push("");
  lines.push("Diagnosis");
  lines.push(nl(p.provisionalDiagnosis));
  lines.push("");
  lines.push("Differential diagnosis");
  lines.push(formatDifferentialBlock(p.differential));
  lines.push("");
  lines.push("Plan");
  lines.push(nl(p.plan));
  const sug = p.suggestedMedications ?? [];
  const fin = p.finalizedMedications ?? [];
  if (sug.length || fin.length) {
    lines.push("");
    lines.push("Medications (structured)");
    if (sug.length) {
      lines.push("Suggested (draft — not final prescription)");
      sug.forEach((line, i) => lines.push(formatMedicationLineBlockTh(line, i)));
    }
    if (fin.length) {
      lines.push("Finalized prescription / order");
      fin.forEach((line, i) => lines.push(formatMedicationLineBlockTh(line, i + sug.length)));
    }
  }
  const mf = p.medicationSafetyFlags;
  if (mf && (mf.allergyConflicts.length || mf.existingMedicationConflicts.length)) {
    lines.push("");
    lines.push("Medication safety flags");
    for (const x of mf.allergyConflicts) lines.push(`- ${x}`);
    for (const x of mf.existingMedicationConflicts) lines.push(`- ${x}`);
  }
  lines.push("");
  lines.push("What to ask next");
  lines.push(formatBulletList(p.askNext ?? []));
  lines.push("");
  lines.push("What to examine next");
  lines.push(formatBulletList(p.examineNext ?? []));
  lines.push("");
  return lines;
}

function formatProblemListLines(ai: OpdAiClinicalNoteJson): string[] {
  const lines: string[] = [];
  const pl = (ai.problemList ?? "").trim();
  if (pl) {
    pl.split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((l, i) => {
        if (/^\d+\.?\s/.test(l)) lines.push(l);
        else lines.push(`${i + 1}. ${l}`);
      });
  } else if (Array.isArray(ai.problems) && ai.problems.length) {
    ai.problems.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.role === "primary" ? "(ประเด็นหลัก) " : ""}${p.title}`);
    });
  } else {
    lines.push("—");
  }
  return lines;
}

function defaultPsychRisk(): PsychRiskAssessmentJson {
  return {
    suicidalIdeation: "",
    suicidalPlan: "",
    selfHarmHistory: "",
    homicidalIdeation: "",
    psychosis: "",
    substanceUse: "",
  };
}

function formatPsychRiskBlock(r: PsychRiskAssessmentJson | undefined): string[] {
  const x = r ?? defaultPsychRisk();
  return [
    `- suicidal ideation: ${nl(x.suicidalIdeation)}`,
    `- suicidal plan: ${nl(x.suicidalPlan)}`,
    `- self-harm history: ${nl(x.selfHarmHistory)}`,
    `- homicidal ideation: ${nl(x.homicidalIdeation)}`,
    `- psychosis: ${nl(x.psychosis)}`,
    `- substance use: ${nl(x.substanceUse)}`,
  ];
}

function formatErPrimarySurveyLines(ps: ErPrimarySurveyJson | undefined): string[] {
  const p = ps ?? {
    airway: "",
    breathing: "",
    circulation: "",
    disability: "",
    exposure: "",
  };
  return [
    `A: ${nl(p.airway)}`,
    `B: ${nl(p.breathing)}`,
    `C: ${nl(p.circulation)}`,
    `D: ${nl(p.disability)}`,
    `E: ${nl(p.exposure)}`,
  ];
}

export type OpdClinicalNoteLayoutOptions = {
  /** ER: when life threat detected — immediate actions before focused history */
  erImmediateLifeThreatReorder?: boolean;
};

/**
 * Thai ER export — default: triage → ABCDE → focused Hx/Ex → problems → management → reassessment → disposition.
 * Life-threat variant: immediate concern → vitals/exam → immediate management → history → problems → reassessment → disposition.
 */
function formatErClinicalNoteLayoutDefault(ai: OpdAiClinicalNoteJson): string {
  const lines: string[] = [];
  const triageLine = nl(ai.erTriageConcern) !== "—" ? nl(ai.erTriageConcern) : nl(ai.cc);

  lines.push("Triage concern");
  lines.push(triageLine);
  lines.push("");
  lines.push("Primary survey / immediate concern");
  lines.push(...formatErPrimarySurveyLines(ai.erPrimarySurvey));
  lines.push("");
  lines.push("Focused history");
  const histParts = [nl(ai.pi)];
  const pmh = nl(ai.pastHistoryMedsAllergy);
  if (pmh !== "—") histParts.push(`PMH / allergy / meds: ${pmh}`);
  lines.push(histParts.filter((x) => x !== "—").join("\n\n") || "—");
  lines.push("");
  lines.push("Focused exam");
  lines.push(nl(ai.pe));
  lines.push("");
  lines.push(...formatInvestigationsSectionLines(ai));
  lines.push("Problem list");
  lines.push(...formatProblemListLines(ai));
  lines.push("");

  let imm = nl(ai.erImmediateManagement);
  if (imm === "—") {
    const plans = (ai.problems ?? []).map((p) => p.plan.trim()).filter(Boolean);
    imm = plans.length ? plans.join("\n\n") : "—";
  }
  lines.push("Immediate management");
  lines.push(imm);
  lines.push("");
  lines.push("Reassessment");
  lines.push(nl(ai.erReassessment));
  lines.push("");
  lines.push("Disposition");
  const disp = nl(ai.erDisposition) !== "—" ? nl(ai.erDisposition) : nl(ai.patientAdvice);
  lines.push(disp);

  return lines.join("\n").trim();
}

function formatErClinicalNoteLayoutLifeThreat(ai: OpdAiClinicalNoteJson): string {
  const lines: string[] = [];
  const triageLine = nl(ai.erTriageConcern) !== "—" ? nl(ai.erTriageConcern) : nl(ai.cc);

  lines.push("Immediate concern");
  lines.push(triageLine);
  lines.push("");
  lines.push("Critical vitals & focused exam");
  lines.push("Primary survey (A–E)");
  lines.push(...formatErPrimarySurveyLines(ai.erPrimarySurvey));
  lines.push("");
  lines.push("Focused exam");
  lines.push(nl(ai.pe));
  lines.push("");
  lines.push(...formatInvestigationsSectionLines(ai));

  let imm = nl(ai.erImmediateManagement);
  if (imm === "—") {
    const plans = (ai.problems ?? []).map((p) => p.plan.trim()).filter(Boolean);
    imm = plans.length ? plans.join("\n\n") : "—";
  }
  lines.push("Immediate management");
  lines.push(imm);
  lines.push("");
  lines.push("Focused history");
  const histParts = [nl(ai.pi)];
  const pmh = nl(ai.pastHistoryMedsAllergy);
  if (pmh !== "—") histParts.push(`PMH / allergy / meds: ${pmh}`);
  lines.push(histParts.filter((x) => x !== "—").join("\n\n") || "—");
  lines.push("");
  lines.push("Problem list");
  lines.push(...formatProblemListLines(ai));
  lines.push("");

  lines.push("Reassessment");
  lines.push(nl(ai.erReassessment));
  lines.push("");
  lines.push("Disposition");
  const disp = nl(ai.erDisposition) !== "—" ? nl(ai.erDisposition) : nl(ai.patientAdvice);
  lines.push(disp);

  return lines.join("\n").trim();
}

export function formatErClinicalNoteLayout(
  ai: OpdAiClinicalNoteJson,
  opts?: OpdClinicalNoteLayoutOptions,
): string {
  if (opts?.erImmediateLifeThreatReorder) {
    return formatErClinicalNoteLayoutLifeThreat(ai);
  }
  return formatErClinicalNoteLayoutDefault(ai);
}

function formatOpdClinicalNoteLayoutOpd(ai: OpdAiClinicalNoteJson): string {
  const lines: string[] = [];

  lines.push("CC");
  lines.push(nl(ai.cc));
  lines.push("");
  lines.push("PI");
  lines.push(nl(ai.pi));
  lines.push("");
  lines.push("Past history / medication / allergy");
  lines.push(nl(ai.pastHistoryMedsAllergy));
  lines.push("");
  lines.push("PE");
  lines.push(nl(ai.pe));
  lines.push("");
  lines.push(...formatInvestigationsSectionLines(ai));
  lines.push("Problem list");
  lines.push(...formatProblemListLines(ai));
  lines.push("");

  const problems = Array.isArray(ai.problems) ? ai.problems : [];
  if (problems.length) {
    problems.forEach((p, i) => lines.push(...formatProblemSection(p, i)));
  } else {
    lines.push("Problem 1: —");
    lines.push("Assessment", "—", "");
    lines.push("Diagnosis", "—", "");
    lines.push("Differential diagnosis", "—", "");
    lines.push("Plan", "—", "");
    lines.push("What to ask next", "—", "");
    lines.push("What to examine next", "—", "");
    lines.push("");
  }

  lines.push("Advice / warning signs");
  lines.push(nl(ai.patientAdvice));

  return lines.join("\n").trim();
}

/** LABOR_ROOM / GYNE — triage summary first; explicit disposition before advice */
function formatLaborGyneClinicalNoteLayout(ai: OpdAiClinicalNoteJson, mode: "LABOR_ROOM" | "GYNE"): string {
  const lines: string[] = [];
  const triageTitle = mode === "LABOR_ROOM" ? "Triage / obstetric summary" : "Triage / gynecologic summary";
  lines.push(triageTitle);
  lines.push(nl(ai.obGyneTriageSummary));
  lines.push("");
  lines.push("CC");
  lines.push(nl(ai.cc));
  lines.push("");
  lines.push("PI");
  lines.push(nl(ai.pi));
  lines.push("");
  lines.push("Past history / medication / allergy");
  lines.push(nl(ai.pastHistoryMedsAllergy));
  lines.push("");
  lines.push("PE");
  lines.push(nl(ai.pe));
  lines.push("");
  lines.push("Problem list");
  lines.push(...formatProblemListLines(ai));
  lines.push("");

  const problems = Array.isArray(ai.problems) ? ai.problems : [];
  if (problems.length) {
    problems.forEach((p, i) => lines.push(...formatProblemSection(p, i)));
  } else {
    lines.push("Problem 1: —");
    lines.push("Assessment", "—", "");
    lines.push("Diagnosis", "—", "");
    lines.push("Differential diagnosis", "—", "");
    lines.push("Plan", "—", "");
    lines.push("What to ask next", "—", "");
    lines.push("What to examine next", "—", "");
    lines.push("");
  }

  lines.push("Disposition");
  lines.push(nl(ai.obGyneDisposition));
  lines.push("");
  lines.push("Advice / warning signs");
  lines.push(nl(ai.patientAdvice));

  return lines.join("\n").trim();
}

/**
 * Trauma export — mechanism → time → primary survey → secondary → problems → assessment → plan (incl. imaging) → disposition.
 */
export function formatTraumaClinicalNoteLayout(ai: OpdAiClinicalNoteJson): string {
  const lines: string[] = [];
  const mechanism = nl(ai.traumaMechanism) !== "—" ? nl(ai.traumaMechanism) : nl(ai.cc);

  lines.push("Mechanism of injury");
  lines.push(mechanism);
  lines.push("");
  lines.push("Time of injury");
  lines.push(nl(ai.traumaTimeOfInjury));
  lines.push("");
  lines.push("Primary survey");
  lines.push(...formatErPrimarySurveyLines(ai.traumaPrimarySurvey));
  lines.push("");
  lines.push("Secondary survey");
  const sec = nl(ai.traumaSecondarySurvey) !== "—" ? nl(ai.traumaSecondarySurvey) : nl(ai.pe);
  lines.push(sec);
  lines.push("");
  lines.push(...formatInvestigationsSectionLines(ai));
  lines.push("Problem list");
  lines.push(...formatProblemListLines(ai));
  lines.push("");

  let ass = nl(ai.traumaFocusedAssessment);
  if (ass === "—") {
    const parts = (ai.problems ?? []).map((p) => p.assessment.trim()).filter(Boolean);
    ass = parts.length ? parts.join("\n\n") : "—";
  }
  lines.push("Assessment");
  lines.push(ass);
  lines.push("");

  let planBlock = nl(ai.traumaPlan);
  if (planBlock === "—") {
    const plans = (ai.problems ?? []).map((p) => p.plan.trim()).filter(Boolean);
    planBlock = plans.length ? plans.join("\n\n") : "—";
  }
  const img = nl(ai.traumaImagingProcedure);
  if (img !== "—") {
    planBlock =
      planBlock === "—"
        ? `Imaging / procedure considerations:\n${img}`
        : `${planBlock}\n\nImaging / procedure considerations:\n${img}`;
  }
  lines.push("Plan");
  lines.push(planBlock);
  lines.push("");
  lines.push("Disposition");
  const disp = nl(ai.traumaDisposition) !== "—" ? nl(ai.traumaDisposition) : nl(ai.patientAdvice);
  lines.push(disp);

  return lines.join("\n").trim();
}

/**
 * PSYCH export — chief concern → HPI → risk → MSE → problems → assessment → plan → disposition/referral.
 */
export function formatPsychClinicalNoteLayout(ai: OpdAiClinicalNoteJson): string {
  const lines: string[] = [];
  const chief = nl(ai.psychChiefConcern) !== "—" ? nl(ai.psychChiefConcern) : nl(ai.cc);
  const hpi = nl(ai.psychHpi) !== "—" ? nl(ai.psychHpi) : nl(ai.pi);

  lines.push("Chief psychiatric concern");
  lines.push(chief);
  lines.push("");
  lines.push("History of present illness");
  lines.push(hpi);
  lines.push("");
  lines.push("Risk assessment");
  lines.push(...formatPsychRiskBlock(ai.psychRiskAssessment));
  lines.push("");
  lines.push("Mental status examination");
  lines.push(nl(ai.psychMentalStatusExam) !== "—" ? nl(ai.psychMentalStatusExam) : nl(ai.pe));
  lines.push("");
  lines.push(...formatInvestigationsSectionLines(ai));
  lines.push("Problem list");
  lines.push(...formatProblemListLines(ai));
  lines.push("");

  let ass = nl(ai.psychSynthesisAssessment);
  if (ass === "—") {
    const parts = (ai.problems ?? []).map((p) => p.assessment.trim()).filter(Boolean);
    ass = parts.length ? parts.join("\n\n") : "—";
  }
  lines.push("Assessment");
  lines.push(ass);
  lines.push("");

  let planBlock = nl(ai.psychPlan);
  if (planBlock === "—") {
    const plans = (ai.problems ?? []).map((p) => p.plan.trim()).filter(Boolean);
    planBlock = plans.length ? plans.join("\n\n") : "—";
  }
  lines.push("Plan");
  lines.push(planBlock);
  lines.push("");
  lines.push("Disposition / referral");
  const disp = nl(ai.psychDispositionReferral) !== "—" ? nl(ai.psychDispositionReferral) : nl(ai.patientAdvice);
  lines.push(disp);

  return lines.join("\n").trim();
}

/**
 * Thai export layout from AI JSON — OPD (default), ER, TRAUMA, PSYCH, LABOR_ROOM, or GYNE.
 */
export function formatOpdClinicalNoteLayout(
  ai: OpdAiClinicalNoteJson,
  mode: AssistMode = "OPD",
  opts?: OpdClinicalNoteLayoutOptions,
): string {
  if (mode === "ER") return formatErClinicalNoteLayout(ai, opts);
  if (mode === "TRAUMA") return formatTraumaClinicalNoteLayout(ai);
  if (mode === "PSYCH") return formatPsychClinicalNoteLayout(ai);
  if (mode === "LABOR_ROOM") return formatLaborGyneClinicalNoteLayout(ai, "LABOR_ROOM");
  if (mode === "GYNE") return formatLaborGyneClinicalNoteLayout(ai, "GYNE");
  return formatOpdClinicalNoteLayoutOpd(ai);
}

function formatErClinicalNoteFromRule(analysis: OpdAssistRuleAnalysis): string {
  const sn = analysis.structuredNote;
  const l1 = analysis.opdFramework.layer1;
  const blocks = analysis.opdFramework.layer2;

  const hist = [nl(sn.pi)];
  const pmh = nl(sn.pastHistory) || nl(l1.pastHistoryAndMeds);
  if (pmh !== "—") hist.push(`PMH / allergy / meds: ${pmh}`);
  const histBlock = hist.filter((x) => x !== "—").join("\n\n") || "—";

  const problemLines: string[] = [];
  if (blocks.length) {
    blocks.forEach((b, i) => {
      problemLines.push(`${i + 1}. ${b.system}: ${b.summaryLine}`);
    });
  } else {
    const pl = l1.problemListOrDx.trim();
    if (!pl) {
      problemLines.push("—");
    } else {
      pl.split(/\r?\n/)
        .filter(Boolean)
        .forEach((l, i) => problemLines.push(`${i + 1}. ${l.replace(/^\d+\.?\s*/, "")}`));
    }
  }

  if (analysis.erImmediateLifeThreat.reorderNarrative) {
    const lines: string[] = [];
    lines.push("Immediate concern");
    lines.push(nl(sn.cc));
    lines.push("");
    lines.push("Critical vitals & focused exam");
    lines.push("Primary survey (A–E)");
    lines.push("A: —", "B: —", "C: —", "D: —", "E: —");
    lines.push("");
    lines.push("Focused exam");
    lines.push(nl(sn.pe) || nl(l1.physicalExamSignificant));
    lines.push("");
    lines.push("Immediate management");
    lines.push(nl(sn.plan) || nl(l1.treatmentAndMeds) || "—");
    lines.push("");
    lines.push("Focused history");
    lines.push(histBlock);
    lines.push("");
    lines.push("Problem list");
    lines.push(...problemLines);
    lines.push("");
    lines.push("Reassessment");
    lines.push("—");
    lines.push("");
    lines.push("Disposition");
    lines.push(nl(sn.patientAdvice) || nl(l1.adviceFollowUp));

    return lines.join("\n").trim();
  }

  const lines: string[] = [];
  lines.push("Triage concern");
  lines.push(nl(sn.cc));
  lines.push("");
  lines.push("Primary survey / immediate concern");
  lines.push("A: —", "B: —", "C: —", "D: —", "E: —");
  lines.push("");
  lines.push("Focused history");
  lines.push(histBlock);
  lines.push("");
  lines.push("Focused exam");
  lines.push(nl(sn.pe) || nl(l1.physicalExamSignificant));
  lines.push("");
  lines.push("Problem list");
  lines.push(...problemLines);
  lines.push("");
  lines.push("Immediate management");
  lines.push(nl(sn.plan) || nl(l1.treatmentAndMeds) || "—");
  lines.push("");
  lines.push("Reassessment");
  lines.push("—");
  lines.push("");
  lines.push("Disposition");
  lines.push(nl(sn.patientAdvice) || nl(l1.adviceFollowUp));

  return lines.join("\n").trim();
}

/**
 * Same layout from rule-only analysis (no AI / AI failed) — best-effort from structured note + layer2.
 */
function formatTraumaClinicalNoteFromRule(analysis: OpdAssistRuleAnalysis): string {
  const sn = analysis.structuredNote;
  const l1 = analysis.opdFramework.layer1;
  const blocks = analysis.opdFramework.layer2;

  const lines: string[] = [];
  lines.push("Mechanism of injury");
  lines.push(nl(sn.cc));
  lines.push("");
  lines.push("Time of injury");
  lines.push("—");
  lines.push("");
  lines.push("Primary survey");
  lines.push("A: —", "B: —", "C: —", "D: —", "E: —");
  lines.push("");
  lines.push("Secondary survey");
  lines.push(nl(sn.pe) || nl(l1.physicalExamSignificant) || "—");
  lines.push("");
  lines.push("Problem list");
  if (blocks.length) {
    blocks.forEach((b, i) => {
      lines.push(`${i + 1}. ${b.system}: ${b.summaryLine}`);
    });
  } else {
    const pl = l1.problemListOrDx.trim();
    if (!pl) lines.push("—");
    else {
      pl.split(/\r?\n/)
        .filter(Boolean)
        .forEach((l, i) => lines.push(`${i + 1}. ${l.replace(/^\d+\.?\s*/, "")}`));
    }
  }
  lines.push("");
  lines.push("Assessment");
  lines.push(nl(sn.assessment));
  lines.push("");
  lines.push("Plan");
  lines.push(nl(sn.plan) || nl(l1.treatmentAndMeds) || "—");
  lines.push("");
  lines.push("Disposition");
  lines.push(nl(sn.patientAdvice) || nl(l1.adviceFollowUp));

  return lines.join("\n").trim();
}

function formatPsychClinicalNoteFromRule(analysis: OpdAssistRuleAnalysis): string {
  const sn = analysis.structuredNote;
  const l1 = analysis.opdFramework.layer1;
  const blocks = analysis.opdFramework.layer2;

  const lines: string[] = [];
  lines.push("Chief psychiatric concern");
  lines.push(nl(sn.cc));
  lines.push("");
  lines.push("History of present illness");
  lines.push(nl(sn.pi));
  lines.push("");
  lines.push("Risk assessment");
  lines.push(...formatPsychRiskBlock(undefined));
  lines.push("");
  lines.push("Mental status examination");
  lines.push(nl(sn.pe) || nl(l1.physicalExamSignificant) || "—");
  lines.push("");
  lines.push("Problem list");
  if (blocks.length) {
    blocks.forEach((b, i) => {
      lines.push(`${i + 1}. ${b.system}: ${b.summaryLine}`);
    });
  } else {
    const pl = l1.problemListOrDx.trim();
    if (!pl) lines.push("—");
    else {
      pl.split(/\r?\n/)
        .filter(Boolean)
        .forEach((l, i) => lines.push(`${i + 1}. ${l.replace(/^\d+\.?\s*/, "")}`));
    }
  }
  lines.push("");
  lines.push("Assessment");
  lines.push(nl(sn.assessment));
  lines.push("");
  lines.push("Plan");
  lines.push(nl(sn.plan) || nl(l1.treatmentAndMeds) || "—");
  lines.push("");
  lines.push("Disposition / referral");
  lines.push(nl(sn.patientAdvice) || nl(l1.adviceFollowUp));

  return lines.join("\n").trim();
}

function formatLaborGyneClinicalNoteFromRule(analysis: OpdAssistRuleAnalysis, mode: "LABOR_ROOM" | "GYNE"): string {
  const sn = analysis.structuredNote;
  const l1 = analysis.opdFramework.layer1;
  const blocks = analysis.opdFramework.layer2;

  const lines: string[] = [];
  lines.push("Pregnancy status");
  lines.push("—");
  lines.push("");
  lines.push("Gestational age (GA / EGA)");
  lines.push("—");
  lines.push("");
  lines.push("Bleeding severity (structured)");
  lines.push("—");
  lines.push("");
  lines.push("Clinical pathway");
  lines.push("—");
  lines.push("");
  const summaryTitle = mode === "LABOR_ROOM" ? "Clinical summary (obstetric triage)" : "Clinical summary (gynecologic triage)";
  lines.push(summaryTitle);
  lines.push("—");
  lines.push("");
  lines.push("CC");
  lines.push(nl(sn.cc));
  lines.push("");
  lines.push("PI");
  lines.push(nl(sn.pi));
  lines.push("");
  lines.push("Past history / medication / allergy");
  lines.push(nl(sn.pastHistory) || nl(l1.pastHistoryAndMeds));
  lines.push("");
  lines.push("PE");
  lines.push(nl(sn.pe) || nl(l1.physicalExamSignificant));
  lines.push("");
  lines.push("Problem list");
  if (blocks.length) {
    blocks.forEach((b, i) => {
      lines.push(`${i + 1}. ${b.system}: ${b.summaryLine}`);
    });
  } else {
    const pl = l1.problemListOrDx.trim();
    if (!pl) {
      lines.push("—");
    } else {
      pl.split(/\r?\n/)
        .filter(Boolean)
        .forEach((l, i) => lines.push(`${i + 1}. ${l.replace(/^\d+\.?\s*/, "")}`));
    }
  }
  lines.push("");

  if (blocks.length) {
    blocks.forEach((b, i) => {
      lines.push(`Problem ${i + 1}: ${b.system}`);
      lines.push("Assessment");
      lines.push(nl(b.assessment) || nl(sn.assessment));
      lines.push("");
      lines.push("Diagnosis");
      lines.push(nl(b.diagnosis) || nl(sn.diagnosis));
      lines.push("");
      lines.push("Differential diagnosis");
      lines.push(formatDifferentialBlock(b.differential ?? sn.differential));
      lines.push("");
      lines.push("Plan");
      lines.push(nl(b.plan) || nl(sn.plan) || nl(l1.treatmentAndMeds));
      lines.push("");
      lines.push("What to ask next");
      lines.push(formatBulletList(b.historyAskNext));
      lines.push("");
      lines.push("What to examine next");
      lines.push(formatBulletList(b.examFocusNext));
      lines.push("");
    });
  } else {
    lines.push("Problem 1: สรุปคลินิก");
    lines.push("Assessment");
    lines.push(nl(sn.assessment));
    lines.push("");
    lines.push("Diagnosis");
    lines.push(nl(sn.diagnosis));
    lines.push("");
    lines.push("Differential diagnosis");
    lines.push(formatDifferentialBlock(sn.differential));
    lines.push("");
    lines.push("Plan");
    lines.push(nl(sn.plan) || nl(l1.treatmentAndMeds));
    lines.push("");
    lines.push("What to ask next");
    lines.push("—");
    lines.push("");
    lines.push("What to examine next");
    lines.push("—");
    lines.push("");
  }

  lines.push("Disposition");
  lines.push("—");
  lines.push("");
  lines.push("Advice / warning signs");
  lines.push(nl(sn.patientAdvice) || nl(l1.adviceFollowUp));

  return lines.join("\n").trim();
}

export function formatOpdClinicalNoteFromRule(analysis: OpdAssistRuleAnalysis): string {
  if (analysis.mode === "ER") {
    return formatErClinicalNoteFromRule(analysis);
  }
  if (analysis.mode === "TRAUMA") {
    return formatTraumaClinicalNoteFromRule(analysis);
  }
  if (analysis.mode === "PSYCH") {
    return formatPsychClinicalNoteFromRule(analysis);
  }
  if (analysis.mode === "LABOR_ROOM" || analysis.mode === "GYNE") {
    return formatLaborGyneClinicalNoteFromRule(analysis, analysis.mode);
  }

  const sn = analysis.structuredNote;
  const l1 = analysis.opdFramework.layer1;
  const blocks = analysis.opdFramework.layer2;

  const lines: string[] = [];
  lines.push("CC");
  lines.push(nl(sn.cc));
  lines.push("");
  lines.push("PI");
  lines.push(nl(sn.pi));
  lines.push("");
  lines.push("Past history / medication / allergy");
  lines.push(nl(sn.pastHistory) || nl(l1.pastHistoryAndMeds));
  lines.push("");
  lines.push("PE");
  lines.push(nl(sn.pe) || nl(l1.physicalExamSignificant));
  lines.push("");
  lines.push("Problem list");
  if (blocks.length) {
    blocks.forEach((b, i) => {
      lines.push(`${i + 1}. ${b.system}: ${b.summaryLine}`);
    });
  } else {
    const pl = l1.problemListOrDx.trim();
    if (!pl) {
      lines.push("—");
    } else {
      pl.split(/\r?\n/)
        .filter(Boolean)
        .forEach((l, i) => lines.push(`${i + 1}. ${l.replace(/^\d+\.?\s*/, "")}`));
    }
  }
  lines.push("");

  if (blocks.length) {
    blocks.forEach((b, i) => {
      lines.push(`Problem ${i + 1}: ${b.system}`);
      lines.push("Assessment");
      lines.push(nl(b.assessment) || nl(sn.assessment));
      lines.push("");
      lines.push("Diagnosis");
      lines.push(nl(b.diagnosis) || nl(sn.diagnosis));
      lines.push("");
      lines.push("Differential diagnosis");
      lines.push(formatDifferentialBlock(b.differential ?? sn.differential));
      lines.push("");
      lines.push("Plan");
      lines.push(nl(b.plan) || nl(sn.plan) || nl(l1.treatmentAndMeds));
      lines.push("");
      lines.push("What to ask next");
      lines.push(formatBulletList(b.historyAskNext));
      lines.push("");
      lines.push("What to examine next");
      lines.push(formatBulletList(b.examFocusNext));
      lines.push("");
    });
  } else {
    lines.push("Problem 1: สรุปคลินิก");
    lines.push("Assessment");
    lines.push(nl(sn.assessment));
    lines.push("");
    lines.push("Diagnosis");
    lines.push(nl(sn.diagnosis));
    lines.push("");
    lines.push("Differential diagnosis");
    lines.push(formatDifferentialBlock(sn.differential));
    lines.push("");
    lines.push("Plan");
    lines.push(nl(sn.plan) || nl(l1.treatmentAndMeds));
    lines.push("");
    lines.push("What to ask next");
    lines.push("—");
    lines.push("");
    lines.push("What to examine next");
    lines.push("—");
    lines.push("");
  }

  lines.push("Advice / warning signs");
  lines.push(nl(sn.patientAdvice) || nl(l1.adviceFollowUp));

  return lines.join("\n").trim();
}
