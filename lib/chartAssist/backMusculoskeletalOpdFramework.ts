/**
 * OPD Assist — back / neck / MSK pain (neurologic & systemic red flags).
 */
import { anyNonNegatedRegexMatch, hasAnyKeywordNonNegated, scoreKeysNegationAware } from "./clinicalNegation";

/** Activation — negation-aware; prefer multi-word phrases over bare "strain" */
export const BACK_MSK_DETECTION_KEYS = [
  "back pain",
  "low back pain",
  "lumbar pain",
  "lumbago",
  "mechanical back pain",
  "neck pain",
  "cervical pain",
  "cervicalgia",
  "shoulder pain",
  "rotator cuff",
  "muscle pain",
  "myalgia",
  "myofascial",
  "joint pain",
  "arthralgia",
  "sprain",
  "muscle strain",
  "lumbar strain",
  "cervical strain",
  "radicular",
  "radiculopathy",
  "sciatica",
  "nerve root",
  "slr",
  "straight leg raise",
  "herniated disc",
  "disc herniation",
  "prolapsed disc",
  "stenosis",
  "spondylosis",
  "spondylolisthesis",
  "facet joint",
  "whiplash",
  "ปวดหลัง",
  "ปวดเอว",
  "ปวดคอ",
  "ปวดไหล่",
  "ปวดกล้ามเนื้อ",
  "ปวดข้อ",
  "หมอนรองกระดูก",
  "หมอนรอง",
  "หัวเข่าเจ็บ",
  "ข้อเข่าเจ็บ",
  "musculoskeletal pain",
  "msk pain",
  "orthopedic",
  "lifting injury",
  "lifted heavy",
  "after lifting",
];

const TRAUMA_MECHANISM_KEYS = [
  "trauma",
  "fall",
  "fell",
  "mva",
  "rta",
  "motor vehicle",
  "accident",
  "blunt",
  "crush",
  "lifting",
  "lifted",
  "sports injury",
  "injury",
  "อุบัติเหตุ",
  "ล้ม",
  "ชน",
  "ยกของ",
];

const MIDLINE_BONY_TENDERNESS_KEYS = [
  "midline tenderness",
  "spinal tenderness",
  "bony tenderness",
  "vertebral tenderness",
  "spinous tenderness",
  "step-off",
  "step off",
  "deformity",
  "กดเจ็บกระดูกสันหลัง",
  "กดเจ็บแนวกลาง",
];

const CAUDA_NEURO_EMERGENCY_KEYS = [
  "bowel incontinence",
  "bladder incontinence",
  "urinary retention",
  "retention of urine",
  "unable to urinate",
  "saddle anesthesia",
  "saddle numbness",
  "perianal numbness",
  "cauda equina",
  "cauda equina syndrome",
  "bilateral leg weakness",
  "กลั้นปัสสาวะไม่ได้",
  "ถ่ายไม่ออก",
  "อุจจาระไม่ออก",
  "ชาบริเวณนั่ง",
];

const FEVER_KEYS = ["fever", "febrile", "pyrexia", "ไข้", "มีไข้"];

const MSK_CONTEXT_FOR_INFECTION = [
  "back pain",
  "low back",
  "lumbar",
  "spine",
  "spinal",
  "neck pain",
  "cervical",
  "epidural",
  "vertebral",
  "discitis",
  "osteomyelitis",
  "ปวดหลัง",
  "ปวดคอ",
  "กระดูกสันหลัง",
];

export type BackMusculoskeletalOpdFramework =
  | {
      active: true;
      factsAlreadyPresent: string[];
      askNext: string[];
      examNext: string[];
      importantNegatives: string[];
      differentialExamples: string[];
      reasoningRules: string[];
      outputStyleHints: string[];
      /** Bowel/bladder dysfunction or saddle anesthesia — urgent / ER pathway */
      urgentCaudaOrNeuroEmergency: boolean;
      /** Fever with back/spine context — consider spinal / systemic infection pathway */
      infectionConsideration: boolean;
      /** Trauma mechanism + midline/bony tenderness — trauma / imaging pathway */
      traumaImagingConsideration: boolean;
    }
  | { active: false };

const HISTORY_TH: string[] = [
  "location — axial vs limb; radiation pattern",
  "onset & duration — acute vs chronic; constant vs intermittent",
  "trauma / lifting / posture / ergonomics trigger",
  "movement-related pain — flexion/extension/rotation",
  "radiation — dermatomal vs non-specific",
  "numbness / weakness / foot drop",
  "gait difficulty",
  "fever / chills",
  "bowel / bladder dysfunction",
  "saddle anesthesia / perianal sensory change",
  "night pain / rest pain / unintended weight loss / cancer history",
  "steroid use / osteoporosis risk / anticoagulation",
  "urinary symptoms / flank pain — if renal or alternative cause possible",
  "prior meds — NSAIDs, muscle relaxants, PT response",
];

