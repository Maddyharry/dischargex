import { describe, expect, it } from "vitest";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";
import {
  buildBackMusculoskeletalOpdFramework,
  detectBackMusculoskeletalFrameworkActive,
  formatBackMusculoskeletalFrameworkForAi,
} from "../lib/chartAssist/backMusculoskeletalOpdFramework";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";

function n(s: string) {
  return normalizeClinicalText(s);
}

describe("detectBackMusculoskeletalFrameworkActive", () => {
  it("activates on back pain", () => {
    expect(detectBackMusculoskeletalFrameworkActive(n("low back pain 3 days"))).toBe(true);
  });

  it("activates on joint pain Thai", () => {
    expect(detectBackMusculoskeletalFrameworkActive(n("ปวดข้อ"))).toBe(true);
  });

  it("activates on sciatica", () => {
    expect(detectBackMusculoskeletalFrameworkActive(n("sciatica radiating to leg"))).toBe(true);
  });

  it("stays inactive on generic follow-up", () => {
    expect(detectBackMusculoskeletalFrameworkActive(n("follow up hypertension only"))).toBe(false);
  });
});

describe("buildBackMusculoskeletalOpdFramework", () => {
  it("returns inactive when no cues", () => {
    const f = buildBackMusculoskeletalOpdFramework(n("follow up hypertension"));
    expect(f.active).toBe(false);
  });

  it("returns four helper blocks plus flags when active", () => {
    const f = buildBackMusculoskeletalOpdFramework(n("chronic neck pain stiffness"));
    expect(f.active).toBe(true);
    if (!f.active) throw new Error("expected active");
    expect(f.factsAlreadyPresent.length).toBeGreaterThan(0);
    expect(f.askNext.length).toBeGreaterThan(8);
    expect(f.examNext.length).toBeGreaterThan(8);
    expect(f.importantNegatives.length).toBeGreaterThan(5);
    expect(f.differentialExamples.length).toBeGreaterThan(5);
    expect(f.reasoningRules.length).toBeGreaterThan(2);
    expect(typeof f.urgentCaudaOrNeuroEmergency).toBe("boolean");
    expect(typeof f.infectionConsideration).toBe("boolean");
    expect(typeof f.traumaImagingConsideration).toBe("boolean");
  });

  it("flags urgent cauda pathway", () => {
    const f = buildBackMusculoskeletalOpdFramework(n("low back pain urinary retention saddle numbness"));
    expect(f.active).toBe(true);
    if (!f.active) throw new Error("expected active");
    expect(f.urgentCaudaOrNeuroEmergency).toBe(true);
  });

  it("flags infection consideration when fever + spine context", () => {
    const f = buildBackMusculoskeletalOpdFramework(n("fever and severe lumbar pain cannot stand"));
    expect(f.active).toBe(true);
    if (!f.active) throw new Error("expected active");
    expect(f.infectionConsideration).toBe(true);
  });

  it("does not flag infection for fever without spine/back context", () => {
    const f = buildBackMusculoskeletalOpdFramework(n("fever and arthralgia in small joints"));
    expect(f.active).toBe(true);
    if (!f.active) throw new Error("expected active");
    expect(f.infectionConsideration).toBe(false);
  });

  it("flags trauma imaging when trauma + bony tenderness", () => {
    const f = buildBackMusculoskeletalOpdFramework(n("fall from ladder back pain midline tenderness spinous"));
    expect(f.active).toBe(true);
    if (!f.active) throw new Error("expected active");
    expect(f.traumaImagingConsideration).toBe(true);
  });
});

describe("formatBackMusculoskeletalFrameworkForAi", () => {
  it("includes section headers when active", () => {
    const f = buildBackMusculoskeletalOpdFramework(n("shoulder pain"));
    const s = formatBackMusculoskeletalFrameworkForAi(f);
    expect(s).toContain("BACK / NECK / MSK");
    expect(s).toContain("Reasoning rules:");
  });
});

describe("analyzeOpdCase backMusculoskeletalFramework", () => {
  it("exposes backMusculoskeletalFramework on analysis", () => {
    const r = analyzeOpdCase("mechanical low back pain after lifting", null);
    expect(r.backMusculoskeletalFramework.active).toBe(true);
  });
});
