import { describe, expect, it } from "vitest";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";
import { buildSepsisShockErOverlay } from "../lib/chartAssist/sepsisShockErOverlay";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";

describe("sepsisShockErOverlay", () => {
  it("is inactive when no shock/sepsis cues", () => {
    const t = normalizeClinicalText("sore throat and runny nose");
    const r = buildSepsisShockErOverlay(t, "OPD", "opd_default", []);
    expect(r.active).toBe(false);
  });

  it("activates when ER mode and sepsis trigger", () => {
    const t = normalizeClinicalText("fever, suspected sepsis, came to ER");
    const r = buildSepsisShockErOverlay(t, "ER", "er_systemic_red_flags", []);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.askNext.length).toBeGreaterThan(5);
      expect(r.examNext.some((x) => /MAP|Blood pressure/i.test(x))).toBe(true);
      expect(r.pertinentNegatives.length).toBeGreaterThan(0);
      expect(r.clinicalRulesAdultPediatric.some((x) => /mimic/i.test(x))).toBe(true);
    }
  });

  it("sets emergencyEscalationLikely when septic shock or hypotension", () => {
    const t = normalizeClinicalText("septic shock, norepinephrine started, lactate 4");
    const r = buildSepsisShockErOverlay(t, "ER", "er_shock_perfusion", []);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.emergencyEscalationLikely).toBe(true);
    }
  });

  it("analyzeOpdCase exposes sepsisShockErOverlay", () => {
    const raw = "ER: hypotension, fever, concern for urosepsis";
    const r = analyzeOpdCase(raw, "ER");
    expect(r.sepsisShockErOverlay.active).toBe(true);
  });
});
