import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trackTelemetry } from "@/lib/telemetry";
import { getDailyApproxLimit, normalizePlanId } from "@/lib/billing-rules";
import { KNOWLEDGE_REFERENCES } from "@/lib/clinical-knowledge";
import { getMergedKnowledge, queuePendingKnowledgeEntry } from "@/lib/knowledge-store";
import {
  DEFAULT_CHAT_STYLE_PROFILE,
  getUserChatStyleProfile,
  mergeChatStyleProfile,
  setUserChatStyleProfile,
  type ChatStyleProfile,
} from "@/lib/chat-style-profile";
import { deidentify } from "@/lib/deidentify";
import { estimateTokenBillingThb, getPlanTokenBudgetThb, readUsageSummary } from "@/lib/token-billing";
import { extractIcd10Candidates, retrieveExternalEvidence } from "@/lib/reference-retriever";

export const runtime = "nodejs";

function jsonUtf8(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function ssePack(payload: Record<string, unknown>) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function formatBangkokDateTime(date: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

type ChatHistoryItem = { role: "user" | "assistant"; content: string };
type ChatMode = "fast" | "precise";
type AssistantMode = "coding" | "opd_demo";
type SummaryIntent = "none" | "opd_case" | "opd_soap";
type UploadedImageInput = { name?: string; dataUrl: string };
type AnswerSource = "internal" | "mixed" | "external";
type ChatIntent = "clinical_question" | "follow_up" | "greeting_or_smalltalk";
type OpenAIResponse = Awaited<ReturnType<OpenAI["responses"]["create"]>>;
type OpenAIApiLikeError = {
  status?: number;
  code?: string;
  type?: string;
  message?: string;
};

type ChatStyleProfilePatch = Partial<ChatStyleProfile>;

const OPD_RDU_COMMON_ICD10 = [
  {
    condition: "Acute nasopharyngitis (common cold)",
    icd10: "J00",
    antibioticDefault: "usually_not_indicated",
  },
  {
    condition: "Acute pharyngitis, unspecified",
    icd10: "J02.9",
    antibioticDefault: "case_by_case",
  },
  {
    condition: "Streptococcal pharyngitis",
    icd10: "J02.0",
    antibioticDefault: "indicated_when_criteria_met",
  },
  {
    condition: "Acute tonsillitis, unspecified",
    icd10: "J03.9",
    antibioticDefault: "case_by_case",
  },
  {
    condition: "Acute sinusitis, unspecified",
    icd10: "J01.9",
    antibioticDefault: "indicated_when_bacterial_pattern",
  },
  {
    condition: "Acute bronchitis, unspecified",
    icd10: "J20.9",
    antibioticDefault: "usually_not_indicated",
  },
  {
    condition: "Pneumonia, unspecified organism",
    icd10: "J18.9",
    antibioticDefault: "often_indicated_if_clinically_consistent",
  },
  {
    condition: "Acute cystitis without hematuria",
    icd10: "N30.00",
    antibioticDefault: "often_indicated_if_consistent_with_lower_UTI",
  },
  {
    condition: "Pyelonephritis, unspecified",
    icd10: "N12",
    antibioticDefault: "indicated",
  },
  {
    condition: "Cellulitis, unspecified site",
    icd10: "L03.90",
    antibioticDefault: "often_indicated_if_bacterial_skin_infection",
  },
  {
    condition: "Acute gastroenteritis due to infection, unspecified",
    icd10: "A09",
    antibioticDefault: "usually_not_indicated",
  },
  {
    condition: "Infectious diarrhea, unspecified",
    icd10: "A09",
    antibioticDefault: "usually_not_indicated_except_selected_cases",
  },
];

function isMissingTableError(err: unknown) {
  const msg = String((err as { message?: string })?.message || "").toLowerCase();
  return msg.includes("does not exist in the current database") || msg.includes("invalid `");
}

function pickPromptVariant(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 2 === 0 ? "A" : "B";
}

function detectChatIntent(message: string, history: ChatHistoryItem[]): ChatIntent {
  const q = message.trim().toLowerCase();
  if (!q) return "clinical_question";
  if (/^(สวัสดี|hello|hi|ขอบคุณ|thanks|thank you|ช่วยหน่อย|test)/i.test(q)) {
    return "greeting_or_smalltalk";
  }
  if (
    /^(แล้ว|แล้วถ้า|ถ้าอย่างนั้น|ต่อ|เพิ่มเติม|อีกข้อ|จากเคสนี้|เคสนี้|แล้วกรณี|แล้วถ้าเป็น|what about|then|and if)/i.test(
      q
    ) &&
    history.length > 0
  ) {
    return "follow_up";
  }
  return "clinical_question";
}

function inferStylePatchFromMessage(message: string): ChatStyleProfilePatch {
  const q = message.toLowerCase();
  const patch: ChatStyleProfilePatch = {};
  if (/สั้น|กระชับ|สรุปสั้น|brief|concise/.test(q)) patch.responseLength = "short";
  if (/ละเอียด|เชิงลึก|ยาว|long|detailed/.test(q)) patch.responseLength = "detailed";
  if (/bullet|หัวข้อ|เป็นข้อ|checklist|list/.test(q)) patch.outputFormat = "bullet";
  if (/ย่อหน้า|paragraph|เล่าเป็นความเรียง/.test(q)) patch.outputFormat = "paragraph";
  if (/ทางการ|formal/.test(q)) patch.tone = "formal";
  if (/กันเอง|friendly|เป็นมิตร/.test(q)) patch.tone = "friendly";
  return patch;
}

function shouldPersistStylePatch(message: string, patch: ChatStyleProfilePatch) {
  if (Object.keys(patch).length === 0) return false;
  return /(จำสไตล์|จำรูปแบบ|ตั้งค่าสไตล์|ตั้งค่าการตอบ|ต่อไปนี้|จากนี้ไป|always|default style|style นี้)/i.test(message);
}

function buildStyleInstruction(profile: ChatStyleProfile) {
  const lines: string[] = [];
  if (profile.responseLength === "short") {
    lines.push("Keep answers short and high-yield (roughly 3-6 bullets unless user asks for more).");
  } else if (profile.responseLength === "detailed") {
    lines.push("Provide detailed answers with practical rationale and structured steps.");
  } else {
    lines.push("Keep answers balanced: concise first, then needed details.");
  }

  if (profile.outputFormat === "bullet") {
    lines.push("Prefer bullet/checklist format over long paragraphs.");
  } else if (profile.outputFormat === "paragraph") {
    lines.push("Prefer short paragraphs over bullet-heavy output unless checklist is required.");
  }

  if (profile.tone === "formal") {
    lines.push("Use a professional and formal Thai clinical tone.");
  } else if (profile.tone === "friendly") {
    lines.push("Use a friendly Thai tone while keeping clinical precision.");
  } else {
    lines.push("Use a neutral Thai clinical tone.");
  }

  return lines.join("\n");
}

function buildSystemPrompt(assistantMode: AssistantMode, variant: "A" | "B", styleProfile: ChatStyleProfile) {
  const styleInstruction = buildStyleInstruction(styleProfile);
  if (assistantMode === "opd_demo") {
    const opdBase = [
      "You are DischargeX OPD Assistant demo for Thai outpatient workflow.",
      "Always answer in Thai language.",
      "This is clinical decision support only, not a replacement for physician judgment.",
      "Use case context from CHAT_HISTORY and USER_MESSAGE before answering.",
      "Do not provide definitive diagnosis. Provide working diagnosis with differential and what evidence is still needed.",
      "Prioritize Thai OPD flow: history taking -> physical exam focus -> differential diagnosis -> additional investigations -> treatment plan -> follow-up/safety net.",
      "Only discuss Thai rational antibiotic use principles (RDU) when user explicitly asks about RDU/antibiotics/indication criteria.",
      "Do not add 'RDU gate' or antibiotic-indication checklist by default.",
      "If user explicitly asks about antibiotics, then show minimum evidence required from history and physical exam before suggesting antibiotics.",
      "When data is missing, explicitly state what to ask and examine next.",
      "Use ICD-10 code format when user asks for diagnostic summary/template or coding output.",
      "Never append ICD-10 to non-diagnosis sections such as CC/PI/PE/Investigation/Treatment/Plan/Follow-up.",
      "When proposing diagnosis lists, prefer ICD-10 from RDU_COMMON_ICD10_CANDIDATES if clinically matched.",
      "For trauma/stroke fast track/MI fast track/toxicology topics, prioritize Thai guidelines and Thai institutional sources first.",
      "Prefer the most recent available guidance; if publication year is visible, mention year briefly.",
      "If the latest Thai guidance is not found, clearly state this and then use international references as secondary support.",
      "Keep overall response in Thai, but for Physical Examination and Investigation sections prefer standard English medical terms and common clinical abbreviations.",
      "In Physical Examination section, use clinical terms such as HEENT, chest, CVS, RS, abdomen, neuro, extremities when appropriate.",
      "In Investigation section, use standard names such as CBC, BMP, LFT, UA, CXR, ECG, culture, CT, US and avoid informal wording.",
      "For medications, provide practical options with route, frequency, duration, and usual adult dosing range.",
      "If weight/age/renal function/pregnancy status is needed for safe dosing, state clearly that dose must be adjusted and verified.",
      "Never fabricate patient facts, lab results, or exam findings.",
      "Use concise checklist style and keep it practical for real OPD time pressure.",
      "Do NOT force full case-summary template in every response.",
      "Only output full Thai OPD case summary + SOAP when user explicitly asks to summarize case.",
      "For normal Q&A, answer directly and practically first; use concise checklist only when needed.",
      "If intent is greeting/smalltalk: keep response short and ask what case user wants to discuss.",
      "If intent is follow_up: continue from previous case and avoid restarting from scratch.",
      "If intent is clinical_question: respond directly first, then structured actionable plan.",
    ];
    const opdVariantA = [
      ...opdBase,
      "Default structure: 1) ประเด็นสำคัญ 2) ซักประวัติเพิ่ม 3) ตรวจร่างกายเพิ่ม 4) Dx/DDx พร้อม ICD-10 5) ตรวจเพิ่ม 6) ยาและโดสเบื้องต้น 7) สรุปเคสแบบสั้น",
      "Keep to high-yield bullets, avoid long textbook paragraphs.",
    ];
    const opdVariantB = [
      ...opdBase,
      "Default structure: 1) Impression 2) Missing history/PE 3) Differential with supporting clues 4) Investigation plan 5) Medication options with dose guardrails 6) Follow-up and red flags",
      "Add one short caution line when uncertainty is high.",
    ];
    return [...(variant === "A" ? opdVariantA : opdVariantB), "USER_STYLE_PREFERENCE:", styleInstruction].join("\n");
  }

  const baseSystem = [
    "You are DischargeX clinical coding copilot for Thai discharge summary workflow.",
    "Always answer in Thai language.",
    "Behave like a helpful chat assistant, not a static document retriever.",
    "Use conversation context from CHAT_HISTORY and USER_MESSAGE before answering.",
    "Do not provide definitive diagnosis. Provide candidate diagnosis and evidence checklist.",
    "Prefer terms: 'Acute diarrhea' or 'Infectious diarrhea'. Avoid using 'AGE' or 'Acute gastroenteritis' as default wording.",
    "Use only KNOWLEDGE_REFERENCE_MAP for [R#] citations when factual claims need support.",
    "If user asks what to write in order sheet, provide example wording as 'ตัวอย่างถ้อยคำ (เมื่อเป็นจริง)' and include warning not to fabricate facts.",
    "If unsure, say what additional evidence/labs/imaging are needed.",
    "When suggesting additional diagnoses (e.g. dehydration, electrolyte disorders), provide minimum evidence criteria first. If criteria are not present, explicitly state 'ยังไม่พอสำหรับลงวินิจฉัยนี้'.",
    "Never diagnose on behalf of physician. Provide advisory checklist only.",
    "Synthesize evidence in your own words. Do not copy long text from references.",
    "Do not paste raw snippets. Summarize practical clinical implication directly.",
    "Focus on the current case context only; avoid dumping generic textbook lists or website-like paragraphs.",
    "If intent is greeting/smalltalk: keep response short and warm (1-3 lines) and ask what case user wants to discuss.",
    "If intent is follow_up: answer continuity from prior case, do not restart from scratch.",
    "If intent is clinical_question: start with direct answer first, then concise evidence checklist.",
  ];
  const systemVariantA = [
    ...baseSystem,
    "Keep answer concise. Focus on top 2-4 high-yield points first.",
    "Prioritize practical next actions for physician/coder workflow.",
    "Default format: 1) คำตอบสั้นตรงคำถาม 2) หลักฐานที่ควรมี 3) สิ่งที่ควรเช็กเพิ่ม",
  ];
  const systemVariantB = [
    ...baseSystem,
    "Use structured mini-checklist style and include one brief caution line.",
    "When evidence is weak, explicitly state missing evidence before suggestions.",
    "Default format: 1) คำตอบสั้นตรงคำถาม 2) หลักฐานที่ควรมี 3) สิ่งที่ควรเช็กเพิ่ม",
  ];
  return [...(variant === "A" ? systemVariantA : systemVariantB), "USER_STYLE_PREFERENCE:", styleInstruction].join("\n");
}

function buildCaseSummaryPatternBlock(assistantMode: AssistantMode) {
  if (assistantMode === "coding") return "";
  const requireIcd10 = assistantMode === "opd_demo";
  return [
    "THAI_OPD_CASE_SUMMARY_PATTERN:",
    "- CC: อาการสำคัญเพียง 1 อาการ + ระยะเวลาก่อนมาโรงพยาบาล/คลินิก",
    "- PI: ต้องขึ้นต้นด้วยระยะเวลาก่อนมา แล้วตามด้วยลำดับอาการตามเวลา (เรียงเก่า -> ใหม่)",
    "- U/D: โรคประจำตัวสำคัญ",
    "- PHI/PMH: ประวัติเดิมที่เกี่ยวข้อง ยาประจำ ประวัติแพ้ยา ปัจจัยเสี่ยง",
    "- PE และ vital signs ที่สัมพันธ์กับปัญหา (ใช้ภาษาอังกฤษ/ศัพท์แพทย์มาตรฐาน)",
    requireIcd10
      ? "- Diagnosis โดยเขียนชื่อโรคพร้อม (ICD-10: ...) ทุกบรรทัด"
      : "- Diagnosis ที่น่าจะเป็น",
    requireIcd10
      ? "- Differential diagnosis โดยเขียนชื่อโรคพร้อม (ICD-10: ...) ทุกบรรทัด"
      : "- Differential diagnosis ที่น่าจะเป็น",
    "- Investigation ที่ทำแล้ว/ควรทำเพิ่ม",
    "- Treatment/Medication plan",
    "- Follow-up interval + return precautions/red flags",
    "",
    "SOAP_PATTERN:",
    "S: subjective (อาการสำคัญ, HPI, ROS ที่เกี่ยวข้อง)",
    "O: objective (vitals, focused PE, ผลตรวจที่มี)",
    requireIcd10
      ? "A: assessment (problem list/diagnosis พร้อม (ICD-10: ...), differential)"
      : "A: assessment (problem list/diagnosis, differential)",
    "P: plan (investigation, treatment incl. dose if needed, patient advice, follow-up)",
  ].join("\n");
}

function detectSummaryIntent(message: string, assistantMode: AssistantMode): SummaryIntent {
  if (assistantMode !== "opd_demo") return "none";
  const q = message.toLowerCase();
  if (/สรุป\s*soap|\bsoap\b/.test(q)) return "opd_soap";
  if (/สรุปเคส|thai opd case summary|opd ไทย/.test(q)) return "opd_case";
  return "none";
}

function buildCriticalScenarioBlock(message: string) {
  const q = message.toLowerCase();
  const isSnakebite = /(snake|snakebite|งูกัด|งูเห่า|cobra|krait|viper)/.test(q);
  if (!isSnakebite) return "";
  return [
    "CRITICAL_SCENARIO_SNAKEBITE:",
    "- For suspected cobra/neurotoxic snakebite, explicitly include serial neuro-respiratory monitoring plan.",
    "- Mention bedside neuro checks: ptosis trend, palpebral fissure narrowing, EOM weakness/ophthalmoplegia, dysarthria, dysphagia, neck flexor weakness, limb power.",
    "- Mention respiratory trend monitoring: RR, SpO2, single-breath count; if available include PEFR/FVC/NIF trend.",
    "- Mark local swelling edge and reassess progression every 30-60 minutes early phase.",
    "- Answer clearly whether antivenom should be given immediately vs observed first based on clinical envenomation signs.",
    "- If currently asymptomatic, state that routine immediate antivenom is usually not indicated; continue close observation and start antivenom promptly when systemic neuro signs or progressive severe local envenomation appears.",
    "- Include early airway preparedness/escalation trigger if respiratory or bulbar weakness emerges.",
    "- Keep output practical and Thai-first guideline oriented.",
  ].join("\n");
}

function buildMandatorySummaryTemplate(intent: SummaryIntent) {
  if (intent === "none") return "";
  if (intent === "opd_case") {
    return [
      "MANDATORY_SUMMARY_OUTPUT_TEMPLATE:",
      "Use EXACT heading order below. Do not skip headings.",
      "If data missing, write 'ไม่พบข้อมูล' under that heading.",
      "Start output with: ผู้ป่วยเคส <เพศ/อายุ> U/D ... หรือ ไม่มีโรคประจำตัว",
      "",
      "## Thai OPD Case Summary",
      "CC: <ONE main chief complaint only + must include duration + 'ก่อนมา รพ.'>",
      "PI: <timeline by lines from oldest -> newest. Example: '2 เดือนก่อนมา รพ. ...' / '1 สัปดาห์ก่อนมา รพ. ...' / '2 วันก่อนมา รพ. ...'>",
      "U/D: <underlying diseases>",
      "PHI/PMH: <relevant history, current meds, drug allergy, risk factors>",
      "PE: <focused physical exam with standard English medical terms>",
      "Investigation: <tests done/recommended with standard English terms>",
      "Diagnosis: <each line must be Disease name (ICD-10: code)>",
      "Differential diagnosis: <each line must be Disease name (ICD-10: code)>",
      "Treatment: <treatment + medication + dose/frequency/duration>",
      "Follow-up: <follow-up interval + return precautions/red flags>",
      "Plan: <overall plan summary>",
    ].join("\n");
  }
  return [
    "MANDATORY_SUMMARY_OUTPUT_TEMPLATE:",
    "Use EXACT heading order below. Do not skip headings.",
    "If data missing, write 'ไม่พบข้อมูล' under that heading.",
    "",
    "## SOAP",
    "S: <subjective>",
    "O: <objective>",
    "A: <assessment with Disease name (ICD-10: code)>",
    "P: <plan>",
  ].join("\n");
}

function extractSectionValue(text: string, labels: string[]) {
  const normalized = text.replace(/\r/g, "");
  const labelPattern = labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const allHeads = [
    "CC",
    "PI",
    "U/D",
    "UD",
    "PHI/PMH",
    "PHI",
    "PMH",
    "PE",
    "Investigation",
    "Diagnosis",
    "Differential diagnosis",
    "Treatment",
    "Follow-up",
    "Followup",
    "Plan",
    "S",
    "O",
    "A",
    "P",
  ];
  const headPattern = allHeads.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`(?:^|\\n)\\s*(?:${labelPattern})\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:${headPattern})\\s*:|$)`, "i");
  const m = normalized.match(re);
  return (m?.[1] || "").trim();
}

function oneLineMainCc(raw: string) {
  const t = raw.trim();
  if (!t) return "ไม่พบข้อมูล";
  const candidates = t
    .split(/,|;| และ | with | ร่วมกับ | accompanied by /i)
    .map((x) => x.trim())
    .filter(Boolean);
  if (!candidates.length) return "ไม่พบข้อมูล";

  const severityRules: Array<{ score: number; re: RegExp }> = [
    { score: 100, re: /(หอบ|เหนื่อยมาก|หายใจลำบาก|respiratory distress|dyspnea|shortness of breath)/i },
    { score: 90, re: /(เจ็บหน้าอก|แน่นหน้าอก|chest pain)/i },
    { score: 80, re: /(ซึม|ชัก|หมดสติ|altered mental|seizure|syncope)/i },
    { score: 70, re: /(ไข้สูง|ไข้)/i },
    { score: 60, re: /(ไอเป็นเลือด|hemoptysis)/i },
    { score: 50, re: /(อาเจียน|ถ่ายเหลว|ปวดท้อง|ท้องเสีย)/i },
  ];

  const duration = (t.match(/(\d+\s*(ชั่วโมง|ชม\.?|วัน|สัปดาห์|อาทิตย์|เดือน|ปี))/i)?.[0] || "").trim();

  const scored = candidates.map((line) => {
    const score = severityRules.reduce((best, rule) => (rule.re.test(line) ? Math.max(best, rule.score) : best), 0);
    return { line, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const main = scored[0]?.line || candidates[0];
  if (!duration || /(\d+\s*(ชั่วโมง|ชม\.?|วัน|สัปดาห์|อาทิตย์|เดือน|ปี))/i.test(main)) {
    return main;
  }
  return `${main} ${duration}`.trim();
}

function extractDurationToken(texts: string[]) {
  for (const text of texts) {
    const m = String(text || "").match(/(\d+\s*(ชั่วโมง|ชม\.?|วัน|สัปดาห์|อาทิตย์|เดือน|ปี))/i);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

function ensureCcBeforeHospital(cc: string, durationHint: string) {
  const raw = cc.trim();
  if (!raw || raw === "ไม่พบข้อมูล") return "ไม่พบข้อมูล";
  if (/ก่อนมา\s*รพ|ก่อนมา\s*โรงพยาบาล/i.test(raw)) return raw;
  const stripped = raw.replace(/(\d+\s*(ชั่วโมง|ชม\.?|วัน|สัปดาห์|อาทิตย์|เดือน|ปี))/gi, "").trim();
  if (durationHint) {
    return `${stripped || raw} ${durationHint}ก่อนมา รพ.`.replace(/\s{2,}/g, " ").trim();
  }
  return `${raw} ก่อนมา รพ.`.replace(/\s{2,}/g, " ").trim();
}

function hasDurationBeforeHospital(text: string) {
  const t = String(text || "").trim();
  if (!t) return false;
  if (/ก่อนมา\s*รพ|ก่อนมา\s*โรงพยาบาล/i.test(t)) return true;
  const re = /(\d+)\s*(ชั่วโมง|ชม\.?|วัน|สัปดาห์|อาทิตย์|เดือน|ปี)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const full = m[0] || "";
    const unit = m[2] || "";
    const idx = m.index ?? 0;
    const left = t.slice(Math.max(0, idx - 18), idx);
    const right = t.slice(idx + full.length, idx + full.length + 22);
    const window = `${left}${full}${right}`.toLowerCase();
    const ageLike =
      /(อายุ|age|yo|y\/o|yrs?|ขวบ|ปี\s*(ชาย|หญิง|เด็ก|male|female|boy|girl))/i.test(window) &&
      !/(ก่อนมา\s*รพ|ก่อนมา\s*โรงพยาบาล|เป็นมา|มานาน|เริ่ม)/i.test(window);
    if (ageLike) continue;
    if (/(ก่อน|ก่อนมา|เป็นมา|มานาน|มาแล้ว|since|duration|เริ่ม)/i.test(window)) return true;
    if (!/ปี/i.test(unit)) return true;
  }
  return false;
}

function normalizePeToMedicalEnglish(raw: string) {
  const text = stripIcd10Suffix(String(raw || "").trim());
  if (!text) return "ไม่พบข้อมูล";
  if (text === "ไม่พบข้อมูล") return text;

  const mapped = text
    .replace(/ไม่มีไข้/gi, "afebrile")
    .replace(/มีไข้/gi, "febrile")
    .replace(/รอยถลอก(จากการเกา)?/gi, "excoriations")
    .replace(/ตุ่มน้ำใส/gi, "vesicles")
    .replace(/ตุ่มหนอง/gi, "pustules")
    .replace(/ตุ่มนูน/gi, "papules")
    .replace(/คันมากตอนกลางคืน/gi, "nocturnal pruritus")
    .replace(/ระหว่างนิ้วมือ|ซอกนิ้วมือ/gi, "interdigital finger web spaces")
    .replace(/ระหว่างนิ้วเท้า|ซอกนิ้วเท้า/gi, "interdigital toe web spaces")
    .replace(/นิ้วมือ/gi, "fingers")
    .replace(/นิ้วเท้า/gi, "toes")
    .replace(/\bก้น\b/gi, "gluteal region")
    .replace(/ไม่พบความผิดปกติ/gi, "no focal abnormality detected")
    .replace(/\bพบ\b/gi, "noted")
    .replace(/\bที่\b/gi, "at")
    .replace(/\s{2,}/g, " ")
    .trim();

  const hasThaiLeft = /[\u0E00-\u0E7F]/.test(mapped);
  if (!hasThaiLeft) {
    const normalized = mapped
      .replace(/focused skin exam/gi, "Focused skin examination")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (/[.;]$/.test(normalized)) return normalized;
    return `${normalized}.`;
  }

  const lower = `${text}\n${mapped}`.toLowerCase();
  const findings: string[] = [];
  if (/papule|ตุ่มนูน/.test(lower)) findings.push("papules");
  if (/vesicle|ตุ่มน้ำใส/.test(lower)) findings.push("vesicles");
  if (/pustule|ตุ่มหนอง/.test(lower)) findings.push("pustules");
  if (/excoriation|รอยถลอก|เกา/.test(lower)) findings.push("excoriations");
  const lesionSummary = findings.length ? findings.join("/") : "pruritic skin lesions";
  const sites: string[] = [];
  if (/interdigital|ซอกนิ้ว|ระหว่างนิ้ว/.test(lower)) sites.push("interdigital finger/toe web spaces");
  if (/finger|นิ้วมือ/.test(lower) && !sites.includes("interdigital finger/toe web spaces")) sites.push("fingers");
  if (/toe|นิ้วเท้า/.test(lower) && !sites.includes("interdigital finger/toe web spaces")) sites.push("toes");
  if (/gluteal|ก้น/.test(lower)) sites.push("gluteal region");
  const siteText = sites.length ? ` over ${sites.join(", ")}` : "";
  const tempText = /afebrile|ไม่มีไข้/.test(lower) ? " Afebrile." : /febrile|มีไข้/.test(lower) ? " Febrile." : "";
  return `Focused skin examination: ${lesionSummary}${siteText}.${tempText}`.trim();
}

function buildPatientLeadLine(sourceText: string, ud: string) {
  const normalizedSource = sourceText
    .replace(/เด้ก|เดก|เด็ก/g, "เด็ก")
    .replace(/ชาบไทย|ชา[ยญ]ไทย|ชายไทย/g, "ชายไทย")
    .replace(/หญ[ิี]งไทย/g, "หญิงไทย")
    .replace(/ขวบ/g, "ปี");
  const demoMatch =
    normalizedSource.match(/(เด็กชายไทย|เด็กหญิงไทย|ชายไทย|หญิงไทย|เด็กชาย|เด็กหญิง|ชาย|หญิง)\s*(\d{1,3})\s*ปี/i) ||
    normalizedSource.match(/(\d{1,3})\s*ปี\s*(เด็กชายไทย|เด็กหญิงไทย|ชายไทย|หญิงไทย|เด็กชาย|เด็กหญิง|ชาย|หญิง)/i) ||
    normalizedSource.match(/(male|female|boy|girl)\s*(\d{1,3})\s*(?:yo|y\/o|years?|yrs?)/i) ||
    normalizedSource.match(/(\d{1,3})\s*(?:yo|y\/o|years?|yrs?)\s*(male|female|boy|girl)/i);
  let demo = "ไม่ระบุเพศอายุ";
  if (demoMatch) {
    if (demoMatch[2] && /(เด็กชายไทย|เด็กหญิงไทย|ชายไทย|หญิงไทย|เด็กชาย|เด็กหญิง|ชาย|หญิง)/i.test(demoMatch[1] || "")) {
      demo = `${demoMatch[1]} ${demoMatch[2]} ปี`;
    } else if (demoMatch[2] && /(male|female|boy|girl)/i.test(demoMatch[1] || "")) {
      const thaiSex = /(female|girl)/i.test(demoMatch[1] || "") ? "หญิง" : "ชาย";
      demo = `${thaiSex} ${demoMatch[2]} ปี`;
    } else if (demoMatch[1] && /(male|female|boy|girl)/i.test(demoMatch[2] || "")) {
      const thaiSex = /(female|girl)/i.test(demoMatch[2] || "") ? "หญิง" : "ชาย";
      demo = `${thaiSex} ${demoMatch[1]} ปี`;
    } else if (demoMatch[1] && /(เด็กชายไทย|เด็กหญิงไทย|ชายไทย|หญิงไทย|เด็กชาย|เด็กหญิง|ชาย|หญิง)/i.test(demoMatch[2] || "")) {
      demo = `${demoMatch[2]} ${demoMatch[1]} ปี`;
    } else if (demoMatch[1] && demoMatch[2]) {
      demo = `${demoMatch[2]} ${demoMatch[1]} ปี`;
    }
  }
  if (demo === "ไม่ระบุเพศอายุ") {
    const childAgeMatch = normalizedSource.match(/เด็ก(?:ไทย)?\s*(\d{1,3})\s*ปี/i) || normalizedSource.match(/(\d{1,3})\s*ปี\s*เด็ก(?:ไทย)?/i);
    if (childAgeMatch?.[1]) {
      demo = `เด็กไทย ${childAgeMatch[1]} ปี`;
    }
  }
  const udText = !ud || ud === "ไม่พบข้อมูล" ? "ไม่มีโรคประจำตัว" : `U/D ${ud}`;
  return `ผู้ป่วยเคส ${demo} ${udText}`.replace(/\s{2,}/g, " ").trim();
}

function ensurePiStartsWithDuration(pi: string) {
  const t = pi.trim();
  if (!t) return "ไม่พบข้อมูล";
  const normalizeUnit = (u: string) => {
    if (/hour|ชม|ชั่วโมง/i.test(u)) return "ชั่วโมง";
    if (/day|วัน/i.test(u)) return "วัน";
    if (/week|สัปดาห์|อาทิตย์/i.test(u)) return "สัปดาห์";
    if (/month|เดือน/i.test(u)) return "เดือน";
    if (/year|ปี/i.test(u)) return "ปี";
    return u;
  };

  const durationRe =
    /(\d+)\s*(ชั่วโมง|ชม\.?|วัน|สัปดาห์|อาทิตย์|เดือน|ปี|hours?|days?|weeks?|months?|years?)(?:\s*(ก่อนมา(?:\s*รพ\.?|โรงพยาบาล)?))?/i;

  const segments = t
    .replace(/\r/g, "\n")
    .split(/\n|;|(?<=\.)\s+|(?<=,)\s+/)
    .map((x) => x.trim())
    .filter(Boolean);

  const lines = segments.map((seg) => {
    const m = seg.match(durationRe);
    if (!m) return seg;
    const qty = m[1];
    const unit = normalizeUnit(m[2] || "");
    const body = seg.replace(durationRe, "").replace(/^[-:,\s]+/, "").trim();
    return body ? `${qty} ${unit}ก่อนมา รพ. ${body}` : `${qty} ${unit}ก่อนมา รพ.`;
  });

  const hasTimeline = lines.some((line) => /(ก่อนมา\s*รพ|โรงพยาบาล)/i.test(line));
  if (hasTimeline) {
    return lines
      .map((line) => line.replace(/\s{2,}/g, " ").trim())
      .filter(Boolean)
      .join("\n");
  }

  return `ระยะเวลาก่อนมา: ไม่พบข้อมูล\nลำดับอาการ: ${t}`;
}

function ensureDiagnosisLines(raw: string) {
  const lines = raw
    .split(/\n|;/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (!lines.length) return "ไม่พบข้อมูล";
  return lines.join("\n");
}

function stripIcd10Suffix(raw: string) {
  if (!raw) return "";
  return raw
    .replace(/\s*\(ICD-10:\s*[^)]+\)/gi, "")
    .replace(/\s*\bICD-10:\s*[A-Z0-9.\-+ ]+/gi, "")
    .trim();
}

function enforceIcd10SuffixPerLine(raw: string) {
  if (!raw || raw.trim() === "ไม่พบข้อมูล") return "ไม่พบข้อมูล";
  const lines = raw
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  if (!lines.length) return "ไม่พบข้อมูล";
  return lines
    .map((line) =>
      /\(ICD-10:\s*[^)]+\)/i.test(line)
        ? line
        : `${line} (ICD-10: ต้องยืนยันรหัส)`
    )
    .join("\n");
}

function toThaiClinicalText(text: string) {
  return text
    .replace(/\blung crepitation\b/gi, "เสียงครืดคราดที่ปอด")
    .replace(/\bcrepitation\b/gi, "เสียงครืดคราด")
    .replace(/\bwheezing\b/gi, "เสียงวี๊ด")
    .replace(/\bshortness of breath\b/gi, "หอบเหนื่อย")
    .replace(/\bdyspnea\b/gi, "หอบเหนื่อย")
    .replace(/\bfever\b/gi, "ไข้")
    .replace(/\bcough\b/gi, "ไอ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stripPeOrInvestigationTermsInPi(pi: string) {
  const blocked =
    /(heent|auscultation|inspection|palpation|percussion|vital signs?|sputum\s*afb|cxr|cbc|lft|cd4|viral load|lab|investigation|crepitation|wheezing)/i;
  const lines = pi
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((line) => !blocked.test(line));
  return lines.join("\n").trim() || "ไม่พบข้อมูล";
}

function splitInvestigationDoneVsSuggested(inv: string) {
  const segments = inv
    .split(/\n|;/)
    .map((x) => x.trim())
    .filter(Boolean);
  const done: string[] = [];
  const suggested: string[] = [];
  for (const seg of segments) {
    if (/ควร|แนะนำ|ควรทำ|consider|suggest|recommend/i.test(seg)) {
      suggested.push(seg);
    } else {
      done.push(seg);
    }
  }
  return {
    done: done.length ? done.join(", ") : "ไม่พบข้อมูล",
    suggested: suggested,
  };
}

function mergePlanWithSuggestions(plan: string, suggestions: string[]) {
  const cleanedPlan = stripIcd10Suffix(plan || "").trim();
  const list = [...suggestions];
  if (cleanedPlan && cleanedPlan !== "ไม่พบข้อมูล") list.unshift(cleanedPlan);
  if (!list.length) return "ไม่พบข้อมูล";
  return list.join(" | ");
}

function normalizeSummaryTemplateOutput(reply: string, assistantMode: AssistantMode, intent: SummaryIntent, sourceContext = "") {
  const ccRaw = oneLineMainCc(extractSectionValue(reply, ["CC"]));
  const piRaw = ensurePiStartsWithDuration(extractSectionValue(reply, ["PI"]));
  let ud = stripIcd10Suffix(extractSectionValue(reply, ["U/D", "UD"])) || "ไม่พบข้อมูล";
  const phi = stripIcd10Suffix(extractSectionValue(reply, ["PHI/PMH", "PHI", "PMH"])) || "ไม่พบข้อมูล";
  const pe = normalizePeToMedicalEnglish(extractSectionValue(reply, ["PE"]));
  const invRaw = stripIcd10Suffix(extractSectionValue(reply, ["Investigation"])) || "ไม่พบข้อมูล";
  const dx = enforceIcd10SuffixPerLine(
    ensureDiagnosisLines(extractSectionValue(reply, ["Diagnosis", "Assessment/Dx", "Assessment"]))
  );
  const ddx = enforceIcd10SuffixPerLine(
    ensureDiagnosisLines(extractSectionValue(reply, ["Differential diagnosis", "DDx", "Differential"]))
  );
  const treatment = stripIcd10Suffix(extractSectionValue(reply, ["Treatment"])) || "ไม่พบข้อมูล";
  const followUp = stripIcd10Suffix(extractSectionValue(reply, ["Follow-up", "Followup"])) || "ไม่พบข้อมูล";
  const basePlan = stripIcd10Suffix(extractSectionValue(reply, ["Plan"])) || "ไม่พบข้อมูล";
  const s = stripIcd10Suffix(extractSectionValue(reply, ["S"])) || "ไม่พบข้อมูล";
  const o = stripIcd10Suffix(extractSectionValue(reply, ["O"])) || "ไม่พบข้อมูล";
  const aRaw = extractSectionValue(reply, ["A"]) || dx;
  const a = enforceIcd10SuffixPerLine(ensureDiagnosisLines(aRaw));

  const durationHint = extractDurationToken([ccRaw, piRaw, reply]);
  const cc = ensureCcBeforeHospital(toThaiClinicalText(ccRaw), durationHint);
  const pi = stripPeOrInvestigationTermsInPi(toThaiClinicalText(piRaw));
  const durationPresentInContext = hasDurationBeforeHospital(sourceContext);
  const durationPresentInDraft = hasDurationBeforeHospital(`${cc}\n${pi}\n${reply}`);
  const missingDurationQuestion =
    !durationPresentInContext && !durationPresentInDraft
      ? "ก่อนสรุปเคส ขอข้อมูลเพิ่มก่อนครับ: อาการนี้เป็นมา多久/กี่วันก่อนมา รพ.? (ตัวอย่าง: 3 วันก่อนมา รพ.)\nตอบระยะเวลาเพิ่มมาได้เลย แล้วผมจะสรุปเคสใหม่ให้ทันที"
      : "";
  if (ud === "ไม่พบข้อมูล" && /hiv/i.test(phi)) {
    ud = "HIV infection";
  }
  const invSplit = splitInvestigationDoneVsSuggested(invRaw);
  const inv = invSplit.done;
  const plan = mergePlanWithSuggestions(basePlan, invSplit.suggested);
  const p = stripIcd10Suffix(extractSectionValue(reply, ["P"])) || basePlan || "ไม่พบข้อมูล";
  const patientLead = buildPatientLeadLine([sourceContext, reply].filter(Boolean).join("\n"), ud);

  if (intent === "opd_case") {
    if (missingDurationQuestion) {
      return missingDurationQuestion;
    }
    return [
      patientLead,
      "",
      `CC: ${cc}`,
      `PI: ${pi}`,
      `PHI/PMH: ${phi}`,
      `PE: ${pe}`,
      `Investigation: ${inv}`,
      `Diagnosis: ${dx}`,
      `Differential diagnosis: ${ddx}`,
      `Treatment: ${treatment}`,
      `Follow-up: ${followUp}`,
      `Plan: ${plan}`,
    ].join("\n");
  }

  if (intent === "opd_soap") {
    return [
      "## SOAP",
      `S: ${s}`,
      `O: ${o}`,
      `A: ${a}`,
      `P: ${p}`,
    ].join("\n");
  }

  return reply;
}

function buildConversationSummary(history: ChatHistoryItem[]) {
  if (!history.length) return "";
  const core = history.slice(-24).map((item) => {
    const compact = item.content.replace(/\s+/g, " ").trim().slice(0, 140);
    return `${item.role === "user" ? "U" : "A"}: ${compact}`;
  });
  const recentUserAsks = history
    .filter((h) => h.role === "user")
    .slice(-3)
    .map((h) => h.content.replace(/\s+/g, " ").trim().slice(0, 120));
  return [
    "conversation_lines:",
    ...core,
    recentUserAsks.length ? `recent_questions: ${recentUserAsks.join(" | ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function compactKnowledgeSummaries(items: Awaited<ReturnType<typeof getMergedKnowledge>>) {
  return items.map((d) => ({
    slug: d.slug,
    name: d.name,
    aliases: d.aliases.slice(0, 4),
    diagnosisToWrite: d.diagnosisToWrite.slice(0, 2),
    investigations: d.investigations.slice(0, 2),
    icd10: d.icd10.slice(0, 6),
    refs: d.refs,
  }));
}

function rankKnowledge(message: string, items: Awaited<ReturnType<typeof getMergedKnowledge>>) {
  const q = message.toLowerCase();
  const scored = items.map((d) => {
    const tokens = [d.name, ...d.aliases, ...d.icd10].map((x) => x.toLowerCase());
    const score = tokens.reduce((acc, token) => (q.includes(token) ? acc + 1 : acc), 0);
    return { d, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.d);
  return {
    matched: scored,
    fallback: items.slice(0, 5),
    hasStrongMatch: scored.length > 0,
  };
}

function normalizeOpenAiError(err: unknown) {
  const e = (err || {}) as OpenAIApiLikeError;
  const message = String(e.message || (err instanceof Error ? err.message : "")).toLowerCase();
  const code = String(e.code || "").toLowerCase();
  const type = String(e.type || "").toLowerCase();
  const status = Number(e.status || 0);

  if (status === 401 || code.includes("invalid_api_key") || message.includes("api key")) {
    return "การตั้งค่า OPENAI_API_KEY ไม่ถูกต้องหรือหมดอายุ";
  }
  if (status === 429 || code.includes("insufficient_quota") || message.includes("quota")) {
    return "โควตาการใช้งาน AI ไม่เพียงพอหรือเกินลิมิตชั่วคราว";
  }
  if (status === 429 || message.includes("rate limit")) {
    return "ระบบ AI ถูกใช้งานหนาแน่น กรุณาลองใหม่อีกครั้งในสักครู่";
  }
  if (
    status === 404 ||
    code.includes("model") ||
    type.includes("invalid_request_error") ||
    message.includes("model") ||
    message.includes("does not exist") ||
    message.includes("unsupported")
  ) {
    return "โมเดล AI ที่ตั้งค่าไว้ใช้งานไม่ได้ กรุณาลองใหม่อีกครั้ง";
  }
  return "ประมวลผลไม่สำเร็จ";
}

function isMedicationOrDoseQuery(text: string) {
  const q = text.toLowerCase();
  return /ขนาดยา|โดส|ยา|ยาฆ่าเชื้อ|antibiotic|dose|dosing|mg|bid|tid|qid|q\d+h|po|iv/.test(q);
}

function hasMedicationDosePattern(text: string) {
  const t = text.toLowerCase();
  return /(\d+(\.\d+)?\s?(mg|mcg|g|ml))(\/(kg|day|dose))?|bid|tid|qid|q\d+h|once daily|วันละ\s*\d+\s*ครั้ง|ทุก\s*\d+\s*ชั่วโมง/.test(
    t
  );
}

function isToxicologyQuestion(text: string) {
  const q = text.toLowerCase();
  return /(พิษ|สารพิษ|ได้รับพิษ|งูกัด|แมลงสัตว์กัดต่อย|poison|poisoning|toxic|toxicity|antidote|snakebite|envenomation)/.test(
    q
  );
}

const TOXICOLOGY_QUICK_LINKS = [
  {
    label: "ศูนย์พิษวิทยารามาธิบดี (Poison Center)",
    url: "https://www.rama.mahidol.ac.th/poisoncenter/th",
  },
  {
    label: "สถานเสาวภา สภากาชาดไทย",
    url: "https://www.saovabha.com/",
  },
];

type ExternalLinkEvidence = {
  sourceName: string;
  sourceUrl: string;
  title: string;
};

function appendExternalReferenceLinks(reply: string, evidences: ExternalLinkEvidence[]) {
  if (!Array.isArray(evidences) || evidences.length === 0) return reply;
  const uniqueByUrl = new Map<string, ExternalLinkEvidence>();
  for (const ev of evidences) {
    const url = String(ev?.sourceUrl || "").trim();
    if (!url) continue;
    if (!uniqueByUrl.has(url)) uniqueByUrl.set(url, ev);
  }
  const missing = Array.from(uniqueByUrl.values()).filter((ev) => !reply.includes(ev.sourceUrl));
  if (!missing.length) return reply;
  const lines = [
    "",
    "ReferenceSource:",
    ...missing.map((ev) => `- ${(ev.title || ev.sourceName || "External source").slice(0, 120)}: ${ev.sourceUrl}`),
  ];
  return `${reply.trim()}\n${lines.join("\n")}`.trim();
}

function appendToxicologyQuickLinks(reply: string, message: string, sourceContext: string) {
  if (!isToxicologyQuestion(`${message}\n${sourceContext}`)) return reply;
  const hasExistingLink = TOXICOLOGY_QUICK_LINKS.some((link) => reply.includes(link.url));
  if (hasExistingLink) return reply;
  const lines = [
    "",
    "อ่านแนวทางเพิ่มเติม (แหล่งไทย):",
    ...TOXICOLOGY_QUICK_LINKS.map((link) => `- ${link.label}: ${link.url}`),
  ];
  return `${reply.trim()}\n${lines.join("\n")}`.trim();
}

function resolveAnswerSource(params: {
  assistantMode: AssistantMode;
  hasStrongMatch: boolean;
  externalEvidenceCount: number;
  reply: string;
}): AnswerSource {
  if (params.externalEvidenceCount > 0) {
    return params.hasStrongMatch ? "mixed" : "external";
  }
  // For OPD demo mode, responses are model + clinical reasoning context
  // and should not be labeled as purely internal knowledge.
  if (params.assistantMode === "opd_demo") {
    return "mixed";
  }
  // Coding mode answers that include dosing logic are often model-prior + reasoning,
  // so avoid labeling them as purely internal-knowledge sourced.
  if (hasMedicationDosePattern(params.reply)) {
    return "mixed";
  }
  return "internal";
}

function sanitizeIncomingImages(raw: unknown): UploadedImageInput[] {
  if (!Array.isArray(raw)) return [];
  const out: UploadedImageInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const dataUrl = String(obj.dataUrl || "").trim();
    if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(dataUrl)) continue;
    if (dataUrl.length > 7_000_000) continue;
    const name = String(obj.name || "").trim();
    out.push({ dataUrl, ...(name ? { name: name.slice(0, 120) } : {}) });
    if (out.length >= 3) break;
  }
  return out;
}

function buildUserContentPayload(prompt: string, images: UploadedImageInput[]) {
  if (!images.length) return prompt;
  return [
    { type: "input_text" as const, text: prompt },
    ...images.map((img) => ({ type: "input_image" as const, image_url: img.dataUrl, detail: "auto" as const })),
  ];
}

async function searchKnowledgeEvidence(message: string) {
  const q = message.trim();
  if (!q) return [];
  try {
    const rows = await prisma.knowledgeChunk.findMany({
      where: {
        document: { isActive: true },
        OR: [{ content: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }],
      },
      include: { document: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    return rows.map((r) => ({
      source: r.document.sourceName,
      pageRef: r.pageRef,
      title: r.title,
      snippet: r.content.slice(0, 350),
    }));
  } catch (error) {
    if (isMissingTableError(error)) {
      console.warn("specialist-chat: KnowledgeChunk table not ready; skip retrieved snippets");
      return [];
    }
    throw error;
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return jsonUtf8({ ok: false, error: "บริการ AI ยังไม่พร้อม" }, 503);
  }

  try {
    const body = (await req.json()) as {
      message?: string;
      history?: ChatHistoryItem[];
      mode?: ChatMode;
      stream?: boolean;
      assistantMode?: AssistantMode | "opd_rdu";
      images?: UploadedImageInput[];
      styleProfile?: ChatStyleProfilePatch;
    };
    const message = String(body.message || "").trim();
    const mode: ChatMode = body.mode === "precise" ? "precise" : "fast";
    const safeImages = sanitizeIncomingImages(body.images);
    const assistantMode: AssistantMode =
      body.assistantMode === "opd_demo" || body.assistantMode === "opd_rdu" ? "opd_demo" : "coding";
    const shouldStream = Boolean(body.stream);
    if (!message) {
      return jsonUtf8({ ok: false, error: "กรุณาระบุข้อความ" }, 400);
    }
    const messageForModel = deidentify(message);

    const rawHistory = Array.isArray(body.history)
      ? body.history
          .filter((h) => h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
          .slice(-200)
          .map((h) => ({ ...h, content: deidentify(h.content) }))
      : [];
    const recentHistory = rawHistory.slice(mode === "fast" ? -8 : -12);
    const conversationSummary = buildConversationSummary(
      rawHistory.slice(0, Math.max(0, rawHistory.length - recentHistory.length))
    );

    const session = await getServerSession(authOptions);
    const dbUser = session?.user?.email
      ? await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { id: true, plan: true },
        })
      : null;
    const userId = dbUser?.id ?? null;
    const normalizedPlan = normalizePlanId(dbUser?.plan ?? "trial");
    const stylePatchFromMessage = inferStylePatchFromMessage(message);
    const stylePatchFromRequest = body.styleProfile || {};
    let styleProfile = mergeChatStyleProfile(DEFAULT_CHAT_STYLE_PROFILE, stylePatchFromRequest);
    if (userId) {
      const storedStyle = await getUserChatStyleProfile(userId);
      styleProfile = mergeChatStyleProfile(storedStyle, { ...stylePatchFromMessage, ...stylePatchFromRequest });
      if (shouldPersistStylePatch(message, stylePatchFromMessage)) {
        await setUserChatStyleProfile(userId, styleProfile);
      }
    } else {
      styleProfile = mergeChatStyleProfile(styleProfile, stylePatchFromMessage);
    }

    if (userId) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const used = await prisma.feedback.count({
        where: {
          userId,
          type: "telemetry",
          message: "chat:specialist_chat_reply",
          createdAt: { gte: since },
        },
      });
      const approxLimit = getDailyApproxLimit(normalizedPlan).chatPerDay;
      if (used >= approxLimit) {
        const nextResetAt = new Date(since.getTime() + 24 * 60 * 60 * 1000);
        return jsonUtf8(
          {
            ok: false,
            error: `วันนี้คุณใช้งานแชทครบโควตาโดยประมาณแล้ว (${approxLimit} ครั้ง/วัน) ระบบจะรีเซ็ตอีกครั้งประมาณ ${formatBangkokDateTime(nextResetAt)} หรือคุณสามารถซื้อแพ็กเพิ่มได้ที่หน้า /pricing`,
          },
          429
        );
      }
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const spend = userId
      ? await prisma.tokenUsageLedger
          .aggregate({
            _sum: { estimatedCostThb: true },
            where: { userId, createdAt: { gte: monthStart } },
          })
          .catch((error) => {
            if (isMissingTableError(error)) {
              console.warn("specialist-chat: TokenUsageLedger table not ready; skip budget guard");
              return { _sum: { estimatedCostThb: 0 } };
            }
            throw error;
          })
      : { _sum: { estimatedCostThb: 0 } };
    const spendThb = Number(spend._sum.estimatedCostThb || 0);
    const budgetThb = getPlanTokenBudgetThb(normalizedPlan);
    if (spendThb >= budgetThb) {
      const nextResetAt = new Date(monthStart);
      nextResetAt.setMonth(nextResetAt.getMonth() + 1);
      return jsonUtf8(
        {
          ok: false,
          error: `โควตาการใช้งานเดือนนี้ครบแล้ว (${spendThb.toFixed(2)} / ${budgetThb.toFixed(2)} บาท) ระบบจะรีเซ็ตอีกครั้งประมาณ ${formatBangkokDateTime(nextResetAt)} หรือคุณสามารถซื้อแพ็กเพิ่มได้ที่หน้า /pricing`,
        },
        402
      );
    }

    const mergedKnowledge = await getMergedKnowledge(false);
    const ranked = rankKnowledge(message, mergedKnowledge);
    const matchedKnowledge = ranked.hasStrongMatch ? ranked.matched.slice(0, 8) : ranked.fallback.slice(0, 4);
    const compactMatchedKnowledge = compactKnowledgeSummaries(matchedKnowledge);
    const retrievedSnippets = await searchKnowledgeEvidence(messageForModel);
    const forceExternalEvidence = assistantMode === "opd_demo" && isMedicationOrDoseQuery(messageForModel);
    const external = ranked.hasStrongMatch && !forceExternalEvidence
      ? { evidences: [], whitelist: [] }
      : await retrieveExternalEvidence(messageForModel, {
          maxEvidence: mode === "fast" ? 2 : 4,
          maxDomains: mode === "fast" ? 3 : 6,
        });
    const variant =
      process.env.SPECIALIST_CHAT_PROMPT_VARIANT === "A" || process.env.SPECIALIST_CHAT_PROMPT_VARIANT === "B"
        ? process.env.SPECIALIST_CHAT_PROMPT_VARIANT
        : pickPromptVariant(userId || message.slice(0, 16));
    const intent = detectChatIntent(messageForModel, recentHistory);
    const system = buildSystemPrompt(assistantMode, variant, styleProfile);
    const caseSummaryPattern = buildCaseSummaryPatternBlock(assistantMode);
    const criticalScenarioBlock = buildCriticalScenarioBlock(messageForModel);
    const summaryIntent = detectSummaryIntent(messageForModel, assistantMode);
    const mandatorySummaryTemplate = buildMandatorySummaryTemplate(summaryIntent);
    const forceSummaryTemplate = summaryIntent !== "none";
    const historyForPrompt = forceSummaryTemplate ? rawHistory.slice(-120) : recentHistory;
    const summarySourceContext = [
      ...rawHistory.filter((h) => h.role === "user").map((h) => h.content),
      messageForModel,
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = [
      "KNOWLEDGE_SUMMARY (primary quick guidance):",
      JSON.stringify(compactMatchedKnowledge),
      "",
      "KNOWLEDGE_REFERENCE_MAP:",
      JSON.stringify(KNOWLEDGE_REFERENCES),
      "",
      "RETRIEVED_SNIPPETS_FROM_DOCUMENTS:",
      JSON.stringify(retrievedSnippets),
      "",
      "RDU_COMMON_ICD10_CANDIDATES:",
      JSON.stringify(OPD_RDU_COMMON_ICD10),
      "",
      ...(caseSummaryPattern ? [caseSummaryPattern, ""] : []),
      ...(criticalScenarioBlock ? [criticalScenarioBlock, ""] : []),
      ...(mandatorySummaryTemplate ? [mandatorySummaryTemplate, ""] : []),
      "EXTERNAL_REFERENCE_SOURCES_FROM_WHITELIST (use only when matchedKnowledge is weak):",
      JSON.stringify(external.evidences),
      "",
      "CONVERSATION_SUMMARY:",
      conversationSummary || "(none)",
      "",
      "CHAT_HISTORY:",
      JSON.stringify(historyForPrompt),
      "",
      `INTENT: ${intent}`,
      "",
      "USER_MESSAGE:",
      messageForModel,
      safeImages.length ? `USER_UPLOADED_IMAGE_COUNT: ${safeImages.length}` : "",
      "",
      "Respond as a real chat assistant.",
      "Do not force numbered sections unless user asks for checklist/template.",
      "If user asks simple question, answer directly in plain Thai.",
      "If user asks diagnosis support, include diagnosis candidate + ICD (if applicable) + minimum evidence.",
      "Keep total answer short, practical, and contextual.",
      "If external sources are used, append 'ReferenceSource:' bullets with url.",
      `MODE: ${mode.toUpperCase()} (FAST = short and quick, PRECISE = more detail).`,
      `ASSISTANT_MODE: ${assistantMode.toUpperCase()}.`,
    ].join("\n");
    const userContentPayload = buildUserContentPayload(prompt, safeImages);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const preferredModel = process.env.OPENAI_CHAT_MODEL || "gpt-4.1-mini";
    const fallbackModels = [preferredModel, "gpt-4.1-mini", "gpt-4o-mini", "gpt-4o"];
    const modelCandidates = Array.from(new Set(fallbackModels.filter(Boolean)));
    const baseAnswerSource: AnswerSource = ranked.hasStrongMatch
      ? external.evidences.length > 0
        ? "mixed"
        : "internal"
      : external.evidences.length > 0
      ? "external"
      : "internal";

    if (shouldStream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          void (async () => {
            try {
              let model = preferredModel;
              let streamReply = "";
              let usage = estimateTokenBillingThb({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
              let lastModelError: unknown = null;
              let completed = false;

              for (const candidate of modelCandidates) {
                try {
                  const responseStream = await (openai.responses as unknown as {
                    stream: (params: {
                      model: string;
                      input: Array<{ role: "system" | "user"; content: unknown }>;
                      max_output_tokens: number;
                    }) => Promise<{
                      [Symbol.asyncIterator]: () => AsyncIterator<{ type?: string; delta?: string }>;
                      finalResponse: () => Promise<OpenAIResponse>;
                    }>;
                  }).stream({
                    model: candidate,
                    input: [
                      { role: "system", content: system },
                      { role: "user", content: userContentPayload },
                    ],
                    max_output_tokens: mode === "fast" ? 520 : 760,
                  });
                  model = candidate;
                  for await (const event of responseStream) {
                    if (event.type === "response.output_text.delta" && event.delta) {
                      streamReply += event.delta;
                      if (!forceSummaryTemplate) {
                        controller.enqueue(encoder.encode(ssePack({ type: "delta", delta: event.delta })));
                      }
                    }
                  }
                  const finalResp = await responseStream.finalResponse();
                  const finalText = "output_text" in finalResp ? String(finalResp.output_text || "").trim() : "";
                  if (!streamReply && finalText) {
                    streamReply = finalText;
                    if (!forceSummaryTemplate) {
                      controller.enqueue(encoder.encode(ssePack({ type: "delta", delta: finalText })));
                    }
                  }
                  const finalUsage = "usage" in finalResp ? finalResp.usage : undefined;
                  usage = estimateTokenBillingThb(readUsageSummary(finalUsage));
                  completed = true;
                  break;
                } catch (error) {
                  lastModelError = error;
                  console.warn("specialist-chat model stream failed:", candidate, error);
                }
              }

              if (!completed) {
                throw lastModelError instanceof Error ? lastModelError : new Error("model_stream_unavailable");
              }

              const rawReply = streamReply.trim() || "ขออภัยครับ ตอนนี้ยังตอบไม่ได้ กรุณาลองใหม่อีกครั้ง";
              const normalizedReply = forceSummaryTemplate
                ? normalizeSummaryTemplateOutput(rawReply, assistantMode, summaryIntent, summarySourceContext)
                : rawReply;
              const withExternalLinks = appendExternalReferenceLinks(normalizedReply, external.evidences);
              const reply = appendToxicologyQuickLinks(withExternalLinks, messageForModel, summarySourceContext);
              const answerSource = resolveAnswerSource({
                assistantMode,
                hasStrongMatch: ranked.hasStrongMatch,
                externalEvidenceCount: external.evidences.length,
                reply,
              });
              if (forceSummaryTemplate) {
                controller.enqueue(
                  encoder.encode(
                    ssePack({
                      type: "delta",
                      delta: reply,
                    })
                  )
                );
              }
              if (!ranked.hasStrongMatch) {
                await queuePendingKnowledgeEntry(message, reply, {
                  externalSources: external.evidences.map((e) => ({
                    title: e.title,
                    url: e.sourceUrl,
                    sourceName: e.sourceName,
                  })),
                  icd10Candidates: extractIcd10Candidates(reply),
                });
              }

              if (userId) {
                try {
                  await prisma.tokenUsageLedger.create({
                    data: {
                      userId,
                      source: "specialist_chat",
                      model,
                      inputTokens: usage.inputTokens,
                      outputTokens: usage.outputTokens,
                      totalTokens: usage.totalTokens,
                      estimatedCostThb: usage.estimatedCostThb,
                      payload: JSON.stringify({ promptVariant: variant }),
                    },
                  });
                } catch (error) {
                  if (isMissingTableError(error)) {
                    console.warn("specialist-chat: TokenUsageLedger table not ready; skip usage log");
                  } else {
                    throw error;
                  }
                }

                await prisma.feedback.createMany({
                  data: [
                    {
                      userId,
                      type: "chat",
                      message,
                      payload: JSON.stringify({
                        source: "specialist_chat",
                        role: "user",
                        promptVariant: variant,
                        deidentifiedBeforeModel: true,
                      }),
                      category: "other",
                      shortSummary: message.slice(0, 180),
                      status: "pending",
                    },
                    {
                      userId,
                      type: "chat",
                      message: reply,
                      payload: JSON.stringify({
                        source: "specialist_chat",
                        role: "assistant",
                        promptVariant: variant,
                        isBot: true,
                        tokenUsage: usage,
                      }),
                      category: "other",
                      shortSummary: reply.slice(0, 180),
                      status: "pending",
                    },
                  ],
                });
              }

              await trackTelemetry({
                userId,
                source: "chat",
                event: "specialist_chat_reply",
                payload: {
                  inputLength: message.length,
                  historyCount: historyForPrompt.length,
                  usedConversationSummary: Boolean(conversationSummary),
                  intent,
                  plan: normalizedPlan,
                  promptVariant: variant,
                  tokenUsage: usage,
                  answerSource,
                  baseAnswerSource,
                  forcedExternalEvidence: forceExternalEvidence,
                },
              });

              controller.enqueue(
                encoder.encode(
                  ssePack({
                    type: "done",
                    answerSource,
                    variant,
                    usage,
                    privacy: { deidentifiedBeforeModel: true },
                  })
                )
              );
            } catch (err) {
              console.error("specialist-chat stream error:", err);
              controller.enqueue(
                encoder.encode(
                  ssePack({
                    type: "error",
                    message: normalizeOpenAiError(err),
                  })
                )
              );
            } finally {
              controller.close();
            }
          })();
        },
      });

      return new NextResponse(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    let resp: OpenAIResponse | null = null;
    let model = preferredModel;
    let lastModelError: unknown = null;
    for (const candidate of modelCandidates) {
      try {
        resp = await openai.responses.create({
          model: candidate,
          input: [
            { role: "system", content: system },
            { role: "user", content: userContentPayload },
          ],
          max_output_tokens: mode === "fast" ? 520 : 760,
        });
        model = candidate;
        break;
      } catch (error) {
        lastModelError = error;
        console.warn("specialist-chat model failed:", candidate, error);
      }
    }
    if (!resp) {
      throw lastModelError instanceof Error ? lastModelError : new Error("model_unavailable");
    }

    const output = "output_text" in resp ? (resp.output_text || "").trim() : "";
    const rawReply = output || "ขออภัยครับ ตอนนี้ยังตอบไม่ได้ กรุณาลองใหม่อีกครั้ง";
    const normalizedReply = forceSummaryTemplate
      ? normalizeSummaryTemplateOutput(rawReply, assistantMode, summaryIntent, summarySourceContext)
      : rawReply;
    const withExternalLinks = appendExternalReferenceLinks(normalizedReply, external.evidences);
    const reply = appendToxicologyQuickLinks(withExternalLinks, messageForModel, summarySourceContext);
    const answerSource = resolveAnswerSource({
      assistantMode,
      hasStrongMatch: ranked.hasStrongMatch,
      externalEvidenceCount: external.evidences.length,
      reply,
    });
    const usage = estimateTokenBillingThb(readUsageSummary(resp.usage));
    if (!ranked.hasStrongMatch) {
      await queuePendingKnowledgeEntry(message, reply, {
        externalSources: external.evidences.map((e) => ({
          title: e.title,
          url: e.sourceUrl,
          sourceName: e.sourceName,
        })),
        icd10Candidates: extractIcd10Candidates(reply),
      });
    }

    if (userId) {
      try {
        await prisma.tokenUsageLedger.create({
          data: {
            userId,
            source: "specialist_chat",
            model,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens,
            estimatedCostThb: usage.estimatedCostThb,
            payload: JSON.stringify({ promptVariant: variant }),
          },
        });
      } catch (error) {
        if (isMissingTableError(error)) {
          console.warn("specialist-chat: TokenUsageLedger table not ready; skip usage log");
        } else {
          throw error;
        }
      }

      await prisma.feedback.createMany({
        data: [
          {
            userId,
            type: "chat",
            message,
            payload: JSON.stringify({
              source: "specialist_chat",
              role: "user",
              promptVariant: variant,
              deidentifiedBeforeModel: true,
            }),
            category: "other",
            shortSummary: message.slice(0, 180),
            status: "pending",
          },
          {
            userId,
            type: "chat",
            message: reply,
            payload: JSON.stringify({
              source: "specialist_chat",
              role: "assistant",
              promptVariant: variant,
              isBot: true,
              tokenUsage: usage,
            }),
            category: "other",
            shortSummary: reply.slice(0, 180),
            status: "pending",
          },
        ],
      });
    }

    await trackTelemetry({
      userId,
      source: "chat",
      event: "specialist_chat_reply",
      payload: {
        inputLength: message.length,
        historyCount: historyForPrompt.length,
        usedConversationSummary: Boolean(conversationSummary),
        intent,
        plan: normalizedPlan,
        promptVariant: variant,
        tokenUsage: usage,
        answerSource,
        baseAnswerSource,
        forcedExternalEvidence: forceExternalEvidence,
      },
    });

    return jsonUtf8({
      ok: true,
      reply,
      answerSource,
      variant,
      usage,
      privacy: { deidentifiedBeforeModel: true },
    });
  } catch (err) {
    console.error("specialist-chat error:", err);
    return jsonUtf8(
      {
        ok: false,
        error: normalizeOpenAiError(err),
      },
      500
    );
  }
}

