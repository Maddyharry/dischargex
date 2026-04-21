import { describe, expect, it } from "vitest";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";
import {
  buildPsychOpdFramework,
  detectPsychOpdFrameworkActive,
  formatPsychFrameworkForAi,
} from "../lib/chartAssist/psychOpdFramework";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";

describe("detectPsychOpdFrameworkActive", () => {
  it("activates when visit mode is PSYCH", () => {
    expect(detectPsychOpdFrameworkActive(normalizeClinicalText("x"), "PSYCH")).toBe(true);
  });

  it("activates on suicidal ideation keyword when OPD", () => {
    const t = normalizeClinicalText("suicidal ideation, denies plan");
    expect(detectPsychOpdFrameworkActive(t, "OPD")).toBe(true);
  });
});

describe("buildPsychOpdFramework", () => {
  it("returns inactive when no psych cues and OPD", () => {
    const f = buildPsychOpdFramework(normalizeClinicalText("sore throat only"), "OPD");
    expect(f.active).toBe(false);
  });

  it("returns lists when active", () => {
    const f = buildPsychOpdFramework(normalizeClinicalText("depression and anxiety"), "OPD");
    expect(f.active).toBe(true);
    if (!f.active) throw new Error("expected active");
    expect(f.historyAskNext.length).toBeGreaterThan(10);
    expect(f.mentalStatusPrompts.length).toBeGreaterThan(6);
    expect(f.riskPrompts.length).toBeGreaterThan(4);
  });
});

describe("formatPsychFrameworkForAi", () => {
  it("includes PSYCH header when active", () => {
    const f = buildPsychOpdFramework(normalizeClinicalText("hallucinations"), "OPD");
    const s = formatPsychFrameworkForAi(f);
    expect(s).toContain("PSYCH");
    expect(s).toContain("safety-first");
  });
});

describe("analyzeOpdCase psychFramework", () => {
  it("exposes psychFramework", () => {
    const r = analyzeOpdCase("paranoia and auditory hallucinations", null);
    expect(r.psychFramework.active).toBe(true);
  });
});
