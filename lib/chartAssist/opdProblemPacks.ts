/**
 * Symptom/problem packs (Step 3–4): ordered catalog + per-pack history/exam/negatives/DDx/plan templates.
 * Matching uses negation-aware keyword scoring only (rule layer); AI refines grouping and ranking (Step 2).
 */
import type { AssistMode } from "./cardTypes";
import { anyNonNegatedRegexMatch, scoreKeysNegationAware } from "./clinicalNegation";
import {
  MODE_EXTENDED_PACKS,
  MODE_PROBLEM_PACK_ORDER,
  type ModeExtendedPackId,
} from "./modeProblemPackData";
import { shouldSuppressFeverProblemPack } from "./feverChildOpdFramework";
import { shouldSuppressDysuriaUtiFramework } from "./dysuriaUtiOpdFramework";
import { URI_RESPIRATORY_DETECTION_KEYS } from "./uriRespiratoryOpdFramework";

/** Legacy full OPD catalog (core + orthopedic packs) — still used for matchers referencing the full set */
export type LegacyOpdProblemPackId =
  | "skin_rash"
  | "fever"
  | "uri_cough"
  | "wheeze_dyspnea"
  | "diarrhea_vomiting"
  | "abdominal_pain"
  | "dysuria"
  | "headache_dizziness"
  | "back_neck_pain"
  | "wound_abscess_cellulitis"
  | "sore_throat"
  | "ear_pain"
  | "red_eye"
  | "chest_palpitations"
  | "allergy_urticaria_anaphylaxis"
  | "ortho_acute_limb_sprain"
  | "ortho_fracture_concern"
  | "ortho_hot_swollen_joint"
  | "ortho_knee_pain"
  | "ortho_shoulder_pain"
  | "ortho_pediatric_limp";

export type OpdProblemPackId = LegacyOpdProblemPackId | ModeExtendedPackId;

export type OpdProblemPackDef = {
  id: OpdProblemPackId;
  /** Roadmap order within the active mode list or legacy OPD catalog */
  order: number;
  titleTh: string;
  titleEn: string;
  /** Negation-aware keyword hits activate this pack */
  matchKeywords: string[];
  /** What the rule layer treats as documentable hard facts */
  hardFactsGuidance: string;
  factsPresentHints: string[];
  askNext: string[];
  examNext: string[];
  pertinentNegatives: string[];
  /** OPD-oriented ranked differentials (templates; not final diagnosis) */
  rankedDifferentials: string[];
  planHints: string[];
};

/** Roadmap order — do not reorder IDs without product sign-off */
export const OPD_PROBLEM_PACK_ORDER: readonly OpdProblemPackId[] = [
  "skin_rash",
  "fever",
  "uri_cough",
  "wheeze_dyspnea",
  "diarrhea_vomiting",
  "abdominal_pain",
  "dysuria",
  "headache_dizziness",
  "back_neck_pain",
  "wound_abscess_cellulitis",
  "sore_throat",
  "ear_pain",
  "red_eye",
  "chest_palpitations",
  "allergy_urticaria_anaphylaxis",
  "ortho_acute_limb_sprain",
  "ortho_fracture_concern",
  "ortho_hot_swollen_joint",
  "ortho_knee_pain",
  "ortho_shoulder_pain",
  "ortho_pediatric_limp",
] as const;

/** Shared MSK prompts — appended per orthopedic pack */
const ORTHO_SHARED_ASK_NEXT: string[] = [
  "mechanism / onset — trauma, twist, fall, sport, lift",
  "weight-bearing ability — full / partial / unable / refusal",
  "deformity / swelling / ecchymosis",
  "point tenderness — focal bony vs soft tissue",
  "ROM — painful arc, block, instability",
  "neurovascular status — sensation, motor, pulses, cap refill",
  "fever / hot joint / systemic symptoms",
  "previous injury — same site, chronicity, hardware",
  "inability to use limb — function / ADL / work/school",
];

const ORTHO_SHARED_EXAM_NEXT: string[] = [
  "Inspect — alignment, deformity, swelling, bruising, skin, open wound",
  "Palpation — joint line, anatomical snuffbox (if wrist), focal tenderness",
  "ROM — active then passive; compare to contralateral",
  "Neurovascular — distal sensation, motor, pulses, CRT bilaterally",
  "Joint-specific provocative tests when indicated — document limitation",
];

const ORTHO_REDFLAGS_DOCUMENT: string[] = [
  "Red flags — document: inability to bear weight; hot swollen joint ± fever; obvious deformity; NV compromise; high-energy / severe trauma",
];

