import type { OpdProblemPackId } from "../opdProblemPacks";
import type { ClinicalScoreComputed, ClinicalScoreDefinition, ClinicalScoreFieldDef } from "./types";

const nih: ClinicalScoreFieldDef[] = [
  { id: "nihss_1a", label: "1a — Level of consciousness (LOC)", kind: "number", min: 0, max: 3 },
  { id: "nihss_1b", label: "1b — LOC questions", kind: "number", min: 0, max: 2 },
  { id: "nihss_1c", label: "1c — LOC commands", kind: "number", min: 0, max: 2 },
  { id: "nihss_2", label: "2 — Best gaze", kind: "number", min: 0, max: 2 },
  { id: "nihss_3", label: "3 — Visual fields", kind: "number", min: 0, max: 3 },
  { id: "nihss_4", label: "4 — Facial palsy", kind: "number", min: 0, max: 3 },
  { id: "nihss_5a", label: "5a — Motor arm (left)", kind: "number", min: 0, max: 4 },
  { id: "nihss_5b", label: "5b — Motor arm (right)", kind: "number", min: 0, max: 4 },
  { id: "nihss_6a", label: "6a — Motor leg (left)", kind: "number", min: 0, max: 4 },
  { id: "nihss_6b", label: "6b — Motor leg (right)", kind: "number", min: 0, max: 4 },
  { id: "nihss_7", label: "7 — Limb ataxia", kind: "number", min: 0, max: 2 },
  { id: "nihss_8", label: "8 — Sensory", kind: "number", min: 0, max: 2 },
  { id: "nihss_9", label: "9 — Best language / aphasia", kind: "number", min: 0, max: 3 },
  { id: "nihss_10", label: "10 — Dysarthria", kind: "number", min: 0, max: 2 },
  { id: "nihss_11", label: "11 — Extinction / inattention", kind: "number", min: 0, max: 2 },
];

function num(i: Record<string, number | boolean | string>, k: string): number {
  const v = i[k];
  return typeof v === "number" && !Number.isNaN(v) ? v : 0;
}

function bool(i: Record<string, number | boolean | string>, k: string): boolean {
  return i[k] === true;
}

export const NIHSS_SCORE: ClinicalScoreDefinition = {
  id: "nihss",
  label: "NIHSS (stroke severity)",
  triggerProblems: [
    "headache_dizziness",
    "er_seizure_ams",
    "tr_minor_head_injury",
    "tr_blunt_trauma",
  ] as OpdProblemPackId[],
  requiredFields: nih,
  optionalFields: [],
  referenceIds: ["ninds-nihss-stroke-scale"],
  compute: (i) => {
    const keys = nih.map((f) => f.id);
    let total = 0;
    const breakdown: Record<string, number> = {};
    for (const k of keys) {
      const v = num(i, k);
      breakdown[k] = v;
      total += v;
    }
    return { kind: "numeric", total, breakdown };
  },
  interpret: (c) => {
    if (c.kind !== "numeric") return "";
    const t = c.total;
    if (t === 0) return "NIHSS 0 — no focal deficit scored on this form.";
    if (t <= 4) return "Mild stroke severity band (NIHSS 1–4) — context-dependent; correlate clinically.";
    if (t <= 15) return "Moderate stroke severity band (NIHSS 5–15).";
    if (t <= 20) return "Moderate–severe band (NIHSS 16–20).";
    return "Severe stroke severity band (NIHSS ≥21).";
  },
};

