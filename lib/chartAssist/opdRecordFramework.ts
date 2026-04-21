import type { AssistCardResult, AssistMode, DominantTheme, SafetySweep } from "./cardTypes";
import {
  type CaseClinicalProfile,
  computeScabiesClusterSignals,
  getSystemKeywordScores,
} from "./caseClinicalProfile";
import { anyNonNegatedRegexMatch } from "./clinicalNegation";
import {
  buildConciseCC,
  buildTimelinePI,
  extractPeFindingsFromNormalizedText,
  extractPeVerbatimFromRaw,
} from "./clinicalTextExtract";
import { uniq } from "./cardTypes";
import {
  EXAM_FOCUS_NEXT,
  HISTORY_ASK_NEXT,
  NEGATIVE_TEMPLATES,
  type ProblemSystem,
} from "./opdProblemPrompts";
import type { AssistantBundle, StructuredOpdNote } from "./structuredNote";

export type { ProblemSystem } from "./opdProblemPrompts";

/** Stable id สำหรับ drag-reorder */
export type ClinicalProblemId = string;

export type MinimumOpdRecord = {
  cc: string;
  pi: string;
  drugAllergy: string;
  pastHistoryAndMeds: string;
  vitalSigns: string;
  physicalExamSignificant: string;
  problemListOrDx: string;
  treatmentAndMeds: string;
  adviceFollowUp: string;
};

export type ProblemBlock = {
  id: ClinicalProblemId;
  system: ProblemSystem;
  /** ลำดับหลัง applyProblemOrder — อันแรก = primary */
  orderIndex: number;
  summaryLine: string;
  historyAskNext: string[];
  examFocusNext: string[];
  pertinentPositives: string[];
  pertinentNegativesToDocument: string[];
  assessment?: string;
  diagnosis?: string;
  differential?: string;
  plan?: string;
};

export type OpdFramework = {
  layer1: MinimumOpdRecord;
  layer2: ProblemBlock[];
};

const PE_HINT_RE =
  /rr|spo2|spo|lung|breath|auscult|rhonchi|wheeze|crackles|retraction|vital|pe\b|exam|pupil|gcs|skin|joint|abdomen|neurovascular|fluctuance|crt|capillary|bp|hr|perfusion|mental status|urine|feeding|work of breathing|mental|spO|oxygen|clear lung/i;

function splitMissingForPiPe(missing: string[]): { pi: string[]; pe: string[] } {
  const pi: string[] = [];
  const pe: string[] = [];
  for (const m of missing) {
    if (PE_HINT_RE.test(m)) pe.push(m);
    else pi.push(m);
  }
  return { pi, pe };
}

function dominantThemeToPrimarySystem(theme: DominantTheme): ProblemSystem {
  switch (theme) {
    case "skin_rash":
      return "skin";
    case "respiratory":
      return "respiratory";
    case "gi":
      return "gi";
    case "trauma":
      return "trauma";
    case "fever_systemic":
      return "fever";
    default:
      return "general";
  }
}

function scoreForSystem(system: ProblemSystem, scores: ReturnType<typeof getSystemKeywordScores>): number {
  switch (system) {
    case "skin":
      return scores.skin;
    case "respiratory":
      return scores.respiratory;
    case "gi":
      return scores.gi;
    case "gu":
      return scores.gu;
    case "msk":
      return scores.msk;
    case "trauma":
      return scores.trauma;
    case "fever":
      return scores.fever;
    default:
      return 0;
  }
}

const ALL_SYSTEMS: ProblemSystem[] = [
  "skin",
  "respiratory",
  "gi",
  "gu",
  "msk",
  "trauma",
  "fever",
  "general",
];

/** บรรทัดแรก ๆ ของ CC / โน้ต — ใช้จับประเด็นหลักจากข้อความ */
function complaintHeadSnippet(rawText: string, normalizedText: string): string {
  const raw = rawText.trim();
  const src = raw || normalizedText;
  const lines = src.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.slice(0, 3).join(" ").toLowerCase();
}

/** บรรทัดแรกสุด — CC มักอยู่บรรทัดแรก; ใช้จับ primary ก่อนรวมบรรทัดถัดไป */
function complaintFirstLine(rawText: string, normalizedText: string): string {
  const raw = rawText.trim();
  const src = raw || normalizedText;
  const line = src.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  return line.toLowerCase();
}