const LEGACY_OPD_PROBLEM_PACKS: Record<LegacyOpdProblemPackId, OpdProblemPackDef> = {
  skin_rash: {
    id: "skin_rash",
    order: 1,
    titleTh: "ผื่น / ผิวหนัง",
    titleEn: "Skin / rash",
    matchKeywords: [
      "rash",
      "ผื่น",
      "คัน",
      "itch",
      "vesicle",
      "papule",
      "eczema",
      "urticaria",
      "ลมพิษ",
      "scabies",
      "burrow",
    ],
    hardFactsGuidance: "ระบุ morphology, distribution, onset, คัน/เจ็บ, ยาทา/ยากิน, sick contacts",
    factsPresentHints: ["ตำแหน่ง/ลาม", "ชนิดผื่นโดยย่อ", "ระยะเวลา", "คันกลางคืน", "ไข้หรือไม่"],
    askNext: [
      "กำเริบ/ลาม — progression",
      "คนในบ้านคันหรือไม่",
      "เมือก/ลิ้น/ตา — ร่วมหรือไม่",
      "ฝ่ามือ/ฝ่าเท้า — ร่วมหรือไม่",
      "ยาแก้แพ้/สเตียรอยด์ทา — ใช้อยู่หรือไม่",
    ],
    examNext: [
      "บันทึก morphology (macule/papule/vesicle/pustule/crust)",
      "distribution — โฟกัส vs กระจาย, dermatomal",
      "excoriation, warmth, fluctuance",
    ],
    pertinentNegatives: [
      "ไม่มี mucosal involvement — ให้บันทึกเมื่อตรวจแล้ว",
      "ไม่มี palm/sole — ถ้าสงสัย certain exanthems",
      "ไม่มี signs of bacterial superinfection — เมื่อไม่มี",
    ],
    rankedDifferentials: [
      "Atopic / contact dermatitis",
      "Urticaria / allergic reaction",
      "Scabies / insect bite hypersensitivity",
      "Viral exanthem",
      "Bacterial cellulitis / impetigo (ถ้ามีร้อน กดเจ็บ หนอง)",
    ],
    planHints: [
      "ทายา/ยาตามกลุ่มที่สมเหตุ + คำแนะนำแก้คัน",
      "นัดซ้ำถ้าไม่ดีขึ้น / ส่งต่อ dermatology ตามชี้",
    ],
  },

  fever: {
    id: "fever",
    order: 2,
    titleTh: "ไข้",
    titleEn: "Fever",
    matchKeywords: ["fever", "febrile", "ไข้", "ไข้สูง", "pyrexia", "อุณหภูมิ"],
    hardFactsGuidance: "ระยะเวลาไข้, สูงสุดถ้ามี, ยาแก้ไข้, สัญญาณ toxicity, แหล่งโฟกัส",
    factsPresentHints: ["ระยะเวลา", "ช่วงสูงสุด", "ตอบสนองยาแก้ไข้", "ซึม/กิน/ปัสสาวะ"],
    askNext: ["แหล่งโฟกัส — หู คอ ปอด ท้อง ผื่น ปัสสาวะ", "ไข้ซ้ำ/โรคประจำตัว", "สัมผัสโรค"],
    examNext: ["Vitals + mental status + perfusion", "ตรวจตามโฟกัสที่สงสัย"],
    pertinentNegatives: ["ไม่มี shock / ไม่มี hypoxia — ถ้าตรวจแล้วไม่มีให้บันทึก"],
    rankedDifferentials: [
      "Viral syndrome / URI focus",
      "Localized bacterial infection (โฟกัสชัด)",
      "UTI/pyelonephritis (ถ้ามีอาการชี้)",
      "Dengue/enteric fever — ตามระบาดและอาการ",
    ],
    planHints: ["ยาแก้ไข้ + หาโฟกัส", "คำแนะนำกลับมาเมื่อ toxicity"],
  },

  uri_cough: {
    id: "uri_cough",
    order: 3,
    titleTh: "หวัด / ไอ / เจ็บคอ (URI)",
    titleEn: "URI / cough / sore throat",
    matchKeywords: [...URI_RESPIRATORY_DETECTION_KEYS],
    hardFactsGuidance:
      "onset, ไข้/ระยะ/สูงสุด, ลักษณะไอและเสมหะ, เจ็บคอ/กลืนเจ็บ, RR/SpO₂/WOB, hydration — ไม่ default pneumonia จากไข้+ไอ อย่างเดียว",
    factsPresentHints: ["สิ่งที่บันทึกแล้วในโน้ต", "ข้อเท็จจริงจากประวัติ — ไข้ ไอ น้ำมูก เจ็บคอ หอบ หายใจลำบาก"],
    askNext: [
      "onset, ระยะไข้/สูงสุด, ลักษณะไอและเสมหะ",
      "sick contact, ตอบสนอง bronchodilator, PMH asthma/wheeze",
    ],
    examNext: ["T HR RR SpO₂, WOB, pharynx/tonsil, nodes, lung sounds, hydration"],
    pertinentNegatives: ["no retraction, no hypoxemia, no focal crackles, no stridor, no drooling, no AMS, no poor feeding — ถ้าไม่มีให้บันทึก"],
    rankedDifferentials: [
      "Viral URI",
      "Acute pharyngitis / tonsillitis",
      "Allergic rhinitis",
      "Bronchiolitis",
      "Wheezing episode / asthma",
      "Pneumonia — เมื่อมีหลักฐาน ไม่ใช่ default",
      "Croup — barking cough / stridor",
    ],
    planHints: [
      "Supportive + ยาตามชี้; หลีกเลี่ยง antibiotic ใน viral URI ธรรมดา",
      "แยก URI เป็น secondary ถ้าประเด็นอื่นเป็น primary",
      "return precautions ตาม RR/SpO₂/WOB",
    ],
  },

  wheeze_dyspnea: {
    id: "wheeze_dyspnea",
    order: 4,
    titleTh: "หอบ / เหนื่อยหอบ / dyspnea",
    titleEn: "Wheeze / dyspnea",
    matchKeywords: ["wheeze", "dyspnea", "หอบ", "หายใจลำบาก", "shortness of breath", "tachypnea", "ventolin", "neb", "bronchospasm"],
    hardFactsGuidance: "Onset, triggers, SpO₂, RR, response to bronchodilator, PMH asthma",
    factsPresentHints: ["หอบครั้งนี้มานาน", "ตอบสนองพ่นยาหรือไม่", "เคยหอบหืด"],
    askNext: ["ไอเรื้อรัง/ไอเลือด", "เจ็บแน่นหน้าอก", "กลืนลำบาก — anaphylaxis"],
    examNext: ["SpO₂, RR, accessory muscle, auscultation", "ลอง bronchodilator ตาม protocol"],
    pertinentNegatives: ["ไม่มี silent chest — ถ้าฟังได้ปกติให้บันทึก"],
    rankedDifferentials: [
      "Asthma / reactive airway exacerbation",
      "Viral bronchiolitis (เด็กเล็ก)",
      "Pneumonia / pneumonitis — ถ้ามี focal",
      "Foreign body / anaphylaxis — ถ้าชี้",
    ],
    planHints: ["Bronchodilator ± steroid ตาม severity", "Return if worse breathing / SpO₂ drop"],
  },

  diarrhea_vomiting: {
    id: "diarrhea_vomiting",
    order: 5,
    titleTh: "ท้องเสีย / อาเจียน",
    titleEn: "Diarrhea / vomiting",
    matchKeywords: ["diarrhea", "vomit", "อาเจียน", "ท้องเสีย", "ถ่าย", "อุจจาระ", "nausea", "คลื่นไส้"],
    hardFactsGuidance: "จำนวนครั้ง/วัน, เลือด/เมือก, ปัสสาวะ, ซึม, สัญญาณขาดน้ำ",
    factsPresentHints: ["จำนวนครั้ง", "ลักษณะอุจจาระ", "กินได้หรือไม่"],
    askNext: ["เลือดในอุจจาระ", "ปวดท้องรุนแรง", "อาหารเสี่ยง", "สัมผัสโรค"],
    examNext: ["Hydration status", "abdomen tenderness/guarding", "fontanelle/cap refill (เด็ก)"],
    pertinentNegatives: ["ไม่มี peritoneal signs — ถ้าตรวจแล้ว", "ไม่มีเลือดในอุจจาระ — ถ้าไม่มี"],
    rankedDifferentials: [
      "Acute gastroenteritis — viral most common",
      "Foodborne illness",
      "Bacterial dysentery — ถ้ามีเลือด/ระบบ",
      "Non-GI mimic (early appendicitis) — ถ้าชี้",
    ],
    planHints: ["ORS / hydration", "ยาตามชี้ — ระวัง anti-diarrheal ใน invasive bacterial"],
  },

  abdominal_pain: {
    id: "abdominal_pain",
    order: 6,
    titleTh: "ปวดท้อง",
    titleEn: "Abdominal pain",
    matchKeywords: ["abdominal pain", "ปวดท้อง", "ท้องขวาล่าง", "rlq", "epigastric", "กดเจ็บท้อง", "guarding"],
    hardFactsGuidance: "ตำแหน่ง/ลักษณะ, ระยะเวลา, คลื่นไส้/อาเจียน/ถ่าย, ปัสสาวะ, gynecologic ถ้าเกี่ยว",
    factsPresentHints: ["จุดปวด", "constant vs colicky", "คลื่นไส้/อาเจียน"],
    askNext: ["เลือดอุจจาระ/ดำ", "ปัสสาวะแสบ", "ประจำเดือน/ตั้งครรภ์"],
    examNext: ["Localized tenderness, rebound, guarding", "CVA ถ้าสงสัย renal"],
    pertinentNegatives: ["ไม่มี peritoneal signs — ให้บันทึกเมื่อไม่มี"],
    rankedDifferentials: [
      "Gastroenteritis / gastritis",
      "Appendicitis — ถ้า RLQ pattern",
      "Renal colic / UTI",
      "Gynecologic causes",
    ],
    planHints: ["Analgesia ตามชี้", "ส่งต่อ/Imaging เมื่อ red flag"],
  },

  dysuria: {
    id: "dysuria",
    order: 7,
    titleTh: "ปัสสาวะแสบ / UTI",
    titleEn: "Dysuria / UTI",
    matchKeywords: [
      "dysuria",
      "ปัสสาวะแสบ",
      "ขัดปัสสาวะ",
      "cystitis",
      "hematuria",
      "urinary frequency",
      "urinary urgency",
      "voiding frequency",
      "suprapubic",
      "flank pain",
      "cloudy urine",
    ],
    hardFactsGuidance: "ระยะเวลา, hematuria, flank/CVA, fever, ตั้งครรภ์, UTI ซ้ำ",
    factsPresentHints: ["frequency/urgency", "เลือดปน", "ไข้หรือไม่"],
    askNext: ["flank pain", "vaginal discharge — แยก urethritis", "catheter/สอดอวัยวะ"],
    examNext: ["Suprapubic / CVA tenderness", "UA dipstick / microscopy ตามชี้"],
    pertinentNegatives: ["ไม่มี CVA tenderness — ถ้าตรวจแล้วไม่มีให้บันทึก"],
    rankedDifferentials: [
      "Uncomplicated UTI / cystitis",
      "Pyelonephritis — ถ้าไข้/CVA",
      "Urethritis / STI",
      "Stone — ถ้า colicky + hematuria",
    ],
    planHints: ["Antibiotic ตาม guideline + hydration", "Follow-up ถ้าไม่ดีขึ้น"],
  },

  headache_dizziness: {
    id: "headache_dizziness",
    order: 8,
    titleTh: "ปวดหัว / เวียนหัว",
    titleEn: "Headache / dizziness",
    matchKeywords: ["headache", "migraine", "dizziness", "vertigo", "ปวดหัว", "เวียนหัว", "บ้านหมุน", "lightheaded"],
    hardFactsGuidance: "Onset, worst headache ever, focal neuro, fever/neck stiffness, trauma, BP",
    factsPresentHints: ["ลักษณะปวด", "ระยะเวลา", "คลื่นไส้/อาเจียนร่วม"],
    askNext: ["ชา/อ่อนแรง/พูดไม่ชัด", "ไข้/คอแข็ง", "หูอื้อ/หูดับ (hearing)"],
    examNext: ["Neuro screening — กำลังกล้ามเนื้อ, speech, gait", "BP, ENT ถ้าเวียน"],
    pertinentNegatives: ["ไม่มี focal neuro deficit — ถ้าตรวจแล้ว"],
    rankedDifferentials: [
      "Tension / migraine spectrum",
      "Vestibular neuritis / BPPV pattern",
      "Sinusitis referral pain",
      "Secondary causes — ถ้า red flags",
    ],
    planHints: ["Symptomatic relief", "Return ED if thunderclap / neuro deficit / fever+neck stiffness"],
  },

  back_neck_pain: {
    id: "back_neck_pain",
    order: 9,
    titleTh: "ปวดหลัง / ปวดคอ",
    titleEn: "Back / neck pain",
    matchKeywords: ["back pain", "neck pain", "ปวดหลัง", "ปวดคอ", "lumbar", "cervical", "radicular", "slr"],
    hardFactsGuidance: "Mechanism, radicular symptoms, bowel/bladder, fever, trauma, neuro exam",
    factsPresentHints: ["ตำแหน่ง", "ชาขา/แขน", "กลั้นปัสสาวะไม่ได้"],
    askNext: ["ไข้/น้ำหนักลด/มะเร็ง PMH", "หลังเจ็บหลังยกของ"],
    examNext: ["Motor/sensory/reflex", "SLR / SpURL ตามชี้", "กดเจ็บกระดูกสันหลัง"],
    pertinentNegatives: ["ไม่มี cauda equina signs — ให้บันทึกเมื่อไม่มี"],
    rankedDifferentials: [
      "Mechanical low back / neck strain",
      "Radiculopathy / disc",
      "Vertebral infection — ถ้าไข้+risk",
      "Non-MSK causes",
    ],
    planHints: ["Analgesia + activity advice", "Imaging/ortho/neuro ตาม red flag"],
  },

  wound_abscess_cellulitis: {
    id: "wound_abscess_cellulitis",
    order: 10,
    titleTh: "แผล / ฝี / cellulitis",
    titleEn: "Wound / abscess / cellulitis",
    matchKeywords: ["wound", "abscess", "cellulitis", "ฝี", "แผล", "pus", "หนอง", "laceration", "bite", "แมลงกัด"],
    hardFactsGuidance: "กลไก, วันที่, ร้อนลาม, fluctuance, tetanus, immune status",
    factsPresentHints: ["ขนาดแผล/ฝี", "มีหนองหรือไม่", "ไข้"],
    askNext: ["น้ำยาล้าง/ยาที่ใช้", "แพ้ยา", "diabetes/immunosuppression"],
    examNext: ["Spreading erythema, warmth, fluctuance", "neurovascular distal"],
    pertinentNegatives: ["ไม่มี deep space infection signs — ถ้าตรวจแล้ว"],
    rankedDifferentials: [
      "Simple localized abscess",
      "Cellulitis / erysipelas",
      "Necrotizing infection — ถ้า severe pain/systemic",
      "Animal bite pathogens",
    ],
    planHints: ["I&D เมื่อฝี", "Antibiotic ตาม severity + follow-up 24–48h"],
  },

  sore_throat: {
    id: "sore_throat",
    order: 11,
    titleTh: "เจ็บคอ",
    titleEn: "Sore throat",
    matchKeywords: ["sore throat", "pharyngitis", "tonsillitis", "เจ็บคอ", "ทอนซิล", "เจ็บเมื่อกลืน"],
    hardFactsGuidance: "Onset, fever, cough (viral lean), exudate, nodes, CENTOR ไม่ต้องคิดเลขในโน้ตแต่เก็บ clues",
    factsPresentHints: ["เจ็บกลืน", "ไข้", "ไอร่วม"],
    askNext: ["หายใจลำบาก/เสียงแหบรุนแรง", "ลิ้นหลังบวมหรือไม่"],
    examNext: ["Tonsillar exudate, nodes, airway"],
    pertinentNegatives: ["ไม่มี airway compromise — ถ้าปกติ"],
    rankedDifferentials: [
      "Viral pharyngitis",
      "Strep pharyngitis — ถ้าชี้ + test/treat policy",
      "Peritonsillar abscess — ถ้า trismus/uvula deviation",
      "Mononucleosis spectrum",
    ],
    planHints: ["Symptomatic + antibiotic เฉพาะเมื่อชี้", "Return if airway symptoms"],
  },

  ear_pain: {
    id: "ear_pain",
    order: 12,
    titleTh: "เจ็บหู",
    titleEn: "Ear pain",
    matchKeywords: ["ear pain", "otalgia", "otitis", "เจ็บหู", "อักเสบหู", "otorrhea", "หูอักเสบ"],
    hardFactsGuidance: "เด็ก vs ผู้ใหญ่, discharge, hearing, trauma, swimming",
    factsPresentHints: ["ข้างใด", "มีน้ำไหลหรือไม่", "ได้ยินลดหรือไม่"],
    askNext: ["ไข้", "URI ร่วม", "คันหู/แพ้"],
    examNext: ["Otoscopy — TM bulging/perforation/fluid", "mastoid tenderness"],
    pertinentNegatives: ["ไม่มี mastoiditis signs — ถ้าไม่มีให้บันทึก"],
    rankedDifferentials: [
      "Acute otitis media",
      "Otitis externa",
      "Referred pain (dental, throat)",
      "Mastoiditis — ถ้า post-auricular swelling",
    ],
    planHints: ["Topical/ systemic abx ตามชนิด", "ENT follow-up ถ้าไม่ดีขึ้น"],
  },

  red_eye: {
    id: "red_eye",
    order: 13,
    titleTh: "ตาแดง",
    titleEn: "Red eye",
    matchKeywords: ["red eye", "conjunctivitis", "ตาแดง", "ตาอักเสบ", "eye discharge", "เยื่อบุตาอักเสบ"],
    hardFactsGuidance: "ข้างเดียว/สองข้าง, discharge, vision, pain, photophobia, contact lens",
    factsPresentHints: ["เริ่มเมื่อไร", "คัดตาหรือไม่", "ปวดตาลึกหรือไม่"],
    askNext: ["บาดเจ็บ/สารเคมี", "เลนส์สัมผัส", "ไข้/บาดแผลใกล้ตา"],
    examNext: ["Visual acuity — critical", "fluorescein ถ้า abrasion สงสัย", "pupil"],
    pertinentNegatives: ["ไม่มี vision-threatening signs — ถ้าตรวจแล้วไม่มีให้บันทึก"],
    rankedDifferentials: [
      "Viral/bacterial conjunctivitis",
      "Allergic conjunctivitis",
      "Corneal abrasion/ulcer — ถ้าเจ็บตามาก",
      "Acute glaucoma / uveitis — red flag",
    ],
    planHints: ["Hygiene + drops ตามชนิด", "ส่งจักษุทันทีถ้า vision↓/severe pain"],
  },

  chest_palpitations: {
    id: "chest_palpitations",
    order: 14,
    titleTh: "เจ็บหน้าอก / เด้งหัวใจ",
    titleEn: "Chest pain / palpitations",
    matchKeywords: ["chest pain", "palpitation", "ปวดหน้าอก", "เด้งหัวใจ", "tightness", "แน่นหน้าอก", "angina"],
    hardFactsGuidance: "OPD focus: quality, exertion, radiation, SOB, diaphoresis, risk factors, vitals",
    factsPresentHints: ["เจ็บตอนพักหรือออกแรง", "เหงื่อออก/คลื่นไส้"],
    askNext: ["syncope", "ไปมาขาเย็น", "PMH โรคหัวใจ"],
    examNext: ["Vitals, heart rhythm note, unilateral leg swelling if PE concern"],
    pertinentNegatives: ["ไม่มี hemodynamic instability — ถ้าเสถียร"],
    rankedDifferentials: [
      "MSK chest wall pain",
      "GERD/esophageal",
      "Anxiety/panic — diagnosis of exclusion",
      "ACS/PE — ถ้า high risk / symptoms",
    ],
    planHints: ["ECG/labs ตาม risk", "Clear ED return precautions"],
  },

  allergy_urticaria_anaphylaxis: {
    id: "allergy_urticaria_anaphylaxis",
    order: 15,
    titleTh: "แพ้ / ลมพิษ / กลัว anaphylaxis",
    titleEn: "Allergy / urticaria / anaphylaxis concern",
    matchKeywords: [
      "anaphylaxis",
      "anaphylactic",
      "allergy",
      "urticaria",
      "angioedema",
      "แพ้",
      "ลมพิษ",
      "epinephrine",
      "adrenaline",
    ],
    hardFactsGuidance: "Airway, BP, onset, trigger, prior epinephrine, concurrent meds (β-blocker)",
    factsPresentHints: ["ลิ้น/ริมฝีปากบวมหรือไม่", "หายใจเสียงดัง/หายใจลำบาก", "ความดันต่ำ"],
    askNext: ["สัมผัสอาหาร/ยา/แมลง", "ลิ้น/ริมฝีปากบวม", "หมดสติ"],
    examNext: ["Airway, BP, HR, skin pattern", "voice change/stridor"],
    pertinentNegatives: ["ไม่มี airway involvement — ถ้าไม่มีให้บันทึก"],
    rankedDifferentials: [
      "Acute urticaria",
      "Anaphylaxis spectrum",
      "Angioedema (ACE-i / hereditary) — ถ้าชี้",
      "Viral exanthem overlap — แยกประเด็นผื่น",
    ],
    planHints: ["Epinephrine IM เมื่อ anaphylaxis", "Observation window + prescription ตาม protocol"],
  },

  ortho_acute_limb_sprain: {
    id: "ortho_acute_limb_sprain",
    order: 16,
    titleTh: "บาดเจ็บแขนขาเฉียบพลัน / sprain",
    titleEn: "Acute limb injury / sprain",
    matchKeywords: [
      "sprain",
      "strain",
      "twisted ankle",
      "rolled ankle",
      "inversion injury",
      "eversion",
      "FOOSH",
      "wrist sprain",
      "ankle sprain",
      "แพลง",
      "พลิกข้อ",
      "บิดข้อ",
      "muscle strain",
      "pulled hamstring",
      "acute injury",
      "ล้มข้อ",
    ],
    hardFactsGuidance:
      "Mechanism, time, weight-bearing, swelling, prior injury, occupation/sport; red flags for fracture or NV compromise",
    factsPresentHints: [
      ...ORTHO_REDFLAGS_DOCUMENT,
      "บันทึกข้อจำกัดการเดิน/ใช้งาน",
      "เครื่องป้องกัน (splint/brace) ถ้ามี",
    ],
    askNext: [
      ...ORTHO_SHARED_ASK_NEXT,
      "pop / snap sensation — ligament concern",
      "locking/catching — meniscus if knee involved",
    ],
    examNext: [...ORTHO_SHARED_EXAM_NEXT, "Stress tests ตาม joint — บันทึก laxity เฉพาะเมื่อชี้"],
    pertinentNegatives: [
      "ไม่มี deformity รุนแรง — เมื่อไม่มี",
      "ไม่มี NV deficit — บันทึกเมื่อตรวจแล้วปกติ",
      "ไม่มี open wound — เมื่อไม่มี",
      "สามารถ bear weight ได้บางส่วน — ถ้าเป็นจริง",
    ],
    rankedDifferentials: [
      "Ligament sprain / muscle strain",
      "Contusion / soft tissue injury",
      "Occult fracture — ถ้ายังไม่มี imaging",
      "Tendinopathy / overuse — ถ้าโฟกัส chronicity",
    ],
    planHints: [
      "RICE / immobilization ตามชี้",
      "Imaging if Ottawa / clinical suspicion fracture",
      "Return if worsening pain, NV symptoms, unable to bear weight",
    ],
  },

  ortho_fracture_concern: {
    id: "ortho_fracture_concern",
    order: 17,
    titleTh: "สงสัยกระดูกหัก / fracture",
    titleEn: "Fracture concern",
    matchKeywords: [
      "fracture",
      "broken bone",
      "snuffbox",
      "scaphoid",
      "fall on outstretched hand",
      "FOOSH",
      "bony tenderness",
      "deformity",
      "x-ray",
      "xr ",
      "radiograph",
      "กระดูกหัก",
      "หัก",
      "กระดูกเคลื่อน",
      "open fracture",
      "clinical suspicion fracture",
      "ottawa",
    ],
    hardFactsGuidance: "Mechanism, energy, time, NV status, skin integrity, prior X-ray, analgesia response",
    factsPresentHints: [...ORTHO_REDFLAGS_DOCUMENT, "บันทึก site ของ bony tenderness", "สงสัยกระดูกหักแม้ยังไม่มีรูป"],
    askNext: [
      ...ORTHO_SHARED_ASK_NEXT,
      "paresthesia / numbness — nerve injury",
      "tetanus / wound — ถ้า open",
      "anticoagulation / bone health risk",
    ],
    examNext: [
      ...ORTHO_SHARED_EXAM_NEXT,
      "Anatomical snuffbox / scaphoid tubercle — ถ้า wrist",
      "Mental status if high-energy trauma",
    ],
    pertinentNegatives: [
      "ไม่มี open fracture — เมื่อไม่มี",
      "ไม่มี NV compromise — บันทึกเมื่อตรวจแล้ว",
      "ไม่มี gross deformity — เมื่อไม่มี",
    ],
    rankedDifferentials: [
      "Fracture (confirmed vs occult)",
      "Soft tissue injury without fracture",
      "Pathologic fracture — ถ้ามี risk",
      "Growth plate injury — pediatric",
    ],
    planHints: ["Immobilization + imaging per protocol", "Orthopedics / ED if open or NV compromise", "Analgesia + sling/splint"],
  },

  ortho_hot_swollen_joint: {
    id: "ortho_hot_swollen_joint",
    order: 18,
    titleTh: "ข้อร้อน / บวม / ปวดข้อเฉียบพลัน",
    titleEn: "Hot swollen joint / acute arthritis",
    matchKeywords: [
      "hot joint",
      "swollen joint",
      "joint effusion",
      "monoarticular",
      "septic arthritis",
      "warm joint",
      "erythema joint",
      "ข้อร้อน",
      "ข้อบวม",
      "ข้อแดง",
      "gout",
      "pseudogout",
      "crystal",
      "acute arthritis",
    ],
    hardFactsGuidance: "Single vs polyarticular, fever, IV drug, immunosuppression, prior gout, recent procedure",
    factsPresentHints: [
      ...ORTHO_REDFLAGS_DOCUMENT,
      "fever + monoarticular — escalate septic workup per protocol",
    ],
    askNext: [
      ...ORTHO_SHARED_ASK_NEXT,
      "IVDU / prosthetic joint / recent surgery / bite",
      "STI / disseminated gonorrhea risk — ถ้าชี้",
      "prior gout / pseudogout / rheumatologic history",
    ],
    examNext: [
      ...ORTHO_SHARED_EXAM_NEXT,
      "Effusion — size, ballottement",
      "Adjacent skin / cellulitis",
      "Other joints — polyarticular pattern",
    ],
    pertinentNegatives: [
      "ไม่มี fever — ให้บันทึกเมื่อไม่มี",
      "ไม่มี spreading cellulitis — เมื่อไม่มี",
      "polyarticular — ถ้าไม่ใช่ ให้บันทึก",
    ],
    rankedDifferentials: [
      "Septic arthritis — until excluded when hot monoarticular + systemic",
      "Crystal arthropathy (gout / CPPD)",
      "Reactive / inflammatory arthritis",
      "Lyme / disseminated infection — ตาม epidemiology",
    ],
    planHints: [
      "Aspiration / labs per protocol — ห้าม delay ใน suspicion septic",
      "Empiric therapy only per guideline + source control",
      "Admit / ortho consult when indicated",
    ],
  },

  ortho_knee_pain: {
    id: "ortho_knee_pain",
    order: 19,
    titleTh: "ปวดเข่า",
    titleEn: "Knee pain",
    matchKeywords: [
      "knee pain",
      "knee injury",
      "patella",
      "patellar",
      "meniscus",
      "ACL",
      "MCL",
      "knee swelling",
      "knee effusion",
      "ปวดเข่า",
      "เข่าบวม",
      "เข่าเจ็บ",
      "หัวเข่า",
      "ข้อเข่า",
    ],
    hardFactsGuidance: "Mechanism, locking, swelling, instability, prior surgery, activity level",
    factsPresentHints: [...ORTHO_REDFLAGS_DOCUMENT, "unable to bear weight on knee — โดยเฉพาะเด็ก"],
    askNext: [
      ...ORTHO_SHARED_ASK_NEXT,
      "locking / giving way — meniscus / ligament",
      "anterolateral pain — patellofemoral",
      "degenerative vs acute — ถ้าสงสัย OA",
    ],
    examNext: [
      ...ORTHO_SHARED_EXAM_NEXT,
      "Effusion / patellar ballottement",
      "Lachman / drawer / McMurray — ถ้าชี้และทำได้",
      "Patellar grind / apprehension",
    ],
    pertinentNegatives: [
      "ไม่มี effusion — ให้บันทึกเมื่อไม่มี",
      "ไม่มี instability — เมื่อตรวจแล้ว",
      "ไม่มี fever — ถ้าไม่มี",
    ],
    rankedDifferentials: [
      "Patellofemoral pain syndrome",
      "Meniscal tear",
      "Ligament sprain",
      "OA flare — ถ้าโฟกัส degenerative",
      "Septic knee — ถ้า hot swollen + systemic",
    ],
    planHints: ["RICE + PT referral ตามชี้", "MRI/ortho if mechanical symptoms", "Aspiration if septic concern"],
  },

  ortho_shoulder_pain: {
    id: "ortho_shoulder_pain",
    order: 20,
    titleTh: "ปวดไหล่",
    titleEn: "Shoulder pain",
    matchKeywords: [
      "shoulder pain",
      "rotator cuff",
      "frozen shoulder",
      "shoulder dislocation",
      "AC joint",
      "impingement",
      "ปวดไหล่",
      "ไหล่หลุด",
      "ไหล่เคล็ด",
      "หัวไหล่",
    ],
    hardFactsGuidance: "Dominant arm, overhead work, trauma vs atraumatic, night pain, stiffness",
    factsPresentHints: [...ORTHO_REDFLAGS_DOCUMENT, "หลุดหลัง reduction — บันทึก neurovascular หลัง"],
    askNext: [
      ...ORTHO_SHARED_ASK_NEXT,
      "traumatic vs spontaneous onset",
      "stiffness — adhesive capsulitis pattern",
      "paresthesia — cervical radiculopathy",
    ],
    examNext: [
      ...ORTHO_SHARED_EXAM_NEXT,
      "ROM — forward flexion / ER / IR (behind back)",
      "Special tests — Neer/Hawkins, Jobe — ตามชี้",
      "Cervical screen — ถ้า radicular symptoms",
    ],
    pertinentNegatives: [
      "ไม่มี gross deformity — เมื่อไม่มี dislocation",
      "ไม่มี axillary nerve deficit — หลัง dislocation",
      "ไม่มี fever — เมื่อไม่มี",
    ],
    rankedDifferentials: [
      "Rotator cuff tendinopathy / tear",
      "Adhesive capsulitis",
      "AC joint injury",
      "Labral / instability",
      "Referred pain — cervical, cardiac (atypical)",
    ],
    planHints: ["PT / NSAIDs per risk", "Imaging if trauma or red flag", "Ortho if full-thickness tear suspected"],
  },

  ortho_pediatric_limp: {
    id: "ortho_pediatric_limp",
    order: 21,
    titleTh: "เด็กเดินเพี้ย / ไม่ยอมเหยียบ / ง่อย",
    titleEn: "Pediatric limp / refusal to bear weight",
    matchKeywords: [
      "limp",
      "limping",
      "refuse to walk",
      "refused to bear weight",
      "non-weight bearing",
      "antalgic gait",
      "gait abnormality",
      "toddler",
      "child leg pain",
      "pediatric hip pain",
      "ง่อย",
      "เดินเพี้ย",
      "ไม่ยอมเหยียบ",
      "ไม่ยอมเดิน",
      "ขาเดินไม่ได้",
      "scfe",
      "slipped capital",
    ],
    hardFactsGuidance: "Age, fever, hip vs knee vs ankle pain, trauma, recent URI, Kocher criteria context",
    factsPresentHints: [
      ...ORTHO_REDFLAGS_DOCUMENT,
      "febrile child + hip pain — urgent rule-out septic hip / osteomyelitis per protocol",
    ],
    askNext: [
      ...ORTHO_SHARED_ASK_NEXT,
      "fever / toxicity — ไม่มีเล่น / กินน้ำได้ — เด็ก",
      "hip vs knee localization — ถ้าชี้",
      "recent viral illness — transient synovitis vs septic",
      "SCFE / LCPD risk — วัยรุ่น vs เด็กเล็ก",
    ],
    examNext: [
      ...ORTHO_SHARED_EXAM_NEXT,
      "Hip — ROM, log roll, leg length",
      "Kocher elements — ถ้า febrile + hip pain",
      "Spine — ถ้าสงสัย discitis / other",
    ],
    pertinentNegatives: [
      "ไม่มี fever — ให้บันทึกเมื่อไม่มี",
      "ไม่มี toxic appearance — เมื่อไม่มี",
      "ไม่มี NV deficit — เมื่อไม่มี",
    ],
    rankedDifferentials: [
      "Transient synovitis — diagnosis of exclusion",
      "Septic arthritis / osteomyelitis — urgent",
      "SCFE — adolescent",
      "Legg-Calvé-Perthes — younger child",
      "Fracture / Toddler fracture",
    ],
    planHints: [
      "Urgent imaging/ labs / ortho-peds when septic concern",
      "No weight-bearing until cleared if high suspicion",
      "Safety-net for return with fever or worse pain",
    ],
  },
};

