/**
 * Structured medication support for OPD clinical packs (rule + AI layers).
 * Explicit missing fields — never omit unknown dose/route/etc.
 */
import { uniq } from "./cardTypes";

export const MEDICATION_FIELD_MISSING = "—";

/** One medication line — use MEDICATION_FIELD_MISSING when unknown (do not omit keys). */
export type OpdStructuredMedicationLineV1 = {
  tier: "suggested" | "finalized";
  drugName: string;
  strength: string;
  dosePerAdministration: string;
  route: string;
  frequency: string;
  timingInstruction: string;
  duration: string;
  prnCondition: string;
  maxDailyDose: string;
  pediatricWeightBasedNote: string;
};

export type OpdMedicationSafetyFlagsV1 = {
  allergyConflicts: string[];
  existingMedicationConflicts: string[];
};

export type MedicationSupportContextV1 = {
  /** Documented or inferred pediatric visit — triggers weight rules */
  pediatricPatientLikely: boolean;
  /** Numeric kg from explicit weight phrase */
  reliableWeightKg: number | null;
  /** True when pediatric and no reliable weight — block mg/kg amounts in output */
  blockPediatricWeightBasedNumericalDosing: boolean;
  /** Short extracts for conflict checks */
  allergyTextForCheck: string;
  currentMedicationsTextForCheck: string;
};

function normField(v: unknown): string {
  const s = String(v ?? "").trim();
  return s.length ? s : MEDICATION_FIELD_MISSING;
}

export function emptyMedicationLine(tier: "suggested" | "finalized"): OpdStructuredMedicationLineV1 {
  return {
    tier,
    drugName: MEDICATION_FIELD_MISSING,
    strength: MEDICATION_FIELD_MISSING,
    dosePerAdministration: MEDICATION_FIELD_MISSING,
    route: MEDICATION_FIELD_MISSING,
    frequency: MEDICATION_FIELD_MISSING,
    timingInstruction: MEDICATION_FIELD_MISSING,
    duration: MEDICATION_FIELD_MISSING,
    prnCondition: MEDICATION_FIELD_MISSING,
    maxDailyDose: MEDICATION_FIELD_MISSING,
    pediatricWeightBasedNote: MEDICATION_FIELD_MISSING,
  };
}

export function normalizeMedicationLine(raw: unknown, defaultTier: "suggested" | "finalized"): OpdStructuredMedicationLineV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const drugName = normField(o.drugName);
  if (drugName === MEDICATION_FIELD_MISSING) return null;
  const tier: "suggested" | "finalized" = o.tier === "finalized" ? "finalized" : defaultTier;
  return {
    tier,
    drugName,
    strength: normField(o.strength),
    dosePerAdministration: normField(o.dosePerAdministration),
    route: normField(o.route),
    frequency: normField(o.frequency),
    timingInstruction: normField(o.timingInstruction),
    duration: normField(o.duration),
    prnCondition: normField(o.prnCondition),
    maxDailyDose: normField(o.maxDailyDose),
    pediatricWeightBasedNote: normField(o.pediatricWeightBasedNote),
  };
}

/** Extract weight in kg when clearly documented (e.g. "15 kg", "น้ำหนัก 12 กก.") */
export function extractReliableWeightKg(text: string): number | null {
  const t = text.toLowerCase();
  const m =
    t.match(/\b(\d+(?:\.\d+)?)\s*kg\b/) ||
    t.match(/น้ำหนัก\s*(\d+(?:\.\d+)?)\s*(?:kg|กก|กิโล)/i) ||
    t.match(/bw\s*(\d+(?:\.\d+)?)\s*kg/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 250) return null;
  return n;
}

