import { describe, expect, it } from "vitest";
import { buildMissingDataStrip, formatMissingDataStripLines } from "../lib/chartAssist/opdAssistMissingStrip";

describe("buildMissingDataStrip", () => {
  it("collects bundle missing and pack askNext", () => {
    const strip = buildMissingDataStrip({
      assistantBundle: {
        missingInfo: ["allergy", "vitals"],
        sectionHints: { piMissing: ["duration"], peMissing: [] },
      },
      problemPackResolution: {
        activeMatches: [{ def: { askNext: ["burrow?", "family cluster?"] } }],
      },
    });
    expect(strip.missing).toContain("allergy");
    expect(strip.askNext).toContain("burrow?");
  });

  it("formats two capped lines", () => {
    const { missingLine, askLine } = formatMissingDataStripLines({
      missing: ["a", "b", "c"],
      askNext: ["x"],
    });
    expect(missingLine?.startsWith("Missing:")).toBe(true);
    expect(askLine?.startsWith("Ask next:")).toBe(true);
  });
});
