/**
 * Chart Assist Lab V1 — pure rule analysis (no LLM).
 */
import type { AssistCardResult, AssistMode, ParsedCaseFact } from "./cardTypes";
import type { ChartAssistUrgency, ChartRuleAnalysis, MedicationDraftV1 } from "./types";
import { buildParsedCaseFact, normalizeClinicalText } from "./parseCaseFacts";
import { detectVisitMode } from "./triggers";
import { buildSafetySweep } from "./safetyEngine";
import { buildCaseClinicalProfile } from "./caseClinicalProfile";
import { buildUriWheezeCard, shouldShowUriWheezeCard } from "./cards/uriWheezeCard";
import { buildBloodyDiarrheaCard, shouldShowBloodyDiarrheaCard } from "./cards/bloodyDiarrheaCard";
import { buildHeadInjuryCard, shouldShowHeadInjuryCard } from "./cards/headInjuryCard";
import { getReferencesByIds } from "./referenceCatalog";
import type { ReferenceTopic } from "./referenceCatalog";
import { referenceMap } from "./referenceCatalog";
import { guidelineHintsForTopics } from "./guidelineHints";
import { hasAny } from "./cardTypes";
import { emptyMedicationLine } from "./medicationSupportLayer";

export const CHART_ASSIST_RULE_VERSION = "chart-assist-v1";

function mapModeToUrgency(mode: AssistMode): ChartAssistUrgency {
  if (mode === "TRAUMA") return "trauma_ed";
  if (mode === "ER" || mode === "LABOR_ROOM" || mode === "GYNE") return "ed";
  return "routine";
}

function topicsFromCards(cards: AssistCardResult[]): ReferenceTopic[] {
  const s = new Set<ReferenceTopic>();
  for (const c of cards) {
    for (const id of c.referenceIds) {
      const r = referenceMap[id];
      if (r) r.topics.forEach((t) => s.add(t));
    }
  }
  return [...s];
}

function buildMedicationDraftV1(parsed: ParsedCaseFact, normalized: string): MedicationDraftV1 {
  const hasAge =
    /\b\d+\s*(year|yr|y\.o\.|month|mo|ขวบ|ควบ|เดือน|ด\.)\b/i.test(normalized) ||
    /\b(อายุ|age)\s*\d+/i.test(normalized);
  const hasWeight = /\b\d+(\.\d+)?\s*kg\b/i.test(normalized);
  const hasAllergy = hasAny(normalized, ["allergy", "แพ้ยา", "no known allergy", "nkda", "ไม่แพ้"]);
  const missing: string[] = [];
  if (!hasAge) missing.push("age");
  if (!hasWeight) missing.push("weight (kg)");
  if (!hasAllergy) missing.push("drug allergy / NKDA");

  if (missing.length > 0) {
    return {
      status: "insufficient_context",
      lines: [
        "ยา: ไม่สร้างชื่อสามัญแบบเต็ม — ข้อมูลยังไม่ครบสำหรับ dosing ที่ปลอดภัย",
        "เติม: " + missing.join(", "),
        "โครงสร้างยา (ร่าง): ใช้ช่อง drugName/strength/dose/route/frequency/… — ช่องว่างให้ใช้ — ไม่ซ่อนรายการที่ยังไม่ทราบ",
      ],
      missingFields: missing,
      suggestedMedicationBlueprint: emptyMedicationLine("suggested"),
    };
  }

  return {
    status: "generic_outline",
    lines: [
      "ยา: ระบุชื่อสามัญ + ความแรง + ความถี่ + ระยะ — ตรวจสอบตามอายุ/น้ำหนัก/แพ้ยา ก่อนสั่ง",
      "หลีกเลี่ยงยาที่ไม่จำเป็น (เช่น routine antibiotic) เมื่อไม่มีข้อบ่งชี้",
      "แยก suggested (ร่าง) จาก finalized prescription ตาม protocol",
    ],
    missingFields: [],
    suggestedMedicationBlueprint: emptyMedicationLine("suggested"),
  };
}

function collectRawFacts(profile: ReturnType<typeof buildCaseClinicalProfile>, normalized: string): string[] {
  const out: string[] = [];
  if (profile.hasSystemicRedFlags) out.push("systemic / danger keywords");
  out.push(`caseType=${profile.caseType}`);
  out.push(`dominantTheme=${profile.dominantTheme}`);
  if (hasAny(normalized, ["fever", "febrile", "ไข้"])) out.push("fever mentioned");
  if (hasAny(normalized, ["ไอ", "cough"])) out.push("cough mentioned");
  return out.slice(0, 12);
}

/**
 * @param modeOverride — when set, matches `detectVisitMode` override behavior (PSYCH allowed by engine)
 */
export function analyzeChartCase(rawText: string, modeOverride: AssistMode | null): ChartRuleAnalysis {
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

  const safetySweep = buildSafetySweep(normalized, mode);

  const cards: AssistCardResult[] = [];
  if (shouldShowHeadInjuryCard(parsed)) cards.push(buildHeadInjuryCard(parsed));
  if (shouldShowBloodyDiarrheaCard(parsed)) cards.push(buildBloodyDiarrheaCard(parsed));
  if (shouldShowUriWheezeCard(parsed)) cards.push(buildUriWheezeCard(parsed));

  cards.sort((a, b) => {
    const score = { urgent: 3, warn: 2, info: 1 };
    return score[b.severity] - score[a.severity];
  });

  const diseaseCards = cards.slice(0, 3);
  const refIds = [...new Set(diseaseCards.flatMap((c) => c.referenceIds))];
  const referenceHints = getReferencesByIds(refIds);
  const guidelineHints = guidelineHintsForTopics(topicsFromCards(diseaseCards));

  return {
    mode,
    visitModeReason: visit.reason,
    urgency: mapModeToUrgency(mode),
    rawFacts: collectRawFacts(profile, normalized),
    safetySweep,
    diseaseCards,
    problemList: diseaseCards.map((c) => c.label),
    referenceHints,
    guidelineHints,
    medicationDraft: buildMedicationDraftV1(parsed, normalized),
    ruleVersion: CHART_ASSIST_RULE_VERSION,
  };
}
