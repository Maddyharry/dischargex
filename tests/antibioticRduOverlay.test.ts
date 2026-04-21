import { describe, expect, it } from "vitest";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";
import {
  buildAntibioticRduOverlay,
  detectAntibioticRduOverlayActive,
  formatAntibioticRduOverlayForAi,
} from "../lib/chartAssist/antibioticRduOverlay";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";

function n(s: string) {
  return normalizeClinicalText(s);
}

describe("detectAntibioticRduOverlayActive", () => {
  it("activates on URI + fever", () => {
    expect(detectAntibioticRduOverlayActive(n("fever cough runny nose 3 days"))).toBe(true);
  });

  it("activates on drug name", () => {
    expect(detectAntibioticRduOverlayActive(n("take amoxicillin"))).toBe(true);
  });

  it("stays inactive on unrelated follow-up", () => {
    expect(detectAntibioticRduOverlayActive(n("follow up hypertension only"))).toBe(false);
  });
});

describe("buildAntibioticRduOverlay", () => {
  it("returns inactive when no cues", () => {
    const o = buildAntibioticRduOverlay(n("follow up chronic disease"));
    expect(o.active).toBe(false);
  });

  it("returns structured blocks when active", () => {
    const o = buildAntibioticRduOverlay(n("sore throat fever cough"));
    expect(o.active).toBe(true);
    if (!o.active) throw new Error("expected active");
    expect(o.evidenceRationale.length).toBeGreaterThan(0);
    expect(o.askNext.length).toBeGreaterThan(3);
    expect(o.examNext.length).toBeGreaterThan(3);
    expect(o.testsToStrengthenBacterial.length).toBeGreaterThan(2);
    expect(o.alternativeNonAntibioticLikely.length).toBeGreaterThan(0);
    expect(o.conditionalSupportExamples.length).toBeGreaterThan(1);
    expect(o.stewardshipRules.length).toBeGreaterThan(2);
    expect(typeof o.supportLevel).toBe("string");
  });

  it("flags severe pattern when sepsis mentioned", () => {
    const o = buildAntibioticRduOverlay(n("fever sepsis hypotension suspected"));
    expect(o.active).toBe(true);
    if (!o.active) throw new Error("expected active");
    expect(o.supportLevel).toBe("severe_complicated_pattern");
  });

  it("format includes header", () => {
    const o = buildAntibioticRduOverlay(n("uti dysuria"));
    const s = formatAntibioticRduOverlayForAi(o);
    expect(s).toContain("ANTIBIOTIC");
    expect(s).toContain("Stewardship rules:");
  });
});

describe("analyzeOpdCase antibioticRduOverlay", () => {
  it("exposes antibioticRduOverlay", () => {
    const r = analyzeOpdCase("cough fever ไอ", null);
    expect(r.antibioticRduOverlay.active).toBe(true);
  });
});