const EXAM_TH: string[] = [
  "Vital signs",
  "Gait and posture — antalgic gait, Trendelenburg if hip",
  "Focal vs midline tenderness — spinous processes",
  "ROM — neck / lumbar / shoulder as indicated",
  "Motor strength by myotome — bilateral comparison",
  "Sensory light touch / pin — dermatomes",
  "Reflexes — DTRs; pathologic reflexes if indicated",
  "SLR / crossed SLR — if radicular / sciatica pattern",
  "Deformity / bruising / swelling — if trauma",
  "CVA tenderness — if flank / renal alternative",
  "Focused abdominal exam — if referred visceral pain possible",
  "Hip exam — FABER / internal rotation — if referred hip pain possible",
];

const IMPORTANT_NEGATIVES_TH: string[] = [
  "ไม่มี weakness — ให้บันทึกเมื่อตรวจแล้วไม่มี",
  "ไม่มี sensory deficit — ให้บันทึกเมื่อไม่มี",
  "ไม่มี bowel/bladder dysfunction — ให้บันทึกเมื่อไม่มี",
  "ไม่มี saddle anesthesia — ให้บันทึกเมื่อไม่มี",
  "ไม่มี fever — ให้บันทึกเมื่อไม่มี",
  "ไม่มี trauma — ให้บันทึกเมื่อไม่มี",
  "ไม่มี midline bony tenderness — ให้บันทึกเมื่อไม่มี",
  "ไม่มี night pain / weight loss — ให้บันทึกเมื่อไม่มี",
  "ไม่มี gait instability — ให้บันทึกเมื่อไม่มี",
];

const DIFFERENTIAL_TH: string[] = [
  "Mechanical low back / neck pain",
  "Muscle strain / myofascial pain",
  "Radiculopathy / sciatica — when radiation + neuro exam matches",
  "Vertebral fracture — especially trauma, steroid, osteoporosis",
  "Spinal infection / discitis / epidural abscess — if fever + spine symptoms",
  "Cauda equina syndrome — if bowel/bladder/saddle",
  "Renal colic / flank pain — if urinary or CVA cues",
  "Referred abdominal / pelvic / hip pathology",
];

const REASONING_RULES_TH: string[] = [
  "จัดลำดับ red flags ก่อน mechanical diagnosis",
  "Bowel/bladder dysfunction หรือ saddle anesthesia — urgent / ER pathway; ไม่จัดการแบบ OPD อย่างเดียว",
  "Fever + back pain — พิจารณา infection path (รวมถึง spinal) ตามชี้",
  "Trauma + midline bony tenderness / deformity — trauma/imaging pathway ตามแนวทาง",
  "ห้าม overcall radiculopathy ถ้าไม่มีอาการ radiating หรือ neurologic exam สอดคล้อง",
];

const OUTPUT_STYLE_TH: string[] = [
  "ระบุ distribution, neuro exam, และ pertinent negatives ที่ตรวจแล้ว",
  "ไม่สรุป diagnosis รุนแรงจาก keyword อย่างเดียว — สอดคล้องกับ PE",
];

function hasFeverCue(t: string): boolean {
  if (/\bafebrile\b/i.test(t)) return false;
  return hasAnyKeywordNonNegated(t, FEVER_KEYS) || anyNonNegatedRegexMatch(t, /\bfever\b/i);
}

function detectUrgentCauda(t: string): boolean {
  return hasAnyKeywordNonNegated(t, CAUDA_NEURO_EMERGENCY_KEYS);
}

function detectInfectionConsideration(t: string): boolean {
  if (!hasFeverCue(t)) return false;
  /** Fever + axial/spine context — not isolated peripheral joint alone */
  return hasAnyKeywordNonNegated(t, MSK_CONTEXT_FOR_INFECTION);
}

function detectTraumaImagingPathway(t: string): boolean {
  const trauma = hasAnyKeywordNonNegated(t, TRAUMA_MECHANISM_KEYS);
  const bony = hasAnyKeywordNonNegated(t, MIDLINE_BONY_TENDERNESS_KEYS);
  return trauma && bony;
}

export function detectBackMusculoskeletalFrameworkActive(normalizedText: string): boolean {
  return scoreKeysNegationAware(normalizedText, BACK_MSK_DETECTION_KEYS) >= 1;
}

