import { describe, expect, it } from "vitest";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";
import { buildErImmediateLifeThreatMeta } from "../lib/chartAssist/erImmediateLifeThreat";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";
import { buildCaseClinicalProfile } from "../lib/chartAssist/caseClinicalProfile";
import { buildAnaphylaxisErOverlay } from "../lib/chartAssist/anaphylaxisErOverlay";

describe("erImmediateLifeThreat", () => {
  it("does not reorder outside ER mode", () => {
    const t = normalizeClinicalText("anaphylaxis epinephrine");
    const profile = buildCaseClinicalProfile(t, "OPD");
    const meta = buildErImmediateLifeThreatMeta(
      "OPD",
      "opd_default",
      profile,
      [],
      {
        anaphylaxisErOverlay: buildAnaphylaxisErOverlay(t, "OPD", "opd_default", []),
        seizureAlteredMentalStatusErOverlay: { active: false },
        dyspneaHypoxemiaErOverlay: { active: false },
        sepsisShockErOverlay: { active: false },
        poisoningOverdoseErOverlay: { active: false },
      },
    );
    expect(meta.reorderNarrative).toBe(false);
  });

  it("reorders when ER and visit reason is life-threat", () => {
    const r = analyzeOpdCase("emergency room: toxic ingestion overdose unknown pills", null);
    expect(r.mode).toBe("ER");
    expect(r.visitModeReason).toBe("er_poisoning_overdose");
    expect(r.erImmediateLifeThreat.reorderNarrative).toBe(true);
    expect(r.erImmediateLifeThreat.reasons.some((x) => x.includes("visit reason"))).toBe(true);
  });

  it("reorders when systemic red flags in ER", () => {
    const raw =
      "ER: septic shock hypotension lactate elevated fever — concern for infection source unknown";
    const r = analyzeOpdCase(raw, "ER");
    expect(r.erImmediateLifeThreat.reorderNarrative).toBe(true);
    expect(r.erImmediateLifeThreat.reasons).toContain("systemic red flags");
  });
});
