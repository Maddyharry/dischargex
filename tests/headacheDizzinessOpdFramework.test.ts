import { describe, expect, it } from "vitest";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";
import {
  buildHeadacheDizzinessOpdFramework,
  detectHeadacheDizzinessFrameworkActive,
  formatHeadacheDizzinessFrameworkForAi,
} from "../lib/chartAssist/headacheDizzinessOpdFramework";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";

function n(s: string) {
  return normalizeClinicalText(s);
}

describe("detectHeadacheDizzinessFrameworkActive", () => {
  it("activates on headache", () => {
    expect(detectHeadacheDizzinessFrameworkActive(n("headache 2 days"))).toBe(true);
  });

  it("activates on vertigo Thai", () => {
    expect(detectHeadacheDizzinessFrameworkActive(n("เวียนหัว บ้านหมุน"))).toBe(true);
  });

  it("activates on nausea with headache", () => {
    expect(detectHeadacheDizzinessFrameworkActive(n("nausea and severe headache"))).toBe(true);
  });

  it("stays inactive on nausea alone", () => {
    expect(detectHeadacheDizzinessFrameworkActive(n("nausea only no headache"))).toBe(false);
  });
});

describe("buildHeadacheDizzinessOpdFramework", () => {
  it("returns inactive when no cues", () => {
    const f = buildHeadacheDizzinessOpdFramework(n("follow up hypertension"));
    expect(f.active).toBe(false);
  });

  it("returns four helper blocks plus meta when active", () => {
    const f = buildHeadacheDizzinessOpdFramework(n("dizziness and imbalance"));
    expect(f.active).toBe(true);
    if (!f.active) throw new Error("expected active");
    expect(f.factsAlreadyPresent.length).toBeGreaterThan(0);
    expect(f.askNext.length).toBeGreaterThan(10);
    expect(f.examNext.length).toBeGreaterThan(5);
    expect(f.importantNegatives.length).toBeGreaterThan(5);
    expect(f.differentialExamples.length).toBeGreaterThan(5);
    expect(f.reasoningRules.length).toBeGreaterThan(2);
    expect(typeof f.erPriorityConcern).toBe("boolean");
  });

  it("flags ER priority when thunderclap or red flags", () => {
    const f = buildHeadacheDizzinessOpdFramework(n("thunderclap headache worst of life"));
    expect(f.active).toBe(true);
    if (!f.active) throw new Error("expected active");
    expect(f.erPriorityConcern).toBe(true);
  });
});

describe("formatHeadacheDizzinessFrameworkForAi", () => {
  it("includes section headers when active", () => {
    const f = buildHeadacheDizzinessOpdFramework(n("vertigo"));
    const s = formatHeadacheDizzinessFrameworkForAi(f);
    expect(s).toContain("HEADACHE / DIZZINESS");
    expect(s).toContain("Reasoning rules:");
  });
});

describe("analyzeOpdCase headacheDizzinessFramework", () => {
  it("exposes headacheDizzinessFramework on analysis", () => {
    const r = analyzeOpdCase("migraine headache photophobia", null);
    expect(r.headacheDizzinessFramework.active).toBe(true);
  });
});
