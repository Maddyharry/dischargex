import { describe, expect, it } from "vitest";
import {
  buildFeverChildOpdFramework,
  detectFeverChildFrameworkActive,
} from "../lib/chartAssist/feverChildOpdFramework";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";

describe("detectFeverChildFrameworkActive", () => {
  it("activates on fever keywords", () => {
    const t = normalizeClinicalText("child with fever 2 days");
    expect(detectFeverChildFrameworkActive(t)).toBe(true);
  });

  it("activates on antipyretic without spelling fever", () => {
    const t = normalizeClinicalText("mother gave paracetamol last night");
    expect(detectFeverChildFrameworkActive(t)).toBe(true);
  });

  it("does not activate when only explicit no fever", () => {
    const t = normalizeClinicalText("no fever, well appearing");
    expect(detectFeverChildFrameworkActive(t)).toBe(false);
  });

  it("activates when no fever stated but paracetamol given (context)", () => {
    const t = normalizeClinicalText("no fever now, paracetamol at home");
    expect(detectFeverChildFrameworkActive(t)).toBe(true);
  });
});

describe("buildFeverChildOpdFramework", () => {
  it("returns four helper blocks when active", () => {
    const t = normalizeClinicalText("febrile child, suspected viral illness");
    const f = buildFeverChildOpdFramework(t);
    expect(f.active).toBe(true);
    if (!f.active) return;
    expect(f.factsAlreadyPresent.length).toBeGreaterThan(0);
    expect(f.askNext.length).toBeGreaterThan(5);
    expect(f.examNext.length).toBeGreaterThan(5);
    expect(f.importantNegatives.length).toBeGreaterThan(5);
    expect(f.differentialExamples.length).toBeGreaterThan(5);
    expect(f.reasoningRules.some((r) => /sepsis|antibiotic/i.test(r))).toBe(true);
  });

  it("flags danger signs for poor feeding and lethargy", () => {
    const t = normalizeClinicalText("fever, poor feeding, lethargic infant");
    const f = buildFeverChildOpdFramework(t);
    expect(f.active).toBe(true);
    if (!f.active) return;
    expect(f.dangerSignsPresent).toBe(true);
    expect(f.dangerSignMatches.length).toBeGreaterThan(0);
    expect(f.urgencyHint).toBe("prefer_er_or_urgent");
  });

  it("escalates urgency when systemic red flags from profile", () => {
    const t = normalizeClinicalText("fever and cough");
    const f = buildFeverChildOpdFramework(t, { hasSystemicRedFlags: true });
    expect(f.active).toBe(true);
    if (!f.active) return;
    expect(f.urgencyHint).toBe("prefer_er_or_urgent");
  });
});
