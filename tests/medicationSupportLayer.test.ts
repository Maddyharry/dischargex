import { describe, expect, it } from "vitest";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";
import {
  buildMedicationSupportContext,
  detectUnsafePediatricMgKgInText,
  evaluateAllergyConflicts,
  evaluateExistingMedicationConflicts,
  extractReliableWeightKg,
  mergeMedicationSafetyFlags,
} from "../lib/chartAssist/medicationSupportLayer";

function n(s: string) {
  return normalizeClinicalText(s);
}

describe("extractReliableWeightKg", () => {
  it("parses kg", () => {
    expect(extractReliableWeightKg(n("weight 15.5 kg"))).toBe(15.5);
  });

  it("returns null without weight", () => {
    expect(extractReliableWeightKg(n("fever only"))).toBe(null);
  });
});

describe("buildMedicationSupportContext", () => {
  it("blocks pediatric mg/kg without weight", () => {
    const ctx = buildMedicationSupportContext(n("อายุ 5 ปี ไข้"), "", "");
    expect(ctx.pediatricPatientLikely).toBe(true);
    expect(ctx.reliableWeightKg).toBe(null);
    expect(ctx.blockPediatricWeightBasedNumericalDosing).toBe(true);
  });

  it("allows weight when documented", () => {
    const ctx = buildMedicationSupportContext(n("อายุ 5 ปี น้ำหนัก 18 kg"), "", "");
    expect(ctx.reliableWeightKg).toBe(18);
    expect(ctx.blockPediatricWeightBasedNumericalDosing).toBe(false);
  });
});

describe("detectUnsafePediatricMgKgInText", () => {
  it("flags mg/kg when pediatric without weight", () => {
    const ctx = buildMedicationSupportContext(n("อายุ 2 ปี"), "", "");
    expect(detectUnsafePediatricMgKgInText('{"dose":"10 mg/kg"}', ctx)).toBe(true);
  });
});

describe("mergeMedicationSafetyFlags", () => {
  it("merges allergy hints", () => {
    const f = mergeMedicationSafetyFlags(
      [{ tier: "suggested", drugName: "amoxicillin", strength: "—", dosePerAdministration: "—", route: "—", frequency: "—", timingInstruction: "—", duration: "—", prnCondition: "—", maxDailyDose: "—", pediatricWeightBasedNote: "—" }],
      undefined,
      "แพ้ penicillin anaphylaxis",
      "",
    );
    expect(f.allergyConflicts.some((x) => /beta-lactam|penicillin/i.test(x))).toBe(true);
  });

  it("flags duplicate with home med text", () => {
    const f = mergeMedicationSafetyFlags(
      [{ tier: "suggested", drugName: "ibuprofen", strength: "—", dosePerAdministration: "—", route: "—", frequency: "—", timingInstruction: "—", duration: "—", prnCondition: "—", maxDailyDose: "—", pediatricWeightBasedNote: "—" }],
      undefined,
      "",
      "ทาน ibuprofen 400 mg อยู่แล้ว",
    );
    expect(f.existingMedicationConflicts.length).toBeGreaterThan(0);
  });
});

describe("evaluateAllergyConflicts", () => {
  it("returns empty for NKDA", () => {
    expect(evaluateAllergyConflicts("amoxicillin", "NKDA").length).toBe(0);
  });
});

describe("evaluateExistingMedicationConflicts", () => {
  it("returns empty when no overlap", () => {
    expect(evaluateExistingMedicationConflicts("azithromycin", "metformin only").length).toBe(0);
  });
});