/** จับคู่ระบบกับบรรทัดร้องเรียนหลัก — ใช้เฉพาะระบบที่อยู่ใน candidates */
const CC_SYSTEM_HINTS: { sys: Exclude<ProblemSystem, "general">; re: RegExp }[] = [
  { sys: "trauma", re: /กระแทก|head trauma|อุบัติเหตุ|ล้ม|ชน|mva|แรงกระแทก|trauma/i },
  { sys: "skin", re: /ผื่น|rash|ลมพิษ|urticaria|คันมาก|lesion/i },
  { sys: "gu", re: /dysuria|ปัสสาวะแสบ|ขัดปัสสาวะ|uti|อักเสบทางเดินปัสสาวะ|cystitis|แสบขณะปัสสาวะ|hematuria|เลือดปนในปัสสาวะ/i },
  { sys: "msk", re: /ปวดหลัง|ปวดเอว|low back|lumbar|back pain|ปวดข้อ|คอแข็ง|radicular/i },
  { sys: "respiratory", re: /ไอ|น้ำมูก|cough|uri|หอบ|wheeze|คัดจมูก|เสียงหายใจ/i },
  { sys: "gi", re: /ท้องเสีย|อาเจียน|ท้องผูก|diarrhea|vomiting|อุจจาระ|ปวดท้อง/i },
  { sys: "fever", re: /ไข้|fever|febrile/i },
];

function pickSystemsMatchingLine(line: string, candidates: ProblemSystem[]): ProblemSystem[] {
  const hit: ProblemSystem[] = [];
  for (const { sys, re } of CC_SYSTEM_HINTS) {
    if (re.test(line) && candidates.includes(sys)) hit.push(sys);
  }
  return hit;
}

function inferPrimarySystemFromComplaint(
  firstLine: string,
  fullHead: string,
  candidates: ProblemSystem[],
  scores: ReturnType<typeof getSystemKeywordScores>,
): ProblemSystem | null {
  const pickBest = (systems: ProblemSystem[]): ProblemSystem | null => {
    if (systems.length === 0) return null;
    if (systems.length === 1) return systems[0];
    const ranked = [...systems].sort((a, b) => scoreForSystem(b, scores) - scoreForSystem(a, scores));
    return ranked[0] ?? null;
  };

  const fromFirst = pickBest(pickSystemsMatchingLine(firstLine, candidates));
  if (fromFirst) return fromFirst;

  return pickBest(pickSystemsMatchingLine(fullHead, candidates));
}

function sortSystemsByScoreDesc(systems: ProblemSystem[], scores: ReturnType<typeof getSystemKeywordScores>): ProblemSystem[] {
  return [...systems].sort((a, b) => scoreForSystem(b, scores) - scoreForSystem(a, scores) || a.localeCompare(b));
}

/**
 * เรียงลำดับ: ความเร่งด่วน (trauma / red flag + fever) → ตรงกับ CC → คะแนนคีย์เวิร์ด
 * ไม่รวม unrelated complaints เข้าประเด็นเดียว — แต่ละระบบเป็นปัญหาแยกในรายการ
 */
export function orderClinicalProblemsByPriority(
  systems: ProblemSystem[],
  normalizedText: string,
  rawText: string,
  profile: CaseClinicalProfile,
): ProblemSystem[] {
  const scores = getSystemKeywordScores(normalizedText);
  const uniq = [...new Set(systems)].filter((s) => s !== "general");
  if (uniq.length <= 1) {
    return uniq.length ? uniq : systems;
  }

  const head = complaintHeadSnippet(rawText, normalizedText);
  const line1 = complaintFirstLine(rawText, normalizedText);

  let first: ProblemSystem | null = null;
  if (uniq.includes("trauma") && /กระแทก|head trauma|อุบัติเหตุ|ล้ม|ชน|mva|trauma/i.test(head)) {
    first = "trauma";
  } else if (profile.hasSystemicRedFlags && uniq.includes("fever")) {
    first = "fever";
  } else {
    first = inferPrimarySystemFromComplaint(line1, head, uniq, scores);
  }

  if (first) {
    const rest = sortSystemsByScoreDesc(
      uniq.filter((s) => s !== first),
      scores,
    );
    return [first, ...rest];
  }

  return sortSystemsByScoreDesc(uniq, scores);
}

/**
 * รวบรวมทุกระบบที่มีคีย์เวิร์ด ≥1 รวมระบบจาก dominantTheme — แล้วเรียงตาม CC/ความเร่งด่วน
 */
export function detectClinicalProblems(
  normalizedText: string,
  profile: CaseClinicalProfile,
  _mode: AssistMode,
  rawText: string,
): ProblemSystem[] {
  const scores = getSystemKeywordScores(normalizedText);
  const primary = dominantThemeToPrimarySystem(profile.dominantTheme);

  const candidates = new Set<ProblemSystem>();
  if (primary !== "general") {
    candidates.add(primary);
  }
  for (const sys of ALL_SYSTEMS) {
    if (sys === "general") continue;
    if (scoreForSystem(sys, scores) >= 1) {
      candidates.add(sys);
    }
  }

  if (candidates.size === 0) {
    return [primary];
  }

  return orderClinicalProblemsByPriority([...candidates], normalizedText, rawText, profile);
}

