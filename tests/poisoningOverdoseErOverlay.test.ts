import { describe, expect, it } from "vitest";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";
import { buildPoisoningOverdoseErOverlay } from "../lib/chartAssist/poisoningOverdoseErOverlay";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";

describe("poisoningOverdoseErOverlay", () => {
  it("is inactive when no poisoning cues", () => {
    const t = normalizeClinicalText("sore throat and runny nose");
    const r = buildPoisoningOverdoseErOverlay(t, "OPD", "opd_default", []);
    expect(r.active).toBe(false);
  });

  it("activates when ER mode and overdose trigger", () => {
    const t = normalizeClinicalText("accidental acetaminophen overdose, came to ER");
    const r = buildPoisoningOverdoseErOverlay(t, "ER", "er_poisoning_overdose", []);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.askNext.some((x) => /substance|Suspected/i.test(x))).toBe(true);
      expect(r.examNext.some((x) => /ECG|glucose/i.test(x))).toBe(true);
      expect(r.clinicalRules.some((x) => /toxidrome/i.test(x))).toBe(true);
    }
  });

  it("sets emergencyEscalationLikely when severe cues", () => {
    const t = normalizeClinicalText("opioid overdose unresponsive, naloxone given, respiratory depression");
    const r = buildPoisoningOverdoseErOverlay(t, "ER", "er_poisoning_overdose", []);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.emergencyEscalationLikely).toBe(true);
    }
  });

  it("analyzeOpdCase exposes poisoningOverdoseErOverlay", () => {
    const raw = "ER: poisoning, unknown pills ingested 2 hours ago";
    const r = analyzeOpdCase(raw, "ER");
    expect(r.poisoningOverdoseErOverlay.active).toBe(true);
  });
});
