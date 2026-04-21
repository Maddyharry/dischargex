/**
 * Thai OPD — antibiotic stewardship / RDU overlay (physician-facing; audit-friendly).
 * Rule layer: classifies support for antibacterial use; does not replace clinical judgment.
 */
import { anyNonNegatedRegexMatch, hasAnyKeywordNonNegated, scoreKeysNegationAware } from "./clinicalNegation";

/** Support level for antibacterial prescription narrative — one primary label */
export type AntibioticSupportLevel =
  | "evidence_weak_for_antibiotic"
  | "evidence_incomplete"
  | "bacterial_features_partially_supportive"
  | "severe_complicated_pattern";

const RDU_ACTIVATION_KEYS = [
  "antibiotic",
  "antibiotics",
  "abx",
  "amoxicillin",
  "amox-clav",
  "augmentin",
  "azithromycin",
  "cefalexin",
  "cephalexin",
  "ceftriaxone",
  "ciprofloxacin",
  "clindamycin",
  "clarithromycin",
  "doxycycline",
  "levofloxacin",
  "metronidazole",
  "nitrofurantoin",
  "penicillin",
  "trimethoprim",
  "tmp-smx",
  "cotrimoxazole",
  "ยาปฏิชีวนะ",
  "ยาฆ่าเชื้อ",
  "ฆ่าเชื้อ",
  "เชื้อแบคทีเรีย",
  "cellulitis",
  "abscess",
  "purulent",
  "exudate",
  "exudative",
  "tonsillitis",
  "pharyngitis",
  "pneumonia",
  "bronchitis",
  "sinusitis",
  "otitis",
  "uti",
  "cystitis",
  "pyelonephritis",
  "dysuria",
  "ปอดอักเสบ",
  "หูอักเสบ",
  "ไซนัส",
  "ทอนซิล",
  "ฝี",
  "หนอง",
  "ผิวหนังอักเสบ",
  "ไข้",
  "fever",
  "cough",
  "ไอ",
  "เจ็บคอ",
];

const SEVERE_COMPLICATED_KEYS = [
  "septic shock",
  "sepsis",
  "hypotension",
  "map ",
  "sbp ",
  "altered mental",
  "confusion",
  "gcs ",
  "respiratory failure",
  "intubat",
  "icu",
  "bilateral infiltrate",
  "multilobar",
  "necrotizing fasciitis",
  "meningitis",
  "endocarditis",
  "epiglottitis",
  "ludwig",
  "retropharyngeal abscess",
  "peritonsillar abscess",
  "quinsy",
  "toxic appearance",
  "ไม่รู้สึกตัว",
  "ช็อก",
  "ช็อค",
  "วิกฤต",
  "hypoxemia",
  "hypoxaemia",
  "spo2 8",
  "spo2 7",
  "spo2 6",
  "oxygen saturation 8",
  "severe pneumonia",
  "severe cap",
];

const BACTERIAL_SUPPORT_KEYS = [
  "purulent",
  "purulence",
  "pus",
  "exudate",
  "exudative",
  "tonsillar exudate",
  "focal crackles",
  "egophony",
  "dullness to percussion",
  "lobar",
  "consolidation",
  "warmth",
  "spreading erythema",
  "fluctuance",
  "positive culture",
  "bacteremia",
  "pyuria",
  "nitrite positive",
  "leukocyte esterase",
  "leukocytosis",
  "left shift",
  "bandemia",
  "cva tenderness",
  "costovertebral",
  "mastoid tenderness",
  "bulging tympanic",
  "acute otitis media",
  "หนอง",
  "ฝีมีหนอง",
  "กดเจ็บกระจาย",
  "คราบหนอง",
  "เสมหะเขียว",
  "เสมหะสี",
];

const VIRAL_OR_NONBACTERIAL_WEAK_KEYS = [
  "viral uri",
  "viral illness",
  "common cold",
  "upper respiratory infection",
  "rhinorrhea",
  "clear rhinorrhea",
  "watery discharge",
  "no exudate",
  "no tonsillar exudate",
  "no purulence",
  "nonproductive cough",
  "myalgia without",
  "influenza-like",
  "ไม่มีหนอง",
  "น้ำมูกใส",
  "ไม่มีคราบ",
  "หวัดธรรมดา",
];

export type AntibioticRduOverlay =
  | { active: false }
  | {
      active: true;
      supportLevel: AntibioticSupportLevel;
      /** Why evidence is weak, incomplete, partially supportive, or severe */
      evidenceRationale: string[];
      askNext: string[];
      examNext: string[];
      /** Labs/imaging that would strengthen bacterial diagnosis */
      testsToStrengthenBacterial: string[];
      /** More likely non-bacterial / non-antibiotic-indicated diagnosis at present */
      alternativeNonAntibioticLikely: string[];
      /** Gaps to address before antibacterial use is well-supported — audit-oriented */
      missingBeforeAntibioticConsideration: string[];
      /** Conditional stewardship lines (if X then Y more supportable) */
      conditionalSupportExamples: string[];
      stewardshipRules: string[];
      outputStyleHints: string[];
    };