function cardIdToSystem(cardId: string): ProblemSystem | null {
  const id = cardId.toLowerCase();
  if (id.includes("uri-wheeze") || id.includes("bronchi")) return "respiratory";
  if (id.includes("soft-tissue")) return "skin";
  if (id.includes("abdominal") || id.includes("bloody-diarrhea")) return "gi";
  if (id.includes("uti") || id.includes("urinary")) return "gu";
  if (id.includes("head-injury")) return "trauma";
  if (id.includes("fever-sepsis")) return "fever";
  return null;
}

function mergePhysicalExam(peFromText: string[], safety: SafetySweep, profile?: CaseClinicalProfile): string {
  const bullets: string[] = [];
  for (const line of peFromText) {
    const x = line.replace(/^[-•]\s*/, "").trim();
    if (x) bullets.push(x);
  }
  for (const b of safety.items) {
    for (const d of b.documented) bullets.push(`${b.label}: ${d}`);
  }
  if (!bullets.length) {
    const skinPrimary = profile?.dominantTheme === "skin_rash" || profile?.caseType === "dermatology";
    return skinPrimary
      ? "ยังไม่ได้บันทึก — ระบุเฉพาะผลตรวจผื่น/ผิวหนังที่พบจริง (ไม่ใส่ข้อความอธิบาย meta)"
      : "ยังไม่ได้บันทึกการตรวจร่างกายที่สำคัญ";
  }
  return bullets.map((x) => `- ${x}`).join("\n");
}

function firstNonEmptyLine(text: string): string {
  const t = text.trim();
  if (!t) return "";
  return t.split(/\r?\n/).find((l) => l.trim())?.trim() ?? "";
}

function extractThaiDrugAllergy(raw: string): string {
  const t = raw.toLowerCase();
  if (/แพ้ยา|allergy|drug allergy/i.test(t)) {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const hit = lines.find((l) => /แพ้|allergy/i.test(l));
    if (hit) return hit.length > 200 ? `${hit.slice(0, 197)}…` : hit;
    return "แพ้ยา — ระบุชนิดและปฏิกิริยาให้ชัดเจน";
  }
  return "ยังไม่ได้บันทึกประวัติแพ้ยา";
}

function extractThaiPastHistoryAndMeds(raw: string): string {
  const t = raw.toLowerCase();
  const hits: string[] = [];
  if (/เบาหวาน|\bdm\b|diabetes/i.test(t)) hits.push("เบาหวาน — ตรวจสอบยาและการควบคุม");
  if (/ความดัน|\bht\b|hypertension/i.test(t)) hits.push("ความดันโลหิตสูง — ตรวจสอบยา");
  if (/หอบหืด|asthma/i.test(t)) hits.push("หอบหืด — ตรวจสอบการรักษา");
  if (/หัวใจ|heart failure|cardiac/i.test(t)) hits.push("โรคหัวใจ — ตรวจสอบตามประวัติ");
  if (hits.length === 0) {
    return "ยังไม่ได้บันทึกโรคประจำตัวและยาประจำ — สอบถามและบันทึกให้ครบ";
  }
  return hits.join("; ");
}

function buildVitalSignsLine(normalized: string, peExtracted: string[]): string {
  const lines: string[] = [];
  const vitals = extractPeFindingsFromNormalizedText(normalized);
  const merged = uniq([...peExtracted.filter((x) => /spo2|bp|hr|rr|temp|vital|pulse|อุณหภูมิ|ความดัน|ชีพจร/i.test(x)), ...vitals]);
  if (merged.length) {
    for (const m of merged.slice(0, 12)) lines.push(`- ${m}`);
  }
  if (!lines.length) {
    return "ยังไม่ได้บันทึก vital signs — ระบุ BP, HR, RR, Temp, SpO₂ ตามความเหมาะสม";
  }
  return lines.join("\n");
}

