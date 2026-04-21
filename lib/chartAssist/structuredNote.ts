import type {
  AssistCardResult,
  AssistMode,
  SafetySweep,
} from "./cardTypes";
import type { CaseClinicalProfile } from "./caseClinicalProfile";
import { uniq } from "./cardTypes";
import {
  buildConciseCC,
  buildTimelinePI,
  extractPeVerbatimFromRaw,
} from "./clinicalTextExtract";
import { normalizeClinicalText } from "./parseCaseFacts";

export type StructuredOpdNote = {
  cc: string;
  pi: string;
  pastHistory: string;
  pe: string;
  assessment: string;
  diagnosis: string;
  differential: string;
  plan: string;
  patientAdvice: string;
};

/** คำแนะแยกตาม section ของโน้ต — แสดง inline ใต้ PI / PE / DDx / Plan */
export type AssistantSectionHints = {
  piMissing: string[];
  peMissing: string[];
  differentialClues: string[];
  planActions: string[];
};

export type AssistantBundle = {
  detectedFacts: string[];
  missingInfo: string[];
  provisionalAssessment: string;
  nextStepSuggestions: string[];
  diagnosisIdeas: string[];
  treatmentHints: string[];
  patientAdviceHints: string[];
  redFlags: string[];
  guidelineSourceIds: string[];
  sectionHints: AssistantSectionHints;
};

export type EvidenceLevel = "low" | "medium" | "high";

function firstNonEmptyLine(text: string): string {
  const t = text.trim();
  if (!t) return "";
  return t.split(/\r?\n/).find((l) => l.trim())?.trim() ?? "";
}

function extractPastHistoryClues(raw: string): string {
  const t = raw.toLowerCase();
  const hits: string[] = [];
  if (/เบาหวาน|\bdm\b|diabetes/i.test(t)) hits.push("DM — verify meds & control");
  if (/ความดัน|\bht\b|hypertension/i.test(t)) hits.push("HTN — verify meds");
  if (/แพ้ยา|allergy|drug allergy/i.test(t)) hits.push("Drug allergy — document agent & reaction");
  if (/หอบหืด|asthma/i.test(t)) hits.push("Asthma — verify therapy");
  if (hits.length === 0) return "PMH: not documented in note — elicit chronic disease, meds, allergies.";
  return `PMH (from text): ${hits.join("; ")}.`;
}

/** PE แบบโน้ตแพทย์ — เฉพาะ bullet findings ไม่มี meta คำอธิบาย */
function mergePhysicalExam(
  peFromText: string[],
  safety: SafetySweep,
  profile?: CaseClinicalProfile,
): string {
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
      : "Not documented.";
  }
  return bullets.map((x) => `- ${x}`).join("\n");
}

function splitMissingForHints(missing: string[]): { pi: string[]; pe: string[] } {
  const peRe =
    /rr|spo2|spo|lung|breath|auscult|rhonchi|wheeze|crackles|retraction|vital|pe\b|exam|pupil|gcs|skin|joint|abdomen|neurovascular|fluctuance|crt|capillary|bp|hr|perfusion|mental status|urine|feeding|work of breathing|mental|spO|oxygen|clear lung/i;
  const pi: string[] = [];
  const pe: string[] = [];
  for (const m of missing) {
    if (peRe.test(m)) pe.push(m);
    else pi.push(m);
  }
  if (pi.length === 0 && pe.length > 0) {
    const half = Math.ceil(pe.length / 2);
    return { pi: pe.slice(0, half), pe: pe.slice(half) };
  }
  if (pe.length === 0 && pi.length > 0) {
    const half = Math.ceil(pi.length / 2);
    return { pi: pi.slice(0, half), pe: pi.slice(half) };
  }
  return { pi, pe };
}

function buildSectionHints(
  detectedFacts: string[],
  missing: string[],
  diagnosisIdeas: string[],
  nextStep: string[],
  treatmentHints: string[],
): AssistantSectionHints {
  const { pi, pe } = splitMissingForHints(missing);
  const differentialClues = uniq([
    ...diagnosisIdeas.slice(0, 4),
    ...detectedFacts.slice(0, 5),
  ]).slice(0, 8);
  const planActions = uniq([...nextStep.slice(0, 8), ...treatmentHints.slice(0, 8)]).slice(0, 12);
  return {
    piMissing: pi.slice(0, 12),
    peMissing: pe.slice(0, 12),
    differentialClues,
    planActions,
  };
}

function countMissingWeight(safety: SafetySweep, cards: AssistCardResult[]): number {
  let n = 0;
  for (const b of safety.items) n += b.missing.length;
  for (const c of cards) n += c.missing.length;
  return n;
}