export const CHA2DS2_VASC_SCORE: ClinicalScoreDefinition = {
  id: "chads2_vasc",
  label: "CHA₂DS₂-VASc (AF stroke risk)",
  triggerProblems: ["chest_palpitations"] as OpdProblemPackId[],
  requiredFields: [
    {
      id: "age_band",
      label: "Age",
      kind: "select",
      options: [
        { value: "lt65", label: "<65 y" },
        { value: "65_74", label: "65–74 y" },
        { value: "gte75", label: "≥75 y" },
      ],
    },
    {
      id: "sex_female",
      label: "Sex category (female)",
      kind: "boolean",
    },
    {
      id: "chf",
      label: "C — Congestive heart failure / LV dysfunction",
      kind: "boolean",
    },
    {
      id: "hypertension",
      label: "H — Hypertension",
      kind: "boolean",
    },
    {
      id: "stroke_tia_thrombo",
      label: "S₂ — Prior stroke / TIA / thromboembolism",
      kind: "boolean",
    },
    {
      id: "vascular",
      label: "V — Vascular disease (prior MI, PAD, aortic plaque)",
      kind: "boolean",
    },
    {
      id: "diabetes",
      label: "D — Diabetes mellitus",
      kind: "boolean",
    },
  ],
  optionalFields: [],
  referenceIds: ["esc-chads2-vasc-af-2024"],
  compute: (i) => {
    let pts = 0;
    const ab = String(i.age_band);
    if (ab === "65_74") pts += 1;
    if (ab === "gte75") pts += 2;
    if (bool(i, "sex_female")) pts += 1;
    if (bool(i, "chf")) pts += 1;
    if (bool(i, "hypertension")) pts += 1;
    if (bool(i, "stroke_tia_thrombo")) pts += 2;
    if (bool(i, "vascular")) pts += 1;
    if (bool(i, "diabetes")) pts += 1;
    return { kind: "numeric", total: pts };
  },
  interpret: (c) => {
    if (c.kind !== "numeric") return "";
    const t = c.total;
    if (t === 0) return "Score 0 — anticoagulation decision requires full clinical context (AF diagnosis, bleeding risk, preferences).";
    if (t === 1) return "Low–moderate risk context; anticoagulation often considered for AF with modifiable factors — follow current guideline thresholds.";
    return "Elevated stroke risk context on this scale; anticoagulation typically weighted toward yes for eligible AF patients — confirm with ESC/AHA/ACC pathway and bleeding risk.";
  },
};

export const ALVARADO_SCORE: ClinicalScoreDefinition = {
  id: "alvarado",
  label: "Alvarado (appendicitis risk)",
  triggerProblems: ["abdominal_pain"] as OpdProblemPackId[],
  requiredFields: [
    { id: "migratory_rlq", label: "Migratory pain to RLQ", kind: "boolean" },
    { id: "anorexia", label: "Anorexia", kind: "boolean" },
    { id: "nausea_vomiting", label: "Nausea / vomiting", kind: "boolean" },
    { id: "rlq_tenderness", label: "RLQ tenderness", kind: "boolean" },
    { id: "rebound_rlq", label: "Rebound tenderness / guarding (RLQ)", kind: "boolean" },
    { id: "fever", label: "Fever / elevated temp", kind: "boolean" },
    { id: "wbc_gt_10", label: "WBC >10 ×10⁹/L", kind: "boolean" },
    { id: "left_shift", label: "Left shift (neutrophil predominance)", kind: "boolean" },
  ],
  optionalFields: [],
  referenceIds: ["alvarado-appendicitis-1986"],
  compute: (i) => {
    let t = 0;
    if (bool(i, "migratory_rlq")) t += 1;
    if (bool(i, "anorexia")) t += 1;
    if (bool(i, "nausea_vomiting")) t += 1;
    if (bool(i, "rlq_tenderness")) t += 2;
    if (bool(i, "rebound_rlq")) t += 1;
    if (bool(i, "fever")) t += 1;
    if (bool(i, "wbc_gt_10")) t += 1;
    if (bool(i, "left_shift")) t += 1;
    return { kind: "numeric", total: t };
  },
  interpret: (c) => {
    if (c.kind !== "numeric") return "";
    const t = c.total;
    if (t <= 4) return "Low probability band on classic Alvarado cutoffs — imaging/observation per pathway; not a stand-alone diagnosis.";
    if (t <= 6) return "Intermediate — consider further evaluation (imaging, serial exams) per local ED pathway.";
    return "Higher probability band — urgent surgical review/imaging often indicated; correlate clinically.";
  },
};

