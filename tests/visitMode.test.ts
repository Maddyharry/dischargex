import { describe, expect, it } from "vitest";
import { detectVisitMode } from "../lib/chartAssist/triggers";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";
import { analyzeOpdCase } from "../lib/chartAssist/analyzeCase";

describe("detectVisitMode", () => {
  it("defaults to OPD for rash + URI style presentation", () => {
    const t = normalizeClinicalText("rash on legs, runny nose, cough 3 days");
    expect(detectVisitMode(t, null).mode).toBe("OPD");
  });

  it("selects ER when hypoxemia / respiratory failure cues are present", () => {
    const t = normalizeClinicalText("severe dyspnea, hypoxemia");
    const v = detectVisitMode(t, null);
    expect(v.mode).toBe("ER");
    expect(v.reason).toBe("er_hypoxemia");
  });

  it("selects ER for poisoning / overdose before routine OPD", () => {
    const t = normalizeClinicalText("accidental opioid overdose, naloxone given");
    expect(detectVisitMode(t, null)).toEqual({ mode: "ER", reason: "er_poisoning_overdose" });
  });

  it("selects ER for severe trauma (unstable) before generic TRAUMA mode", () => {
    const t = normalizeClinicalText("RTA with open fracture left tibia, bleeding controlled");
    expect(detectVisitMode(t, null)).toEqual({ mode: "ER", reason: "er_severe_trauma" });
  });

  it("selects TRAUMA for road traffic / RTA language", () => {
    const t = normalizeClinicalText("RTA — motor vehicle accident, driver restrained");
    const v = detectVisitMode(t, null);
    expect(v.mode).toBe("TRAUMA");
    expect(v.reason).toBe("trauma_mechanism");
  });

  it("selects PSYCH for suicidal ideation", () => {
    const t = normalizeClinicalText("suicidal ideation, denies plan");
    expect(detectVisitMode(t, null).mode).toBe("PSYCH");
  });

  it("respects manual override", () => {
    const t = normalizeClinicalText("hypoxemia and shock");
    expect(detectVisitMode(t, "PSYCH").mode).toBe("PSYCH");
    expect(detectVisitMode(t, "PSYCH").reason).toBe("override");
  });

  it("selects ER for pediatric fever + danger signs (e.g. poor feeding)", () => {
    const t = normalizeClinicalText("fever 2 days, poor feeding, infant");
    expect(detectVisitMode(t, null)).toEqual({ mode: "ER", reason: "er_fever_danger_pediatric" });
  });

  it("selects ER for diarrhea/vomiting + severe dehydration signs (GI composite, not already ER-first)", () => {
    const t = normalizeClinicalText("watery diarrhea, vomiting everything, infant");
    expect(detectVisitMode(t, null)).toEqual({ mode: "ER", reason: "er_gi_severe_dehydration" });
  });

  it("selects LABOR_ROOM for third-trimester / strong obstetric cues", () => {
    const t = normalizeClinicalText("39 weeks pregnant, contractions every 5 minutes, labor room");
    expect(detectVisitMode(t, null)).toEqual({ mode: "LABOR_ROOM", reason: "labor_room_presentation" });
  });

  it("selects GYNE for early pregnancy bleeding (ectopic pathway) before generic TRAUMA", () => {
    const t = normalizeClinicalText("8 weeks pregnant vaginal bleeding and lower abdominal pain");
    expect(detectVisitMode(t, null)).toEqual({ mode: "GYNE", reason: "gyne_presentation" });
  });

  it("selects GYNE for ovarian torsion cues", () => {
    const t = normalizeClinicalText("acute pelvic pain ovarian torsion concern");
    expect(detectVisitMode(t, null)).toEqual({ mode: "GYNE", reason: "gyne_presentation" });
  });
});

describe("analyzeOpdCase visitModeReason", () => {
  it("returns visitModeReason alongside mode", () => {
    const r = analyzeOpdCase("hallucinations and paranoia", null);
    expect(r.mode).toBe("PSYCH");
    expect(r.visitModeReason).toBe("psychiatric_risk");
    expect(r.problemPackResolution).toBeDefined();
  });
});
