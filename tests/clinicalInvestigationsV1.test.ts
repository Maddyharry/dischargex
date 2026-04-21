import { describe, expect, it } from "vitest";
import {
  computeOpdAssistInvestigationsStatsV1,
  normalizeClinicalInvestigationsV1,
} from "../lib/chartAssist/clinicalInvestigationV1";
import type { OpdAiClinicalNoteJson } from "../lib/chartAssist/opdAssistAiTypes";
import { formatInvestigationsSectionLines } from "../lib/chartAssist/opdNoteLayout";

describe("normalizeClinicalInvestigationsV1", () => {
  it("returns [] for non-array and warns", () => {
    const w: string[] = [];
    expect(normalizeClinicalInvestigationsV1("x", w)).toEqual([]);
    expect(w.some((x) => /not an array/i.test(x))).toBe(true);
  });

  it("CXR — xray kind + bodyPart + impression", () => {
    const w: string[] = [];
    const out = normalizeClinicalInvestigationsV1(
      [
        {
          investigationId: "inv_cxr_1",
          kind: "xray",
          label: "CXR PA",
          status: "done",
          bodyPart: "chest",
          impression: "Clear lungs",
        },
      ],
      w,
    );
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("xray");
    expect(out[0].impression).toContain("Clear");
  });

  it("ECG — rate, rhythm, sttSummary", () => {
    const w: string[] = [];
    const out = normalizeClinicalInvestigationsV1(
      [
        {
          investigationId: "inv_ecg_1",
          kind: "ecg",
          label: "ECG 12-lead",
          status: "done",
          rate: "80",
          rhythm: "sinus",
          sttSummary: "no ST elevation",
        },
      ],
      w,
    );
    expect(out[0].rate).toBe("80");
    expect(out[0].rhythm).toBe("sinus");
  });

  it("CT brain — ct + bodyPart", () => {
    const w: string[] = [];
    const out = normalizeClinicalInvestigationsV1(
      [
        {
          investigationId: "inv_ct_1",
          kind: "ct",
          label: "CT brain non-contrast",
          status: "ordered",
          bodyPart: "brain",
        },
      ],
      w,
    );
    expect(out[0].kind).toBe("ct");
    expect(out[0].bodyPart).toBe("brain");
  });

  it("U/S abdomen — ultrasound + keyFindings", () => {
    const w: string[] = [];
    const out = normalizeClinicalInvestigationsV1(
      [
        {
          investigationId: "inv_us_1",
          kind: "ultrasound",
          label: "FAST / abdomen",
          bodyPart: "abdomen",
          keyFindings: ["no free fluid", "GB wall normal"],
        },
      ],
      w,
    );
    expect(out[0].keyFindings?.length).toBe(2);
  });

  it("lab summary — lab kind + summary", () => {
    const w: string[] = [];
    const out = normalizeClinicalInvestigationsV1(
      [
        {
          investigationId: "inv_lab_1",
          kind: "lab",
          label: "CBC, BMP",
          status: "done",
          summary: "WBC 8, Hct 40, Cr 0.9",
        },
      ],
      w,
    );
    expect(out[0].summary).toContain("WBC");
  });

  it("coerces unknown kind to lab", () => {
    const w: string[] = [];
    const out = normalizeClinicalInvestigationsV1(
      [{ investigationId: "x", kind: "mri_brain", label: "MRI" }],
      w,
    );
    expect(out[0].kind).toBe("lab");
  });
});

describe("computeOpdAssistInvestigationsStatsV1", () => {
  it("counts returned, complete, problemRef", () => {
    const w: string[] = [];
    const items2 = normalizeClinicalInvestigationsV1(
      [
        {
          investigationId: "a",
          kind: "lab",
          label: "CBC",
          summary: "ok",
          problemRefId: "p1",
        },
        { investigationId: "b", kind: "xray", label: "CXR", impression: "clear" },
      ],
      w,
    );
    const s = computeOpdAssistInvestigationsStatsV1(items2);
    expect(s.returned).toBe(true);
    expect(s.count).toBe(2);
    expect(s.withProblemRefCount).toBe(1);
    expect(s.completeCount).toBe(2);
    expect(s.byKind.lab).toBe(1);
    expect(s.byKind.xray).toBe(1);
  });
});

describe("formatInvestigationsSectionLines", () => {
  it("renders heading and lines for mixed investigations", () => {
    const ai = {
      cc: "",
      pi: "",
      pastHistoryMedsAllergy: "",
      pe: "",
      problemList: "",
      problems: [],
      patientAdvice: "",
      investigations: normalizeClinicalInvestigationsV1(
        [
          {
            investigationId: "1",
            kind: "xray",
            label: "CXR",
            impression: "normal",
            bodyPart: "chest",
          },
          {
            investigationId: "2",
            kind: "ecg",
            label: "ECG",
            rate: "70",
            rhythm: "SR",
          },
        ],
        [],
      ),
    } as OpdAiClinicalNoteJson;
    const lines = formatInvestigationsSectionLines(ai);
    expect(lines[0]).toContain("Investigations");
    expect(lines.join("\n")).toContain("[xray]");
    expect(lines.join("\n")).toContain("rate:");
  });
});