export function detectAntibioticRduOverlayActive(normalizedText: string): boolean {
  return scoreKeysNegationAware(normalizedText, RDU_ACTIVATION_KEYS) >= 1;
}

function levelLabelTh(level: AntibioticSupportLevel): string {
  switch (level) {
    case "evidence_weak_for_antibiotic":
      return "ระดับหลักฐาน: อ่อน — ยาปฏิชีวนะไม่มีข้อบ่งชี้ชัดจากข้อมูลปัจจุบัน";
    case "evidence_incomplete":
      return "ระดับหลักฐาน: ยังไม่ครบ — ต้องเสริมประวัติ/ตรวจร่างกาย/ผลเสริมก่อนตัดสินใจยา";
    case "bacterial_features_partially_supportive":
      return "ระดับหลักฐาน: มีบาง features ที่สอดคล้องการติดเชื้อแบคทีเรีย — ชี้ขาดตามบริบท";
    case "severe_complicated_pattern":
      return "ระดับหลักฐาน: รูปแบบรุนแรง/ซับซ้อน — จัดลำดับความเร่งด่วนและ pathway พิเศษ";
    default:
      return "";
  }
}

function classifyLevel(t: string): AntibioticSupportLevel {
  const severe = scoreKeysNegationAware(t, SEVERE_COMPLICATED_KEYS) + (anyNonNegatedRegexMatch(t, /\bspo2\s*<?\s*9[0-2]\b/i) ? 2 : 0);
  const bacterial = scoreKeysNegationAware(t, BACTERIAL_SUPPORT_KEYS);
  const viralWeak = scoreKeysNegationAware(t, VIRAL_OR_NONBACTERIAL_WEAK_KEYS);

  if (severe >= 2 || anyNonNegatedRegexMatch(t, /\bseptic\b|\bsepsis\b|ช็อก|วิกฤต/i)) {
    return "severe_complicated_pattern";
  }
  if (bacterial >= 2 && viralWeak <= 1) {
    return "bacterial_features_partially_supportive";
  }
  if (viralWeak >= 2 && bacterial <= 1) {
    return "evidence_weak_for_antibiotic";
  }
  if (bacterial >= 1 && viralWeak >= 2) {
    return "evidence_incomplete";
  }
  if (bacterial === 0 && viralWeak === 0 && scoreKeysNegationAware(t, RDU_ACTIVATION_KEYS) >= 1) {
    return "evidence_incomplete";
  }
  if (viralWeak >= 1) {
    return "evidence_weak_for_antibiotic";
  }
  return "evidence_incomplete";
}

function buildMissingBeforeAntibioticConsideration(level: AntibioticSupportLevel): string[] {
  const examAndSource = [
    "Site-specific exam — focal findings (lung, pharynx, skin/soft tissue, joint, urine) ยังไม่ครบหรือยังไม่ได้บันทึก",
    "Vital signs และ toxicity / stability — ก่อนตัดสินใจยา",
  ];
  const labsDirected = [
    "Directed labs or imaging — ถ้าผลจะเปลี่ยนการให้ยา (เช่น CXR, urinalysis, rapid strep, procalcitonin ตาม protocol)",
  ];
  switch (level) {
    case "evidence_weak_for_antibiotic":
      return [
        ...examAndSource,
        "Features ที่สนับสนุนแบคทีเรีย (exudate, focal crackles, purulence, UTI dipstick) — ยังไม่ชัดก่อนพิจารณา abx",
        "ทางเลือก non-bacterial ที่สมเหตุ — ต้องแยกก่อนให้ยา",
        ...labsDirected,
      ];
    case "evidence_incomplete":
      return [
        ...examAndSource,
        "Serial reassessment — viral vs bacterial overlap",
        ...labsDirected,
      ];
    case "bacterial_features_partially_supportive":
      return [
        "ยืนยันแหล่งติดเชื้อ / spectrum — ก่อนกำหนดยาและระยะ",
        "กฎ stewardship และ follow-up culture ตามชี้",
        ...labsDirected,
      ];
    case "severe_complicated_pattern":
      return [
        "Source control / resuscitation — ตาม protocol; ไม่ delay ที่จำเป็น",
        "Microbiology และ imaging — ตามภาวะรุนแรง",
        "บันทึก indication และ duration ของ abx",
      ];
    default:
      return [...examAndSource, ...labsDirected];
  }
}

