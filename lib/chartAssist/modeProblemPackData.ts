/**
 * Mode-specific symptom/problem packs (ER / TRAUMA / PSYCH / LABOR_ROOM / GYNE) + OPD subset order.
 * Merged into `opdProblemPacks.ts` catalog.
 */
import type { AssistMode } from "./cardTypes";
import {
  GYNE_PACK_ORDER,
  LABOR_GYNE_PACKS,
  LABOR_ROOM_PACK_ORDER,
  type LaborGynePackId,
} from "./laborGynePackData";

/** Legacy OPD pack ids used in OPD mode roadmap (subset) */
export type OpdLegacyPackId =
  | "skin_rash"
  | "uri_cough"
  | "fever"
  | "diarrhea_vomiting"
  | "abdominal_pain"
  | "dysuria"
  | "headache_dizziness"
  | "back_neck_pain"
  | "ear_pain"
  | "red_eye"
  | "ortho_acute_limb_sprain"
  | "ortho_fracture_concern"
  | "ortho_hot_swollen_joint"
  | "ortho_knee_pain"
  | "ortho_shoulder_pain"
  | "ortho_pediatric_limp";

/**
 * OPD roadmap — ten core ambulatory packs (skin → red eye), then orthopedic packs.
 * URI/cough covers sore-throat–type presentations; ear and red eye are separate packs.
 */
export const OPD_MODE_PACK_ORDER: readonly OpdLegacyPackId[] = [
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
  "ortho_acute_limb_sprain",
  "ortho_fracture_concern",
  "ortho_hot_swollen_joint",
  "ortho_knee_pain",
  "ortho_shoulder_pain",
  "ortho_pediatric_limp",
] as const;

/** ER overlays — life-threat triage order; dehydration follows acute tox/ACS/sepsis patterns */
export const ER_MODE_PACK_ORDER: readonly ModeExtendedPackId[] = [
  "er_dyspnea_hypoxemia",
  "er_seizure_ams",
  "er_anaphylaxis",
  "er_chest_pain",
  "er_sepsis_shock",
  "er_poisoning_overdose",
  "er_dehydration",
] as const;

export const TRAUMA_MODE_PACK_ORDER: readonly ModeExtendedPackId[] = [
  "tr_minor_head_injury",
  "tr_laceration_wound",
  "tr_fracture_sprain",
  "tr_blunt_trauma",
  "tr_neck_back_trauma",
] as const;

export const PSYCH_MODE_PACK_ORDER: readonly ModeExtendedPackId[] = [
  "psych_depression_si",
  "psych_psychosis",
  "psych_agitation_violence",
  "psych_substance_intoxWithdrawal",
  "psych_panic_anxiety",
] as const;

export const LABOR_ROOM_MODE_PACK_ORDER: readonly LaborGynePackId[] = LABOR_ROOM_PACK_ORDER;
export const GYNE_MODE_PACK_ORDER: readonly LaborGynePackId[] = GYNE_PACK_ORDER;

export const MODE_PROBLEM_PACK_ORDER: Record<
  AssistMode,
  readonly (OpdLegacyPackId | ModeExtendedPackId)[]
> = {
  OPD: OPD_MODE_PACK_ORDER,
  ER: ER_MODE_PACK_ORDER,
  TRAUMA: TRAUMA_MODE_PACK_ORDER,
  PSYCH: PSYCH_MODE_PACK_ORDER,
  LABOR_ROOM: LABOR_ROOM_MODE_PACK_ORDER,
  GYNE: GYNE_MODE_PACK_ORDER,
};

/** Shape matches `OpdProblemPackDef` in opdProblemPacks.ts */
type ModePackDefShape = {
  id: string;
  order: number;
  titleTh: string;
  titleEn: string;
  matchKeywords: string[];
  hardFactsGuidance: string;
  factsPresentHints: string[];
  askNext: string[];
  examNext: string[];
  pertinentNegatives: string[];
  rankedDifferentials: string[];
  planHints: string[];
};

/** Extended pack ids (mode-specific catalog) */
export type ModeExtendedPackId =
  | "er_dyspnea_hypoxemia"
  | "er_sepsis_shock"
  | "er_dehydration"
  | "er_chest_pain"
  | "er_anaphylaxis"
  | "er_seizure_ams"
  | "er_poisoning_overdose"
  | "tr_minor_head_injury"
  | "tr_laceration_wound"
  | "tr_fracture_sprain"
  | "tr_blunt_trauma"
  | "tr_neck_back_trauma"
  | "psych_depression_si"
  | "psych_psychosis"
  | "psych_agitation_violence"
  | "psych_substance_intoxWithdrawal"
  | "psych_panic_anxiety"
  | LaborGynePackId;

