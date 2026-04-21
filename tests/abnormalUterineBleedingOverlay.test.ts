import { describe, expect, it } from "vitest";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";
import { buildAbnormalUterineBleedingOverlay } from "../lib/chartAssist/abnormalUterineBleedingOverlay";

describe("abnormalUterineBleedingOverlay", () => {
  it("is inactive outside LABOR_ROOM / GYNE", () => {
    const t = "heavy menstrual bleeding menorrhagia";
    const r = buildAbnormalUterineBleedingOverlay(t, "OPD", []);
    expect(r.active).toBe(false);
  });

  it("activates with gy_abnormal_uterine_bleeding pack in GYNE", () => {
    const t = "follow up";
    const r = buildAbnormalUterineBleedingOverlay(t, "GYNE", ["gy_abnormal_uterine_bleeding"]);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.avoidRoutineDysmenorrheaNoteFormat).toBe(true);
      expect(r.surfaceAlways.some((s) => s.includes("Pregnancy status"))).toBe(true);
      expect(r.surfaceAlways.some((s) => s.includes("Hemodynamic"))).toBe(true);
    }
  });

  it("defers to early pregnancy pain/bleeding overlay when that trigger matches", () => {
    const t = "first trimester vaginal bleeding and cramping pelvic pain 8 weeks pregnant";
    const r = buildAbnormalUterineBleedingOverlay(t, "GYNE", []);
    expect(r.active).toBe(false);
  });

  it("flags urgent pathway when hemodynamic instability with AUB context", () => {
    const t = "abnormal uterine bleeding acute vaginal bleeding hypotension shock tachycardia";
    const r = buildAbnormalUterineBleedingOverlay(t, "GYNE", []);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.urgentPathwayLikely).toBe(true);
    }
  });

  it("detects nonpregnant hint for advisory flag", () => {
    const t = "heavy menstrual bleeding not pregnant upt negative menorrhagia";
    const r = buildAbnormalUterineBleedingOverlay(t, "GYNE", ["gy_abnormal_uterine_bleeding"]);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.nonPregnantAubHint).toBe(true);
    }
  });

  it("analyzeOpdCase exposes abnormalUterineBleedingOverlay", () => {
    const raw = "acute abnormal uterine bleeding heavy menstrual bleeding";
    const r = analyzeOpdCase(raw, "GYNE");
    expect(r.abnormalUterineBleedingOverlay.active).toBe(true);
  });
});