export function assessEvidenceLevel(
  safety: SafetySweep,
  cards: AssistCardResult[],
  rawLen: number,
): EvidenceLevel {
  const miss = countMissingWeight(safety, cards);
  if (miss > 18 || rawLen < 40) return "low";
  if (miss > 8) return "medium";
  return "high";
}

/** กรอง differential ที่ over-call sepsis/shock/pneumonia และไม่ให้ URI ครองเมื่อผื่นเป็นประเด็นหลัก */
function filterDiagnosisIdeas(
  ideas: string[],
  profile: CaseClinicalProfile,
): string[] {
  const ct = profile.caseType;
  const red = profile.hasSystemicRedFlags;
  const skinPrimary = profile.dominantTheme === "skin_rash" || ct === "dermatology";

  return ideas.filter((raw) => {
    const idea = raw.toLowerCase();
    if (skinPrimary) {
      if (
        idea.includes("viral uri") ||
        idea.includes("upper respiratory") ||
        idea === "viral uri" ||
        (idea.includes("bronchiolitis") && ct === "dermatology")
      ) {
        return false;
      }
    }
    if (idea.includes("sepsis") || idea.includes("shock")) {
      return red || ct === "fever_without_focus" || ct === "trauma";
    }
    if (idea.includes("pneumonia") || idea.includes("ปอดอักเสบ")) {
      return ct === "respiratory" || red;
    }
    return true;
  });
}

function dermatologyDifferentialBlock(profile: CaseClinicalProfile, normalizedText: string): string[] {
  const skinPrimary = profile.dominantTheme === "skin_rash" || profile.caseType === "dermatology";
  if (!skinPrimary) return [];
  const t = normalizedText.toLowerCase();
  const base = [
    "Papular urticaria",
    "Scabies",
    "Viral exanthem",
    "Eczema flare",
    "Impetigo",
  ];
  if (/pain|tender|warm|fluctuant|abscess|cellulitis|ปวด|ร้อน|กดเจ็บ|หนอง|แดงลาม|ฝี/i.test(t)) {
    base.push("Cellulitis / abscess (if painful, warm, tender, fluctuant)");
  }
  return base;
}

function buildProvisionalDiagnosisNote(
  ev: EvidenceLevel,
  profile: CaseClinicalProfile,
  ideas: string[],
): string {
  const filtered = filterDiagnosisIdeas(ideas, profile);
  const lead = filtered[0];
  const skinNote =
    profile.dominantTheme === "skin_rash" || profile.caseType === "dermatology"
      ? " Skin-predominant presentation — prioritize dermatologic DDx."
      : "";

  if (ev === "low") {
    return lead
      ? `Provisional dx: ${lead}.${skinNote} Limited data — refine after vitals & exam.`
      : `Provisional dx: acute undifferentiated illness (${profile.caseType} pattern).${skinNote} Refine after vitals/exam.`;
  }
  if (ev === "medium") {
    return lead
      ? `Provisional dx: ${lead}.${skinNote} Confirm with targeted exam/labs.`
      : `Provisional dx: acute illness — ${profile.dominantTheme} lead.${skinNote} Pending further data.`;
  }
  if (filtered.length) {
    const top = filtered.slice(0, 4).join("; ");
    return `Provisional dx: ${top}.${skinNote}`;
  }
  return `Provisional dx: ${profile.caseType} — ${profile.dominantTheme} presentation.${skinNote} Refine clinically.`;
}

function finalizePlanBlock(
  structuredPlan: string,
  bundle: AssistantBundle,
  profile: CaseClinicalProfile,
): string {
  const trimmed = structuredPlan.trim();
  if (trimmed) return trimmed;
  const actions = bundle.sectionHints.planActions;
  if (actions.length) {
    return `=== Plan (problem-based) ===\n${actions.map((x) => `- ${x}`).join("\n")}`;
  }
  return `=== Plan ===\n- Vitals + focused exam for ${profile.dominantTheme}.\n- Counsel return precautions; Rx/supportive care per syndrome.\n- Follow-up PRN.`;
}

