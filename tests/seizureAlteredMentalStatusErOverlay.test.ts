import { describe, expect, it } from "vitest";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";
import { buildSeizureAlteredMentalStatusErOverlay } from "../lib/chartAssist/seizureAlteredMentalStatusErOverlay";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";

describe("seizureAlteredMentalStatusErOverlay", () => {
  it("is inactive when no neuro/AMS cues", () => {
    const t = normalizeClinicalText("URI cough runny nose");
    const r = buildSeizureAlteredMentalStatusErOverlay(t, "OPD", "opd_default", []);
    expect(r.active).toBe(false);
  });

  it("is inactive for mild drowsy alone in OPD without escalation", () => {
    const t = normalizeClinicalText("mild fatigue, slept poorly");
    const r = buildSeizureAlteredMentalStatusErOverlay(t, "OPD", "opd_default", []);
    expect(r.active).toBe(false);
  });

  it("activates when ER mode and seizure trigger", () => {
    const t = normalizeClinicalText("witnessed generalized seizure, now postictal, in ER");
    const r = buildSeizureAlteredMentalStatusErOverlay(t, "ER", "er_seizure", []);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.examNext.some((x) => /GCS|pupil/i.test(x))).toBe(true);
    }
  });

  it("activates when OPD but status epilepticus / severe pattern", () => {
    const t = normalizeClinicalText("status epilepticus, ongoing seizure activity");
    const r = buildSeizureAlteredMentalStatusErOverlay(t, "OPD", "opd_default", []);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.emergencyEscalationLikely).toBe(true);
    }
  });

  it("activates concerning syncope with trauma feature", () => {
    const t = normalizeClinicalText("syncope with head strike, not back to baseline");
    const r = buildSeizureAlteredMentalStatusErOverlay(t, "OPD", "opd_default", []);
    expect(r.active).toBe(true);
  });

  it("analyzeOpdCase exposes seizureAlteredMentalStatusErOverlay", () => {
    const raw = "ER: seizure, unresponsive, GCS 10";
    const r = analyzeOpdCase(raw, "ER");
    expect(r.seizureAlteredMentalStatusErOverlay.active).toBe(true);
  });
});