function extractSkinRashFactsPresent(normalized: string): string[] {
  const t = normalized;
  const out: string[] = [];
  const add = (cond: boolean, line: string) => {
    if (cond) out.push(line);
  };
  add(anyNonNegatedRegexMatch(t, /rash|ผื่น/i), "ข้อความระบุผื่น/rash");
  add(anyNonNegatedRegexMatch(t, /papule|papules|ปื้น/i), "คำอธิบายคล้าย papule(s)");
  add(anyNonNegatedRegexMatch(t, /vesicle|vesicles|ตุ่มน้ำ/i), "vesicle / ตุ่มน้ำ");
  add(anyNonNegatedRegexMatch(t, /pustule|pustules|หนอง/i), "pustule / หนอง");
  add(anyNonNegatedRegexMatch(t, /crust|คราด|สะเก็ด/i), "crust / คราด");
  add(anyNonNegatedRegexMatch(t, /swelling|บวม|erythema|แดง/i), "บวม/แดง/erythema");
  add(anyNonNegatedRegexMatch(t, /insect bite|แมลงกัด|bite|burrow/i), "ประวัติกัด/แมลง/burrow");
  add(anyNonNegatedRegexMatch(t, /eczema|atopic|สะเก็ดเงิน|flare/i), "eczema/atopy/recurrence");
  add(anyNonNegatedRegexMatch(t, /คัน|itch|nocturnal|กลางคืน/i), "คัน / เวลาคัน");
  add(anyNonNegatedRegexMatch(t, /ไข้|fever/i), "มีไข้ (ไม่ตีเป็น URI อัตโนมัติเมื่อผื่นเด่น)");
  add(anyNonNegatedRegexMatch(t, /ไอ|น้ำมูก|cough|runny/i), "อาการทางเดินหายใจร่วม — ให้เป็น secondary เมื่อผื่นเด่น");
  const fam = computeScabiesClusterSignals(normalized);
  if (fam.familyItchPositive) {
    out.push("บริบทคันในบ้าน/ผู้ดูแล — สนับสนุนการพิจารณา scabies cluster");
  }
  if (fam.familyItchNegative) {
    out.push("ระบุไม่มีคันในบ้าน/คนใกล้ชิด — ลดน้ำหนัก scabies cluster");
  }
  return out;
}

function buildSkinRashDdxLines(normalized: string): string[] {
  const sig = computeScabiesClusterSignals(normalized);
  const scabiesLine =
    sig.familyItchNegative
      ? "Scabies (ความน่าจะเป็นลดลงถ้ายืนยันไม่มีคันในบ้าน/คนใกล้ชิด)"
      : sig.familyItchPositive
        ? "Scabies (สนับสนุนเมื่อมีคันในบ้าน/ผู้ดูแลหรือสมาชิกคันร่วม)"
        : "Scabies";
  const base = ["Papular urticaria", scabiesLine, "Viral exanthem", "Eczema flare", "Impetigo"];
  const t = normalized.toLowerCase();
  if (/pain|tender|warm|fluctuant|abscess|cellulitis|ปวด|ร้อน|กดเจ็บ|หนอง|แดงลาม|ฝี/i.test(t)) {
    base.push("Cellulitis / abscess (ถ้าปวด ร้อน กดเจ็บ หรือ fluctuant)");
  }
  return base;
}

function enrichSkinRashProblemBlock(
  block: ProblemBlock,
  normalized: string,
  profile: CaseClinicalProfile,
  isPrimary: boolean,
): ProblemBlock {
  const facts = extractSkinRashFactsPresent(normalized);
  const positives = uniq([...facts, ...block.pertinentPositives]).slice(0, 20);
  const skinPrimaryCase = profile.dominantTheme === "skin_rash" || profile.caseType === "dermatology";
  const ddx = buildSkinRashDdxLines(normalized);
  const ddxBullets = ddx.map((x) => `- ${x}`).join("\n");

  if (!skinPrimaryCase) {
    if (!isPrimary) {
      return {
        ...block,
        pertinentPositives: positives,
        assessment:
          "ประเด็นรอง — ผื่น/ผิวหนัง: แยกจากประเด็นอื่นหากไม่มีความเชื่อมทางพยาธิ — ไม่รวม diagnosis เดียวกับปัญหาอื่นโดยอัตโนมัติ",
        diagnosis: "Provisional: ตาม morphology + distribution — ระบุชัดเมื่อตรวจแล้ว",
        differential: ddx.slice(0, 3).map((x) => `- ${x}`).join("\n"),
        plan: "บันทึกผื่นแบบมีโครง + แผนรักษาเฉพาะผื่น แยกจากประเด็นหลัก",
      };
    }
    return { ...block, pertinentPositives: positives };
  }

  if (!isPrimary) {
    return {
      ...block,
      pertinentPositives: positives,
      assessment:
        "ประเด็นรอง — ผื่น: สรุปสั้น morphology/distribution — ไม่ผูกกับ URI/ไข้เป็นหลักถ้าไม่สอดคล้อง",
      diagnosis: "Provisional: ตามกลุ่มผื่นที่พบ — แยกจากประเด็นหลักของการมา",
      differential: ddx.slice(0, 4).map((x) => `- ${x}`).join("\n"),
      plan: "โฟกัสตรวจผื่น + คำแนะนำเฉพาะผื่น; ประเด็นอื่นตามลำดับความสำคัญ",
    };
  }

  return {
    ...block,
    pertinentPositives: positives,
    assessment:
      "สรุปแบบประเด็นผื่น: เน้น morphology + distribution + pattern คัน/เจ็บ — ไม่ยึด URI หรือ sepsis เป็นหลักเมื่อผื่นเป็นประเด็นหลัก",
    diagnosis:
      "Provisional diagnosis: รอผลตรวจผื่นแบบมีโครง — ดูรายการ DDx ด้านล่าง; ไม่ใช่แค่ URI เพราะมีไอ/ไข้ร่วม",
    differential: ddxBullets,
    plan: [
      "ตรวจผื่นแบบมีโครง: morphology, distribution, palm/sole, mucosa, lymph node ตามชี้",
      "บันทึก pertinent negatives ที่เกี่ยวกับ scabies / bacterial / allergy",
      "แผนรักษาและยาเฉพาะหลังสรุปกลุ่มโรคที่สมเหตุ",
    ].join("\n"),
  };
}