export const ASTHMA_ACT_SCORE: ClinicalScoreDefinition = {
  id: "asthma_act",
  label: "Asthma control (ACT-style sum)",
  triggerProblems: ["wheeze_dyspnea", "uri_cough"] as OpdProblemPackId[],
  requiredFields: [
    { id: "act_1", label: "ACT 1 — How often asthma kept you from usual activities?", kind: "number", min: 1, max: 5 },
    { id: "act_2", label: "ACT 2 — Shortness of breath (frequency)", kind: "number", min: 1, max: 5 },
    { id: "act_3", label: "ACT 3 — Night symptoms / waking", kind: "number", min: 1, max: 5 },
    { id: "act_4", label: "ACT 4 — Rescue bronchodilator use", kind: "number", min: 1, max: 5 },
    { id: "act_5", label: "ACT 5 — How would you rate asthma control?", kind: "number", min: 1, max: 5 },
  ],
  optionalFields: [],
  referenceIds: ["gina-act-asthma-control"],
  compute: (i) => {
    let s = 0;
    for (let k = 1; k <= 5; k += 1) {
      s += num(i, `act_${k}`);
    }
    return { kind: "numeric", total: s };
  },
  interpret: (c) => {
    if (c.kind !== "numeric") return "";
    const t = c.total;
    if (t <= 19) return "Poor control band (ACT sum ≤19) — step-up / review per GINA-style framework.";
    if (t <= 24) return "Partially controlled (20–24) — optimize adherence, triggers, technique.";
    return "Well controlled (25) on this 5-item sum — maintain plan; still correlate with symptoms/exacerbations.";
  },
};

export const COPD_ASSESSMENT_SCORE: ClinicalScoreDefinition = {
  id: "copd_assessment",
  label: "COPD — CAT + mMRC (+ optional exacerbations)",
  triggerProblems: ["wheeze_dyspnea"] as OpdProblemPackId[],
  requiredFields: [
    { id: "cat_1", label: "CAT 1 — Cough", kind: "number", min: 0, max: 5 },
    { id: "cat_2", label: "CAT 2 — Mucus", kind: "number", min: 0, max: 5 },
    { id: "cat_3", label: "CAT 3 — Chest tightness", kind: "number", min: 0, max: 5 },
    { id: "cat_4", label: "CAT 4 — Breathlessness climbing stairs", kind: "number", min: 0, max: 5 },
    { id: "cat_5", label: "CAT 5 — Home limitation", kind: "number", min: 0, max: 5 },
    { id: "cat_6", label: "CAT 6 — confidence leaving home", kind: "number", min: 0, max: 5 },
    { id: "cat_7", label: "CAT 7 — Sleep quality", kind: "number", min: 0, max: 5 },
    { id: "cat_8", label: "CAT 8 — Energy", kind: "number", min: 0, max: 5 },
    { id: "mmrc", label: "mMRC dyspnea grade", kind: "number", min: 0, max: 4 },
  ],
  optionalFields: [
    {
      id: "exac_last_year",
      label: "Moderate–severe exacerbations (last 12 mo)",
      kind: "select",
      options: [
        { value: "0", label: "0" },
        { value: "1", label: "1" },
        { value: "2plus", label: "≥2" },
      ],
    },
  ],
  referenceIds: ["gold-cat-mmrc-copd"],
  compute: (i) => {
    let cat = 0;
    for (let k = 1; k <= 8; k += 1) cat += num(i, `cat_${k}`);
    const mmrc = num(i, "mmrc");
    const ex = String(i.exac_last_year ?? "");
    const lines: { label: string; value: string }[] = [
      { label: "CAT total (0–40)", value: String(cat) },
      { label: "mMRC (0–4)", value: String(mmrc) },
    ];
    if (ex && ex !== "") {
      lines.push({
        label: "Exacerbations (12 mo)",
        value: ex === "2plus" ? "≥2" : ex,
      });
    }
    return {
      kind: "composite",
      lines,
    };
  },
  interpret: (c) => {
    if (c.kind !== "composite") return "";
    const catLine = c.lines.find((l) => l.label.startsWith("CAT"));
    const mmrcLine = c.lines.find((l) => l.label.startsWith("mMRC"));
    const cat = catLine ? Number(catLine.value) : NaN;
    const mmrc = mmrcLine ? Number(mmrcLine.value) : NaN;
    const parts: string[] = [];
    if (!Number.isNaN(cat)) {
      if (cat >= 10) parts.push("CAT ≥10 suggests clinically important symptom burden.");
      else parts.push("CAT <10 — lower symptom burden on this scale.");
    }
    if (!Number.isNaN(mmrc)) {
      if (mmrc >= 2) parts.push("mMRC ≥2 — higher dyspnea burden; use with CAT/exacerbation history for GOLD grouping context.");
      else parts.push("mMRC 0–1 — less dyspnea on exertion by this scale.");
    }
    return parts.join(" ");
  },
};

