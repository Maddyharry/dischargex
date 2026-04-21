import type { MinimumOpdRecord } from "./opdRecordFramework";
import type { StructuredOpdNote } from "./structuredNote";
import type { OpdAiClinicalNoteJson, OpdAiProblemJson } from "./opdAssistAiTypes";
import { formatMedicationLineBlockTh } from "./medicationSupportLayer";

/** Patterns that read as AI filler or empty platitudes — stripped lightly (do not over-delete real clinical content). */
const BANNED_PLACEHOLDERS = new RegExp(
  [
    "summarize according to actual",
    "follow up as appropriate",
    "no automated syndrome match",
    "it is important to note",
    "as mentioned above",
    "from the note",
    "according to the note",
    "according to the documentation",
    "based on the provided",
    "โดยสรุปจากข้อมูล",
    "ดังนั้น\\s*จึง",
    "ตามความเหมาะสมอย่างเดียว",
    "สรุปตามการตรวจจริงเท่านั้น",
    "ในกรณีนี้\\s*ขอแนะนำให้",
    "ควรพิจารณา\\s*อย่างระมัดระวัง",
  ].join("|"),
  "gi",
);

/** Remove generic AI boilerplate the user forbade */
export function stripBannedPlaceholders(s: string): string {
  return (s || "").replace(BANNED_PLACEHOLDERS, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function problemsToAssessmentBlock(problems: OpdAiProblemJson[]): string {
  if (!problems.length) return "";
  return problems
    .map((x) => {
      const tag = x.role === "primary" ? "ประเด็นหลัก" : "ประเด็นรอง";
      return `${tag} — ${x.title}\n${stripBannedPlaceholders(x.assessment)}`;
    })
    .join("\n\n");
}

export function problemsToDiagnosisBlock(problems: OpdAiProblemJson[]): string {
  if (!problems.length) return "";
  return problems
    .map((x) => `${x.title}: ${stripBannedPlaceholders(x.provisionalDiagnosis)}`)
    .join("\n");
}

export function problemsToDifferentialBlock(problems: OpdAiProblemJson[]): string {
  if (!problems.length) return "";
  return problems
    .map((x) => `=== ${x.title} ===\n${stripBannedPlaceholders(x.differential)}`)
    .join("\n\n");
}

function medicationsAppendForProblem(x: OpdAiProblemJson): string {
  const sug = x.suggestedMedications ?? [];
  const fin = x.finalizedMedications ?? [];
  if (!sug.length && !fin.length) return "";
  const parts: string[] = ["", "ยา (โครงสร้าง — ช่องว่าง = ยังไม่ระบุ):"];
  if (sug.length) {
    parts.push("— ข้อเสนอ (ร่าง — ไม่ใช่ใบสั่งยาสุดท้าย) —");
    sug.forEach((line, i) => parts.push(formatMedicationLineBlockTh(line, i)));
  }
  if (fin.length) {
    parts.push("— ใบสั่งยา / ยืนยันแล้ว —");
    fin.forEach((line, i) => parts.push(formatMedicationLineBlockTh(line, i + sug.length)));
  }
  const flags = x.medicationSafetyFlags;
  if (flags && (flags.allergyConflicts.length || flags.existingMedicationConflicts.length)) {
    parts.push("— แจ้งเตือนความปลอดภัย (rule assist) —");
    for (const a of flags.allergyConflicts) parts.push(`- ${a}`);
    for (const a of flags.existingMedicationConflicts) parts.push(`- ${a}`);
  }
  return parts.join("\n");
}

export function problemsToPlanBlock(problems: OpdAiProblemJson[]): string {
  if (!problems.length) return "";
  return problems
    .map((x) => {
      const base = stripBannedPlaceholders(x.plan);
      const ask =
        x.askNext?.length > 0
          ? `\nถามต่อ:\n${x.askNext.map((a) => `- ${stripBannedPlaceholders(a)}`).join("\n")}`
          : "";
      const ex =
        x.examineNext?.length > 0
          ? `\nตรวจต่อ:\n${x.examineNext.map((a) => `- ${stripBannedPlaceholders(a)}`).join("\n")}`
          : "";
      const med = medicationsAppendForProblem(x);
      return `=== ${x.title} ===\n${base}${ask}${ex}${med}`;
    })
    .join("\n\n");
}

export function buildStructuredNoteFromClinicalAi(
  ai: OpdAiClinicalNoteJson,
  ruleFallback: StructuredOpdNote,
): StructuredOpdNote {
  const problems = Array.isArray(ai.problems) ? ai.problems : [];
  const assessment = stripBannedPlaceholders(problemsToAssessmentBlock(problems)) || ruleFallback.assessment;
  const diagnosis = stripBannedPlaceholders(problemsToDiagnosisBlock(problems)) || ruleFallback.diagnosis;
  const differential = stripBannedPlaceholders(problemsToDifferentialBlock(problems)) || ruleFallback.differential;
  const plan = stripBannedPlaceholders(problemsToPlanBlock(problems)) || ruleFallback.plan;

  return {
    cc: stripBannedPlaceholders(ai.cc) || ruleFallback.cc,
    pi: stripBannedPlaceholders(ai.pi) || ruleFallback.pi,
    pastHistory: stripBannedPlaceholders(ai.pastHistoryMedsAllergy) || ruleFallback.pastHistory,
    pe: stripBannedPlaceholders(ai.pe) || ruleFallback.pe,
    assessment,
    diagnosis,
    differential,
    plan,
    patientAdvice: stripBannedPlaceholders(ai.patientAdvice) || ruleFallback.patientAdvice,
  };
}

export function buildLayer1FromClinicalAi(
  ai: OpdAiClinicalNoteJson,
  ruleLayer1: MinimumOpdRecord,
): MinimumOpdRecord {
  const pl = stripBannedPlaceholders(ai.problemList || "");
  const planText = stripBannedPlaceholders(problemsToPlanBlock(Array.isArray(ai.problems) ? ai.problems : []));
  return {
    cc: stripBannedPlaceholders(ai.cc) || ruleLayer1.cc,
    pi: stripBannedPlaceholders(ai.pi) || ruleLayer1.pi,
    drugAllergy: ruleLayer1.drugAllergy,
    pastHistoryAndMeds: stripBannedPlaceholders(ai.pastHistoryMedsAllergy) || ruleLayer1.pastHistoryAndMeds,
    vitalSigns: ruleLayer1.vitalSigns,
    physicalExamSignificant: stripBannedPlaceholders(ai.pe) || ruleLayer1.physicalExamSignificant,
    problemListOrDx: pl || ruleLayer1.problemListOrDx,
    treatmentAndMeds: planText || ruleLayer1.treatmentAndMeds,
    adviceFollowUp: stripBannedPlaceholders(ai.patientAdvice) || ruleLayer1.adviceFollowUp,
  };
}