function enrichDefaultProblemClinicalBlock(
  block: ProblemBlock,
  _normalized: string,
  _profile: CaseClinicalProfile,
  isPrimary: boolean,
): ProblemBlock {
  const brief = !isPrimary;
  const sys = block.system;

  const pack = (
    assessment: string,
    diagnosis: string,
    differential: string,
    plan: string,
  ): ProblemBlock => ({
    ...block,
    assessment: brief ? assessment.split(" — ")[0] || assessment : assessment,
    diagnosis: brief ? diagnosis.replace(/\s*—.*$/, "").trim() || diagnosis : diagnosis,
    differential: brief ? differential.split("\n").slice(0, 2).join("\n") : differential,
    plan: brief ? plan.split("\n").slice(0, 2).join("\n") : plan,
  });

  switch (sys) {
    case "skin":
      return block;
    case "respiratory":
      return pack(
        "ประเด็นทางเดินหายใจ — แยกจากระบบอื่นหากอาการไม่มีความเชื่อม (เช่น ผื่น + URI = สองประเด็น)",
        "Provisional: URI / bronchospasm / localized infection ตามหลักฐาน — ไม่รวมกับปัญหาอื่นโดยไม่มีบริบท",
        ["- Viral URI", "- Acute bronchitis", "- Asthma/bronchospasm exacerbation", "- Early pneumonia (ถ้ามีหลักฐาน)"].join("\n"),
        "รักษาตาม syndrome ที่สอดคล้อง + ติดตามอากร; ถ้ามีปัญหาอื่นในรายการ ให้มี plan แยกตามประเด็น",
      );
    case "gi":
      return pack(
        "ประเด็นทางเดินอาหาร — ประเมินสัญญาณเตือนและขาดน้ำแยกจากระบบอื่น",
        "Provisional: gastroenteritis / functional / อื่น ๆ ตามบริบท — ไม่ผสมกับปัญหา MSK/GU หากไม่เกี่ยว",
        ["- Viral GE", "- Food-related", "- Bacterial dysentery (ถ้ามีเลือด/ระบบ)", "- Non-GI mimic"].join("\n"),
        "ให้น้ำ/คำแนะนำอาหาร/ยาตามชี้; แยก follow-up จากประเด็นอื่นใน visit เดียวกัน",
      );
    case "gu":
      return pack(
        "ประเด็นทางเดินปัสสาวะ — แยกจากปวดหลัง/MSK ได้หากบริบทไม่สนับสนุน pyelonephritis หรือ cauda equina",
        "Provisional: UTI / urethritis / hematuria workup ตามหลักฐาน",
        ["- Uncomplicated UTI", "- Pyelonephritis (ถ้ามีไข้/CVA)", "- Urethritis/STI", "- Stone (ถ้ามี colicky + hematuria)"].join("\n"),
        "UA/เลือกยา/ติดตามตาม severity; ถ้ามีปวดหลังร่วม ให้ชี้แจงว่าเป็นกลุ่มอาการเดียวหรือสองประเด็น",
      );
    case "msk":
      return pack(
        "ประเด็นกระดูก/กล้ามเนื้อ — mechanical vs radicular vs red flag ตามบริบท; ไม่รวมกับ dysuria เป็นหนึ่ง diagnosis หากไม่สอดคล้อง",
        "Provisional: mechanical low back pain / radiculopathy / อื่น ๆ ตามอาการ",
        ["- Muscular strain", "- Disc/radiculopathy", "- Spinal stenosis (chronic)", "- Non-MSK mimic"].join("\n"),
        "ยาตามชี้ + ทำกายภาพ/งดกิจที่กระตุ้น; ถ้ามีอาการปัสสาวะร่วม ให้แยกประเมิน GU เป็นอีกประเด็น",
      );
    case "trauma":
      return pack(
        "ประเด็นบาดเจ็บ — ลำดับความสำคัญสูงหากกลไก/อาการสนับสนุน",
        "Provisional: ตามกลไกและทาง anatomical — ไม่รวมกับ URI/GI โดยไม่มีความเชื่อม",
        ["- Soft tissue injury", "- Concussion/TBI spectrum", "- Fracture/dislocation (ถ้าสงสัย)", "- Other trauma"].join("\n"),
        "ABCDE / imaging / observation ตาม guideline; แยก plan จากปัญหาไม่เร่งด่วนอื่น",
      );
    case "fever":
      return pack(
        "ประเด็นไข้/แหล่งติดเชื้อ — แยกจากผื่นหรือ URI เป็นอีกประเด็นได้ถ้าไม่ใช่กลุ่มอาการเดียวกัน",
        "Provisional: ไข้จากโฟกัสหรือไข้ไม่มีโฟกัส — ตามหลักฐาน",
        ["- Viral syndrome", "- Localized bacterial focus", "- UTI/pyelonephritis", "- Other"].join("\n"),
        "ยาแก้ไข้/หาโฟกัส/นัดซ้ำตาม severity; ไม่ผูกทุกอาการเป็นหนึ่ง diagnosis",
      );
    case "general":
      return pack(
        "สรุประดับทั่วไป — เมื่อมีหลายระบบ ให้ใช้รายการปัญหาด้านบนแยกตามระบบ",
        "Provisional: ตามข้อมูลที่มี — ไม่รวม unrelated complaints",
        ["- ตามโฟกัสหลัก", "- Mimic / หลายระบบ"].join("\n"),
        "Plan ตามประเด็นที่เรียงลำดับแล้ว",
      );
    default:
      return block;
  }
}

