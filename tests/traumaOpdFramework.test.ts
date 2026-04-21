import { describe, expect, it } from "vitest";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";
import {
  buildTraumaOpdFramework,
  detectTraumaOpdFrameworkActive,
  formatTraumaFrameworkForAi,
} from "../lib/chartAssist/traumaOpdFramework";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";

describe("detectTraumaOpdFrameworkActive", () => {
  it("activates when visit mode is TRAUMA even without keywords", () => {
    const t = normalizeClinicalText("minor scrape");
    expect(detectTraumaOpdFrameworkActive(t, "TRAUMA")).toBe(true);
  });

  it("activates on RTA keyword when mode OPD", () => {
    const t = normalizeClinicalText("RTA driver, seatbelt on");
    expect(detectTraumaOpdFrameworkActive(t, "OPD")).toBe(true);
  });
});

describe("buildTraumaOpdFramework", () => {
  it("returns inactive when no trauma and OPD mode", () => {
    const f = buildTraumaOpdFramework(normalizeClinicalText("sore throat"), "OPD");
    expect(f.active).toBe(false);
  });

  it("returns history and exam lists when active", () => {
    const f = buildTraumaOpdFramework(normalizeClinicalText("fall from bike"), "OPD");
    expect(f.active).toBe(true);
    if (!f.active) throw new Error("expected active");
    expect(f.historyAskNext.length).toBeGreaterThan(8);
    expect(f.examFocusNext.length).toBeGreaterThan(8);
    expect(f.importantNegatives.length).toBeGreaterThan(4);
  });
});

describe("formatTraumaFrameworkForAi", () => {
  it("includes TRAUMA header when active", () => {
    const f = buildTraumaOpdFramework(normalizeClinicalText("mva"), "OPD");
    const s = formatTraumaFrameworkForAi(f);
    expect(s).toContain("TRAUMA");
    expect(s).toContain("mechanism-first");
  });
});

describe("analyzeOpdCase traumaFramework", () => {
  it("exposes traumaFramework", () => {
    const r = analyzeOpdCase("head trauma after fall", null);
    expect(r.traumaFramework.active).toBe(true);
  });
});