const ASK_NEXT_TH: string[] = [
  "ระยะเวลาและกำเริบของอาการ — เทียบกับกลุ่มไวรัสสัมพันธ์",
  "ไข้สูงสุด / รูปแบบไข้ — ต่อเนื่อง vs หายเป็นพัก",
  "หายใจลำบาก / ซีด / กินน้ำได้ — เด็กและผู้สูงอายุ",
  "ปัสสาวะ / สี / dysuria / flank — ถ้าสงสัย UTI",
  "ผื่น / รอยแดง / หนอง / แผล — ถ้าสงสัย soft tissue",
  "เจ็บคอ / กลืน / เสมหะ — ถ้าโฟกัส ENT",
  "ประวัติแพ้ยา / ยาปฏิชีวนะล่าสุด / การตอบสนอง",
];

const EXAM_NEXT_TH: string[] = [
  "Vital signs — T, HR, RR, BP, SpO₂ (ระบุ room air vs O₂)",
  "ทรงการหายใจ / work of breathing / retraction",
  "ฟังปอด — symmetrical vs focal crackles / wheeze / diminished air",
  "ตรวจคอ — tonsil, exudate, uvula, drooling, trismus",
  "ผิวหนัง — ร้อยั่ว, ขอบเขต erythema, fluctuance, lymphangitic streaking",
  "ถ้า GU — CVA tenderness, suprapubic",
  "ถ้าเด็ก — perfusion, CRT, activity, hydration",
];

const TESTS_TH: string[] = [
  "CBC / differential — leukocytosis, left shift (ถ้ายังไม่มี)",
  "Procalcitonin / CRP — ตาม protocol และบริบท (ไม่ใช่เกณฑ์เดียว)",
  "CXR — focal infiltrate, effusion, multilobar (เมื่อสงสัยปอด)",
  "Urine dipstick / microscopy / culture — เมื่อสงสัย UTI",
  "Rapid strep / throat culture — เมื่อสงสัย bacterial pharyngitis ตามเกณฑ์",
  "Blood culture — เมื่อมีภาวะระบบรุนแรงตาม protocol",
  "Ultrasound / aspiration — abscess vs cellulitis เมื่อสงสัย collection",
];

const ALTERNATIVE_TH: Record<AntibioticSupportLevel, string[]> = {
  evidence_weak_for_antibiotic: [
    "Viral URI / common cold / ILI — เป็นค่าเริ่มต้นที่สมเหตุเมื่อไม่มี focal bacterial features",
    "Allergic rhinitis / vasomotor — ถ้าโฟกัสน้ำมูก/คัดเป็นหลัก",
    "Bronchospasm / reactive airway — ถ้า wheeze เด่นแต่ไม่มีรอยโรคปอดอักเสบ",
  ],
  evidence_incomplete: [
    "ยังไม่สามารถแยก viral vs bacterial ได้จากข้อมูลที่มี — ต้องเติม exam/labs",
    "อาจเป็น self-limited viral illness — หากสัญญาณระบบดี",
  ],
  bacterial_features_partially_supportive: [
    "ยังมี DDx ไวรัสหรือ non-bacterial แข่ง — ยืนยันด้วย exam/ผลตรวจก่อนยืนยันการให้ยา",
    "Early bacterial vs viral overlap — ใช้ serial exam เมื่ออาการกำลังเปลี่ยน",
  ],
  severe_complicated_pattern: [
    "Non-infectious mimics (เช่น inflammatory, embolic) ยังเป็นไปได้ — แต่ไม่ลดความเร่งด่วนของการประเมิน",
  ],
};

const CONDITIONAL_TH: string[] = [
  "หากพบ focal crackles + hypoxemia และ/หรือ tachypnea ตามเกณฑ์ — pneumonia สนับสนุนมากขึ้น; บันทึก SpO₂/RR และ rationale การใช้ยา",
  "หากมี purulence / spreading erythema / warmth + tenderness ชัด — bacterial skin/soft tissue infection สนับสนุนมากขึ้น; ทำแผนผ่าตัด/ imaging ตามชี้",
  "หาก tonsillitis มี exudate พร้อม features สนับสนุนแบคทีเรีย (ตาม clinical score / rapid test) — bacterial pharyngitis สนับสนุนมากขึ้น",
  "หาก dysuria + pyuria / nitrite ชัด — lower UTI สนับสนุนมากขึ้น; culture ตาม protocol",
];