function pertinentSnippetsForSystem(normalized: string, system: ProblemSystem): string[] {
  const t = normalized;
  const out: string[] = [];
  const pushIf = (cond: boolean, label: string) => {
    if (cond) out.push(label);
  };
  switch (system) {
    case "skin":
      pushIf(anyNonNegatedRegexMatch(t, /ผื่น|rash|urticaria|ลมพิษ|คัน/i), "ผื่น/ผิวหนัง — ระบุในข้อความ");
      break;
    case "respiratory":
      pushIf(
        anyNonNegatedRegexMatch(t, /ไอ|wheeze|rhonchi|หอบ|ปอด|dyspnea|หายใจลำบาก/i),
        "ทางเดินหายใจ — ระบุในข้อความ",
      );
      break;
    case "gi":
      pushIf(anyNonNegatedRegexMatch(t, /ท้องเสีย|อาเจียน|อุจจาระ|ปวดท้อง/i), "ทางเดินอาหาร — ระบุในข้อความ");
      break;
    case "gu":
      pushIf(
        anyNonNegatedRegexMatch(t, /dysuria|ปัสสาวะแสบ|uti|ขัดปัสสาวะ|hematuria|เลือดปนในปัสสาวะ/i),
        "ทางเดินปัสสาวะ — ระบุในข้อความ",
      );
      break;
    case "msk":
      pushIf(anyNonNegatedRegexMatch(t, /ปวดหลัง|lumbar|radicular|ชา|อ่อนแรง/i), "MSK/กระดูกสันหลัง — ระบุในข้อความ");
      break;
    case "trauma":
      pushIf(anyNonNegatedRegexMatch(t, /กระแทก|head trauma|trauma|ล้ม|mva/i), "บาดเจ็บ/ศีรษะ — ระบุในข้อความ");
      break;
    case "fever":
      pushIf(anyNonNegatedRegexMatch(t, /ไข้|fever|febrile/i), "ไข้ — ระบุในข้อความ");
      break;
    default:
      break;
  }
  return out;
}

function shouldKeepNegativeTemplate(template: string, normalized: string): boolean {
  const t = normalized;
  const low = template.toLowerCase();

  if (low.includes("หนอง") && (t.includes("หนอง") || t.includes("pus") || /ไม่มีหนอง|no pus/i.test(t))) {
    return false;
  }
  if (low.includes("hypox") && (t.includes("hypox") || t.includes("spo2") || t.includes("o2 sat"))) {
    return false;
  }
  if (low.includes("ร้อยวงแดง") && (t.includes("ร้อยวงแดง") || t.includes("ลาม"))) {
    return false;
  }
  if (low.includes("ร้อน") && t.includes("ร้อน")) {
    return false;
  }
  if (low.includes("เมือก") && (t.includes("เมือก") || t.includes("ลิ้น"))) {
    return false;
  }
  if (low.includes("peritoneal") && (t.includes("กดเจ็บ") || t.includes("guarding"))) {
    return false;
  }
  if (low.includes("เลือดในอุจจาระ") && (t.includes("เลือด") || /bloody/i.test(t))) {
    return false;
  }
  if (low.includes("กลั้นปัสสาวะ") && t.includes("กลั้น")) {
    return false;
  }
  if (low.includes("อ่อนแรง motor") && (t.includes("อ่อนแรง") || t.includes("weakness"))) {
    return false;
  }
  if (low.includes("airway") && (t.includes("airway") || t.includes("ทางเดินหายใจ"))) {
    return false;
  }
  if (low.includes("ภาวะ shock") && (t.includes("shock") || t.includes("ช็อก"))) {
    return false;
  }
  if (low.includes("altered mental") && (t.includes("gcs") || t.includes("ซึม") || t.includes("สติ"))) {
    return false;
  }
  if (low.includes("mucosal") && (t.includes("เมือก") || t.includes("ลิ้น") || t.includes("mucosal"))) {
    return false;
  }
  if (low.includes("palm/sole") && (t.includes("ฝ่ามือ") || t.includes("ฝ่าเท้า") || t.includes("palm") || t.includes("sole"))) {
    return false;
  }
  if (low.includes("family itching") && (t.includes("คนในบ้าน") || t.includes("family"))) {
    return false;
  }
  if (low.includes("nocturnal") && (t.includes("กลางคืน") || t.includes("nocturnal"))) {
    return false;
  }
  if (low.includes("fluctuance") && (t.includes("fluctuant") || t.includes("ฝี") || t.includes("abscess"))) {
    return false;
  }
  if (low.includes("spreading erythema") && (t.includes("ลาม") || t.includes("แดงลาม"))) {
    return false;
  }
  if (/ไม่มี|no |negative for|denies/i.test(t) && template.length < 80) {
    return true;
  }
  return true;
}