/** Simplified deterministic TG18-style severity triage (not a substitute for full guideline tables). */
export const TOKYO_CHOLECYSTITIS_SCORE: ClinicalScoreDefinition = {
  id: "tokyo_acute_cholecystitis",
  label: "Tokyo severity (acute cholecystitis — simplified)",
  triggerProblems: ["abdominal_pain"] as OpdProblemPackId[],
  requiredFields: [
    { id: "age_gte_70", label: "Age ≥70 y", kind: "boolean" },
    { id: "wbc_gt_18", label: "WBC >18 ×10⁹/L", kind: "boolean" },
    { id: "organ_dysfunction", label: "Organ dysfunction (e.g. hypotension, confusion, coagulopathy, AKI)", kind: "boolean" },
    { id: "diffuse_peritonitis", label: "Diffuse peritonitis / perforation concern", kind: "boolean" },
    { id: "palpable_gb", label: "Palpable tender gallbladder / mass", kind: "boolean" },
    { id: "imaging_severe", label: "Imaging: severe GB wall thickening / distension / pericholecystic fluid / stones", kind: "boolean" },
  ],
  optionalFields: [],
  referenceIds: ["tg18-acute-cholecystitis-severity"],
  compute: (i) => {
    const iii = bool(i, "organ_dysfunction") || bool(i, "diffuse_peritonitis");
    if (iii) {
      return {
        kind: "graded",
        grade: "III",
        gradeLabel: "Severe (simplified — organ dysfunction or diffuse peritonitis)",
      };
    }
    const ii =
      bool(i, "wbc_gt_18") ||
      bool(i, "age_gte_70") ||
      bool(i, "palpable_gb") ||
      bool(i, "imaging_severe");
    if (ii) {
      return {
        kind: "graded",
        grade: "II",
        gradeLabel: "Moderate (simplified — systemic or local severity criteria met)",
      };
    }
    return {
      kind: "graded",
      grade: "I",
      gradeLabel: "Mild (simplified — none of the higher-grade triggers)",
    };
  },
  interpret: (c) => {
    if (c.kind !== "graded") return "";
    if (c.grade === "III") return "Grade III context — urgent resuscitation/specialist care; this UI uses a simplified rule set.";
    if (c.grade === "II") return "Grade II context — inpatient management often considered; correlate with TG18 tables and local practice.";
    return "Grade I context — mild localized disease on this simplified screen; still correlate clinically and with imaging.";
  },
};

export const CLINICAL_SCORE_DEFINITIONS: ClinicalScoreDefinition[] = [
  NIHSS_SCORE,
  CHA2DS2_VASC_SCORE,
  ALVARADO_SCORE,
  ASTHMA_ACT_SCORE,
  COPD_ASSESSMENT_SCORE,
  TOKYO_CHOLECYSTITIS_SCORE,
];

export const CLINICAL_SCORE_BY_ID: Record<string, ClinicalScoreDefinition> = Object.fromEntries(
  CLINICAL_SCORE_DEFINITIONS.map((d) => [d.id, d])
);
