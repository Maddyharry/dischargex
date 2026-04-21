import { describe, expect, it } from "vitest";
import {
  buildAbdominalPainOpdFramework,
  detectAbdominalPainFrameworkActive,
  matchesAbdominalPainErEscalation,
} from "../lib/chartAssist/abdominalPainOpdFramework";
import { detectVisitMode } from "../lib/chartAssist/triggers";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";

describe("detectAbdominalPainFrameworkActive", () => {
  it("activates on abdominal pain", () => {
    expect(detectAbdominalPainFrameworkActive(normalizeClinicalText("severe abdominal pain RLQ"))).toBe(true);
  });

  it("activates on vomiting with abdominal complaint", () => {
    const t = normalizeClinicalText("vomiting and epigastric abdominal pain");
    expect(detectAbdominalPainFrameworkActive(t)).toBe(true);
  });

  it("activates on dysuria with lower abdominal pain", () => {
    const t = normalizeClinicalText("dysuria lower abdominal pain suprapubic");
    expect(detectAbdominalPainFrameworkActive(t)).toBe(true);
  });
});

describe("matchesAbdominalPainErEscalation", () => {
  it("returns true when abdominal presentation + surgical red flags", () => {
    const t = normalizeClinicalText("abdominal pain RLQ rebound tenderness appendicitis");
    expect(matchesAbdominalPainErEscalation(t)).toBe(true);
    expect(detectVisitMode(t, null)).toEqual({ mode: "ER", reason: "er_abdominal_surgical_concern" });
  });
});

describe("buildAbdominalPainOpdFramework", () => {
  it("exposes four helper blocks and red-flag grouping", () => {
    const f = buildAbdominalPainOpdFramework(normalizeClinicalText("bilious vomiting abdominal distension"));
    expect(f.active).toBe(true);
    if (!f.active) return;
    expect(f.factsAlreadyPresent.length).toBeGreaterThan(0);
    expect(f.askNext.length).toBeGreaterThan(5);
    expect(f.examNext.length).toBeGreaterThan(4);
    expect(f.importantNegatives.length).toBeGreaterThan(5);
    expect(f.surgicalRedFlagsPresent).toBe(true);
    expect(f.surgicalRedFlagMatches.length).toBeGreaterThan(0);
  });
});
