import { describe, expect, it } from "vitest";
import { postCheckOpdAiPhase1 } from "../lib/chartAssist/opdAssistAiPostCheck";
import type { CaseClinicalProfile } from "../lib/chartAssist/caseClinicalProfile";
import type { AssistantBundle } from "../lib/chartAssist/structuredNote";
import type { StructuredOpdNote } from "../lib/chartAssist/structuredNote";

const emptyBundle = (): AssistantBundle => ({
  detectedFacts: [],
  missingInfo: [],
  provisionalAssessment: "",
  nextStepSuggestions: [],
  diagnosisIdeas: [],
  treatmentHints: [],
  patientAdviceHints: [],
  redFlags: [],
  guidelineSourceIds: [],
  sectionHints: { piMissing: [], peMissing: [], differentialClues: [], planActions: [] },
});

const profile = (): CaseClinicalProfile => ({
  caseType: "general",
  dominantTheme: "unclear",
  hasSystemicRedFlags: false,
});

describe("postCheckOpdAiPhase1", () => {
  it("rejects empty AI output when input is substantial", () => {
    const ruleNote: StructuredOpdNote = {
      cc: "x",
      pi: "y",
      pastHistory: "",
      pe: "",
      assessment: "",
      diagnosis: "",
      differential: "",
      plan: "",
      patientAdvice: "",
    };
    const r = postCheckOpdAiPhase1(
      "a".repeat(50),
      ruleNote,
      { cc: "", pi: "", pe: "" },
      profile(),
      emptyBundle(),
    );
    expect(r.ok).toBe(false);
  });

  it("accepts reasonable AI output", () => {
    const ruleNote: StructuredOpdNote = {
      cc: "",
      pi: "",
      pastHistory: "",
      pe: "",
      assessment: "",
      diagnosis: "",
      differential: "",
      plan: "",
      patientAdvice: "",
    };
    const r = postCheckOpdAiPhase1(
      "เด็ก 3 ขวบ ไข้ 2 วัน ไอ เล่นได้",
      ruleNote,
      { cc: "ไข้ 2 วัน", pi: "เริ่มเมื่อ…", pe: "- Temp 38\n- ปอดชัด" },
      profile(),
      emptyBundle(),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cc).toContain("ไข้");
    }
  });
});