export const OPD_PROBLEM_PACKS: Record<OpdProblemPackId, OpdProblemPackDef> = {
  ...LEGACY_OPD_PROBLEM_PACKS,
  ...(Object.fromEntries(
    (Object.keys(MODE_EXTENDED_PACKS) as ModeExtendedPackId[]).map((id) => [
      id,
      { ...MODE_EXTENDED_PACKS[id], id } as OpdProblemPackDef,
    ]),
  ) as Record<ModeExtendedPackId, OpdProblemPackDef>),
};

export type OpdProblemPackMatch = {
  packId: OpdProblemPackId;
  order: number;
  score: number;
  def: OpdProblemPackDef;
};

export type OpdProblemPackResolution = {
  /** Visit mode used for roadmap order */
  mode: AssistMode;
  /** Pack ids in mode roadmap order (subset of catalog for that mode) */
  orderedIds: readonly OpdProblemPackId[];
  /** Packs with ≥1 non-negated keyword hit, sorted by roadmap order then score */
  activeMatches: OpdProblemPackMatch[];
};

export function resolveOpdProblemPacks(
  normalizedText: string,
  mode: AssistMode = "OPD",
): OpdProblemPackResolution {
  const orderedIds = MODE_PROBLEM_PACK_ORDER[mode];
  const raw: OpdProblemPackMatch[] = [];
  for (const id of orderedIds) {
    const def = OPD_PROBLEM_PACKS[id];
    if (id === "fever" && shouldSuppressFeverProblemPack(normalizedText)) {
      continue;
    }
    if (id === "dysuria" && shouldSuppressDysuriaUtiFramework(normalizedText)) {
      continue;
    }
    let score = scoreKeysNegationAware(normalizedText, def.matchKeywords);
    if (id === "dysuria" && anyNonNegatedRegexMatch(normalizedText, /\buti\b/i)) {
      score += 1;
    }
    if (score >= 1) {
      raw.push({ packId: id, order: def.order, score, def });
    }
  }
  raw.sort((a, b) => (a.order !== b.order ? a.order - b.order : b.score - a.score));
  return { mode, orderedIds, activeMatches: raw };
}