const RULES_TH: string[] = [
  "ไม่แนะนำยาปฏิชีวนะเป็น default สำหรับกลุ่มไวรัสทั่วไป (เช่น URI ไม่มี bacterial features)",
  "ห้ามเปลี่ยน diagnosis เพื่อให้สอดคล้องการให้ยาปฏิชีวนะ — ให้สอดคล้องหลักฐานทางคลินิก",
  "หากหลักฐานยังอ่อน — เน้น symptomatic care, safety-net, follow-up และ serial exam",
  "การให้ยาปฏิชีวนะต้องอธิบาย rationale, spectrum, และ duration ตามแนวทาง stewardship",
];

const STYLE_TH: string[] = [
  "สั้น กระชับ ภาษาแพทย์ — ไม่ใช่คำอธิบายผู้ป่วยแบบย่อส่วนเกินไป",
  "audit-friendly: ระบุระดับหลักฐานและสิ่งที่ยังขาด",
  "ไม่สั่งยาแทนผู้ประเมิน — เป็น overlay ช่วยคิด",
];

function buildRationaleForLevel(level: AntibioticSupportLevel, t: string): string[] {
  const lines: string[] = [levelLabelTh(level)];
  switch (level) {
    case "severe_complicated_pattern":
      lines.push("มีคำบ่งหรือรูปแบบที่อาจบ่งชี้ภาวะรุนแรง/ซับซ้อน — จัด disposition และ workup ตาม protocol");
      break;
    case "bacterial_features_partially_supportive":
      lines.push("พบคำบ่งทางคลินิกที่สอดคล้องการติดเชื้อแบคทีเรียบางส่วน — ยังต้องยืนยันด้วยบริบทและเกณฑ์ท้องถิ่น");
      break;
    case "evidence_weak_for_antibiotic":
      lines.push("รูปแบบใกล้เคียงกลุ่มไวรัสหรือไม่มี focal bacterial features จากข้อความ — ยาปฏิชีวนะไม่ใช่ default");
      break;
    default:
      lines.push("ข้อมูลในข้อความยังไม่ครบสำหรับการยืนยันการติดเชื้อแบคทีเรีย — ต้องเติมประวัติ/ตรวจ/ผล");
  }
  if (hasAnyKeywordNonNegated(t, ["antibiotic", "amoxicillin", "ยาปฏิชีวนะ", "ฆ่าเชื้อ"])) {
    lines.push("มีการกล่าวถึงยาปฏิชีวนะในข้อความ — ตรวจสอบให้สอดคล้องระดับหลักฐานข้างต้น");
  }
  return lines.slice(0, 10);
}

export function buildAntibioticRduOverlay(normalizedText: string): AntibioticRduOverlay {
  if (!detectAntibioticRduOverlayActive(normalizedText)) {
    return { active: false };
  }
  const t = normalizedText;
  const supportLevel = classifyLevel(t);
  return {
    active: true,
    supportLevel,
    evidenceRationale: buildRationaleForLevel(supportLevel, t),
    askNext: [...ASK_NEXT_TH],
    examNext: [...EXAM_NEXT_TH],
    testsToStrengthenBacterial: [...TESTS_TH],
    alternativeNonAntibioticLikely: [...ALTERNATIVE_TH[supportLevel]],
    missingBeforeAntibioticConsideration: buildMissingBeforeAntibioticConsideration(supportLevel),
    conditionalSupportExamples: [...CONDITIONAL_TH],
    stewardshipRules: [...RULES_TH],
    outputStyleHints: [...STYLE_TH],
  };
}

export function formatAntibioticRduOverlayForAi(o: AntibioticRduOverlay): string {
  if (!o.active) return "(ANTIBIOTIC_RDU_OVERLAY inactive)";
  return [
    "=== THAI ANTIBIOTIC STEWARDSHIP / RDU OVERLAY (rule) ===",
    `supportLevel: ${o.supportLevel}`,
    "",
    "Evidence rationale:",
    ...o.evidenceRationale.map((x) => `- ${x}`),
    "",
    "Ask next:",
    ...o.askNext.map((x) => `- ${x}`),
    "",
    "Examine next:",
    ...o.examNext.map((x) => `- ${x}`),
    "",
    "Tests / results that would strengthen bacterial diagnosis:",
    ...o.testsToStrengthenBacterial.map((x) => `- ${x}`),
    "",
    "Alternative non-antibiotic diagnosis more likely at present:",
    ...o.alternativeNonAntibioticLikely.map((x) => `- ${x}`),
    "",
    "Missing before antibiotic consideration (gaps to address):",
    ...o.missingBeforeAntibioticConsideration.map((x) => `- ${x}`),
    "",
    "Conditional support (if findings emerge):",
    ...o.conditionalSupportExamples.map((x) => `- ${x}`),
    "",
    "Stewardship rules:",
    ...o.stewardshipRules.map((x) => `- ${x}`),
    "",
    "Output style:",
    ...o.outputStyleHints.map((x) => `- ${x}`),
  ].join("\n");
}