export const MODE_EXTENDED_PACKS: Record<ModeExtendedPackId, ModePackDefShape> = {
  er_dyspnea_hypoxemia: {
    id: "er_dyspnea_hypoxemia",
    order: 1,
    titleTh: "หายใจลำบาก / hypoxemia",
    titleEn: "Dyspnea / hypoxemia",
    matchKeywords: [
      "dyspnea",
      "hypoxemia",
      "hypoxia",
      "respiratory distress",
      "shortness of breath",
      "spo2",
      "o2 sat",
      "oxygen",
      "หอบ",
      "หายใจลำบาก",
      "เหนื่อยหอบ",
      "tachypnea",
    ],
    hardFactsGuidance: "Onset, RR, SpO₂ (room air vs O₂), work of breathing, response to treatment",
    factsPresentHints: ["SpO₂", "RR", "accessory muscle", "retraction"],
    askNext: ["orthopnea", "chest pain", "PE", "hemoptysis", "PMH asthma/COPD"],
    examNext: ["Vitals, SpO₂, lung auscultation, perfusion", "CXR/ABG if indicated"],
    pertinentNegatives: ["ไม่มี stridor — ถ้าไม่มี", "ไม่มี focal findings — ถ้าฟังแล้ว"],
    rankedDifferentials: [
      "Viral URI / bronchitis",
      "Asthma / COPD exacerbation",
      "Pneumonia",
      "PE / ACS — ถ้าชี้",
      "Pneumothorax",
    ],
    planHints: ["O₂, bronchodilator, sepsis bundle if infection suspected", "Escalate if hypoxemic"],
  },

  er_sepsis_shock: {
    id: "er_sepsis_shock",
    order: 2,
    titleTh: "sepsis / shock",
    titleEn: "Sepsis / shock concern",
    matchKeywords: [
      "sepsis",
      "septic",
      "shock",
      "hypotension",
      "lactate",
      "perfusion",
      "ช็อก",
      "ความดันต่ำ",
      "bp ต่ำ",
      "tachycardia",
      "mottled",
    ],
    hardFactsGuidance: "Source, BP/MAP, HR, lactate, CRT, mental status, temperature",
    factsPresentHints: ["MAP", "lactate", "source suspected"],
    askNext: ["focus infection", "immunosuppression", "antibiotics given", "urine output"],
    examNext: ["Perfusion, mental status, focal infection, skin", "FAST if indicated"],
    pertinentNegatives: ["ไม่มี hypotension — ถ้าไม่มีให้บันทึก"],
    rankedDifferentials: [
      "Septic shock",
      "Hypovolemic shock",
      "Cardiogenic shock",
      "Anaphylactic shock",
    ],
    planHints: ["IV access, fluids, cultures, antibiotics early", "ICU criteria"],
  },

  er_dehydration: {
    id: "er_dehydration",
    order: 3,
    titleTh: "ขาดน้ำ / dehydration",
    titleEn: "Dehydration",
    matchKeywords: [
      "dehydration",
      "dehydrated",
      "dry mucosa",
      "sunken",
      "ขาดน้ำ",
      "ตาโหล่ง",
      "no tears",
      "hypovolemic",
      "orthostatic",
    ],
    hardFactsGuidance: "I/O, orthostasis, electrolytes, age/infant fontanelle",
    factsPresentHints: ["HR", "BP", "UOP", "skin turgor"],
    askNext: ["diarrhea/vomiting duration", "oral intake", "diabetes", "diuretics"],
    examNext: ["Mucosa, cap refill, orthostatic vitals", "BMP if indicated"],
    pertinentNegatives: ["ไม่มี shock — ถ้าไม่มี"],
    rankedDifferentials: [
      "Gastroenteritis dehydration",
      "DKA/HS — ถ้าชี้",
      "Heat illness",
    ],
    planHints: ["Oral/IV fluids", "Electrolyte correction", "Admit if severe"],
  },

  er_chest_pain: {
    id: "er_chest_pain",
    order: 4,
    titleTh: "เจ็บหน้าอก (ER — ACS / life threat triage)",
    titleEn: "Chest pain (ACS & life-threatening causes)",
    matchKeywords: [
      "chest pain",
      "chest discomfort",
      "angina",
      "crushing",
      "substernal",
      "st elevation",
      "stemi",
      "nstemi",
      "acs",
      "troponin",
      "myocardial infarction",
      "acute coronary syndrome",
      "pleuritic",
      "pleuritic chest",
      "tearing pain",
      "pneumothorax",
      "pulmonary embolism",
      "deep vein thrombosis",
      "dvt",
      "aortic dissection",
      "dissection",
      "pericarditis",
      "cocaine chest",
      "cocaine",
      "amphetamine",
      "stimulant use",
      "syncope",
      "diaphoresis",
      "แน่นหน้าอก",
      "เจ็บหน้าอก",
      "เจ็บอก",
      "หายใจไม่ทัน",
      "เหนื่อยหอบ",
    ],
    hardFactsGuidance:
      "Immediate triage for ACS and other life-threatening causes — acute chest pain must not remain in routine OPD-only format until ECG + vitals + SpO₂ are surfaced (erTriageConcern / erImmediateManagement or equivalent). Required immediate actions: (1) ECG within urgent ED workflow, (2) vital signs, (3) SpO₂ (room air vs oxygen), (4) consider troponin pathway when ACS suspected. If initial ECG is nondiagnostic but suspicion remains high, document serial ECG / repeat troponin per protocol. Low-risk chest pain may stay structured and conservative after immediate danger is excluded.",
    factsPresentHints: [
      "ECG obtained / timing",
      "Vitals (BP/HR/RR)",
      "SpO₂",
      "Troponin pathway if ACS suspected",
    ],
    askNext: [
      "Onset and duration",
      "Pain character: pressure vs sharp vs pleuritic vs tearing",
      "Exertional vs rest / positional",
      "Radiation (arm, jaw, back, epigastric)",
      "Associated: diaphoresis, nausea, dyspnea, syncope",
      "Fever, cough, hemoptysis",
      "Recent trauma or Valsalva",
      "Cardiovascular risk factors (age, HTN, DM, smoking, prior CAD)",
      "PE risk clues (immobility, cancer, OCP, prior VTE, recent surgery)",
      "Stimulant or illicit drug use (cocaine, amphetamines)",
    ],
    examNext: [
      "ECG (serial ECG when indicated)",
      "Perfusion / general appearance",
      "Heart and lung exam",
      "Chest wall palpation for reproducible tenderness",
      "Bilateral pulses / pulse deficit if aortic syndrome suspected",
      "Leg swelling / calf asymmetry — DVT clues if PE suspected",
    ],
    pertinentNegatives: [
      "No hypotension — if absent",
      "No hypoxemia — if absent",
      "No syncope — if absent",
      "No unequal pulses / pulse deficit — if absent",
      "No persistent severe ischemic-sounding pain — if absent",
    ],
    rankedDifferentials: [
      "ACS / STEMI / NSTEMI",
      "Pulmonary embolism",
      "Aortic dissection",
      "Tension pneumothorax / pneumothorax",
      "Esophageal rupture (Boerhaave) — if context",
      "Pericarditis / myocarditis",
      "Pneumonia / pleurisy",
      "Musculoskeletal / costochondritis",
      "GERD / esophageal spasm",
    ],
    planHints: [
      "Urgent ECG + vitals + SpO₂ before long benign OPD-style narrative",
      "Troponin and serial ECG per institutional ACS pathway when suspected",
      "Antiplatelet / anticoagulation only when indicated per protocol",
      "If low-risk after evaluation: conservative plan with explicit return precautions",
    ],
  },

  er_anaphylaxis: {
    id: "er_anaphylaxis",
    order: 5,
    titleTh: "anaphylaxis / แพ้รุนแรง",
    titleEn: "Anaphylaxis",
    matchKeywords: [
      "anaphylaxis",
      "anaphylactic",
      "angioedema",
      "epinephrine",
      "airway swelling",
      "ลมพิษรุนแรง",
      "แพ้ยา",
      "แพ้อาหาร",
    ],
    hardFactsGuidance: "Trigger, airway, BP, epinephrine given, β-blocker",
    factsPresentHints: ["stridor", "hypotension", "urticaria"],
    askNext: ["exposure history", "prior episodes", "stinger"],
    examNext: ["Airway, BP, skin, voice"],
    pertinentNegatives: ["ไม่มี hypotension — ถ้าไม่มี"],
    rankedDifferentials: [
      "Anaphylaxis",
      "Angioedema (ACE-i)",
      "Urticaria",
    ],
    planHints: ["IM epinephrine", "Observation", "Adjunct antihistamine/steroid"],
  },

  er_seizure_ams: {
    id: "er_seizure_ams",
    order: 6,
    titleTh: "ชัก / สติเปลี่ยน",
    titleEn: "Seizure / AMS",
    matchKeywords: [
      "seizure",
      "convulsion",
      "status epilepticus",
      "altered mental status",
      "ams",
      "unresponsive",
      "gcs",
      "ชัก",
      "หมดสติ",
      "ซึม",
    ],
    hardFactsGuidance: "Duration, focality, postictal, glucose, tox, trauma",
    factsPresentHints: ["GCS", "glucose", "witness"],
    askNext: ["PMH epilepsy", "alcohol", "drugs", "head injury"],
    examNext: ["Neuro exam, pupils, glucose", "CT if indicated"],
    pertinentNegatives: ["ไม่มี focal deficit — ถ้าไม่มี"],
    rankedDifferentials: [
      "Provoked seizure",
      "Status epilepticus",
      "Toxic/metabolic",
      "Stroke",
    ],
    planHints: ["Benzodiazepine protocol", "Glucose correction", "Neuro consult"],
  },

  er_poisoning_overdose: {
    id: "er_poisoning_overdose",
    order: 7,
    titleTh: "พิษ / overdose",
    titleEn: "Poisoning / overdose",
    matchKeywords: [
      "overdose",
      "poisoning",
      "ingestion",
      "intoxication",
      "toxidrome",
      "opioid",
      "naloxone",
      "organophosphate",
      "acetaminophen",
      "salicylate",
      "tricyclic",
      "กินยาเกิน",
      "สารพิษ",
    ],
    hardFactsGuidance: "Substance(s), time, amount, route, co-ingestion, intent; antidotes and response",
    factsPresentHints: ["agent or unknown", "time", "ECG/glucose"],
    askNext: [
      "สารที่สงสัย",
      "เวลาได้รับ / กิน",
      "ปริมาณโดยประมาณ",
      "ยาเดี่ยวหรือหลายชนิด",
      "ทางได้รับ",
      "เจตนา / อุบัติเหตุ",
      "แอลกอฮอล์หรือ co-ingestion",
      "อาการเปลี่ยนแปลง",
      "ยาประจำ",
      "กล่องยา / blister",
    ],
    examNext: [
      "ABC, GCS, รูม่านตา",
      "RR, SpO₂, ETCO₂, BP, HR, T",
      "ECG, glucose ต้นเรื่อง",
      "VBG/lactate/electrolytes ตามชี้",
      "trauma ถ้ามี",
    ],
    pertinentNegatives: [
      "ไม่มีเสียงทางเดินหายใจตีบ — ถ้าไม่มี",
      "ไม่มี concern aspiration — ถ้าไม่มี",
      "ไม่มี QRS/QT ผิดปกติ — ถ้าตรวจแล้ว",
    ],
    rankedDifferentials: [
      "Opioid / sedative tox",
      "Anticholinergic / sympathomimetic toxidrome",
      "TCA / sodium-channel blocker",
      "Acetaminophen / salicylate",
    ],
    planHints: [
      "Stabilize ก่อน label กลุ่มอาการ",
      "Poison center / toxicology เมื่อรุนแรงหรือไม่ชัด",
      "Opioid — เป้าหมายหายใจ + naloxone titration",
    ],
  },

  tr_minor_head_injury: {
    id: "tr_minor_head_injury",
    order: 1,
    titleTh: "กระแทกศีรษะเล็กน้อย",
    titleEn: "Minor head injury",
    matchKeywords: [
      "head injury",
      "head trauma",
      "concussion",
      "หัวกระแทก",
      "ศีรษะกระแทก",
      "minor head",
      "gcs 15",
    ],
    hardFactsGuidance: "Mechanism, LOC, vomiting, anticoagulant, neuro",
    factsPresentHints: ["LOC", "amnesia", "warfarin"],
    askNext: ["LOC duration", "vomiting", "anticoagulant", "symptoms worsening"],
    examNext: ["GCS, pupils, neck", "CT criteria per guideline"],
    pertinentNegatives: ["ไม่มี focal neuro — ถ้าไม่มี"],
    rankedDifferentials: [
      "Concussion",
      "Skull fracture — ถ้าชี้",
    ],
    planHints: ["Observation instructions", "CT if high risk", "Return precautions"],
  },

  tr_laceration_wound: {
    id: "tr_laceration_wound",
    order: 2,
    titleTh: "แผล / laceration",
    titleEn: "Laceration / wound",
    matchKeywords: ["laceration", "lacerate", "wound", "cut", "แผล", "เย็บ", "suture"],
    hardFactsGuidance: "Location, depth, contamination, tetanus, foreign body",
    factsPresentHints: ["size", "bleeding control"],
    askNext: ["mechanism", "tetanus", "allergy to LA", "time since injury"],
    examNext: ["Neurovascular, tendon, depth", "Irrigation/closure plan"],
    pertinentNegatives: ["ไม่มี NVS injury — ถ้าไม่มี"],
    rankedDifferentials: [
      "Simple laceration",
      "High-risk infection",
    ],
    planHints: ["Irrigation, repair", "Tetanus", "Prophylaxis if indicated"],
  },

  tr_fracture_sprain: {
    id: "tr_fracture_sprain",
    order: 3,
    titleTh: "หัก / sprain",
    titleEn: "Fracture / sprain",
    matchKeywords: ["fracture", "sprain", "หัก", "เคล็ด", "dislocation", "x-ray", "กระดูก"],
    hardFactsGuidance: "Mechanism, deformity, NVS, open vs closed",
    factsPresentHints: ["site", "deformity"],
    askNext: ["weight bearing", "sensation distal", "time"],
    examNext: ["Alignment, NVS, compartments", "Imaging"],
    pertinentNegatives: ["ไม่มี open fracture — ถ้าไม่มี"],
    rankedDifferentials: [
      "Sprain / contusion",
      "Fracture",
      "Dislocation",
    ],
    planHints: ["Immobilization", "Orthopedics", "Surgery if open"],
  },

  tr_blunt_trauma: {
    id: "tr_blunt_trauma",
    order: 4,
    titleTh: "blunt trauma",
    titleEn: "Blunt trauma",
    matchKeywords: [
      "blunt",
      "trauma",
      "mvc",
      "rta",
      "mva",
      "motor vehicle",
      "ชน",
      "อุบัติเหตุ",
      "crush",
    ],
    hardFactsGuidance: "Mechanism, restraints, seatbelt sign, FAST if indicated",
    factsPresentHints: ["mechanism", "speed"],
    askNext: ["LOC", "seatbelt", "airbag", "other injuries"],
    examNext: ["Primary survey", "FAST", "spine precautions"],
    pertinentNegatives: ["ไม่มี peritonitis — ถ้าไม่มี"],
    rankedDifferentials: [
      "Multi-trauma",
      "Solid organ injury",
    ],
    planHints: ["Trauma protocol", "Imaging", "Consults"],
  },

  tr_neck_back_trauma: {
    id: "tr_neck_back_trauma",
    order: 5,
    titleTh: "คอ/หลัง บาดเจ็บ",
    titleEn: "Neck / back trauma",
    matchKeywords: [
      "neck pain",
      "c-spine",
      "cervical",
      "back pain",
      "spine",
      "whiplash",
      "คอเจ็บ",
      "ปวดหลัง",
      "หลังกระแทก",
    ],
    hardFactsGuidance: "Midline tenderness, neuro deficit, mechanism, spinal precautions",
    factsPresentHints: ["midline tenderness", "neuro"],
    askNext: ["numbness", "weakness", "bowel/bladder"],
    examNext: ["Motor/sensory", "rectal if cauda", "imaging per NEXUS"],
    pertinentNegatives: ["ไม่มี midline tenderness — ถ้าไม่มี"],
    rankedDifferentials: [
      "Sprain",
      "Fracture",
      "Cord injury",
    ],
    planHints: ["C-collar per protocol", "MRI/CT if red flags"],
  },

  psych_depression_si: {
    id: "psych_depression_si",
    order: 1,
    titleTh: "ซึมเศร้า / SI",
    titleEn: "Depression / suicidal ideation",
    matchKeywords: [
      "depression",
      "depressed",
      "suicidal",
      "suicide",
      "self-harm",
      "คิดฆ่าตัวตาย",
      "อยากตาย",
      "ซึมเศร้า",
    ],
    hardFactsGuidance: "SI/HI, plan, intent, means, protective factors, prior attempts",
    factsPresentHints: ["SI denied or endorsed", "plan"],
    askNext: ["sleep", "substance", "psych history", "support"],
    examNext: ["MSE, safety", "collateral"],
    pertinentNegatives: ["no current SI — ถ้าไม่มีให้บันทึก"],
    rankedDifferentials: [
      "Major depression",
      "Adjustment disorder",
      "Bipolar depression",
    ],
    planHints: ["Safety plan", "Crisis resources", "Psych referral", "Meds if indicated"],
  },

  psych_psychosis: {
    id: "psych_psychosis",
    order: 2,
    titleTh: "psychosis",
    titleEn: "Psychosis",
    matchKeywords: [
      "psychosis",
      "hallucination",
      "delusion",
      "paranoia",
      "หูแว่ว",
      "หลอน",
      "schizo",
    ],
    hardFactsGuidance: "Onset, command hallucinations, agitation, substance",
    factsPresentHints: ["AH/VH", "disorganization"],
    askNext: ["substance", "medical cause", "first episode"],
    examNext: ["MSE, orientation", "UO tox"],
    pertinentNegatives: ["ไม่มี agitation — ถ้าไม่มี"],
    rankedDifferentials: [
      "Primary psychotic disorder",
      "Substance-induced",
      "Delirium",
    ],
    planHints: ["Antipsychotic", "Medical workup", "Admission if safety"],
  },

  psych_agitation_violence: {
    id: "psych_agitation_violence",
    order: 3,
    titleTh: "กระวนกระวาย / ความรุนแรง",
    titleEn: "Agitation / violence",
    matchKeywords: [
      "agitation",
      "agitated",
      "violent",
      "violence",
      "aggressive",
      "restraint",
      "ทำร้าย",
      "ดุร้าย",
    ],
    hardFactsGuidance: "Trigger, weapons, injury, substance, medical cause",
    factsPresentHints: ["restraint used", "injury"],
    askNext: ["intent to harm", "substance", "psych history"],
    examNext: ["Vitals, trauma exam", "glucose"],
    pertinentNegatives: ["no HI — ถ้าไม่มี"],
    rankedDifferentials: [
      "Acute agitation",
      "Intoxication",
      "Mania",
    ],
    planHints: ["De-escalation", "Chemical restraint protocol", "Medical clearance"],
  },

  psych_substance_intoxWithdrawal: {
    id: "psych_substance_intoxWithdrawal",
    order: 4,
    titleTh: "สารเสพติด / ถอน",
    titleEn: "Substance intoxication / withdrawal",
    matchKeywords: [
      "alcohol",
      "intoxication",
      "withdrawal",
      "opioid",
      "benzodiazepine",
      "ethanol",
      "เมา",
      "ถอน",
      "delirium tremens",
    ],
    hardFactsGuidance: "Substance, last use, CIWA, vitals, withdrawal scale",
    factsPresentHints: ["tremor", "HR"],
    askNext: ["dependence", "seizure history", "other drugs"],
    examNext: ["CIWA/COWS", "hydration"],
    pertinentNegatives: ["ไม่มี seizure — ถ้าไม่มี"],
    rankedDifferentials: [
      "Alcohol withdrawal",
      "Opioid withdrawal",
      "Intoxication",
    ],
    planHints: ["Benzodiazepine protocol", "Thiamine", "Admit if severe"],
  },

  psych_panic_anxiety: {
    id: "psych_panic_anxiety",
    order: 5,
    titleTh: "วิตก / panic",
    titleEn: "Panic / anxiety",
    matchKeywords: [
      "panic",
      "anxiety",
      "palpitation",
      "hyperventilation",
      "วิตก",
      "กังวล",
      "ตื่นตระหนก",
    ],
    hardFactsGuidance: "Triggers, frequency, somatic symptoms, cardiac ruled out",
    factsPresentHints: ["episodes", "chest"],
    askNext: ["caffeine", "thyroid", "substance"],
    examNext: ["Vitals, thyroid", "ECG if chest"],
    pertinentNegatives: ["ไม่มี ACS — ถ้าชัดเจน"],
    rankedDifferentials: [
      "Panic disorder",
      "GAD",
      "Medical mimic",
    ],
    planHints: ["SSRIs/benzodiazepine PRN", "CBT referral", "Cardiac workup if needed"],
  },

  ...LABOR_GYNE_PACKS,
};
