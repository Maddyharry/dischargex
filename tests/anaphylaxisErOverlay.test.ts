import { describe, expect, it } from "vitest";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";
import { buildAnaphylaxisErOverlay } from "../lib/chartAssist/anaphylaxisErOverlay";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";

describe("anaphylaxisErOverlay", () => {
  it("is inactive for isolated mild urticaria in OPD without systemic features", () => {
    const t = normalizeClinicalText("small patch of hives on arm, no breathing issues, stable");
    const r = buildAnaphylaxisErOverlay(t, "OPD", "opd_default", []);
    expect(r.active).toBe(false);
  });

  it("activates when ER and anaphylaxis keyword", () => {
    const t = normalizeClinicalText("anaphylaxis after peanut, epipen given in field");
    const r = buildAnaphylaxisErOverlay(t, "ER", "er_anaphylaxis", []);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.immediateManagementHints.some((x) => /epinephrine/i.test(x))).toBe(true);
    }
  });

  it("activates urticaria plus wheeze (systemic)", () => {
    const t = normalizeClinicalText("generalized urticaria with wheeze after eating shellfish");
    const r = buildAnaphylaxisErOverlay(t, "ER", "opd_default", []);
    expect(r.active).toBe(true);
  });

  it("analyzeOpdCase exposes anaphylaxisErOverlay", () => {
    const raw = "ER: angioedema, stridor, tongue swelling after bee sting";
    const r = analyzeOpdCase(raw, "ER");
    expect(r.anaphylaxisErOverlay.active).toBe(true);
  });
});