/** Age < 18 years — loose pattern for outpatient text */
export function detectPediatricPatientLikely(text: string): boolean {
  const t = text.toLowerCase();
  if (/\b\d+\s*(day|days|week|weeks|month|months|mo|mos)\s*old\b/i.test(t)) return true;
  const ageYearsExplicit = t.match(/(?:อายุ|age)\s*(\d+)\s*(?:ปี|year|y\.o\.)/i)?.[1];
  if (ageYearsExplicit) {
    const y = Number(ageYearsExplicit);
    if (Number.isFinite(y) && y < 18) return true;
  }
  const ageCup = t.match(/(\d+)\s*(?:ขวบ|ควบ)(?:\s|$)/);
  if (ageCup) {
    const y = Number(ageCup[1]);
    if (Number.isFinite(y) && y < 18) return true;
  }
  if (/\b(infant|neonate|newborn|ทารก|เด็กเล็ก|pediatric|paediatric)\b/i.test(t)) return true;
  const mo = t.match(/\b(\d+)\s*(?:mo|mos|month|months)\b/i);
  if (mo && Number(mo[1]) <= 216) return true;
  return false;
}

export function buildMedicationSupportContext(
  normalizedText: string,
  drugAllergy: string,
  pastHistoryAndMeds: string,
): MedicationSupportContextV1 {
  const pediatricPatientLikely = detectPediatricPatientLikely(normalizedText);
  const reliableWeightKg = extractReliableWeightKg(normalizedText);
  const blockPediatricWeightBasedNumericalDosing = pediatricPatientLikely && reliableWeightKg === null;
  return {
    pediatricPatientLikely,
    reliableWeightKg,
    blockPediatricWeightBasedNumericalDosing,
    allergyTextForCheck: `${drugAllergy} ${pastHistoryAndMeds}`.trim(),
    currentMedicationsTextForCheck: pastHistoryAndMeds.trim(),
  };
}

type ClassRule = { re: RegExp; label: string; allergyTriggers: RegExp[] };

const ALLERGY_CLASS_RULES: ClassRule[] = [
  {
    re: /\b(amoxicillin|ampicillin|penicillin|cef[a-z]+|cephalexin|ceftriaxone)\b/i,
    label: "beta-lactam",
    allergyTriggers: [/\bpenicillin\b/i, /\bpcn\b/i, /\bแพ้เพนิซิลลิน/i, /\bcephalospor/i, /\bcef[a-z]/i],
  },
  {
    re: /\b(sulfa|sulfamethoxazole|tmp-smx|cotrimoxazole|trimethoprim)\b/i,
    label: "sulfa / TMP-SMX",
    allergyTriggers: [/\bsulfa\b/i, /\bsulfonamide/i, /\btmp-smx/i, /\bcotrimox/i],
  },
  {
    re: /\b(ibuprofen|diclofenac|naproxen|meloxicam|celecoxib|nsaid)\b/i,
    label: "NSAID",
    allergyTriggers: [/\bnsaid\b/i, /\bibuprofen/i, /\bdiclofenac/i, /\bแพ้ยาแก้ปวด/i],
  },
  {
    re: /\b(aspirin|asa)\b/i,
    label: "aspirin",
    allergyTriggers: [/\baspirin\b/i, /\bsalicylate/i],
  },
  {
    re: /\b(codeine|tramadol|morphine|oxycodone)\b/i,
    label: "opioid",
    allergyTriggers: [/\bopioid\b/i, /\bcodeine/i, /\bmorphine/i],
  },
];

export function evaluateAllergyConflicts(drugName: string, allergyNarrative: string): string[] {
  const out: string[] = [];
  const drug = drugName.toLowerCase();
  const allergy = allergyNarrative.toLowerCase();
  if (!drug || drug === "—" || allergy.length < 2) return out;
  if (/nkda|no known drug allergy|ไม่แพ้ยา|no allergy/i.test(allergy)) return out;

  for (const rule of ALLERGY_CLASS_RULES) {
    if (!rule.re.test(drug)) continue;
    for (const trig of rule.allergyTriggers) {
      if (trig.test(allergy)) {
        out.push(`สังเกต: ${drugName.trim()} (${rule.label}) vs allergy narrative — verify class cross-reactivity / alternative`);
        break;
      }
    }
  }
  return uniq(out);
}

