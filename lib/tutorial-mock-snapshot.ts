/**
 * ผลสรุปโหมดสาธิต — snapshot จากเคสตัวอย่างที่รันสรุปจริง (CAP + DM + HTN + hypoglycemia, med ward)
 * อัปเดตได้โดยแทนที่ object นี้ด้วย `result` จาก POST /api/summarize
 */
import type { DischargeEnginePayload } from "@/lib/discharge-engine/types";

type MockBlock = {
  key: string;
  title: string;
  order: number;
  content: string;
  icd10: string;
};

export type TutorialMockApiResult = {
  blocks: MockBlock[];
  warnings: string[];
  meta: {
    losDays: number | null;
    adjrw: number | null;
    diagnosis_confidence: string;
    upgrade: unknown;
  };
  preprocess: {
    originalChars: number;
    cleanedChars: number;
    removedChars: number;
    removedSummary: string[];
    cleanedPreview: string;
  };
  engine: DischargeEnginePayload;
};

export const TUTORIAL_MOCK_RESULT: TutorialMockApiResult = {
  blocks: [
    {
      key: "principal_dx",
      title: "Principal Diagnosis",
      order: 1,
      content: "Community acquired pneumonia",
      icd10: "J18.9",
    },
    {
      key: "comorbidity",
      title: "Comorbidity",
      order: 2,
      content: "Type 2 diabetes mellitus, Hypertension",
      icd10: "E11.9, I10",
    },
    {
      key: "complication",
      title: "Complication",
      order: 3,
      content: "Hypoglycemia",
      icd10: "E16.2",
    },
    {
      key: "other_diag",
      title: "Other Diagnosis",
      order: 4,
      content: "",
      icd10: "",
    },
    {
      key: "external_cause",
      title: "External Cause",
      order: 5,
      content: "",
      icd10: "",
    },
    {
      key: "icd9",
      title: "ICD-9",
      order: 6,
      content:
        "93.90 Oxygen therapy\n" +
        "99.21 Injection of antibiotic\n" +
        "99.29 Injection or infusion of other therapeutic substance\n" +
        "93.94 Respiratory medication administered by nebulizer",
      icd10: "",
    },
    {
      key: "admit_date",
      title: "Admit Date",
      order: 7,
      content: "16/02/2569",
      icd10: "",
    },
    {
      key: "discharge_date",
      title: "Discharge Date",
      order: 8,
      content: "19/02/2569",
      icd10: "",
    },
    {
      key: "final_diag",
      title: "Final Diagnosis",
      order: 9,
      content: "Community acquired pneumonia, Hypoglycemia, Type 2 diabetes mellitus, Hypertension",
      icd10: "",
    },
    {
      key: "investigations",
      title: "Investigations",
      order: 10,
      content:
        "CBC, BUN, Cr, electrolytes, blood lactate, blood culture x2, CXR, ECG, DTX monitoring, FBS",
      icd10: "",
    },
    {
      key: "treatment",
      title: "Treatment",
      order: 11,
      content:
        "Admit med ward, O2 cannula 3 LPM, IV ceftriaxone, oral roxithromycin, oral amoxicillin clavulanate step down, Berodual nebulization, IV NSS, 50% glucose IV push, hold metformin 1 dose, supportive care and hydration",
      icd10: "",
    },
    {
      key: "outcome",
      title: "Outcome",
      order: 12,
      content: "improved",
      icd10: "",
    },
    {
      key: "follow_up",
      title: "Follow-up",
      order: 13,
      content: "Medicine clinic in 1 week",
      icd10: "",
    },
    {
      key: "home_med",
      title: "Home Medication",
      order: 14,
      content:
        "Amoxicillin clavulanate 875/125 mg bid x 5 days, Metformin 500 mg bid, Amlodipine 5 mg daily, Paracetamol 500 mg PRN fever or pain",
      icd10: "",
    },
  ],
  warnings: [
    "สิ่งที่ควรทวนก่อน copy ไปใช้:",
    "No explicit respiratory failure diagnosis; do not code acute respiratory failure from oxygen use alone.",
    "No explicit sepsis diagnosis; antibiotics alone are insufficient for sepsis coding.",
    "Pneumonia organism unspecified in chart.",
    "Hypoglycemia is documented during admission, but the cause is not clearly specified; avoid assigning diabetes with hypoglycemia combination code without explicit linkage.",
    "Community acquired pneumonia organism is not identified; unspecified pneumonia code is appropriate from available documentation.",
    "Initial hypoxemia and oxygen requirement are documented, but acute respiratory failure is not clearly diagnosed; do not code respiratory failure without physician documentation.",
    "ICD-9 procedure coding for nebulization and therapeutic infusions is estimate-based from ward orders and may vary by local coding convention.",
    "Missing admit/discharge date for LOS (used as guidance only).",
    "— ผลนี้แสดงในโหมดสาธิต — การสร้างสรุปจริงจากระบบจะใช้เครดิตตามบัญชีของคุณ",
  ],
  meta: {
    losDays: 3,
    adjrw: 1.15,
    diagnosis_confidence: "Medium",
    upgrade: null,
  },
  preprocess: {
    originalChars: 3920,
    cleanedChars: 3588,
    removedChars: 332,
    removedSummary: [
      "De-identification: ลบตัวระบุตัวบุคคลที่ไม่จำเป็นต่อการสรุปทางคลินิก",
      "Normalization: จัดรูปแบบบรรทัด order ซ้ำในกลุ่มเดียวกัน",
    ],
    cleanedPreview:
      "CAP · T2DM · HTN · hypoglycemia episode · O2 cannula · ceftriaxone / macrolide / amoxicillin-clavulanate · " +
      "Berodual neb · IV NSS · glucose 50% IV · hold metformin 1 dose…",
  },
  engine: {
    admit_date: "16/02/2569",
    discharge_date: "19/02/2569",
    summary_text:
      "ผู้ป่วยรับด้วยภาวะปอดอักเสบใน community (CAP) มีประวัติเบาหวานชนิดที่ 2 และความดันโลหิตสูง ระหว่างรับการรักษาในเวรดมีการให้ออกซิเจนทางจมูก ยาปฏิชีวนะทางเส้นและ per oral ตามลำดับการตอบสนอง และพ่นขยายหลอดลม ร่วมกับให้สารน้ำและการดูแล supportive care\n\n" +
      "มีการบันทึกภาวะ hypoglycemia ระหว่าง admit จึงมีการปรับยาเม็ตฟอร์มินและให้ glucose เข้าเส้นเลือดตาม order พร้อมติดตาม DTX อาการโดยรวมดีขึ้นตามลำดับ (improved) แผนหลังจำหน่ายรวมยาต่อเนื่องและนัดติดตามคลินิกอายุรศาสตร์\n\n" +
      "ข้อความนี้เป็นตัวอย่างจากบทเรียน — การใช้งานจริงควรทบทวนร่วมกับเวชระเบียนต้นฉบับและนโยบายการเข้ารหัสของหน่วยงาน",
    principal_diagnosis: {
      text: "Community acquired pneumonia",
      icd10: "J18.9",
      confidence: "likely_supported",
      evidence: [
        { source: "physician_dx", snippet: "Community acquired pneumonia" },
        { source: "imaging_support", snippet: "CXR consistent with pneumonia" },
      ],
      trust_label: "supported_by_chart",
    },
    comorbidities: [
      {
        text: "Type 2 diabetes mellitus",
        icd10: "E11.9",
        confidence: "likely_supported",
        evidence: [{ source: "physician_dx", snippet: "T2DM" }],
      },
      {
        text: "Essential (primary) hypertension",
        icd10: "I10",
        confidence: "likely_supported",
        evidence: [{ source: "physician_dx", snippet: "Hypertension" }],
      },
    ],
    complications: [
      {
        text: "Hypoglycemia",
        icd10: "E16.2",
        confidence: "likely_supported",
        evidence: [{ source: "assessment_note", snippet: "Hypoglycemia documented during admission" }],
      },
    ],
    other_diagnoses: [],
    external_causes: [],
    procedures_icd9: [
      {
        text: "Oxygen therapy",
        icd9_cm: "93.90",
        confidence: "likely_supported",
        evidence: [{ source: "medication_support", snippet: "O2 cannula" }],
      },
      {
        text: "Injection of antibiotic",
        icd9_cm: "99.21",
        confidence: "likely_supported",
        evidence: [{ source: "medication_support", snippet: "IV ceftriaxone" }],
      },
      {
        text: "Injection or infusion of other therapeutic substance",
        icd9_cm: "99.29",
        confidence: "likely_supported",
        evidence: [{ source: "medication_support", snippet: "IV NSS / IV therapies" }],
      },
      {
        text: "Respiratory medication administered by nebulizer",
        icd9_cm: "93.94",
        confidence: "likely_supported",
        evidence: [{ source: "medication_support", snippet: "Berodual nebulization" }],
      },
    ],
    investigations: [
      "CBC",
      "BUN, Cr, electrolytes",
      "Blood lactate",
      "Blood culture x2",
      "CXR",
      "ECG",
      "DTX monitoring",
      "FBS",
    ],
    treatments: [
      "IV ceftriaxone",
      "Oral roxithromycin",
      "Oral amoxicillin-clavulanate (step down)",
      "Berodual nebulization",
      "IV NSS",
      "O2 cannula 3 LPM",
      "50% glucose IV push",
      "Hold metformin 1 dose",
      "Supportive care and hydration",
    ],
    home_medications: [
      "Amoxicillin clavulanate 875/125 mg bid x 5 days",
      "Metformin 500 mg bid",
      "Amlodipine 5 mg daily",
      "Paracetamol 500 mg PRN fever or pain",
    ],
    drg_estimation: {
      status: "estimated",
      disclaimer_th:
        "AdjRW เป็นประมาณการจากข้อความที่วาง — ไม่ใช่การคำนวณจาก DRG grouper โรงพยาบาล",
      drivers: [
        "Pneumonia (community acquired) — simple / moderate complexity",
        "Hypoglycemia as comorbidity/complication context (verify documentation)",
      ],
      possible_complexity_adders: [
        {
          item: "Diabetes with comorbidities",
          tier: "likely_supported",
          note_th: "ตรวจสอบการลงรหัสร่วมกับ hypoglycemia ตามนโยบายหน่วยงาน",
        },
      ],
      audit_warnings: [],
    },
    chart_capture_hints: [
      {
        target_diagnosis_text: "Community acquired pneumonia",
        target_icd10: "J18.9",
        missing_in_input: [
          "ระบุชนิดเชื้อ/ผล culture ถ้ามี (ตอนนี้เป็น unspecified pneumonia ตามเอกสาร)",
        ],
        suggested_order_sheet_wording_th:
          "CAP: organism ___ / sputum culture result ___ / sensitivities ___",
        suggested_lab_or_imaging: ["Sputum culture", "Blood culture"],
        approx_adjrw_note_th:
          "ถ้ามีหลักฐาน sepsis ชัดแยกจาก pneumonia แยกต่างหาก — อย่าใช้แค่การให้ยาปฏิชีวนะอย่างเดียว",
        tier: "likely_supported",
      },
      {
        target_diagnosis_text: "Hypoglycemia",
        target_icd10: "E16.2",
        missing_in_input: [
          "สาเหตุ hypoglycemia (ยา / NPO / โรคเดิม) — หลีกเลี่ยง combination code โดยไม่มี explicit linkage",
        ],
        suggested_order_sheet_wording_th:
          "Hypoglycemia: glucose ___ mg/dL · context (medications / intake) · intervention",
        suggested_lab_or_imaging: ["FBS", "DTX monitoring"],
        approx_adjrw_note_th: "ความเชื่อมโยงกับ diabetes ต้องมีคำใน chart ตามนโยบายการเข้ารหัส",
        tier: "likely_supported",
      },
    ],
    documentation_gaps: [
      "ไม่มี physician diagnosis ของ acute respiratory failure แม้มี hypoxemia — ใช้ oxygen อย่างเดียวไม่เพียงพอสำหรับ J96.0",
    ],
    coder_notes: [
      "ICD-9 หัตถการจาก ward order เป็นประมาณการ — ตรวจตาม convention ของหน่วยงาน",
      "ตรวจสอบวันที่ admit/discharge ให้ครบก่อนใช้ LOS เป็น guidance",
    ],
    why_this_principal_diagnosis:
      "การรับครั้งนี้มีศูนย์กลางทางคลินิกที่การรักษาปอดอักเสบและการให้ยาปฏิชีวนะตามแนวทาง CAP จึงเลือก Community acquired pneumonia เป็นภาวะหลักของการรับ",
    linkage: [
      {
        source: "pneumonia",
        relation: "managed_by",
        target: "antibiotic_therapy",
        confidence: 0.86,
        kind: "explicit_wording",
      },
      {
        source: "type_2_diabetes",
        relation: "associated_with",
        target: "hypoglycemia_episode",
        confidence: 0.62,
        kind: "possible_linkage",
      },
    ],
    extraction: {
      admit_date: "16/02/2569",
      discharge_date: "19/02/2569",
      chief_problem_on_admission: "Community acquired pneumonia",
      conditions_present_on_admission: ["Type 2 diabetes mellitus", "Hypertension"],
      conditions_arising_after_admission: ["Hypoglycemia during admission"],
      abnormal_labs: ["Blood lactate (as ordered)", "Blood culture x2"],
      investigations: ["CBC", "BUN", "Cr", "electrolytes", "CXR", "ECG", "DTX", "FBS"],
      treatments: [
        "O2 cannula",
        "IV ceftriaxone",
        "Roxithromycin",
        "Amoxicillin-clavulanate",
        "Berodual nebulization",
        "IV NSS",
        "50% glucose IV",
        "Hold metformin",
      ],
    },
    case_graph: {
      underlying_diseases: ["Type 2 diabetes mellitus", "Hypertension"],
      acute_admission_problems: ["Community acquired pneumonia"],
      metabolic_derangements: ["Hypoglycemia (documented)"],
      infections: ["Lower respiratory tract infection / pneumonia"],
      procedures: ["Oxygen therapy", "Nebulized Berodual", "IV antibiotic"],
      resource_intensive_treatments: ["Medical ward care with oxygen support"],
    },
  },
};
