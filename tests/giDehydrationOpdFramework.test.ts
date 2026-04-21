import { describe, expect, it } from "vitest";
import {
  buildGiDehydrationOpdFramework,
  classifyDehydrationFromText,
  detectGiDehydrationFrameworkActive,
} from "../lib/chartAssist/giDehydrationOpdFramework";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";

describe("detectGiDehydrationFrameworkActive", () => {
  it("activates on diarrhea", () => {
    expect(detectGiDehydrationFrameworkActive(normalizeClinicalText("watery diarrhea 2 days"))).toBe(true);
  });

  it("activates on decreased urine and thirst", () => {
    expect(detectGiDehydrationFrameworkActive(normalizeClinicalText("thirst, oliguria, dry mouth"))).toBe(true);
  });
});

describe("classifyDehydrationFromText", () => {
  it("classifies severe when unable to drink and lethargic", () => {
    const t = normalizeClinicalText("diarrhea, unable to drink, lethargic child");
    expect(classifyDehydrationFromText(t).level).toBe("severe");
  });

  it("classifies some when sunken eyes and dry mucosa", () => {
    const t = normalizeClinicalText("vomiting, sunken eyes, dry mucosa, decreased urine");
    expect(classifyDehydrationFromText(t).level).toBe("some");
  });

  it("classifies none when drinks well and active", () => {
    const t = normalizeClinicalText("mild diarrhea, drinks well, active, wet diaper");
    expect(classifyDehydrationFromText(t).level).toBe("none");
  });

  it("down-tiers some to none when กินได้ดี", () => {
    const t = normalizeClinicalText("diarrhea, sunken eyes, dry mouth, กินได้ดี");
    expect(classifyDehydrationFromText(t).level).toBe("none");
  });
});

describe("buildGiDehydrationOpdFramework", () => {
  it("exposes four helper blocks", () => {
    const f = buildGiDehydrationOpdFramework(normalizeClinicalText("diarrhea and vomiting"));
    expect(f.active).toBe(true);
    if (!f.active) return;
    expect(f.factsAlreadyPresent.length).toBeGreaterThan(0);
    expect(f.askNext.length).toBeGreaterThan(5);
    expect(f.examNext.length).toBeGreaterThan(5);
    expect(f.importantNegatives.length).toBeGreaterThan(5);
    expect(f.differentialExamples.length).toBeGreaterThan(3);
  });

  it("sets urgent hint for severe dehydration", () => {
    const f = buildGiDehydrationOpdFramework(normalizeClinicalText("diarrhea shock poor perfusion mottled"));
    expect(f.active).toBe(true);
    if (!f.active) return;
    expect(f.dehydrationLevel).toBe("severe");
    expect(f.urgencyHint).toBe("prefer_er_or_urgent");
  });

  it("flags dysentery risk reduced when no blood in stool documented", () => {
    const f = buildGiDehydrationOpdFramework(normalizeClinicalText("diarrhea ไม่มีเลือดในอุจจาระ"));
    expect(f.active).toBe(true);
    if (!f.active) return;
    expect(f.dysenteryRiskReduced).toBe(true);
  });
});
