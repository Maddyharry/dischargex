import { describe, expect, it } from "vitest";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";
import { buildAntepartumBleedingOverlay } from "../lib/chartAssist/antepartumBleedingOverlay";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";

describe("antepartumBleedingOverlay", () => {
  it("is inactive outside LABOR_ROOM / GYNE", () => {
    const t = normalizeClinicalText("placenta previa bleeding third trimester");
    const r = buildAntepartumBleedingOverlay(t, "ER", []);
    expect(r.active).toBe(false);
  });

  it("activates in LABOR_ROOM with APH keywords", () => {
    const t = normalizeClinicalText("antepartum bleeding 34 weeks placenta previa concern");
    const r = buildAntepartumBleedingOverlay(t, "LABOR_ROOM", []);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.surfaceAlways.some((x) => /Gestational age/i.test(x))).toBe(true);
      expect(r.clinicalRules.some((x) => /urgent obstetric/i.test(x))).toBe(true);
    }
  });

  it("sets immediateConcernFirst when unstable vitals", () => {
    const t = normalizeClinicalText("vaginal bleeding pregnancy hypotension shock third trimester");
    const r = buildAntepartumBleedingOverlay(t, "LABOR_ROOM", ["lr_antepartum_bleeding"]);
    expect(r.active).toBe(true);
    if (r.active) {
      expect(r.immediateConcernFirst).toBe(true);
    }
  });

  it("analyzeOpdCase exposes antepartumBleedingOverlay in GYNE", () => {
    const raw = "first trimester bleeding and abdominal pain ectopic rule out";
    const r = analyzeOpdCase(raw, "GYNE");
    expect(r.mode).toBe("GYNE");
    expect(r.antepartumBleedingOverlay.active).toBe(true);
  });
});
