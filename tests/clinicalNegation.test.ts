import { describe, expect, it } from "vitest";
import {
  buildCaseClinicalProfile,
  computeScabiesClusterSignals,
  getSystemKeywordScores,
} from "../lib/chartAssist/caseClinicalProfile";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";
import { detectClinicalProblems } from "../lib/chartAssist/opdRecordFramework";

describe("negation-aware keyword scoring", () => {
  it("does not score fever when chart says no fever", () => {
    const t = normalizeClinicalText("rash on arms, no fever, mother also itchy");
    expect(getSystemKeywordScores(t).fever).toBe(0);
  });

  it("does not score dyspnea / SOB cues when negated (without other resp positives)", () => {
    const t = normalizeClinicalText("no dyspnea, no shortness of breath, no wheeze");
    expect(getSystemKeywordScores(t).respiratory).toBe(0);
  });

  it("still scores cough when dyspnea is negated", () => {
    const t = normalizeClinicalText("cough and runny nose, no dyspnea");
    const r = getSystemKeywordScores(t).respiratory;
    expect(r).toBeGreaterThanOrEqual(1);
  });
});

describe("scabies cluster signals", () => {
  it("strengthens when household / mother itchy (positive)", () => {
    const s = computeScabiesClusterSignals(normalizeClinicalText("rash, mother also itchy"));
    expect(s.familyItchPositive).toBe(true);
    expect(s.familyItchNegative).toBe(false);
  });

  it("weakens when no family itching (negative)", () => {
    const s = computeScabiesClusterSignals(
      normalizeClinicalText("itchy rash, no family itching, denies household itch"),
    );
    expect(s.familyItchNegative).toBe(true);
    expect(s.familyItchPositive).toBe(false);
  });
});

describe("fever problem not opened from negated fever", () => {
  it("omits fever system when only no fever is documented", () => {
    const raw = "ปวดหลัง 3 วัน\nno fever";
    const normalized = normalizeClinicalText(raw);
    const profile = buildCaseClinicalProfile(normalized, "OPD");
    const systems = detectClinicalProblems(normalized, profile, "OPD", raw);
    expect(systems).not.toContain("fever");
  });
});
