import { describe, expect, it } from "vitest";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";
import { buildPreeclampsiaOverlay } from "../lib/chartAssist/preeclampsiaOverlay";

describe("preeclampsiaOverlay", () => {
  it("is inactive outside LABOR_ROOM / GYNE", () => {
    const t = "pregnant 34 weeks severe headache BP 170/110 preeclampsia concern";
    const r = buildPreeclampsiaOverlay(t, "ER", []);
    expect(r.active).toBe(false);
  });

  it("activates in LABOR_ROOM when lr_preeclampsia pack matches", () => {
    const t = "follow up hypertension";
    const r = buildPreeclampsiaOverlay(t, "LABOR_ROOM", ["lr_preeclampsia"]);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.avoidRoutineHeadacheNoteFormat).toBe(true);
      expect(r.surfaceAlways.some((s) => s.includes("Pregnancy status"))).toBe(true);
      expect(r.surfaceAlways.some((s) => s.includes("Gestational age"))).toBe(true);
      expect(r.surfaceAlways.some((s) => s.includes("Blood pressure"))).toBe(true);
      expect(r.surfaceAlways.some((s) => s.includes("Headache"))).toBe(true);
      expect(r.surfaceAlways.some((s) => s.includes("Visual"))).toBe(true);
      expect(r.surfaceAlways.some((s) => s.includes("RUQ"))).toBe(true);
      expect(r.surfaceAlways.some((s) => s.includes("Seizure"))).toBe(true);
      expect(r.surfaceAlways.some((s) => s.includes("Fetal"))).toBe(true);
    }
  });

  it("flags urgent OB pathway when pregnancy + severe headache + high BP pattern", () => {
    const t =
      "pregnant third trimester worst headache blurred vision BP 170/105 epigastric pain fetal movement decreased";
    const r = buildPreeclampsiaOverlay(t, "LABOR_ROOM", []);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.urgentObPathwayLikely).toBe(true);
      expect(r.urgentObPathwayReasons.length).toBeGreaterThan(0);
    }
  });

  it("analyzeOpdCase exposes preeclampsiaOverlay in LABOR_ROOM with keyword trigger", () => {
    const raw = "gestational hypertension 32 weeks pregnant severe headache visual scotoma";
    const r = analyzeOpdCase(raw, "LABOR_ROOM");
    expect(r.preeclampsiaOverlay.active).toBe(true);
  });

  it("analyzeOpdCase exposes preeclampsiaOverlay in GYNE when pregnancy + headache", () => {
    const raw = "pregnant 10 weeks headache and nausea";
    const r = analyzeOpdCase(raw, "GYNE");
    expect(r.preeclampsiaOverlay.active).toBe(true);
  });
});