function filterNegativeTemplates(system: ProblemSystem, normalized: string): string[] {
  const raw = NEGATIVE_TEMPLATES[system];
  return raw.filter((t) => shouldKeepNegativeTemplate(t, normalized));
}

function buildSummaryLine(system: ProblemSystem, normalized: string, profile: CaseClinicalProfile): string {
  const t = normalized;
  switch (system) {
    case "skin":
      return profile.dominantTheme === "skin_rash" || /ผื่น|rash/i.test(t)
        ? "ผื่น/ผิวหนัง (primary) — morphology + distribution + คัน/เจ็บ; URI/ไข้เป็น secondary ได้"
        : "ผิวหนัง — ติดตามประเด็นหลัก";
    case "respiratory":
      return "ทางเดินหายใจ — URI / airway ตามหลักฐาน";
    case "gi":
      return "ทางเดินอาหาร — ระบุอาการและสัญญาณเตือน";
    case "gu":
      return "ทางเดินปัสสาวะ — UTI / dysuria / hematuria ตามบริบท; แยกจากปวดหลังถ้าไม่สนับสนุนกลุ่มเดียวกัน";
    case "msk":
      return "กระดูก/กล้ามเนื้อ — ปวดหลังหรือข้อ ตามบริบท";
    case "trauma":
      return "การบาดเจ็บ / ศีรษะกระแทก — ตามกลไกและความรุนแรง";
    case "fever":
      return "ไข้ / แหล่งติดเชื้อ — ประเมินความรุนแรง";
    default:
      return "ประเด็นทั่วไป — สรุปจากประวัติและการตรวจ";
  }
}

function collectCardStringsForSystem(
  cards: AssistCardResult[],
  system: ProblemSystem,
  kind: "documented" | "missing",
): string[] {
  const out: string[] = [];
  for (const c of cards) {
    const cs = cardIdToSystem(c.id);
    if (cs !== system) continue;
    const arr = kind === "documented" ? c.documented : c.missing;
    out.push(...arr.map((x) => `${c.label}: ${x}`));
  }
  return uniq(out);
}

function mergeCardMissingIntoPrompts(
  system: ProblemSystem,
  cards: AssistCardResult[],
  baseHistory: string[],
  baseExam: string[],
): { history: string[]; exam: string[] } {
  const history = [...baseHistory];
  const exam = [...baseExam];
  for (const c of cards) {
    if (cardIdToSystem(c.id) !== system) continue;
    const { pi, pe } = splitMissingForPiPe(c.missing);
    for (const x of pi) {
      const line = `${c.label}: ${x}`;
      if (!history.includes(line)) history.unshift(line);
    }
    for (const x of pe) {
      const line = `${c.label}: ${x}`;
      if (!exam.includes(line)) exam.unshift(line);
    }
  }
  return {
    history: uniq(history).slice(0, 24),
    exam: uniq(exam).slice(0, 24),
  };
}

function buildProblemBlock(
  system: ProblemSystem,
  orderIndex: number,
  normalized: string,
  profile: CaseClinicalProfile,
  cards: AssistCardResult[],
  isPrimary: boolean,
): ProblemBlock {
  const id = `pb-${system}-${orderIndex}`;
  const baseH = HISTORY_ASK_NEXT[system];
  const baseE = EXAM_FOCUS_NEXT[system];
  const merged = mergeCardMissingIntoPrompts(system, cards, baseH, baseE);
  const positives = uniq([
    ...(system === "skin" ? extractSkinRashFactsPresent(normalized) : []),
    ...pertinentSnippetsForSystem(normalized, system),
    ...collectCardStringsForSystem(cards, system, "documented"),
  ]).slice(0, 20);
  const negatives = filterNegativeTemplates(system, normalized).slice(0, 10);

  const block: ProblemBlock = {
    id,
    system,
    orderIndex,
    summaryLine: buildSummaryLine(system, normalized, profile),
    historyAskNext: merged.history,
    examFocusNext: merged.exam,
    pertinentPositives: positives,
    pertinentNegativesToDocument: negatives,
  };

  if (system === "skin") {
    return enrichSkinRashProblemBlock(block, normalized, profile, isPrimary);
  }
  if (system === "general") {
    return block;
  }
  return enrichDefaultProblemClinicalBlock(block, normalized, profile, isPrimary);
}

