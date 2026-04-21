export type ReferenceRegion = "THAI" | "INTL";
export type ReferenceSourceType =
  | "direct-clinical-rule"
  | "topic-index"
  | "supporting-source";

export type ReferenceTopic =
  | "trauma"
  | "head-injury"
  | "respiratory"
  | "uri"
  | "bronchitis"
  | "bronchiolitis"
  | "pneumonia"
  | "wheeze"
  | "asthma"
  | "diarrhea"
  | "bloody-diarrhea"
  | "dehydration"
  | "sepsis"
  | "acute-febrile-illness"
  | "uti"
  | "rdu"
  | "antibiotic-stewardship"
  | "wound"
  | "cellulitis"
  | "general-pediatrics"
  | "obstetrics-gynecology"
  | "toxicology"
  | "emergency-medicine"
  | "anaphylaxis"
  | "stroke"
  | "cardiology"
  | "abdomen"
  | "copd";

export type ReferenceSource = {
  id: string;
  title: string;
  shortLabel: string;
  url: string;
  region: ReferenceRegion;
  sourceType: ReferenceSourceType;
  topics: ReferenceTopic[];
  priority: number;
  /** Publication / revision year or date label when known (display only) */
  sourceDate?: string;
  /** Issuing body / organization (display only) */
  publisher?: string;
  notes?: string;
};