/** Compact block for AI user message (Step 2) */
export function formatProblemPacksForAiPrompt(resolution: OpdProblemPackResolution): string {
  const medPackRule =
    "MEDICATION (all packs): When treatment includes medications, use structured suggestedMedications[] (tier=suggested) on the matching problem — drugName, strength, dose per dose, route, frequency, timing, duration, PRN, max/day, pediatric note; use \"—\" for unknown. finalizedMedications[] only for confirmed orders. Do not invent pediatric mg/kg without weight.";
  const abxRduRule =
    "ANTIBIOTIC_RDU (all packs): When ANTIBIOTIC_RDU_OVERLAY is active, align antibacterial reasoning with supportLevel; no default antibiotics for uncomplicated viral URI; conditional phrasing if exam/labs would strengthen bacterial diagnosis; do not relabel diagnosis to justify antibiotics.";
  if (resolution.activeMatches.length === 0) {
    return `(no symptom packs matched — use RULE_CANDIDATE_PROBLEMS and raw text)\n\n${medPackRule}\n\n${abxRduRule}`;
  }
  const lines: string[] = [];
  for (const m of resolution.activeMatches) {
    const d = m.def;
    const isChestPainEr = d.id === "er_chest_pain";
    const askCap = isChestPainEr ? d.askNext.length : 6;
    const examCap = isChestPainEr ? d.examNext.length : 5;
    const negCap = isChestPainEr ? d.pertinentNegatives.length : 4;
    lines.push(
      `--- Pack #${d.order} ${d.titleTh} / ${d.titleEn} (score=${m.score}) ---`,
      `Hard facts: ${d.hardFactsGuidance}`,
      `Ask next: ${d.askNext.slice(0, askCap).join(" | ")}`,
      `Exam next: ${d.examNext.slice(0, examCap).join(" | ")}`,
      `Pertinent negatives: ${d.pertinentNegatives.slice(0, negCap).join(" | ")}`,
      `DDx (ranked template): ${d.rankedDifferentials.join(" > ")}`,
      `Plan hints: ${d.planHints.join(" | ")}`,
      "",
    );
  }
  lines.push(medPackRule, abxRduRule);
  return lines.join("\n").trim();
}
