/**
 * LABOR_ROOM and GYNE mode symptom/problem packs — merged into `modeProblemPackData` catalog.
 */
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

export type LaborGynePackId =
  | "lr_labor_evaluation"
  | "lr_antepartum_bleeding"
  | "lr_preeclampsia"
  | "lr_reduced_fetal_movement"
  | "lr_postpartum_hemorrhage"
  | "lr_postpartum_fever"
  | "gy_early_pregnancy_bleeding"
  | "gy_abnormal_uterine_bleeding"
  | "gy_vaginal_discharge_pid"
  | "gy_acute_pelvic_pain_torsion"
  | "gy_dysmenorrhea_chronic_pelvic_pain"
  | "gy_postmenopausal_bleeding"
  | "gy_vulvar_bartholin";

export const LABOR_ROOM_PACK_ORDER: readonly LaborGynePackId[] = [
  "lr_labor_evaluation",
  "lr_antepartum_bleeding",
  "lr_preeclampsia",
  "lr_reduced_fetal_movement",
  "lr_postpartum_hemorrhage",
  "lr_postpartum_fever",
] as const;

export const GYNE_PACK_ORDER: readonly LaborGynePackId[] = [
  "gy_early_pregnancy_bleeding",
  "gy_abnormal_uterine_bleeding",
  "gy_vaginal_discharge_pid",
  "gy_acute_pelvic_pain_torsion",
  "gy_dysmenorrhea_chronic_pelvic_pain",
  "gy_postmenopausal_bleeding",
  "gy_vulvar_bartholin",
] as const;

