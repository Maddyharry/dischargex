import { describe, expect, it } from "vitest";
import { createDxCoachData } from "../lib/charge-mentor";
import type { DischargeEnginePayload } from "../lib/discharge-engine/types";

function makeEngine(overrides: Partial<DischargeEnginePayload> = {}): DischargeEnginePayload {
  return {
    principal_diagnosis: {
      text: "Community acquired pneumonia",
      confidence: "confirmed_from_chart",
      evidence: [{ source: "physician_dx" }],
    },
    comorbidities: [],
    complications: [],
    other_diagnoses: [],
    external_causes: [],
    procedures_icd9: [],
    investigations: [],
    drg_estimation: {
      status: "estimated",
      drivers: [],
      possible_complexity_adders: [],
      audit_warnings: [],
    },
    documentation_gaps: [],
    coder_notes: [],
    ...overrides,
  };
}

describe("dx coach mapper", () => {
  it("returns empty when engine is null", () => {
    const result = createDxCoachData({
      engine: null,
      warnings: [],
      orderSheet: "",
    });
    expect(result.dx_coach_items).toEqual([]);
    expect(result.dx_coach_summary.total_items).toBe(0);
  });

  it("creates broad diagnosis item for symptom-based principal diagnosis", () => {
    const engine = makeEngine({
      principal_diagnosis: {
        text: "Fever",
        confidence: "confirmed_from_chart",
        evidence: [{ source: "physician_dx" }],
      },
    });
    const result = createDxCoachData({
      engine,
      warnings: [],
      orderSheet: "",
    });
    expect(result.dx_coach_items.some((c) => c.type === "broad_diagnosis")).toBe(true);
  });

  it("creates needs evidence item when warnings show weak explicit documentation", () => {
    const engine = makeEngine();
    const result = createDxCoachData({
      engine,
      warnings: ["Insufficient for sepsis without physician documentation"],
      orderSheet: "",
    });
    expect(result.dx_coach_items.some((c) => c.id === "dx-needs-provider-wording")).toBe(true);
  });

  it("creates guideline review item from F2 exclusion warning", () => {
    const engine = makeEngine();
    const result = createDxCoachData({
      engine,
      warnings: [
        "F2 exclusion: SDx A000 (Cholera due to Vibrio cholerae 01, biovar cholerae) may not increase complexity when PDx is A001. Review principal-secondary pairing and supporting evidence.",
      ],
      orderSheet: "",
    });
    expect(result.dx_coach_items.some((c) => c.id.startsWith("dx-f2-exclusion-A000-A001"))).toBe(true);
  });

  it("creates guideline review items for AGE pattern", () => {
    const engine = makeEngine({
      principal_diagnosis: {
        text: "Acute gastroenteritis",
        confidence: "confirmed_from_chart",
        evidence: [{ source: "physician_dx" }],
      },
    });
    const result = createDxCoachData({
      engine,
      warnings: [],
      orderSheet: "AGE with diarrhea and dehydration risk",
    });
    expect(result.dx_coach_items.some((c) => c.id === "dx-guideline-age")).toBe(true);
  });

  it("creates guideline review item for sepsis context", () => {
    const engine = makeEngine();
    const result = createDxCoachData({
      engine,
      warnings: [],
      orderSheet: "sepsis with hypotension and severe infection",
    });
    expect(result.dx_coach_items.some((c) => c.id === "dx-guideline-sepsis")).toBe(true);
  });

  it("creates malnutrition and dehydration guideline review items", () => {
    const engine = makeEngine();
    const result = createDxCoachData({
      engine,
      warnings: [],
      orderSheet: "AGE with poor intake, weight loss and dehydration",
    });
    expect(result.dx_coach_items.some((c) => c.id === "dx-guideline-malnutrition")).toBe(true);
    expect(result.dx_coach_items.some((c) => c.id === "dx-guideline-dehydration")).toBe(true);
  });

  it("creates dizziness, pneumonia, and hypokalemia trigger-specific items", () => {
    const engine = makeEngine({
      principal_diagnosis: {
        text: "Dizziness",
        confidence: "confirmed_from_chart",
        evidence: [{ source: "physician_dx" }],
      },
      comorbidities: [{ text: "Hypokalemia", confidence: "confirmed_from_chart", evidence: [{ source: "lab_support" }] }],
    });
    const result = createDxCoachData({
      engine,
      warnings: [],
      orderSheet: "pneumonia with oxygen support",
    });
    expect(result.dx_coach_items.some((c) => c.id === "dx-dizziness-workup")).toBe(true);
    expect(result.dx_coach_items.some((c) => c.id === "dx-pneumonia-specificity")).toBe(true);
    expect(result.dx_coach_items.some((c) => c.id === "dx-hypokalemia-evidence")).toBe(true);
  });

  it("suppresses chart hint items when configured", () => {
    const engine = makeEngine({
      chart_capture_hints: [
        {
          target_diagnosis_text: "Sepsis",
          target_icd10: "A41.9",
          missing_in_input: ["physician wording"],
          tier: "suggest_if_documented",
        },
      ],
    });
    const result = createDxCoachData({
      engine,
      warnings: [],
      orderSheet: "sepsis context",
      suppressChartHintItems: true,
    });
    expect(result.dx_coach_items.some((c) => c.source === "chart_hint")).toBe(false);
  });
});
