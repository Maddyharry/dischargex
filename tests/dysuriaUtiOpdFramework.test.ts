import { describe, expect, it } from "vitest";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";
import {
  buildDysuriaUtiOpdFramework,
  detectDysuriaUtiFrameworkActive,
  formatDysuriaUtiFrameworkForAi,
  shouldSuppressDysuriaUtiFramework,
} from "../lib/chartAssist/dysuriaUtiOpdFramework";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";
import { resolveOpdProblemPacks } from "../lib/chartAssist/opdProblemPacks";

function n(s: string) {
  return normalizeClinicalText(s);
}

describe("detectDysuriaUtiFrameworkActive", () => {
  it("activates on dysuria", () => {
    expect(detectDysuriaUtiFrameworkActive(n("dysuria 2 days"))).toBe(true);
  });

  it("activates on urinary frequency", () => {
    expect(detectDysuriaUtiFrameworkActive(n("increased urinary frequency"))).toBe(true);
  });

  it("stays inactive on unrelated text", () => {
    expect(detectDysuriaUtiFrameworkActive(n("follow up asthma"))).toBe(false);
  });

  it("suppresses when strong alternative infection focus and no affirmative GU", () => {
    expect(shouldSuppressDysuriaUtiFramework(n("pneumonia otitis media cellulitis, no urinary symptoms"))).toBe(true);
    expect(detectDysuriaUtiFrameworkActive(n("pneumonia otitis media cellulitis"))).toBe(false);
  });
});

describe("buildDysuriaUtiOpdFramework", () => {
  it("returns inactive when no cues", () => {
    const f = buildDysuriaUtiOpdFramework(n("routine check"));
    expect(f.active).toBe(false);
  });

  it("returns four helper blocks plus meta when active", () => {
    const f = buildDysuriaUtiOpdFramework(n("dysuria, urinary urgency, cloudy urine"));
    expect(f.active).toBe(true);
    if (!f.active) throw new Error("expected active");
    expect(f.factsAlreadyPresent.length).toBeGreaterThan(0);
    expect(f.askNext.length).toBeGreaterThan(5);
    expect(f.examNext.length).toBeGreaterThan(3);
    expect(f.importantNegatives.length).toBeGreaterThan(4);
    expect(f.differentialExamples.length).toBeGreaterThan(4);
    expect(f.reasoningRules.length).toBeGreaterThan(2);
    expect(["lower", "upper_suspected", "unclear"]).toContain(f.utiConcernTier);
  });

  it("flags upper tier when fever present", () => {
    const f = buildDysuriaUtiOpdFramework(n("dysuria fever 39 flank pain"));
    expect(f.active).toBe(true);
    if (!f.active) throw new Error("expected active");
    expect(f.utiConcernTier).toBe("upper_suspected");
  });

  it("classifies lower path when isolated urinary symptoms without systemic/flank", () => {
    const f = buildDysuriaUtiOpdFramework(n("dysuria urinary urgency suprapubic discomfort, afebrile"));
    expect(f.active).toBe(true);
    if (!f.active) throw new Error("expected active");
    expect(f.dysuriaPresent).toBe(true);
    expect(f.utiConcernTier).toBe("lower");
  });

  it("reduces lower UTI likelihood when dysuria absent but alternative infection focus strong", () => {
    const f = buildDysuriaUtiOpdFramework(n("pneumonia otitis urinary frequency, no painful urination"));
    expect(f.active).toBe(true);
    if (!f.active) throw new Error("expected active");
    expect(f.dysuriaPresent).toBe(false);
    expect(f.lowerUtiLikelihoodReduced).toBe(true);
    expect(f.utiConcernTier).toBe("unclear");
  });

  it("flags genital irritation prominence", () => {
    const f = buildDysuriaUtiOpdFramework(
      n("vaginal discharge severe dysuria urinary frequency vulvovaginitis"),
    );
    expect(f.active).toBe(true);
    if (!f.active) throw new Error("expected active");
    expect(f.genitalIrritationProminent).toBe(true);
  });

  it("flags urgent pediatric pathway under 3 months with suspected UTI", () => {
    const f = buildDysuriaUtiOpdFramework(n("2 month old dysuria fever urinary frequency suspected uti"));
    expect(f.active).toBe(true);
    if (!f.active) throw new Error("expected active");
    expect(f.pediatricSpecialistEscalation).toBe(true);
  });
});

describe("formatDysuriaUtiFrameworkForAi", () => {
  it("includes section headers when active", () => {
    const f = buildDysuriaUtiOpdFramework(n("uti suspected hematuria"));
    const s = formatDysuriaUtiFrameworkForAi(f);
    expect(s).toContain("DYSURIA / UTI-LIKE");
    expect(s).toContain("Reasoning rules:");
  });
});

describe("analyzeOpdCase dysuriaUtiFramework", () => {
  it("exposes dysuriaUtiFramework on analysis", () => {
    const r = analyzeOpdCase("dysuria and suprapubic pain", null);
    expect(r.dysuriaUtiFramework.active).toBe(true);
  });
});

describe("resolveOpdProblemPacks dysuria", () => {
  it("matches dysuria pack when urinary cues present", () => {
    const r = resolveOpdProblemPacks(n("dysuria urinary frequency"), "OPD");
    expect(r.activeMatches.some((m) => m.packId === "dysuria")).toBe(true);
  });
});