export const LABOR_GYNE_PACKS: Record<LaborGynePackId, ModePackDefShape> = {
  lr_labor_evaluation: {
    id: "lr_labor_evaluation",
    order: 1,
    titleTh: "ปวดคลอด / ประเมินการคลอด",
    titleEn: "Labor pain / labor evaluation",
    matchKeywords: [
      "labor",
      "labour",
      "contraction",
      "latent labor",
      "active labor",
      "ตัวคลอด",
      "เปิดปากมดลูก",
      "คลอด",
      "ห้องคลอด",
      "labor room",
      "intrapartum",
      "partogram",
      "ส่งครรภ์",
      "ปวดคลอด",
    ],
    hardFactsGuidance:
      "Pregnancy status, GA, parity/prior CS, contractions, ROM, bleeding, fetal movement, maternal vitals, fetal status",
    factsPresentHints: ["GA", "contractions", "ROM", "FM", "BP/HR", "FHR"],
    askNext: [
      "สถานะการตั้งครรภ์ / GA",
      "parity / เคยผ่าตัดคลอด",
      "ความถี่-ระยะเวลาตัวคลอด",
      "น้ำเดิน / เวลา",
      "เลือดทางช่องคลอด",
      "ลูกดิ้น",
      "ยาประจำ / พบฝาก",
    ],
    examNext: [
      "Vital signs มารดา",
      "uterine activity / toco",
      "FHR / CTG ตาม protocol",
      "ปากมดลูก — ถ้า indicated",
    ],
    pertinentNegatives: [
      "ไม่มีเลือดออกมาก — ถ้าไม่มี",
      "ลูกดิ้นปกติ — ถ้าไม่มี concern",
    ],
    rankedDifferentials: [
      "Latent vs active labor",
      "False labor / Braxton Hicks",
      "Preterm labor",
      "Non-labor abdominal pain — ถ้าชี้",
    ],
    planHints: [
      "ไม่เขียนแบบ URI/OPD ล้วน — มี ob triage field",
      "obGyneDisposition ชัด: latent / active / observe / urgent OB / refer",
      "red flag — เลือด / FM ลด / ปวดรุนแรง / vitals ไม่นิ่ง → urgent pathway",
    ],
  },

  lr_antepartum_bleeding: {
    id: "lr_antepartum_bleeding",
    order: 2,
    titleTh: "เลือดออกทางช่องคลอดก่อนคลอด",
    titleEn: "Antepartum bleeding",
    matchKeywords: [
      "antepartum bleeding",
      "abruption",
      "placenta previa",
      "previa",
      "เลือดออกก่อนคลอด",
      "เลือดออกท้อง",
      "third trimester bleeding",
      "vaginal bleeding pregnancy",
      "ante partum hemorrhage",
      "aph",
    ],
    hardFactsGuidance:
      "Always document: GA, bleeding amount, pain severity, hemodynamic status, fetal concern (FHR/FM) when relevant",
    factsPresentHints: ["GA", "EBL or pads/h", "BP/HR", "FHR"],
    askNext: [
      "GA / dating",
      "ปริมาณเลือด / ลิ่มเลือด",
      "ความรุนแรงของปวด",
      "prior previa / abruption / CS",
      "Rh / anti-D",
      "FM / FHR context",
    ],
    examNext: [
      "Maternal vitals — hemodynamic status",
      "uterine tone / tenderness",
      "FHR / CTG per protocol",
      "US / urgent OB — per protocol",
    ],
    pertinentNegatives: ["ไม่มี hypotension — ถ้าไม่มี", "ไม่มี fetal distress — ถ้าตรวจแล้วไม่มี"],
    rankedDifferentials: [
      "Placenta previa",
      "Abruptio placentae",
      "Other APH causes",
    ],
    planHints: [
      "Later pregnancy bleeding → urgent obstetric review pathway",
      "Large-bore IV, type & screen",
      "Unstable vitals → immediate concern first in triage note",
      "ไม่เขียนแบบ URI/OPD ล้วน",
    ],
  },

  lr_preeclampsia: {
    id: "lr_preeclampsia",
    order: 3,
    titleTh: "ครรภ์เป็นพิษ / hypertension ในการตั้งครรภ์",
    titleEn: "Hypertensive disorder / preeclampsia",
    matchKeywords: [
      "preeclampsia",
      "pre-eclampsia",
      "eclampsia",
      "gestational hypertension",
      "proteinuria pregnancy",
      "hellp",
      "ครรภ์เป็นพิษ",
      "ความดันสูงตอนท้อง",
      "ปวดหัวหลังท้อง",
    ],
    hardFactsGuidance:
      "Always surface early: pregnancy status, GA, BP, headache (severity), visual symptoms, RUQ/epigastric pain, seizure/eclampsia concern, fetal concern when relevant; proteinuria/edema/reflexes/labs if documented",
    factsPresentHints: [
      "pregnancy status",
      "GA",
      "BP",
      "headache",
      "visual/visual field",
      "RUQ/epigastric",
      "seizure",
      "FHR/FM",
      "protein",
    ],
    askNext: [
      "Headache onset/severity vs prior; visual changes",
      "RUQ/epigastric pain; nausea/vomiting",
      "Fetal movement; prior home BP",
      "Prior PIH / preeclampsia; aspirin or antihypertensive",
      "Urinary symptoms; edema progression",
    ],
    examNext: [
      "Repeat BP; neuro — focal deficit if indicated",
      "RUQ/epigastric",
      "DTR/clonus/edema per protocol",
      "FHR / CTG / NST per protocol",
      "Urine protein / labs per protocol",
    ],
    pertinentNegatives: ["ไม่มี seizure — ถ้าไม่มี", "ไม่มี visual symptoms — ถ้า assessed แล้วไม่มี"],
    rankedDifferentials: [
      "Preeclampsia",
      "Gestational hypertension",
      "Chronic HTN + superimposed",
    ],
    planHints: [
      "Pregnancy + severe headache/visual/severe BP → urgent OB pathway — not routine OPD headache note",
      "Magnesium / antihypertensive per protocol",
      "Admit vs urgent OB; fetal monitoring",
    ],
  },

  lr_reduced_fetal_movement: {
    id: "lr_reduced_fetal_movement",
    order: 4,
    titleTh: "ลูกดิ้นน้อย / fetal movement",
    titleEn: "Reduced fetal movement",
    matchKeywords: [
      "reduced fetal movement",
      "decreased fetal movement",
      "fetal movement decreased",
      "ลูกดิ้นน้อย",
      "ลูกไม่ดิ้น",
      "baby not moving",
      "rfm",
    ],
    hardFactsGuidance: "GA, last normal movement time, kick counts, FHR / NST if done",
    factsPresentHints: ["GA", "timing"],
    askNext: ["maternal perception", "prior similar", "risk factors"],
    examNext: ["NST / biophysical profile per protocol", "US if indicated"],
    pertinentNegatives: ["ไม่มี bleeding — ถ้าไม่มี"],
    rankedDifferentials: [
      "Maternal perception vs true RFM",
      "Fetal compromise — rule out",
    ],
    planHints: ["Formal fetal assessment", "Urgent OB / L&D triage", "Disposition per NST/BPP"],
  },

  lr_postpartum_hemorrhage: {
    id: "lr_postpartum_hemorrhage",
    order: 5,
    titleTh: "เลือดออกหลังคลอด / ภาวะแทรกหลังคลอด",
    titleEn: "Postpartum hemorrhage / complication",
    matchKeywords: [
      "postpartum hemorrhage",
      "pph",
      "atonic uterus",
      "uterine atony",
      "เลือดออกหลังคลอด",
      "ตกเลือดหลังคลอด",
      "retained placenta",
      "postpartum complication",
    ],
    hardFactsGuidance: "Time from delivery, estimated blood loss, vitals, uterine tone, products of conception",
    factsPresentHints: ["EBL", "BP", "HR"],
    askNext: ["mode of delivery", "oxytocin", "clotting history"],
    examNext: ["VS, fundus, lochia", "labs / transfuse pathway"],
    pertinentNegatives: ["ไม่มี shock — ถ้าไม่มี"],
    rankedDifferentials: [
      "Uterine atony",
      "Retained tissue",
      "Laceration",
      "Coagulopathy",
    ],
    planHints: ["Uterotonics / escalation per protocol", "Type & cross", "Surgical consult if refractory"],
  },

  lr_postpartum_fever: {
    id: "lr_postpartum_fever",
    order: 6,
    titleTh: "ไข้หลังคลอด / ภาวะแทรกหลังคลอด",
    titleEn: "Postpartum fever / postpartum complication",
    matchKeywords: [
      "postpartum fever",
      "postpartum infection",
      "postpartum complication",
      "puerperal",
      "endometritis",
      "mastitis postpartum",
      "ไข้หลังคลอด",
      "สะดือเหม็น",
      "uterine infection",
    ],
    hardFactsGuidance: "Days postpartum, fever curve, uterine tenderness, lochia, breast, wound",
    factsPresentHints: ["T", "uterine tenderness"],
    askNext: ["delivery details", "ROM duration", "breast symptoms", "UTI symptoms"],
    examNext: ["VS, uterus, wound, breast", "CBC, cultures per protocol"],
    pertinentNegatives: ["ไม่มี hypotension — ถ้าไม่มี"],
    rankedDifferentials: [
      "Endometritis",
      "UTI",
      "Mastitis",
      "Wound infection",
    ],
    planHints: ["Broad-spectrum antibiotics per protocol", "Admit if sepsis criteria", "Source control if abscess"],
  },

  gy_early_pregnancy_bleeding: {
    id: "gy_early_pregnancy_bleeding",
    order: 1,
    titleTh: "ตั้งครรภ์ระยะแรก — ปวดท้อง / เลือดออก",
    titleEn: "Early pregnancy pain/bleeding (ectopic/miscarriage pathway)",
    matchKeywords: [
      "early pregnancy",
      "first trimester bleeding",
      "threatened abortion",
      "incomplete abortion",
      "missed abortion",
      "ectopic",
      "extrauterine pregnancy",
      "6 weeks pregnant",
      "8 weeks pregnant",
      "10 weeks ga",
      "ครรภ์นอกมดลูก",
      "แท้ง",
      "เลือดล้างหน้าเด็ก",
    ],
    hardFactsGuidance:
      "Always surface early: pregnancy status; LMP / estimated GA; pain severity and laterality; bleeding amount (structured); hemodynamic status; ectopic risk clues (prior ectopic, tubal/PID, IUD, ART, etc.)",
    factsPresentHints: ["LMP", "GA", "pain side", "bleeding", "BP/HR", "β-hCG", "US"],
    askNext: [
      "Pain severity and RLQ vs LLQ vs diffuse",
      "Pads/h, clots, syncope",
      "Prior ectopic, PID, tubal surgery, IUD",
      "Rh / anti-D",
      "β-hCG and TVS pathway",
    ],
    examNext: [
      "Vitals — hemodynamic status",
      "Abdomen — focal tenderness, peritoneal signs, shoulder-tip equivalent",
      "US / serial β-hCG per protocol",
    ],
    pertinentNegatives: ["ไม่มี peritoneal signs — ถ้าไม่มี", "ไม่มี unstable vitals — ถ้าไม่มี"],
    rankedDifferentials: [
      "Threatened abortion",
      "Incomplete/complete abortion",
      "Ectopic pregnancy",
      "Molar pregnancy",
    ],
    planHints: [
      "Pain + bleeding in early pregnancy → ectopic/miscarriage pathway (rule overlay)",
      "Unstable vitals or peritonism → urgent GYNE/ER pathway",
      "Rule out ectopic per protocol",
      "Rhogam if indicated",
    ],
  },

  gy_abnormal_uterine_bleeding: {
    id: "gy_abnormal_uterine_bleeding",
    order: 2,
    titleTh: "เลือดออกผิดปกติเฉียบพลัน (ไม่ใช่ครรภ์ระยะแรกเท่านั้น)",
    titleEn: "Acute abnormal uterine bleeding",
    matchKeywords: [
      "abnormal uterine bleeding",
      "aub",
      "heavy menstrual bleeding",
      "menorrhagia",
      "เลือดประจำเดือนมาก",
      "ประจำเดือนมากผิดปกติ",
      "acute vaginal bleeding",
    ],
    hardFactsGuidance:
      "Clarify pregnancy status early (UPT/β-hCG); hemodynamic stability first; structured bleeding amount; cycle pattern; anemia symptoms — nonpregnant acute AUB is not routine dysmenorrhea documentation",
    factsPresentHints: ["UPT / β-hCG", "BP/HR", "bleeding quantified", "Hgb if known"],
    askNext: [
      "Pregnancy status — UPT/β-hCG",
      "Bleeding amount — pads/h, clots, syncope",
      "LMP / cycle pattern",
      "Contraception / fibroids / coagulation",
    ],
    examNext: [
      "Vitals — hemodynamic stability first",
      "Anemia signs",
      "Pelvic per protocol when stable",
    ],
    pertinentNegatives: ["ไม่มี pregnancy — ถ้าตรวจแล้ว", "ไม่มี unstable vitals — ถ้าไม่มี"],
    rankedDifferentials: [
      "Anovulatory bleeding",
      "Fibroid / polyp",
      "Coagulopathy",
      "Pregnancy-related — rule out first",
    ],
    planHints: [
      "Heavy bleeding + instability → urgent pathway (rule overlay)",
      "Hemodynamic stabilization first",
      "Hormonal/hemostatic therapy per protocol",
      "Do not merge nonpregnant AUB with primary dysmenorrhea note format",
    ],
  },

  gy_vaginal_discharge_pid: {
    id: "gy_vaginal_discharge_pid",
    order: 3,
    titleTh: "ตกขาว / สงสัย PID",
    titleEn: "Vaginal discharge / PID-like",
    matchKeywords: [
      "pelvic inflammatory disease",
      "pid",
      "cervicitis",
      "vaginal discharge",
      "purulent discharge",
      "ตกขาว",
      "คัน ช่องคลอด",
      "แผลคลอง",
    ],
    hardFactsGuidance: "Discharge character, odor, fever, cervical motion tenderness, pregnancy status",
    factsPresentHints: ["fever", "CMT"],
    askNext: ["partners", "STI risk", "prior PID"],
    examNext: ["Bimanual if indicated", "pregnancy test", "NAAT/cultures per protocol"],
    pertinentNegatives: ["ไม่มี fever — ถ้าไม่มี"],
    rankedDifferentials: [
      "PID",
      "Bacterial vaginosis",
      "Candida / trichomonas",
    ],
    planHints: ["Antibiotics per CDC-style regimen", "Treat partners", "Pregnancy test before meds"],
  },

  gy_acute_pelvic_pain_torsion: {
    id: "gy_acute_pelvic_pain_torsion",
    order: 4,
    titleTh: "ปวดท้องเฉียบพลันในอุ้งเชิงกราน / สงสัย torsion",
    titleEn: "Acute pelvic pain / torsion concern",
    matchKeywords: [
      "ovarian torsion",
      "adnexal mass",
      "acute pelvic pain",
      "ปวดท้องเฉียบพลัน ผู้หญิง",
      "ท้องน้อยข้างเดียว",
      "ruptured cyst",
      "ขั้วรังไข่บิด",
    ],
    hardFactsGuidance: "Sudden vs gradual, nausea, peritoneal signs, pregnancy status, prior cysts",
    factsPresentHints: ["unilateral pain", "nausea"],
    askNext: ["last menstrual period", "pregnancy", "prior ovarian cyst"],
    examNext: ["VS, abdominal + pelvic", "US urgent"],
    pertinentNegatives: ["ไม่มี peritonitis — ถ้าไม่มี"],
    rankedDifferentials: [
      "Ovarian torsion",
      "Ruptured hemorrhagic cyst",
      "Ectopic",
      "Appendicitis — mimic",
    ],
    planHints: ["Urgent GYN / surgery consult", "NPO if surgical", "Analgesia + rule-out"],
  },

  gy_dysmenorrhea_chronic_pelvic_pain: {
    id: "gy_dysmenorrhea_chronic_pelvic_pain",
    order: 5,
    titleTh: "ปวดประจำเดือน / ปวดท้องน้อยเรื้อรัง",
    titleEn: "Dysmenorrhea / chronic pelvic pain",
    matchKeywords: [
      "dysmenorrhea",
      "chronic pelvic pain",
      "endometriosis",
      "adenomyosis",
      "ปวดประจำเดือน",
      "ปวดท้องน้อยเรื้อรัง",
      "ประจำเดือนมาปวดมาก",
    ],
    hardFactsGuidance: "Cycle relation, NSAID response, dyspareunia, infertility hx, prior laparoscopy",
    factsPresentHints: ["cyclical pain"],
    askNext: ["contraception", "fertility goals", "bowel/bladder symptoms"],
    examNext: ["Pelvic if indicated", "consider US"],
    pertinentNegatives: ["ไม่มี acute abdomen — ถ้าไม่มี"],
    rankedDifferentials: [
      "Primary dysmenorrhea",
      "Endometriosis",
      "Adenomyosis",
      "IBS overlap",
    ],
    planHints: ["NSAIDs / hormonal therapy", "Specialist referral", "Exclude acute surgical first"],
  },

  gy_postmenopausal_bleeding: {
    id: "gy_postmenopausal_bleeding",
    order: 6,
    titleTh: "เลือดออกหลังหมดประจำเดือน",
    titleEn: "Postmenopausal bleeding",
    matchKeywords: [
      "postmenopausal bleeding",
      "pmb",
      "เลือดออกหลังวัยทอง",
      "หมดประจำเดือนแล้วยังมีเลือด",
      "menopause bleeding",
    ],
    hardFactsGuidance: "Time since menopause, amount, focal symptoms, HRT use",
    factsPresentHints: ["postmenopausal", "bleeding"],
    askNext: ["HRT", "weight loss", "family cancer hx"],
    examNext: ["Pelvic", "TVUS / endometrial biopsy pathway"],
    pertinentNegatives: ["ไม่มี mass on exam — ถ้าไม่มี"],
    rankedDifferentials: [
      "Endometrial hyperplasia/cancer",
      "Atrophy",
      "Polyp",
    ],
    planHints: ["Urgent GYN workup", "Endometrial sampling per protocol", "Refer"],
  },

  gy_vulvar_bartholin: {
    id: "gy_vulvar_bartholin",
    order: 7,
    titleTh: "ปัญหา vulvar / Bartholin",
    titleEn: "Vulvar / Bartholin problems",
    matchKeywords: [
      "bartholin",
      "bartholin cyst",
      "bartholin abscess",
      "vulvar abscess",
      "vulvar mass",
      "หนองใน",
      "ต่อมหนองใน",
      "แผล vulva",
    ],
    hardFactsGuidance: "Location, erythema, fluctuance, fever, prior I&D",
    factsPresentHints: ["unilateral labial swelling"],
    askNext: ["diabetes", "STI risk", "prior episodes"],
    examNext: ["Local exam", "I&D if abscess + antibiotics"],
    pertinentNegatives: ["ไม่มี cellulitis — ถ้าไม่มี"],
    rankedDifferentials: [
      "Bartholin abscess",
      "Bartholin cyst",
      "Hidradenitis",
    ],
    planHints: ["I&D + antibiotics if abscess", "Sitz bath", "GYN follow-up"],
  },
};