export const referenceCatalog: ReferenceSource[] = [
  {
    id: "thai-peds-cpg-index",
    title: "Clinical Practice Guideline แยกตามอนุสาขาต่างๆ – Thai Pediatrics",
    shortLabel: "Thai Pediatrics CPG Index",
    url: "https://www.thaipediatrics.org/700/",
    region: "THAI",
    sourceType: "topic-index",
    topics: [
      "general-pediatrics",
      "diarrhea",
      "respiratory",
      "uri",
      "bronchitis",
      "pneumonia",
      "bronchiolitis",
      "wheeze",
      "asthma",
      "sepsis",
      "acute-febrile-illness",
      "uti",
    ],
    priority: 1,
    publisher: "Thai Pediatric Society",
    notes: "Thai-first registry for pediatric guideline topics.",
  },
  {
    id: "thai-trauma-abcde",
    title:
      "บทที่ 2 หลักการพื้นฐานในกระดูกหักและข้อเคลื่อน (Orthopaedic Trauma 2019)",
    shortLabel: "Thai Trauma ABCDE",
    url: "https://www.rama.mahidol.ac.th/ortho/sites/default/files/public/education/textbook/pdf/OrthopaedicTrauma2019/02%20OrthoTrauma%20P12-27.pdf",
    region: "THAI",
    sourceType: "direct-clinical-rule",
    topics: ["trauma"],
    priority: 1,
    publisher: "Mahidol University / Faculty of Medicine Ramathibodi (orthopaedic trauma)",
    notes: "Trauma primary survey / ABCDE.",
  },
  {
    id: "thai-rdu-hospital-manual",
    title: "คู่มือการดำเนินงานโครงการโรงพยาบาลส่งเสริมการใช้ยาอย่างสมเหตุผล",
    shortLabel: "Thai RDU Manual",
    url: "https://dmsic.moph.go.th/dmsic/admin/files/userfiles/files/RDU_HospitalManual_v220615.pdf",
    region: "THAI",
    sourceType: "direct-clinical-rule",
    topics: ["rdu", "antibiotic-stewardship", "diarrhea", "uri", "respiratory"],
    priority: 1,
    publisher: "Thailand Ministry of Public Health (DMSIC)",
    notes: "Rational drug use / avoid routine antibiotics.",
  },
  {
    id: "thai-head-injury-traumatic-patients",
    title: "Traumatic Patients",
    shortLabel: "Thai Head Injury / Trauma",
    url: "https://rbpho.moph.go.th/upload-file/doc/files/09072020-075911-2403.pdf",
    region: "THAI",
    sourceType: "direct-clinical-rule",
    topics: ["head-injury", "trauma"],
    priority: 1,
    publisher: "Thailand Ministry of Public Health (RBPHO)",
    notes: "Head injury red flags, GCS/vomiting, referral.",
  },
  {
    id: "thai-head-injury-transfer",
    title: "ข้อพิจารณาในการส่งต่อผู้ป่วยบาดเจ็บศีรษะ",
    shortLabel: "Thai Head Injury Transfer",
    url: "https://www.rbpho.moph.go.th/upload-file/doc/files/17062020-022532-7017.pdf",
    region: "THAI",
    sourceType: "supporting-source",
    topics: ["head-injury", "trauma"],
    priority: 2,
    publisher: "Thailand Ministry of Public Health (RBPHO)",
    notes: "Transfer/disposition after head injury assessment.",
  },
  {
    id: "thai-peds-acute-diarrhea",
    title:
      "แนวทางเวชปฏิบัติการดูแลรักษาโรคท้องร่วงเฉียบพลันในเด็ก พ.ศ. 2562",
    shortLabel: "Thai Acute Diarrhea in Children",
    url: "https://www.thaipediatrics.org/700/",
    region: "THAI",
    sourceType: "topic-index",
    topics: ["diarrhea", "bloody-diarrhea", "dehydration"],
    priority: 1,
    publisher: "Thai Pediatric Society",
    notes: "Index entry: acute diarrhea in children 2562.",
  },
  {
    id: "thai-peds-respiratory-infections-2019",
    title: "แนวทางการดูแลรักษาโรคติดเชื้อเฉียบพลันระบบหายใจในเด็ก พ.ศ. 2562",
    shortLabel: "Thai Pediatric Respiratory Infections",
    url: "https://www.thaipediatrics.org/700/",
    region: "THAI",
    sourceType: "topic-index",
    topics: ["respiratory", "uri", "bronchitis", "pneumonia", "wheeze"],
    priority: 1,
    publisher: "Thai Pediatric Society",
    notes: "Index entry: pediatric respiratory infections 2562.",
  },
  {
    id: "thai-peds-bronchiolitis",
    title: "หลอดลมฝอยอักเสบเฉียบพลัน (Acute bronchiolitis)",
    shortLabel: "Thai Bronchiolitis",
    url: "https://www.thaipediatrics.org/700/",
    region: "THAI",
    sourceType: "topic-index",
    topics: ["respiratory", "bronchiolitis", "wheeze"],
    priority: 1,
    notes: "Index: bronchiolitis.",
  },
  {
    id: "thai-peds-viral-induced-wheeze",
    title: "เสียงหวีดที่เกิดร่วมกับการติดเชื้อไวรัส (Viral induced wheeze)",
    shortLabel: "Thai Viral-Induced Wheeze",
    url: "https://www.thaipediatrics.org/700/",
    region: "THAI",
    sourceType: "topic-index",
    topics: ["wheeze", "respiratory"],
    priority: 1,
    notes: "Index: viral-induced wheeze.",
  },
  {
    id: "thai-peds-asthma",
    title: "แนวทางการวินิจฉัยและรักษาโรคหอบหืดในประเทศไทยสำหรับผู้ป่วยเด็ก",
    shortLabel: "Thai Pediatric Asthma",
    url: "https://www.thaipediatrics.org/700/",
    region: "THAI",
    sourceType: "topic-index",
    topics: ["asthma", "wheeze", "respiratory"],
    priority: 1,
    notes: "Index: pediatric asthma.",
  },
  {
    id: "thai-peds-severe-sepsis-shock",
    title:
      "แนวทางเวชปฏิบัติการวินิจฉัย และรักษาผู้ป่วยเด็กติดเชื้อในกระแสเลือดแบบรุนแรง และแบบที่มีภาวะช็อก พ.ศ. 2561",
    shortLabel: "Thai Pediatric Sepsis/Septic Shock",
    url: "https://www.thaipediatrics.org/700/",
    region: "THAI",
    sourceType: "topic-index",
    topics: ["sepsis", "acute-febrile-illness"],
    priority: 1,
    publisher: "Thai Pediatric Society",
    notes: "Index: severe sepsis / septic shock.",
  },
  {
    id: "thai-peds-acute-febrile-illness",
    title: "แนวทางเวชปฏิบัติผู้ป่วยเด็กที่มีภาวะไข้เฉียบพลัน พ.ศ. 2562",
    shortLabel: "Thai Pediatric Acute Febrile Illness",
    url: "https://www.thaipediatrics.org/700/",
    region: "THAI",
    sourceType: "topic-index",
    topics: ["acute-febrile-illness", "sepsis"],
    priority: 1,
    notes: "Index: acute febrile illness.",
  },
  {
    id: "thai-peds-uti-2m-5y",
    title: "แนวทางเวชปฏิบัติโรคติดเชื้อทางเดินปัสสาวะในผู้ป่วยเด็กอายุ 2 เดือนถึง 5 ปี พ.ศ. 2565",
    shortLabel: "Thai Pediatric UTI",
    url: "https://www.thaipediatrics.org/700/",
    region: "THAI",
    sourceType: "topic-index",
    topics: ["uti", "acute-febrile-illness"],
    priority: 1,
    publisher: "Thai Pediatric Society",
    notes: "Index: pediatric UTI 2mo–5y.",
  },
  {
    id: "nice-head-injury-ct-1h",
    title: "Quality statement 1: CT head scans | Head injury | NICE",
    shortLabel: "NICE Head Injury CT",
    url: "https://www.nice.org.uk/guidance/qs74/chapter/Quality-statement-1-CT-head-scans",
    region: "INTL",
    sourceType: "direct-clinical-rule",
    topics: ["head-injury", "trauma"],
    priority: 10,
    notes: "INTL fallback for CT timing / risk factors.",
  },
  {
    id: "idsa-infectious-diarrhea-2017",
    title:
      "IDSA 2017 Clinical Practice Guidelines for the Diagnosis and Management of Infectious Diarrhea",
    shortLabel: "IDSA Infectious Diarrhea",
    url: "https://www.idsociety.org/practice-guideline/infectious-diarrhea/",
    region: "INTL",
    sourceType: "direct-clinical-rule",
    topics: ["diarrhea", "bloody-diarrhea", "dehydration", "sepsis"],
    priority: 10,
    sourceDate: "2017",
    publisher: "IDSA",
    notes: "INTL fallback: stool testing / selected antibiotic logic.",
  },
  {
    id: "uk-resus-anaphylaxis-2021",
    title: "Emergency treatment of anaphylaxis",
    shortLabel: "UK Resuscitation Council — Anaphylaxis",
    url: "https://www.resus.org.uk/resuscitation-guidelines/emergency-treatment-of-anaphylaxis/",
    region: "INTL",
    sourceType: "direct-clinical-rule",
    topics: ["anaphylaxis", "emergency-medicine"],
    priority: 2,
    sourceDate: "2021",
    publisher: "UK Resuscitation Council",
    notes: "Acute anaphylaxis treatment and adrenaline-first framing.",
  },
  {
    id: "acog-gestational-htn-preeclampsia-2019",
    title: "Gestational Hypertension and Preeclampsia (ACOG Clinical Practice Guideline)",
    shortLabel: "ACOG — Gestational HTN / preeclampsia",
    url: "https://www.acog.org/clinical/clinical-guidance/clinical-practice-guidelines/articles/2019/01/gestational-hypertension-and-preeclampsia-acog",
    region: "INTL",
    sourceType: "direct-clinical-rule",
    topics: ["obstetrics-gynecology"],
    priority: 2,
    sourceDate: "2019",
    notes: "Hypertensive disorders of pregnancy.",
  },
  {
    id: "who-postpartum-hemorrhage-2018",
    title: "WHO recommendations: Uterotonics for the prevention of postpartum haemorrhage",
    shortLabel: "WHO — Postpartum hemorrhage / uterotonics",
    url: "https://www.who.int/publications/i/item/9789241549521",
    region: "INTL",
    sourceType: "direct-clinical-rule",
    topics: ["obstetrics-gynecology"],
    priority: 2,
    sourceDate: "2018",
    notes: "PPH prevention and management context.",
  },
  {
    id: "rcog-green-top-63-antepartum-haemorrhage-2011",
    title: "Antepartum Haemorrhage (Green-top Guideline No. 63)",
    shortLabel: "RCOG — Antepartum haemorrhage (GTG 63)",
    url: "https://www.rcog.org.uk/guidance/browse-all-guidance/green-top-guidelines/antepartum-haemorrhage-triage-and-management-green-top-63/",
    region: "INTL",
    sourceType: "direct-clinical-rule",
    topics: ["obstetrics-gynecology"],
    priority: 2,
    sourceDate: "2011",
    notes: "APH triage and management.",
  },
  {
    id: "nice-ectopic-miscarriage-ng126",
    title: "Ectopic pregnancy and miscarriage: diagnosis and initial management (NG126)",
    shortLabel: "NICE — Ectopic pregnancy & miscarriage",
    url: "https://www.nice.org.uk/guidance/ng126",
    region: "INTL",
    sourceType: "direct-clinical-rule",
    topics: ["obstetrics-gynecology"],
    priority: 2,
    sourceDate: "2019",
    notes: "Early pregnancy pain/bleeding — initial management context.",
  },
  {
    id: "figo-abnormal-uterine-bleeding-2011",
    title: "FIGO classification / menstrual disorders (PALM-COEIN)",
    shortLabel: "FIGO — AUB / menstrual disorders",
    url: "https://www.figo.org/resources/figo-menstrual-disorders-dysmenorrhoea-menorrhagia-and-menorrhagia",
    region: "INTL",
    sourceType: "supporting-source",
    topics: ["obstetrics-gynecology"],
    priority: 3,
    sourceDate: "2011",
    publisher: "FIGO",
    notes: "Structured AUB classification and terminology.",
  },
  {
    id: "nice-sepsis-ng51-2016",
    title: "Sepsis: recognition, diagnosis and early management (NG51)",
    shortLabel: "NICE — Sepsis (NG51)",
    url: "https://www.nice.org.uk/guidance/ng51",
    region: "INTL",
    sourceType: "direct-clinical-rule",
    topics: ["sepsis", "emergency-medicine"],
    priority: 3,
    sourceDate: "2016",
    notes: "Adult sepsis recognition and early management (INTL fallback).",
  },
  {
    id: "who-poisoning-fact-sheet-2018",
    title: "Poisoning prevention and management",
    shortLabel: "WHO — Poisoning prevention & management",
    url: "https://www.who.int/news-room/fact-sheets/detail/poisoning-prevention-and-management",
    region: "INTL",
    sourceType: "direct-clinical-rule",
    topics: ["toxicology", "emergency-medicine"],
    priority: 2,
    sourceDate: "2018",
    publisher: "WHO",
    notes: "Official public-health framing for poisoning / tox context.",
  },
  {
    id: "ninds-nihss-stroke-scale",
    title: "NIH Stroke Scale (NIHSS)",
    shortLabel: "NINDS — NIHSS",
    url: "https://www.ninds.nih.gov/sites/default/files/documents/NIH_Stroke_Scale_508C.pdf",
    region: "INTL",
    sourceType: "direct-clinical-rule",
    topics: ["stroke", "emergency-medicine"],
    priority: 1,
    sourceDate: "NINDS",
    publisher: "NINDS/NIH",
    notes: "Standardized stroke severity scoring (structured items).",
  },
  {
    id: "esc-chads2-vasc-af-2024",
    title: "Atrial fibrillation — stroke risk (CHA₂DS₂-VASc context)",
    shortLabel: "ESC — AF / CHA₂DS₂-VASc",
    url: "https://www.escardio.org/Guidelines/Clinical-Practice-Guidelines/Atrial-Fibrillation-Management-of",
    region: "INTL",
    sourceType: "direct-clinical-rule",
    topics: ["cardiology", "emergency-medicine"],
    priority: 2,
    sourceDate: "2024",
    publisher: "ESC",
    notes: "Anticoagulation decision support uses CHA₂DS₂-VASc with bleeding risk and patient factors.",
  },
  {
    id: "alvarado-appendicitis-1986",
    title: "Alvarado score for acute appendicitis",
    shortLabel: "Alvarado — appendicitis risk",
    url: "https://pubmed.ncbi.nlm.nih.gov/3485230/",
    region: "INTL",
    sourceType: "supporting-source",
    topics: ["abdomen", "emergency-medicine"],
    priority: 2,
    sourceDate: "1986",
    notes: "Classic clinical prediction rule; imaging pathways vary by setting.",
  },
  {
    id: "gina-act-asthma-control",
    title: "Asthma control — ACT-style questionnaire (GINA context)",
    shortLabel: "GINA — asthma control (ACT)",
    url: "https://ginasthma.org/",
    region: "INTL",
    sourceType: "direct-clinical-rule",
    topics: ["asthma", "emergency-medicine"],
    priority: 2,
    sourceDate: "GINA",
    publisher: "GINA",
    notes: "5-item ACT sum 5–25; interpret with exacerbations and lung function when available.",
  },
  {
    id: "gold-cat-mmrc-copd",
    title: "COPD assessment — CAT and mMRC (GOLD)",
    shortLabel: "GOLD — CAT / mMRC",
    url: "https://goldcopd.org/",
    region: "INTL",
    sourceType: "direct-clinical-rule",
    topics: ["copd", "emergency-medicine", "wheeze"],
    priority: 2,
    sourceDate: "GOLD",
    publisher: "GOLD",
    notes: "Symptom burden (CAT) and dyspnea (mMRC) with exacerbation history for GOLD grouping.",
  },
  {
    id: "tg18-acute-cholecystitis-severity",
    title: "Tokyo Guidelines — acute cholecystitis (severity / management)",
    shortLabel: "TG18 — acute cholecystitis",
    url: "https://www.jshbps.jp/modules/en/index.php?content_id=47",
    region: "INTL",
    sourceType: "direct-clinical-rule",
    topics: ["abdomen", "emergency-medicine"],
    priority: 2,
    sourceDate: "2018",
    notes: "TG18 severity grades; UI uses a simplified deterministic screen — follow full criteria in source.",
  },
];

export const referenceMap = Object.fromEntries(
  referenceCatalog.map((ref) => [ref.id, ref])
);

export function getReferencesByTopic(topic: ReferenceTopic) {
  return referenceCatalog
    .filter((ref) => ref.topics.includes(topic))
    .sort((a, b) => a.priority - b.priority);
}

export function getReferencesByIds(ids: string[]) {
  const seen = new Set<string>();
  const out: ReferenceSource[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const r = referenceMap[id];
    if (r) out.push(r);
  }
  return out.sort((a, b) => {
    if (a.region !== b.region) return a.region === "THAI" ? -1 : 1;
    return a.priority - b.priority;
  });
}