function primaryProblemLine(profile: CaseClinicalProfile): string {
  switch (profile.dominantTheme) {
    case "skin_rash":
      return "ประเด็นหลัก (primary problem): ผื่น/ผิวหนัง — การวินิจฉัยและแผนต้องตามประเด็นนี้ก่อน";
    case "respiratory":
      return "ประเด็นหลัก (primary problem): ทางเดินหายใจ (URI / lower airway ตามหลักฐาน)";
    case "gi":
      return "ประเด็นหลัก (primary problem): ทางเดินอาหาร";
    case "trauma":
      return "ประเด็นหลัก (primary problem): การบาดเจ็บ/ศีรษะ (ตามบริบท)";
    case "fever_systemic":
      return "ประเด็นหลัก (primary problem): ไข้/พิษระบบ — ต้องหาแหล่งและความรุนแรง";
    default:
      return "ประเด็นหลัก (primary problem): ยังไม่ชัด — สรุปจากประวัติและการตรวจจริง";
  }
}

function problemBasedPlan(cards: AssistCardResult[], profile: CaseClinicalProfile): string {
  const blocks: string[] = [];

  const pushBlock = (title: string, list: AssistCardResult[]) => {
    if (!list.length) return;
    const inner: string[] = [`=== ${title} ===`];
    for (const c of list) {
      if (c.checkNext.length) {
        inner.push(`[${c.label}] ขั้นต่อ: ${c.checkNext.slice(0, 5).join("; ")}`);
      }
      if (c.actionNow.length) {
        inner.push(`[${c.label}] ดำเนินการ: ${c.actionNow.slice(0, 5).join("; ")}`);
      }
    }
    blocks.push(inner.join("\n"));
  };

  const head = cards.filter((c) => c.id.includes("head-injury"));
  const gi = cards.filter((c) => c.id.includes("bloody-diarrhea") || c.id.includes("abdominal-pain"));
  const skin = cards.filter((c) => c.id.includes("soft-tissue"));
  const resp = cards.filter((c) => c.id.includes("uri-wheeze"));
  const fever = cards.filter((c) => c.id.includes("fever-sepsis"));

  pushBlock("Head / injury (if applicable)", head);
  pushBlock("GI problem", gi);
  pushBlock("Skin problem", skin);
  pushBlock("Respiratory problem", resp);
  if (fever.length && (profile.caseType === "fever_without_focus" || profile.hasSystemicRedFlags)) {
    pushBlock("Fever / source & severity (OPD — escalate only if red flags)", fever);
  } else if (fever.length) {
    pushBlock("Fever — clarify severity (avoid sepsis template without evidence)", fever);
  }

  if (!blocks.length) {
    for (const c of cards) {
      if (c.checkNext.length) {
        blocks.push(`[${c.label}] ขั้นต่อ: ${c.checkNext.slice(0, 5).join("; ")}`);
      }
      if (c.actionNow.length) {
        blocks.push(`[${c.label}] ดำเนินการ: ${c.actionNow.slice(0, 5).join("; ")}`);
      }
    }
  }

  if (!blocks.length) {
    return "";
  }
  return blocks.join("\n\n");
}

export function buildAssistantBundle(
  rawText: string,
  mode: AssistMode,
  safety: SafetySweep,
  cards: AssistCardResult[],
  referenceIds: string[],
  profile: CaseClinicalProfile,
): AssistantBundle {
  const detectedFacts: string[] = [];
  for (const b of safety.items) {
    for (const d of b.documented) detectedFacts.push(`[${b.label}] ${d}`);
  }
  for (const c of cards) {
    for (const d of c.documented) detectedFacts.push(`${c.label}: ${d}`);
  }

  const missingInfo: string[] = [];
  for (const b of safety.items) missingInfo.push(...b.missing.map((m) => `[${b.label}] ${m}`));
  for (const c of cards) missingInfo.push(...c.missing.map((m) => `${c.label}: ${m}`));

  const nextStepSuggestions = uniq([
    ...safety.items.flatMap((b) => b.checkNext),
    ...cards.flatMap((c) => c.checkNext),
  ]);

  const rawDiagnosisIdeas = uniq(cards.flatMap((c) => c.mostSupportedDiagnosisIdeas));
  const diagnosisIdeas = filterDiagnosisIdeas(rawDiagnosisIdeas, profile);

  const treatmentHints = uniq([
    ...cards.flatMap((c) => c.medicationClassSuggestions),
    ...cards.flatMap((c) => c.actionNow),
  ]);

  const patientAdviceHints = uniq([
    ...cards.flatMap((c) => c.dispositionHints),
    ...cards.flatMap((c) => c.avoidRoutine).map((x) => `หลีกเลี่ยงสิ่งที่ไม่จำเป็น: ${x}`),
  ]);

  const redFlags = uniq(
    safety.items.flatMap((b) => b.redFlags).concat(cards.flatMap((c) => c.redFlags)),
  );

  const ev = assessEvidenceLevel(safety, cards, rawText.length);
  const cardSummary =
    cards.length > 0
      ? cards.map((c) => c.label).join(", ")
      : "ยังไม่มีแนวทางจับกลุ่มโรคชัดจากตัวช่วย — อาจต้องเพิ่มประวัติ/การตรวจ";

  const provisionalAssessment = [
    primaryProblemLine(profile).replace(/^ประเด็นหลัก \(primary problem\): /, "Impression scaffold: "),
    `Pattern: ${profile.caseType}; lead symptoms: ${profile.dominantTheme}; setting: ${mode}.`,
    `Cards: ${cardSummary}.`,
    ev === "low"
      ? "Data thin — expand HPI/exam before firm conclusions."
      : ev === "medium"
        ? "Gaps remain — complete vitals/exam as indicated."
        : "Adequate for provisional planning — confirm at bedside.",
  ].join(" ");

  const sectionHints = buildSectionHints(
    uniq(detectedFacts),
    uniq(missingInfo),
    diagnosisIdeas,
    nextStepSuggestions,
    treatmentHints,
  );

  return {
    detectedFacts: uniq(detectedFacts),
    missingInfo: uniq(missingInfo),
    provisionalAssessment,
    nextStepSuggestions,
    diagnosisIdeas,
    treatmentHints,
    patientAdviceHints,
    redFlags,
    guidelineSourceIds: uniq(referenceIds),
    sectionHints,
  };
}

