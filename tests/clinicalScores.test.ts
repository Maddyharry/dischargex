import { describe, expect, it } from "vitest";
import {
  ALVARADO_SCORE,
  assignScoresToActivePacks,
  CHA2DS2_VASC_SCORE,
  CLINICAL_SCORE_DEFINITIONS,
  evaluateClinicalScore,
  NIHSS_SCORE,
  TOKYO_CHOLECYSTITIS_SCORE,
} from "../lib/chartAssist/clinicalScores";

describe("clinicalScores engine", () => {
  it("CHA2DS2-VASc sums deterministically", () => {
    const raw = {
      age_band: "65_74",
      sex_female: true,
      chf: true,
      hypertension: false,
      stroke_tia_thrombo: false,
      vascular: false,
      diabetes: true,
    };
    const ev = evaluateClinicalScore(CHA2DS2_VASC_SCORE, raw, {
      activePackIds: new Set(["chest_palpitations"]),
      markedNa: false,
    });
    expect(ev.state).toBe("ready");
    expect(ev.computed?.kind).toBe("numeric");
    if (ev.computed?.kind === "numeric") {
      // 1 (age) + 1 (female) + 1 (CHF) + 1 (DM) = 4
      expect(ev.computed.total).toBe(4);
    }
  });

  it("NIHSS totals item sum", () => {
    const raw: Record<string, number> = {};
    for (const f of NIHSS_SCORE.requiredFields) {
      raw[f.id] = f.id === "nihss_4" ? 2 : 0;
    }
    const ev = evaluateClinicalScore(NIHSS_SCORE, raw, {
      activePackIds: new Set(["headache_dizziness"]),
      markedNa: false,
    });
    expect(ev.state).toBe("ready");
    if (ev.computed?.kind === "numeric") expect(ev.computed.total).toBe(2);
  });

  it("Alvarado matches classic sum", () => {
    const raw = {
      migratory_rlq: true,
      anorexia: true,
      nausea_vomiting: false,
      rlq_tenderness: true,
      rebound_rlq: false,
      fever: true,
      wbc_gt_10: true,
      left_shift: false,
    };
    const ev = evaluateClinicalScore(ALVARADO_SCORE, raw, {
      activePackIds: new Set(["abdominal_pain"]),
      markedNa: false,
    });
    expect(ev.state).toBe("ready");
    // 1+1+0+2+0+1+1+0 = 6
    if (ev.computed?.kind === "numeric") expect(ev.computed.total).toBe(6);
  });

  it("Tokyo simplified grade III on organ dysfunction", () => {
    const raw = {
      age_gte_70: false,
      wbc_gt_18: false,
      organ_dysfunction: true,
      diffuse_peritonitis: false,
      palpable_gb: false,
      imaging_severe: false,
    };
    const ev = evaluateClinicalScore(TOKYO_CHOLECYSTITIS_SCORE, raw, {
      activePackIds: new Set(["abdominal_pain"]),
      markedNa: false,
    });
    expect(ev.state).toBe("ready");
    if (ev.computed?.kind === "graded") expect(ev.computed.grade).toBe("III");
  });

  it("hides score when pack not active", () => {
    const ev = evaluateClinicalScore(NIHSS_SCORE, {}, {
      activePackIds: new Set(["fever"]),
      markedNa: false,
    });
    expect(ev.state).toBe("not_applicable");
  });

  it("assignScoresToActivePacks dedupes to first roadmap pack", () => {
    const matches = [
      { packId: "headache_dizziness" },
      { packId: "er_seizure_ams" },
    ];
    const rows = assignScoresToActivePacks(CLINICAL_SCORE_DEFINITIONS, matches);
    expect(rows[0]?.scoreIds).toContain("nihss");
    expect(rows[1]?.scoreIds).not.toContain("nihss");
  });
});
