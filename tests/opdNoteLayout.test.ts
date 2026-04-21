import { describe, expect, it } from "vitest";
import { formatOpdClinicalNoteLayout } from "../lib/chartAssist/opdNoteLayout";
import type { OpdAiClinicalNoteJson } from "../lib/chartAssist/opdAssistAiTypes";

describe("formatOpdClinicalNoteLayout TRAUMA", () => {
  it("uses trauma headings when mode is TRAUMA", () => {
    const ai: OpdAiClinicalNoteJson = {
      cc: "RTA",
      pi: "LOC 2 min",
      pastHistoryMedsAllergy: "—",
      pe: "GCS 15",
      problemList: "1. Closed head injury",
      problems: [],
      patientAdvice: "—",
      traumaMechanism: "MVA restrained driver, frontal impact",
      traumaTimeOfInjury: "2 hours ago",
      traumaPrimarySurvey: {
        airway: "patent",
        breathing: "RR 18",
        circulation: "BP 120/80",
        disability: "GCS 15",
        exposure: "no obvious bleed",
      },
      traumaSecondarySurvey: "No step-off c-spine",
      traumaFocusedAssessment: "Low concern for ICH clinically",
      traumaImagingProcedure: "CT head if worsening",
      traumaPlan: "observe, analgesia",
      traumaDisposition: "Discharge with precautions",
    };
    const out = formatOpdClinicalNoteLayout(ai, "TRAUMA");
    expect(out).toContain("Mechanism of injury");
    expect(out).toContain("Time of injury");
    expect(out).toContain("Primary survey");
    expect(out).toContain("Secondary survey");
    expect(out).toContain("Problem list");
    expect(out).toContain("Assessment");
    expect(out).toContain("Plan");
    expect(out).toContain("Imaging / procedure considerations");
    expect(out).toContain("Disposition");
    expect(out).not.toContain("Advice / warning signs");
  });
});

describe("formatOpdClinicalNoteLayout PSYCH", () => {
  it("uses psych headings when mode is PSYCH", () => {
    const ai: OpdAiClinicalNoteJson = {
      cc: "Hearing voices",
      pi: "2 weeks",
      pastHistoryMedsAllergy: "—",
      pe: "MSE documented",
      problemList: "1. Psychosis NOS",
      problems: [],
      patientAdvice: "OP follow-up",
      psychChiefConcern: "Auditory hallucinations",
      psychHpi: "Progressive over 2 weeks",
      psychRiskAssessment: {
        suicidalIdeation: "denies",
        suicidalPlan: "none",
        selfHarmHistory: "none",
        homicidalIdeation: "denies",
        psychosis: "AH present",
        substanceUse: "denies",
      },
      psychMentalStatusExam: "Alert, cooperative, AH endorsed",
      psychSynthesisAssessment: "Primary psychotic symptoms",
      psychPlan: "start antipsychotic, safety plan",
      psychDispositionReferral: "OP psych referral",
    };
    const out = formatOpdClinicalNoteLayout(ai, "PSYCH");
    expect(out).toContain("Chief psychiatric concern");
    expect(out).toContain("History of present illness");
    expect(out).toContain("Risk assessment");
    expect(out).toContain("suicidal ideation:");
    expect(out).toContain("Mental status examination");
    expect(out).toContain("Problem list");
    expect(out).toContain("Assessment");
    expect(out).toContain("Plan");
    expect(out).toContain("Disposition / referral");
    expect(out).not.toContain("Advice / warning signs");
  });
});

describe("formatOpdClinicalNoteLayout", () => {
  it("uses ER headings when mode is ER", () => {
    const ai: OpdAiClinicalNoteJson = {
      cc: "เหนื่อยหอบ",
      pi: "มา 1 ชม.",
      pastHistoryMedsAllergy: "—",
      pe: "RR 32",
      problemList: "1. Hypoxemic respiratory distress",
      problems: [],
      patientAdvice: "—",
      erTriageConcern: "ESI 2 — hypoxemia",
      erPrimarySurvey: {
        airway: "เปิดกว้าง พูดได้สั้นๆ",
        breathing: "RR 32, SpO2 88% RA",
        circulation: "BP 110/70, HR 110",
        disability: "Alert, distress",
        exposure: "ไม่เห็นผื่น",
      },
      erImmediateManagement: "O2, IV, CXR",
      erReassessment: "รอ CXR",
      erDisposition: "รอผล + admit สังเกต",
    };
    const out = formatOpdClinicalNoteLayout(ai, "ER");
    expect(out).toContain("Triage concern");
    expect(out).toContain("Primary survey / immediate concern");
    expect(out).toContain("A:");
    expect(out).toContain("Focused history");
    expect(out).toContain("Immediate management");
    expect(out).toContain("Reassessment");
    expect(out).toContain("Disposition");
    expect(out).not.toContain("Advice / warning signs");
  });

  it("uses life-threat ER section order when option is set", () => {
    const ai: OpdAiClinicalNoteJson = {
      cc: "เหนื่อยหอบ",
      pi: "มา 1 ชม.",
      pastHistoryMedsAllergy: "—",
      pe: "RR 32",
      problemList: "1. Hypoxemic respiratory distress",
      problems: [],
      patientAdvice: "—",
      erTriageConcern: "ESI 2 — hypoxemia",
      erPrimarySurvey: {
        airway: "เปิดกว้าง พูดได้สั้นๆ",
        breathing: "RR 32, SpO2 88% RA",
        circulation: "BP 110/70, HR 110",
        disability: "Alert, distress",
        exposure: "ไม่เห็นผื่น",
      },
      erImmediateManagement: "O2, IV, CXR",
      erReassessment: "รอ CXR",
      erDisposition: "รอผล + admit สังเกต",
    };
    const out = formatOpdClinicalNoteLayout(ai, "ER", { erImmediateLifeThreatReorder: true });
    const idx = (label: string) => out.indexOf(label);
    expect(idx("Immediate concern")).toBeLessThan(idx("Critical vitals & focused exam"));
    expect(idx("Critical vitals & focused exam")).toBeLessThan(idx("Immediate management"));
    expect(idx("Immediate management")).toBeLessThan(idx("Focused history"));
    expect(idx("Focused history")).toBeLessThan(idx("Problem list"));
    expect(idx("Problem list")).toBeLessThan(idx("Reassessment"));
    expect(idx("Reassessment")).toBeLessThan(idx("Disposition"));
  });

  it("includes section headers in order (OPD)", () => {
    const ai: OpdAiClinicalNoteJson = {
      cc: "ไข้ 2 วัน",
      pi: "เริ่มเมื่อ…",
      pastHistoryMedsAllergy: "ยังไม่ครบ",
      pe: "- Temp 38",
      problemList: "1. ไข้\n2. ไอ",
      problems: [
        {
          role: "primary",
          title: "ไข้",
          assessment: "ดูดี",
          provisionalDiagnosis: "URI?",
          differential: "- a\n- b",
          plan: "ยา",
          askNext: ["x"],
          examineNext: ["y"],
        },
      ],
      patientAdvice: "กลับถ้าแย่",
    };
    const out = formatOpdClinicalNoteLayout(ai, "OPD");
    expect(out).toContain("CC");
    expect(out).toContain("PI");
    expect(out).toContain("Past history / medication / allergy");
    expect(out).toContain("Problem list");
    expect(out).toContain("Problem 1:");
    expect(out).toContain("Differential diagnosis");
    expect(out).toContain("What to ask next");
    expect(out).toContain("Advice / warning signs");
  });
});