export function buildStructuredOpdNote(
  rawText: string,
  mode: AssistMode,
  safety: SafetySweep,
  cards: AssistCardResult[],
  bundle: AssistantBundle,
  profile: CaseClinicalProfile,
  peFromText: string[],
): StructuredOpdNote {
  const ev = assessEvidenceLevel(safety, cards, rawText.length);
  const fl = firstNonEmptyLine(rawText);
  const cc = buildConciseCC(rawText, fl);
  const pi = buildTimelinePI(rawText);
  const pastHistory = extractPastHistoryClues(rawText);
  const peCombined = uniq([...peFromText, ...extractPeVerbatimFromRaw(rawText)]);
  const normalizedForDerm = normalizeClinicalText(rawText);
  const pe = mergePhysicalExam(peCombined, safety, profile);

  const assessmentLines: string[] = [
    `${primaryProblemLine(profile)}`,
    `Working pattern: ${profile.caseType}; dominant theme: ${profile.dominantTheme}.`,
  ];
  if (cards.length) {
    assessmentLines.push(`Syndrome alignment: ${cards.map((c) => c.label).join(", ")}.`);
  } else {
    assessmentLines.push("No automated syndrome match — anchor to bedside findings.");
  }
  if (ev !== "high") {
    assessmentLines.push("Documentation incomplete — add vitals/exam as indicated.");
  }
  const assessment = assessmentLines.join("\n");

  const diagnosis = buildProvisionalDiagnosisNote(ev, profile, bundle.diagnosisIdeas);

  const diffIdeas = filterDiagnosisIdeas(bundle.diagnosisIdeas, profile);
  const dermDx = dermatologyDifferentialBlock(profile, normalizedForDerm);
  const mergedDiff = uniq([...dermDx, ...diffIdeas]);
  const differential =
    mergedDiff.length > 0
      ? mergedDiff.map((d) => `- ${d}`).join("\n")
      : "- DDx: refine by dominant complaint, exam, and course — avoid anchor bias without findings.";

  const plan = finalizePlanBlock(problemBasedPlan(cards, profile), bundle, profile);

  const adviceParts = bundle.patientAdviceHints.slice(0, 6);
  const skinPrimary = profile.dominantTheme === "skin_rash" || profile.caseType === "dermatology";
  const defaultSkinAdvice =
    "รีบกลับมาฉุกเฉินถ้าแดงลามเร็ว ร้อนมาก ปวดรุนแรง มีหนองแพร่ หายใจลำบาก ปาก/ลิ้นบวม หรือซึม — มิฉะนั้นทำตามแผนและนัดตามคำแนะนำ";
  const defaultGeneralAdvice =
    "Return if worse (breathing difficulty, unable to feed, lethargy, new rash with fever). Otherwise routine follow-up per plan.";
  const patientAdvice =
    adviceParts.length > 0
      ? uniq(adviceParts).join("\n")
      : skinPrimary
        ? defaultSkinAdvice
        : defaultGeneralAdvice;

  return {
    cc,
    pi,
    pastHistory,
    pe,
    assessment,
    diagnosis,
    differential,
    plan,
    patientAdvice,
  };
}