export function buildProblemBlocks(
  systems: ProblemSystem[],
  normalized: string,
  profile: CaseClinicalProfile,
  cards: AssistCardResult[],
): ProblemBlock[] {
  return systems.map((sys, i) => buildProblemBlock(sys, i, normalized, profile, cards, i === 0));
}

/**
 * จัดเรียง ProblemBlock ตาม id — อันแรก = primary (orderIndex ใหม่)
 */
export function applyProblemOrder(blocks: ProblemBlock[], orderedIds: ClinicalProblemId[]): ProblemBlock[] {
  const map = new Map(blocks.map((b) => [b.id, b]));
  const next: ProblemBlock[] = [];
  for (let i = 0; i < orderedIds.length; i++) {
    const b = map.get(orderedIds[i]);
    if (b) next.push({ ...b, orderIndex: i });
  }
  for (const b of blocks) {
    if (!orderedIds.includes(b.id)) next.push({ ...b, orderIndex: next.length });
  }
  return next;
}

export function buildMinimumOpdRecord(args: {
  rawText: string;
  normalizedText: string;
  structuredNote: StructuredOpdNote;
  bundle: AssistantBundle;
  safety: SafetySweep;
  peFromText: string[];
  problemBlocks: ProblemBlock[];
  profile: CaseClinicalProfile;
}): MinimumOpdRecord {
  const { rawText, normalizedText, structuredNote, bundle, safety, peFromText, problemBlocks, profile } = args;
  const fl = firstNonEmptyLine(rawText);
  const cc = buildConciseCC(rawText, fl);
  const piThai = buildTimelinePI(rawText);
  const pi =
    piThai === "Not documented." ? "ยังไม่ได้บันทึกประวัติอาการ (PI) ให้ครบ" : piThai;

  const drugAllergy = extractThaiDrugAllergy(rawText);
  const pastHistoryAndMeds = extractThaiPastHistoryAndMeds(rawText);

  const peCombined = uniq([...peFromText, ...extractPeVerbatimFromRaw(rawText)]);
  const vitalSigns = buildVitalSignsLine(normalizedText, peCombined);
  const physicalExamSignificant = mergePhysicalExam(peCombined, safety, profile);

  const problemLines = problemBlocks.map((b, i) => `${i + 1}. ${b.system}: ${b.summaryLine}`);
  const problemListOrDx =
    problemLines.length > 0
      ? problemLines.join("\n")
      : structuredNote.diagnosis.trim() || "ยังไม่ได้บันทึกรายการปัญหา/การวินิจฉัย";

  const treatmentAndMeds =
    structuredNote.plan.trim() ||
    (bundle.treatmentHints.length
      ? bundle.treatmentHints.slice(0, 10).map((x) => `- ${x}`).join("\n")
      : "ยังไม่ได้บันทึกการรักษาและยา");

  const adviceFollowUp =
    structuredNote.patientAdvice.trim() ||
    (bundle.patientAdviceHints.length
      ? bundle.patientAdviceHints.slice(0, 8).join("\n")
      : "ยังไม่ได้บันทึกคำแนะนำผู้ป่วยและการนัด");

  return {
    cc,
    pi,
    drugAllergy,
    pastHistoryAndMeds,
    vitalSigns,
    physicalExamSignificant,
    problemListOrDx,
    treatmentAndMeds,
    adviceFollowUp,
  };
}

export function buildOpdFramework(args: {
  rawText: string;
  normalizedText: string;
  mode: AssistMode;
  profile: CaseClinicalProfile;
  safety: SafetySweep;
  diseaseCards: AssistCardResult[];
  bundle: AssistantBundle;
  structuredNote: StructuredOpdNote;
  peFromText: string[];
}): OpdFramework {
  const systems = detectClinicalProblems(args.normalizedText, args.profile, args.mode, args.rawText);
  const layer2 = buildProblemBlocks(systems, args.normalizedText, args.profile, args.diseaseCards);
  const layer1 = buildMinimumOpdRecord({
    rawText: args.rawText,
    normalizedText: args.normalizedText,
    structuredNote: args.structuredNote,
    bundle: args.bundle,
    safety: args.safety,
    peFromText: args.peFromText,
    problemBlocks: layer2,
    profile: args.profile,
  });
  return { layer1, layer2 };
}
