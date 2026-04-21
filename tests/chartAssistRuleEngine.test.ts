import { describe, expect, it } from "vitest";
import { analyzeChartCase } from "../lib/chartAssist/ruleEngine";
import { detectVisitMode } from "../lib/chartAssist/triggers";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";

function n(s: string) {
  return normalizeClinicalText(s);
}

describe("detectVisitMode", () => {
  it("defaults to OPD for mild URI", () => {
    const r = detectVisitMode(n("ไข้ เจ็บคอ ไอ"), null);
    expect(r.mode).toBe("OPD");
  });

  it("detects trauma when mechanism present", () => {
    const r = detectVisitMode(n("head trauma after RTA"), null);
    expect(r.mode).toBe("TRAUMA");
  });
});

describe("analyzeChartCase", () => {
  it("returns ABCDE safety framework in trauma mode", () => {
    const r = analyzeChartCase("motor vehicle accident head injury", null);
    expect(r.mode).toBe("TRAUMA");
    expect(r.safetySweep.framework).toBe("ABCDE");
    expect(r.safetySweep.items.some((i) => i.label === "E")).toBe(true);
  });

  it("includes head injury card when cues present", () => {
    const r = analyzeChartCase("หัวกระแทก อาเจียน 3 ครั้ง", null);
    expect(r.diseaseCards.some((c) => c.id.includes("head") || c.label.toLowerCase().includes("head"))).toBe(
      true,
    );
  });

  it("includes URI card for cough and nasal symptoms (Thai cues)", () => {
    const r = analyzeChartCase("ไข้ ไอ น้ำมูก", null);
    expect(r.diseaseCards.some((c) => c.id === "uri-wheeze")).toBe(true);
    expect(r.problemList.some((p) => /uri|wheeze|respiratory/i.test(p))).toBe(true);
  });

  it("includes bloody diarrhea card when blood in stool", () => {
    const r = analyzeChartCase("ท้องเสีย ถ่ายเป็นเลือด", null);
    expect(r.diseaseCards.some((c) => c.id.includes("bloody") || /blood|diarrhea/i.test(c.label))).toBe(true);
  });

  it("emits medicationDraft with missing fields when insufficient context", () => {
    const r = analyzeChartCase("ไอ", null);
    expect(r.medicationDraft.status).toBe("insufficient_context");
    expect(r.medicationDraft.missingFields.length).toBeGreaterThan(0);
    expect(r.medicationDraft.suggestedMedicationBlueprint?.drugName).toBe("—");
    expect(r.medicationDraft.suggestedMedicationBlueprint?.tier).toBe("suggested");
  });

  it("respects mode override", () => {
    const r = analyzeChartCase("mild cough", "ER");
    expect(r.mode).toBe("ER");
    expect(r.safetySweep.framework).toBe("ABCD");
  });
});
