import { describe, expect, it } from "vitest";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";
import { buildDyspneaHypoxemiaErOverlay } from "../lib/chartAssist/dyspneaHypoxemiaErOverlay";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";

describe("dyspneaHypoxemiaErOverlay", () => {
  it("is inactive when no breathing cues", () => {
    const t = normalizeClinicalText("sore throat and runny nose");
    const r = buildDyspneaHypoxemiaErOverlay(t, "OPD", "opd_default", []);
    expect(r.active).toBe(false);
  });

  it("is inactive for mild wheeze only in OPD without escalation", () => {
    const t = normalizeClinicalText("mild wheeze, no fever, stable");
    const r = buildDyspneaHypoxemiaErOverlay(t, "OPD", "opd_default", []);
    expect(r.active).toBe(false);
  });

  it("activates when ER mode and dyspnea trigger", () => {
    const t = normalizeClinicalText("dyspnea and cough, came to ER");
    const r = buildDyspneaHypoxemiaErOverlay(t, "ER", "er_dyspnea_hypoxemia", []);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.askNext.length).toBeGreaterThan(3);
      expect(r.examNext.some((x) => /SpO/i.test(x))).toBe(true);
    }
  });

  it("activates when OPD but text has severe dyspnea + hypoxemia pattern", () => {
    const t = normalizeClinicalText("severe dyspnea, SpO2 88% on room air");
    const r = buildDyspneaHypoxemiaErOverlay(t, "OPD", "opd_default", []);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.emergencyEscalationLikely).toBe(true);
    }
  });

  it("analyzeOpdCase exposes dyspneaHypoxemiaErOverlay", () => {
    const raw = "ER visit: dyspnea, wheeze, SpO2 91% RA";
    const r = analyzeOpdCase(raw, "ER");
    expect(r.dyspneaHypoxemiaErOverlay.active).toBe(true);
  });
});
