import { describe, expect, it } from "vitest";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";
import { buildEarlyPregnancyPainBleedingOverlay } from "../lib/chartAssist/earlyPregnancyPainBleedingOverlay";

describe("earlyPregnancyPainBleedingOverlay", () => {
  it("is inactive outside LABOR_ROOM / GYNE", () => {
    const t = "first trimester bleeding abdominal pain cramping";
    const r = buildEarlyPregnancyPainBleedingOverlay(t, "OPD", []);
    expect(r.active).toBe(false);
  });

  it("activates in GYNE with gy_early_pregnancy_bleeding pack", () => {
    const t = "follow up";
    const r = buildEarlyPregnancyPainBleedingOverlay(t, "GYNE", ["gy_early_pregnancy_bleeding"]);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.surfaceAlways.some((s) => s.includes("LMP"))).toBe(true);
      expect(r.surfaceAlways.some((s) => s.includes("lateralization"))).toBe(true);
      expect(r.surfaceAlways.some((s) => s.includes("Bleeding amount"))).toBe(true);
      expect(r.surfaceAlways.some((s) => s.includes("Hemodynamic"))).toBe(true);
      expect(r.surfaceAlways.some((s) => s.includes("Ectopic risk"))).toBe(true);
    }
  });

  it("sets ectopic/miscarriage pathway when early pregnancy + pain + bleeding", () => {
    const t = "first trimester vaginal bleeding and cramping pelvic pain 8 weeks pregnant";
    const r = buildEarlyPregnancyPainBleedingOverlay(t, "GYNE", []);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.ectopicMiscarriagePathwayRequired).toBe(true);
    }
  });

  it("flags urgent GYNE/ER when unstable or peritoneal signs", () => {
    const t =
      "early pregnancy 7 weeks vaginal bleeding abdominal pain hypotension shock rebound tenderness guarding";
    const r = buildEarlyPregnancyPainBleedingOverlay(t, "LABOR_ROOM", []);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.immediateGyneErConcern).toBe(true);
      expect(r.immediateConcernReasons.length).toBeGreaterThan(0);
    }
  });

  it("analyzeOpdCase exposes overlay in GYNE", () => {
    const raw = "ectopic pregnancy ruled out threatened abortion 6 weeks pregnant spotting";
    const r = analyzeOpdCase(raw, "GYNE");
    expect(r.earlyPregnancyPainBleedingOverlay.active).toBe(true);
  });
});
