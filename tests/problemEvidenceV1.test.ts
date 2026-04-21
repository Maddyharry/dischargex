import { describe, expect, it } from "vitest";
import type { OpdAiProblemJson } from "../lib/chartAssist/opdAssistAiTypes";
import { formatProblemEvidenceOverlayLines } from "../lib/chartAssist/opdNoteLayout";
import {
  normalizeConfidenceLevel,
  normalizeEvidenceSupportItems,
  normalizeUncertaintyReasons,
  summarizeProblemEvidenceForLog,
} from "../lib/chartAssist/problemEvidenceV1";

describe("normalizeConfidenceLevel", () => {
  it("accepts enum and rejects junk", () => {
    const w: string[] = [];
    expect(normalizeConfidenceLevel("high", w)).toBe("high");
    expect(normalizeConfidenceLevel("bogus", w)).toBeUndefined();
    expect(w.length).toBeGreaterThan(0);
  });
});

describe("normalizeEvidenceSupportItems", () => {
  it("parses recommended shape and refId", () => {
    const w: string[] = [];
    const out = normalizeEvidenceSupportItems(
      [
        {
          type: "investigation",
          text: "CXR clear",
          relation: "supports",
          refId: "inv_cxr_1",
        },
      ],
      w,
    );
    expect(out).toHaveLength(1);
    expect(out![0].type).toBe("investigation");
    expect(out![0].refId).toBe("inv_cxr_1");
  });

  it("coerces invalid type/relation", () => {
    const w: string[] = [];
    const out = normalizeEvidenceSupportItems(
      [{ type: "xray", text: "test", relation: "maybe" }],
      w,
    );
    expect(out![0].type).toBe("history");
    expect(out![0].relation).toBe("supports");
  });
});

describe("summarizeProblemEvidenceForLog", () => {
  it("counts fields", () => {
    const s = summarizeProblemEvidenceForLog([
      { confidenceLevel: "low", uncertaintyReasons: ["no fever documented"], evidenceSupport: [] },
      { evidenceSupport: [{ type: "exam", text: "wheeze", relation: "supports" }] },
    ] as unknown as { confidenceLevel?: unknown; uncertaintyReasons?: unknown; evidenceSupport?: unknown }[]);
    expect(s.withConfidence).toBe(1);
    expect(s.withUncertainty).toBe(1);
    expect(s.withEvidenceLines).toBe(1);
  });
});

describe("formatProblemEvidenceOverlayLines", () => {
  it("renders sections", () => {
    const p = {
      role: "primary" as const,
      title: "URI",
      assessment: "",
      provisionalDiagnosis: "",
      differential: "",
      plan: "",
      askNext: [],
      examineNext: [],
      confidenceLevel: "medium",
      uncertaintyReasons: ["pending CXR"],
      evidenceSupport: [
        { type: "history" as const, text: "cough 3d", relation: "supports" as const },
      ],
    } satisfies OpdAiProblemJson;
    const lines = formatProblemEvidenceOverlayLines(p);
    expect(lines.join("\n")).toContain("Confidence");
    expect(lines.join("\n")).toContain("Uncertainty");
    expect(lines.join("\n")).toContain("[history] supports");
  });
});
