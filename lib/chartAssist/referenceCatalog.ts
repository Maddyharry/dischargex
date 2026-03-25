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
  | "general-pediatrics";

export type ReferenceSource = {
  id: string;
  title: string;
  shortLabel: string;
  url: string;
  region: ReferenceRegion;
  sourceType: ReferenceSourceType;
  topics: ReferenceTopic[];
  priority: number;
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
    notes: "INTL fallback: stool testing / selected antibiotic logic.",
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
