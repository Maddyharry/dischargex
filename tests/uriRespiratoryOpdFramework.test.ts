import { describe, expect, it } from "vitest";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";
import {
  buildUriRespiratoryOpdFramework,
  detectUriRespiratoryOpdActive,
  formatUriRespiratoryFrameworkForAi,
} from "../lib/chartAssist/uriRespiratoryOpdFramework";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";

function n(s: string) {
  return normalizeClinicalText(s);
}

describe("detectUriRespiratoryOpdActive", () => {
  it("activates on fever + cough", () => {
    expect(detectUriRespiratoryOpdActive(n("ไข้ 2 วัน ไอ"))).toBe(true);
  });

  it("activates on sore throat Thai", () => {
    expect(detectUriRespiratoryOpdActive(n("เจ็บคอ 3 วัน"))).toBe(true);
  });

  it("stays inactive on unrelated text", () => {
    expect(detectUriRespiratoryOpdActive(n("ปวดหลัง chronic 1 year"))).toBe(false);
  });

  it("does not activate on negated cough", () => {
    expect(detectUriRespiratoryOpdActive(n("ไม่มีไอ ไม่มีไข้"))).toBe(false);
  });
});

describe("buildUriRespiratoryOpdFramework", () => {
  it("returns inactive object when no cues", () => {
    const f = buildUriRespiratoryOpdFramework(n("follow up HT"));
    expect(f.active).toBe(false);
  });

  it("returns four helper blocks plus meta when active", () => {
    const f = buildUriRespiratoryOpdFramework(n("cough, runny nose, fever 38"));
    expect(f.active).toBe(true);
    if (!f.active) throw new Error("expected active");
    expect(f.factsAlreadyPresent.length).toBeGreaterThan(0);
    expect(f.askNext.length).toBeGreaterThan(5);
    expect(f.examNext.length).toBeGreaterThan(3);
    expect(f.importantNegatives.length).toBeGreaterThan(4);
    expect(f.differentialExamples.length).toBeGreaterThan(4);
    expect(f.reasoningRules.length).toBeGreaterThan(2);
    expect(f.outputStyleHints.length).toBeGreaterThan(2);
  });
});

describe("formatUriRespiratoryFrameworkForAi", () => {
  it("includes section headers when active", () => {
    const f = buildUriRespiratoryOpdFramework(n("wheeze and cough"));
    const s = formatUriRespiratoryFrameworkForAi(f);
    expect(s).toContain("URI / COUGH / SORE THROAT");
    expect(s).toContain("Reasoning rules:");
  });
});

describe("analyzeOpdCase uriRespiratoryFramework", () => {
  it("exposes uriRespiratoryFramework on analysis", () => {
    const r = analyzeOpdCase("ไอ น้ำมูก", null);
    expect(r.uriRespiratoryFramework.active).toBe(true);
  });
});
