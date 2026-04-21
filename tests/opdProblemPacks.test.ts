import { describe, expect, it } from "vitest";
import { resolveOpdProblemPacks, OPD_PROBLEM_PACK_ORDER } from "../lib/chartAssist/opdProblemPacks";
import { shouldSuppressFeverProblemPack } from "../lib/chartAssist/feverChildOpdFramework";
import { normalizeClinicalText } from "../lib/chartAssist/parseCaseFacts";
import { findClinicalContradictions } from "../lib/chartAssist/clinicalContradictionCheck";
import { GYNE_PACK_ORDER, LABOR_ROOM_PACK_ORDER } from "../lib/chartAssist/laborGynePackData";
import { OPD_MODE_PACK_ORDER } from "../lib/chartAssist/modeProblemPackData";

describe("OPD_PROBLEM_PACK_ORDER", () => {
  it("has core packs then orthopedic packs in the product roadmap order", () => {
    expect(OPD_PROBLEM_PACK_ORDER).toHaveLength(21);
    expect(OPD_PROBLEM_PACK_ORDER[0]).toBe("skin_rash");
    expect(OPD_PROBLEM_PACK_ORDER[14]).toBe("allergy_urticaria_anaphylaxis");
    expect(OPD_PROBLEM_PACK_ORDER[15]).toBe("ortho_acute_limb_sprain");
    expect(OPD_PROBLEM_PACK_ORDER[20]).toBe("ortho_pediatric_limp");
  });
});

describe("OPD_MODE_PACK_ORDER (mode roadmap)", () => {
  it("lists ten core OPD packs then six orthopedic packs", () => {
    expect(OPD_MODE_PACK_ORDER).toHaveLength(16);
    expect(OPD_MODE_PACK_ORDER.slice(0, 10)).toEqual([
      "skin_rash",
      "uri_cough",
      "fever",
      "diarrhea_vomiting",
      "abdominal_pain",
      "dysuria",
      "headache_dizziness",
      "back_neck_pain",
      "ear_pain",
      "red_eye",
    ]);
    expect(OPD_MODE_PACK_ORDER[10]).toBe("ortho_acute_limb_sprain");
    expect(OPD_MODE_PACK_ORDER[15]).toBe("ortho_pediatric_limp");
  });
});

describe("resolveOpdProblemPacks", () => {
  it("does not activate fever pack when no fever is documented", () => {
    const t = normalizeClinicalText("cough and rash, no fever");
    const r = resolveOpdProblemPacks(t, "OPD");
    expect(r.mode).toBe("OPD");
    expect(r.activeMatches.map((x) => x.packId)).not.toContain("fever");
  });

  it("activates multiple packs when cues are present", () => {
    const t = normalizeClinicalText("fever and dysuria for 2 days");
    const ids = resolveOpdProblemPacks(t, "OPD").activeMatches.map((x) => x.packId);
    expect(ids).toContain("fever");
    expect(ids).toContain("dysuria");
  });

  it("sorts active packs by OPD roadmap order", () => {
    const t = normalizeClinicalText("dysuria and fever");
    const orders = resolveOpdProblemPacks(t, "OPD").activeMatches.map((m) => m.order);
    const sorted = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sorted);
  });

  it("does not activate fever pack when ไม่มีไข้ without affirmative fever cues", () => {
    const t = normalizeClinicalText("cough, ไม่มีไข้, well appearing");
    expect(shouldSuppressFeverProblemPack(t)).toBe(true);
    const ids = resolveOpdProblemPacks(t, "OPD").activeMatches.map((x) => x.packId);
    expect(ids).not.toContain("fever");
  });

  it("uses ER pack order and ER-only packs", () => {
    const t = normalizeClinicalText("chest pain substernal crushing");
    const r = resolveOpdProblemPacks(t, "ER");
    expect(r.mode).toBe("ER");
    expect(r.orderedIds.slice(0, 7)).toEqual([
      "er_dyspnea_hypoxemia",
      "er_seizure_ams",
      "er_anaphylaxis",
      "er_chest_pain",
      "er_sepsis_shock",
      "er_poisoning_overdose",
      "er_dehydration",
    ]);
    expect(r.activeMatches.map((m) => m.packId)).toContain("er_chest_pain");
  });

  it("er_chest_pain pack includes ACS triage ask/exam lists", () => {
    const def = resolveOpdProblemPacks(normalizeClinicalText("acute chest pain"), "ER").activeMatches.find(
      (m) => m.packId === "er_chest_pain",
    )?.def;
    expect(def).toBeDefined();
    expect(def!.askNext.length).toBeGreaterThanOrEqual(8);
    expect(def!.examNext.length).toBeGreaterThanOrEqual(5);
    expect(def!.hardFactsGuidance).toMatch(/ECG|troponin/i);
    expect(def!.titleEn).toContain("ACS");
  });

  it("activates orthopedic packs after core OPD roadmap when cues match", () => {
    const t = normalizeClinicalText("twisted ankle sprain cannot bear weight");
    const r = resolveOpdProblemPacks(t, "OPD");
    expect(r.activeMatches.map((m) => m.packId)).toContain("ortho_acute_limb_sprain");
    const orders = r.activeMatches.map((m) => m.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });

  it("matches pediatric limp pack", () => {
    const t = normalizeClinicalText("child limping refusing to walk fever");
    const r = resolveOpdProblemPacks(t, "OPD");
    expect(r.activeMatches.map((m) => m.packId)).toContain("ortho_pediatric_limp");
  });

  it("uses LABOR_ROOM roadmap order (six obstetric packs)", () => {
    const r = resolveOpdProblemPacks(normalizeClinicalText("labor room contraction"), "LABOR_ROOM");
    expect(r.mode).toBe("LABOR_ROOM");
    expect(r.orderedIds).toEqual(LABOR_ROOM_PACK_ORDER);
    expect(LABOR_ROOM_PACK_ORDER).toHaveLength(6);
    expect(LABOR_ROOM_PACK_ORDER[0]).toBe("lr_labor_evaluation");
    expect(LABOR_ROOM_PACK_ORDER[5]).toBe("lr_postpartum_fever");
  });

  it("uses GYNE roadmap order (seven gynecology packs)", () => {
    const r = resolveOpdProblemPacks(normalizeClinicalText("abnormal uterine bleeding heavy"), "GYNE");
    expect(r.mode).toBe("GYNE");
    expect(r.orderedIds).toEqual(GYNE_PACK_ORDER);
    expect(GYNE_PACK_ORDER).toHaveLength(7);
    expect(GYNE_PACK_ORDER[0]).toBe("gy_early_pregnancy_bleeding");
    expect(GYNE_PACK_ORDER[6]).toBe("gy_vulvar_bartholin");
  });
});

describe("findClinicalContradictions", () => {
  it("flags fever positive and denial phrases together", () => {
    const t = normalizeClinicalText("febrile 39C but patient states no fever");
    expect(findClinicalContradictions(t).length).toBeGreaterThan(0);
  });
});