function extractFacts(t: string): string[] {
  const out: string[] = [];
  const add = (cond: boolean, line: string) => {
    if (cond) out.push(line);
  };
  add(anyNonNegatedRegexMatch(t, /back pain|lumbar|lbp|ปวดหลัง|ปวดเอว/i), "มีการกล่าวถึง back / lumbar pain");
  add(anyNonNegatedRegexMatch(t, /neck pain|cervical|ปวดคอ/i), "มีการกล่าวถึง neck / cervical pain");
  add(anyNonNegatedRegexMatch(t, /shoulder pain|rotator|ปวดไหล่/i), "มีการกล่าวถึง shoulder pain");
  add(anyNonNegatedRegexMatch(t, /joint pain|arthralgia|ปวดข้อ/i), "มีการกล่าวถึง joint pain");
  add(anyNonNegatedRegexMatch(t, /muscle pain|myalgia|myofascial|sprain|muscle strain/i), "มีการกล่าวถึง muscle / strain / sprain");
  add(anyNonNegatedRegexMatch(t, /radicular|radiculopathy|sciatica|slr|straight leg/i), "มีการกล่าวถึง radicular / sciatica pattern");
  add(anyNonNegatedRegexMatch(t, /trauma|fall|mva|lifting|injury|อุบัติเหตุ|ล้ม|ยกของ/i), "มี trauma / mechanism / lifting context");
  if (out.length === 0) {
    out.push("มีคีย์เวิร์ด MSK — เก็บ location, neuro exam, red flags");
  }
  return out.slice(0, 14);
}

export function buildBackMusculoskeletalOpdFramework(normalizedText: string): BackMusculoskeletalOpdFramework {
  if (!detectBackMusculoskeletalFrameworkActive(normalizedText)) {
    return { active: false };
  }

  const t = normalizedText;
  const urgentCaudaOrNeuroEmergency = detectUrgentCauda(t);
  const infectionConsideration = detectInfectionConsideration(t);
  const traumaImagingConsideration = detectTraumaImagingPathway(t);

  const facts = extractFacts(t);
  if (urgentCaudaOrNeuroEmergency) facts.unshift("มีคำบ่ง cauda / bowel-bladder / saddle — เร่งด่วน");
  if (infectionConsideration) facts.push("มี fever + บริบทกระดูกสันหลัง/ปวดหลัง — พิจารณา infection");
  if (traumaImagingConsideration) facts.push("มี trauma + midline/bony tenderness — พิจารณา imaging pathway");

  return {
    active: true,
    factsAlreadyPresent: facts.slice(0, 16),
    askNext: [...HISTORY_TH],
    examNext: [...EXAM_TH],
    importantNegatives: [...IMPORTANT_NEGATIVES_TH],
    differentialExamples: [...DIFFERENTIAL_TH],
    reasoningRules: [...REASONING_RULES_TH],
    outputStyleHints: [...OUTPUT_STYLE_TH],
    urgentCaudaOrNeuroEmergency,
    infectionConsideration,
    traumaImagingConsideration,
  };
}

export function formatBackMusculoskeletalFrameworkForAi(f: BackMusculoskeletalOpdFramework): string {
  if (!f.active) return "(BACK_MSK_FRAMEWORK inactive)";
  const lines = [
    "=== BACK / NECK / MSK PAIN (OPD) ===",
    f.urgentCaudaOrNeuroEmergency
      ? "URGENT: bowel/bladder dysfunction or saddle anesthesia — ER / neurosurgical pathway; do not treat as benign strain alone."
      : "",
    f.infectionConsideration ? "Consider spinal/systemic infection pathway: fever + spine/MSK symptoms — disposition per protocol." : "",
    f.traumaImagingConsideration
      ? "Trauma + midline bony tenderness — trauma/imaging pathway; document mechanism and exam."
      : "",
    "",
    "Facts already present:",
    ...f.factsAlreadyPresent.map((x) => `- ${x}`),
    "",
    "Ask next (history):",
    ...f.askNext.map((x) => `- ${x}`),
    "",
    "Examine next:",
    ...f.examNext.map((x) => `- ${x}`),
    "",
    "Important negatives to document if absent:",
    ...f.importantNegatives.map((x) => `- ${x}`),
    "",
    "Differential examples:",
    ...f.differentialExamples.map((x) => `- ${x}`),
    "",
    "Reasoning rules:",
    ...f.reasoningRules.map((x) => `- ${x}`),
    "",
    "Output style:",
    ...f.outputStyleHints.map((x) => `- ${x}`),
  ].filter((line) => line !== "");
  return lines.join("\n");
}