/** Heuristic duplicate / overlap with home meds narrative */
export function evaluateExistingMedicationConflicts(drugName: string, currentMedsNarrative: string): string[] {
  const out: string[] = [];
  const drug = drugName.toLowerCase().trim();
  if (!drug || drug === "—" || currentMedsNarrative.length < 3) return out;
  const med = currentMedsNarrative.toLowerCase();
  const tokens = drug.split(/[\s/]+/).filter((t) => t.length >= 4);
  for (const tok of tokens) {
    if (med.includes(tok)) {
      out.push(`สังเกต: ${drugName.trim()} อาจซ้ำกับยาที่ผู้ป่วยใช้อยู่ — ตรวจสอบรายการยาประจำ`);
      break;
    }
  }
  return out;
}

export function mergeMedicationSafetyFlags(
  suggested: OpdStructuredMedicationLineV1[] | undefined,
  finalized: OpdStructuredMedicationLineV1[] | undefined,
  allergyText: string,
  pmhMedsText: string,
): OpdMedicationSafetyFlagsV1 {
  const allergyConflicts: string[] = [];
  const existingMedicationConflicts: string[] = [];
  const lines = [...(suggested ?? []), ...(finalized ?? [])];
  for (const line of lines) {
    allergyConflicts.push(...evaluateAllergyConflicts(line.drugName, allergyText));
    existingMedicationConflicts.push(...evaluateExistingMedicationConflicts(line.drugName, pmhMedsText));
  }
  return {
    allergyConflicts: uniq(allergyConflicts),
    existingMedicationConflicts: uniq(existingMedicationConflicts),
  };
}

const MG_KG_PATTERN = /\b\d+(?:\.\d+)?\s*mg\s*\/\s*kg\b/i;

/** If pediatric without weight, flag unsafe numerical mg/kg in free text */
export function detectUnsafePediatricMgKgInText(text: string, ctx: MedicationSupportContextV1): boolean {
  if (!ctx.blockPediatricWeightBasedNumericalDosing) return false;
  return MG_KG_PATTERN.test(text);
}

export function formatMedicationLineBlockTh(line: OpdStructuredMedicationLineV1, index: number): string {
  const tierLabel = line.tier === "suggested" ? "(ร่าง/ข้อเสนอ — ไม่ใช่ใบสั่งยาสุดท้าย)" : "(ใบสั่งยา/ยืนยันแล้ว — ตรวจสอบก่อนลงลายเซ็น)";
  const rows = [
    `${index + 1}. ${line.drugName} ${tierLabel}`,
    `  ความแรง: ${line.strength}`,
    `  ขนาดต่อครั้ง: ${line.dosePerAdministration}`,
    `  ทางให้: ${line.route}`,
    `  ความถี่: ${line.frequency}`,
    `  เวลา/คำสั่งการกิน: ${line.timingInstruction}`,
    `  ระยะ: ${line.duration}`,
    `  PRN เมื่อ: ${line.prnCondition}`,
    `  สูงสุดต่อวัน: ${line.maxDailyDose}`,
    `  หมายเหตุเด็ก (mg/kg): ${line.pediatricWeightBasedNote}`,
  ];
  return rows.join("\n");
}

export function formatMedicationSupportForAiPrompt(ctx: MedicationSupportContextV1): string {
  const lines = [
    "MEDICATION_SUPPORT_CONTEXT (rule layer — fixed checks):",
    `- pediatricPatientLikely: ${ctx.pediatricPatientLikely}`,
    `- reliableWeightKg: ${ctx.reliableWeightKg ?? "null"}`,
    `- blockPediatricWeightBasedNumericalDosing: ${ctx.blockPediatricWeightBasedNumericalDosing} — if true, do NOT output numeric mg/kg doses; use "—" in pediatricWeightBasedNote and state weight needed`,
    `- allergyTextForCheck (excerpt): ${ctx.allergyTextForCheck.slice(0, 400) || "(empty)"}`,
    `- currentMedicationsTextForCheck (excerpt): ${ctx.currentMedicationsTextForCheck.slice(0, 400) || "(empty)"}`,
  ];
  return lines.join("\n");
}
