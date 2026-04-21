/**
 * AI-first drafting layer (Layer B) — primary interpreter of raw text into structured Thai clinical JSON.
 *
 * Pipeline order: `analyzeOpdCase` supplies guardrail context → this module drafts → `postCheckOpdAiClinicalNote` enforces.
 * Product is hybrid (not AI-only): rules handle negation, modes, red flags, RDU, med safety — see `opdAssistArchitecture.ts`.
 * Env: `OPENAI_API_KEY`, optional `OPD_ASSIST_AI_MODEL` (default gpt-4o-mini), `OPD_ASSIST_AI_ENABLED=false` for rule-only output.
 */
import { openai } from "@/lib/openai";
import type { AssistMode } from "./cardTypes";
import type { OpdAssistRuleAnalysis } from "./analyzeCase";
import { buildLayer1FromClinicalAi, buildStructuredNoteFromClinicalAi } from "./opdAssistAiFormat";
import { postCheckOpdAiClinicalNote } from "./opdAssistAiPostCheck";
import type {
  ErPrimarySurveyJson,
  ObGyneBleedingSeverityJson,
  OpdAssistAiBundle,
  OpdAssistAiPhase1Meta,
  OpdAssistPromptStats,
  OpdAiClinicalNoteJson,
  OpdAiProblemJson,
  PsychRiskAssessmentJson,
} from "./opdAssistAiTypes";
import type { ClinicalInvestigationV1, OpdAssistInvestigationsStatsV1 } from "./clinicalInvestigationV1";
import { computeOpdAssistInvestigationsStatsV1 } from "./clinicalInvestigationV1";
import { summarizeProblemEvidenceForLog } from "./problemEvidenceV1";
import { formatObGynePathwayHintsForAi, inferObGynePathwayHints } from "./obGynePathways";
import { normalizeClinicalText } from "./parseCaseFacts";
import { getVisitModeStyleGuidance } from "./triggers";
import { formatProblemPacksForAiPrompt } from "./opdProblemPacks";
import { formatFeverChildFrameworkForAi } from "./feverChildOpdFramework";
import { formatGiDehydrationFrameworkForAi } from "./giDehydrationOpdFramework";
import { formatAbdominalPainFrameworkForAi } from "./abdominalPainOpdFramework";
import { formatUriRespiratoryFrameworkForAi } from "./uriRespiratoryOpdFramework";
import { formatTraumaFrameworkForAi } from "./traumaOpdFramework";
import { formatPsychFrameworkForAi } from "./psychOpdFramework";
import { formatDysuriaUtiFrameworkForAi } from "./dysuriaUtiOpdFramework";
import { formatHeadacheDizzinessFrameworkForAi } from "./headacheDizzinessOpdFramework";
import { formatBackMusculoskeletalFrameworkForAi } from "./backMusculoskeletalOpdFramework";
import { formatMedicationSupportForAiPrompt } from "./medicationSupportLayer";
import { formatAntibioticRduOverlayForAi } from "./antibioticRduOverlay";
import { formatAuditFriendlyLanguageForAiPrompt } from "./auditFriendlyLanguage";
import { formatLikelyAdmitBridgeForAi } from "./likelyAdmitBridge";
import { formatDyspneaHypoxemiaErOverlayForAi } from "./dyspneaHypoxemiaErOverlay";
import { formatSeizureAlteredMentalStatusErOverlayForAi } from "./seizureAlteredMentalStatusErOverlay";
import { formatAnaphylaxisErOverlayForAi } from "./anaphylaxisErOverlay";
import { formatSepsisShockErOverlayForAi } from "./sepsisShockErOverlay";
import { formatPoisoningOverdoseErOverlayForAi } from "./poisoningOverdoseErOverlay";
import { formatLaborRoomLaborEvaluationOverlayForAi } from "./laborRoomLaborEvaluationOverlay";
import { formatAntepartumBleedingOverlayForAi } from "./antepartumBleedingOverlay";
import { formatPreeclampsiaOverlayForAi } from "./preeclampsiaOverlay";
import { formatEarlyPregnancyPainBleedingOverlayForAi } from "./earlyPregnancyPainBleedingOverlay";
import { formatAbnormalUterineBleedingOverlayForAi } from "./abnormalUterineBleedingOverlay";
import { formatOpdClinicalNoteFromRule, formatOpdClinicalNoteLayout } from "./opdNoteLayout";
import {
  formatGlobalRulesOnlyForSystemPrompt,
  formatHybridArchitectureForSystemPrompt,
} from "./opdAssistArchitecture";

export type OpdAssistHybridResult = OpdAssistRuleAnalysis & {
  aiAssist: OpdAssistAiBundle;
  /** Canonical copy/export layout (Thai OPD headings) */
  formattedClinicalNote: string;
  /** User + system prompt size for observability (~4 chars/token) */
  promptStats?: OpdAssistPromptStats;
  /** Normalized investigations v1 when AI path produced any (else omitted) */
  investigations?: ClinicalInvestigationV1[];
  investigationsStats?: OpdAssistInvestigationsStatsV1;
  /** Post-checked problems[] including confidence / evidence v1 fields when AI ran */
  aiProblems?: OpdAiProblemJson[];
};

type FinalizeHybridOptions = {
  promptStats?: OpdAssistPromptStats;
  investigations?: ClinicalInvestigationV1[];
  investigationsStats?: OpdAssistInvestigationsStatsV1;
  aiProblems?: OpdAiProblemJson[];
};

function finalizeHybrid(
  base: OpdAssistRuleAnalysis & { aiAssist: OpdAssistAiBundle },
  aiForLayout: OpdAiClinicalNoteJson | null,
  opts?: FinalizeHybridOptions,
): OpdAssistHybridResult {
  const layoutOpts =
    base.mode === "ER" && base.erImmediateLifeThreat.reorderNarrative
      ? { erImmediateLifeThreatReorder: true as const }
      : undefined;
  const formattedClinicalNote = aiForLayout
    ? formatOpdClinicalNoteLayout(aiForLayout, base.mode, layoutOpts)
    : formatOpdClinicalNoteFromRule(base);
  return {
    ...base,
    formattedClinicalNote,
    ...(opts?.promptStats ? { promptStats: opts.promptStats } : {}),
    ...(opts?.investigations?.length ? { investigations: opts.investigations } : {}),
    ...(opts?.investigationsStats ? { investigationsStats: opts.investigationsStats } : {}),
    ...(opts?.aiProblems?.length ? { aiProblems: opts.aiProblems } : {}),
  };
}

function prepareClinicalAiRequest(
  rawText: string,
  base: OpdAssistRuleAnalysis,
): { systemPrompt: string; userPayload: string; promptStats: OpdAssistPromptStats } {
  const systemPrompt = buildClinicalSystemPrompt(base.mode);
  const userPayload = buildClinicalUserPayload(rawText, base);
  const totalCharCount = systemPrompt.length + userPayload.length;
  return {
    systemPrompt,
    userPayload,
    promptStats: {
      userPayloadCharCount: userPayload.length,
      systemPromptCharCount: systemPrompt.length,
      totalCharCount,
      approxTokens: Math.ceil(totalCharCount / 4),
      problemBlockCount: base.opdFramework.layer2.length,
      mode: base.mode,
    },
  };
}

export function isOpdAssistAiPhase1Enabled(): boolean {
  if (process.env.OPD_ASSIST_AI_ENABLED === "false") return false;
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

function stripCodeFences(s: string) {
  return (s || "").replace(/```json|```/g, "").trim();
}

function extractJsonObject<T>(text: string): T | null {
  try {
    const s = stripCodeFences(text);
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    return JSON.parse(s.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

function parseErPrimarySurveyFromParsed(raw: unknown): ErPrimarySurveyJson | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const e = raw as Record<string, unknown>;
  const g = (k: string) => String(e[k] ?? "").trim();
  const ps: ErPrimarySurveyJson = {
    airway: g("airway"),
    breathing: g("breathing"),
    circulation: g("circulation"),
    disability: g("disability"),
    exposure: g("exposure"),
  };
  if (!ps.airway && !ps.breathing && !ps.circulation && !ps.disability && !ps.exposure) return undefined;
  return ps;
}

function mergeErFieldsFromParsed(parsed: Record<string, unknown>): Partial<OpdAiClinicalNoteJson> {
  const out: Partial<OpdAiClinicalNoteJson> = {};
  const opt = (key: "erTriageConcern" | "erImmediateManagement" | "erReassessment" | "erDisposition") => {
    const v = parsed[key];
    if (v === undefined) return;
    out[key] = String(v ?? "").trim();
  };
  opt("erTriageConcern");
  opt("erImmediateManagement");
  opt("erReassessment");
  opt("erDisposition");
  const ps = parseErPrimarySurveyFromParsed(parsed.erPrimarySurvey);
  if (ps) out.erPrimarySurvey = ps;
  return out;
}

function mergeTraumaFieldsFromParsed(parsed: Record<string, unknown>): Partial<OpdAiClinicalNoteJson> {
  const out: Partial<OpdAiClinicalNoteJson> = {};
  const opt = (
    key:
      | "traumaMechanism"
      | "traumaTimeOfInjury"
      | "traumaSecondarySurvey"
      | "traumaFocusedAssessment"
      | "traumaImagingProcedure"
      | "traumaPlan"
      | "traumaDisposition",
  ) => {
    const v = parsed[key];
    if (v === undefined) return;
    out[key] = String(v ?? "").trim();
  };
  opt("traumaMechanism");
  opt("traumaTimeOfInjury");
  opt("traumaSecondarySurvey");
  opt("traumaFocusedAssessment");
  opt("traumaImagingProcedure");
  opt("traumaPlan");
  opt("traumaDisposition");
  const tps = parseErPrimarySurveyFromParsed(parsed.traumaPrimarySurvey);
  if (tps) out.traumaPrimarySurvey = tps;
  return out;
}

function parsePsychRiskFromParsed(raw: unknown): PsychRiskAssessmentJson | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const e = raw as Record<string, unknown>;
  const g = (k: keyof PsychRiskAssessmentJson) => String(e[k] ?? "").trim();
  const o: PsychRiskAssessmentJson = {
    suicidalIdeation: g("suicidalIdeation"),
    suicidalPlan: g("suicidalPlan"),
    selfHarmHistory: g("selfHarmHistory"),
    homicidalIdeation: g("homicidalIdeation"),
    psychosis: g("psychosis"),
    substanceUse: g("substanceUse"),
  };
  if (!Object.values(o).some(Boolean)) return undefined;
  return o;
}

function mergePsychFieldsFromParsed(parsed: Record<string, unknown>): Partial<OpdAiClinicalNoteJson> {
  const out: Partial<OpdAiClinicalNoteJson> = {};
  const opt = (
    key:
      | "psychChiefConcern"
      | "psychHpi"
      | "psychMentalStatusExam"
      | "psychSynthesisAssessment"
      | "psychPlan"
      | "psychDispositionReferral",
  ) => {
    const v = parsed[key];
    if (v === undefined) return;
    out[key] = String(v ?? "").trim();
  };
  opt("psychChiefConcern");
  opt("psychHpi");
  opt("psychMentalStatusExam");
  opt("psychSynthesisAssessment");
  opt("psychPlan");
  opt("psychDispositionReferral");
  const r = parsePsychRiskFromParsed(parsed.psychRiskAssessment);
  if (r) out.psychRiskAssessment = r;
  return out;
}

function parseObGyneBleedingSeverity(raw: unknown): ObGyneBleedingSeverityJson | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const e = raw as Record<string, unknown>;
  const level = String(e.level ?? "").trim();
  const quantifiedDetails = String(e.quantifiedDetails ?? "").trim();
  if (!level && !quantifiedDetails) return undefined;
  return {
    level: level || "unknown",
    quantifiedDetails: quantifiedDetails || "—",
  };
}

function mergeObGyneFieldsFromParsed(parsed: Record<string, unknown>): Partial<OpdAiClinicalNoteJson> {
  const out: Partial<OpdAiClinicalNoteJson> = {};
  for (const key of [
    "obGyneTriageSummary",
    "obGyneDisposition",
    "obGynePregnancyStatus",
    "obGyneGestationalAge",
    "obGyneClinicalPathway",
  ] as const) {
    const v = parsed[key];
    if (v === undefined) continue;
    out[key] = String(v ?? "").trim();
  }
  const bs = parseObGyneBleedingSeverity(parsed.obGyneBleedingSeverity);
  if (bs) out.obGyneBleedingSeverity = bs;
  return out;
}

/** Coerce legacy {cc,pi,pe}-only responses into full clinical note shape */
function coerceToClinicalNoteJson(
  parsed: Record<string, unknown>,
  rule: OpdAssistRuleAnalysis,
): OpdAiClinicalNoteJson {
  const sn = rule.structuredNote;
  const er = mergeErFieldsFromParsed(parsed);
  const tr = mergeTraumaFieldsFromParsed(parsed);
  const psych = mergePsychFieldsFromParsed(parsed);
  const obGyne = mergeObGyneFieldsFromParsed(parsed);
  const invFromParsed = Array.isArray(parsed.investigations)
    ? (parsed.investigations as NonNullable<OpdAiClinicalNoteJson["investigations"]>)
    : undefined;

  if (
    Array.isArray(parsed.problems) ||
    parsed.pastHistoryMedsAllergy !== undefined ||
    Array.isArray(parsed.investigations)
  ) {
    return {
      cc: String(parsed.cc ?? ""),
      pi: String(parsed.pi ?? ""),
      pastHistoryMedsAllergy: String(parsed.pastHistoryMedsAllergy ?? sn.pastHistory),
      pe: String(parsed.pe ?? ""),
      problemList: String(parsed.problemList ?? ""),
      problems: Array.isArray(parsed.problems) ? (parsed.problems as OpdAiClinicalNoteJson["problems"]) : [],
      patientAdvice: String(parsed.patientAdvice ?? sn.patientAdvice),
      ...(invFromParsed !== undefined ? { investigations: invFromParsed } : {}),
      ...er,
      ...tr,
      ...psych,
      ...obGyne,
    };
  }
  return {
    cc: String(parsed.cc ?? ""),
    pi: String(parsed.pi ?? ""),
    pastHistoryMedsAllergy: sn.pastHistory,
    pe: String(parsed.pe ?? ""),
    problemList: "",
    problems: [],
    patientAdvice: sn.patientAdvice,
    ...(invFromParsed !== undefined ? { investigations: invFromParsed } : {}),
    ...er,
    ...tr,
    ...psych,
    ...obGyne,
  };
}

function buildOpdClinicalSystemPrompt(): string {
  return [
    formatHybridArchitectureForSystemPrompt(),
    "",
    "You draft Thai OPD notes for physicians. Output ONE JSON object only (no markdown). Clinical prose in concise medical Thai; English only for usual terms (URI, SpO2, etc.).",
    "Downstream, fields map to this export layout: CC → PI → Past history/medication/allergy → PE → optional Investigations (structured) → numbered Problem list → for each problem (Assessment, Diagnosis, Differential bullets, Plan, What to ask next, What to examine next) → Advice / warning signs. Write so each block is ready for that structure.",
    "",
    "STYLE (strict):",
    "- Thai outpatient physician voice: short, natural, clinical — not conversational, not tutorial, not AI-polite filler.",
    "- No explanatory narration (do not explain what CC/PI/PE mean; do not lecture).",
    "- Do not parrot, quote, or paste the raw input as the final note — synthesize into clean documentation.",
    "- No meta-commentary: avoid phrases like 'from the note', 'according to the documentation', 'based on the provided text', or similar.",
    "- Avoid AI-sounding phrases in any language (e.g. โดยสรุปจากข้อมูล, it is important to note, ดังนั้น, as mentioned above).",
    "",
    "SECTIONS:",
    "- cc: one tight line; symptom + duration if known; never age/weight as CC.",
    "- pi: concise timeline narrative — order of events, key positives/negatives; no bullet dump; demographics only when clinically relevant (not repetitive ID block).",
    "- pastHistoryMedsAllergy: only relevant PMH/meds/allergy; if unknown, one short line ยังไม่ได้บันทึก/สอบถาม — no invention.",
    "- pe: objective findings only (dash bullets OK); no meta (ไม่พบในโน้ต); no repeating PI; pertinent negatives only if documented.",
    "- problemList: clear primary vs secondary, short lines.",
    "- problems[]: per problem — short assessment; provisionalDiagnosis when evidence incomplete; differential 3–5 lines, ranked if possible;",
    "  Include optional clinicalProblemId on each problems[] item — copy the id from RULE_PROBLEM_BLOCK_IDS (first column) so the rule layer can align order.",
    "  Optional per problem (v1): confidenceLevel ∈ high|medium|low|unknown; uncertaintyReasons[] (short strings); evidenceSupport[] with { type: history|exam|investigation, text, relation: supports|against|missing, refId? } — refId may match investigations[].investigationId or clinicalProblemId (no character offsets).",
    "  plan: concrete next steps (ยา/ตรวจเพิ่ม/การปฏิบัติตัว) — actionable, not vague.",
    "  askNext & examineNext: only the MOST relevant gaps (about 3–5 items each max); omit filler questions.",
    "- patientAdvice: brief return precautions; proportional severity.",
    "- investigations[] (optional v1): structured labs / imaging / ECG / bedside when ordered or resulted — see INVESTIGATIONS_SCHEMA_V1 in user message; omit key if none.",
    "",
    "CLINICAL RULES:",
    "- One visit can list multiple simultaneous problems — one problemList for the whole visit.",
    "- Do NOT merge unrelated complaints into a single diagnosis; separate by system/clinical focus.",
    "- Each problems[] item must have its own assessment, provisionalDiagnosis, differential, plan (secondary problems: keep concise).",
    "- Examples: back pain + URI = two problems; rash + fever/URI = two problems; dysuria + low back pain may be one syndrome or two — use context; if both tracks are documented as active issues, keep two problems with clear linkage in assessment.",
    "- Primary = best match to chief complaint OR most urgent; RULE_CANDIDATE_PROBLEMS order is a hint.",
    "- No default sepsis/URI/pneumonia without support. No invented facts.",
    "- When URI_RESPIRATORY_FRAMEWORK appears in the user message (active), follow its severity logic (RR/SpO2/WOB), negatives to document, and differentials — do not diagnose pneumonia from fever+cough alone; keep URI secondary if another problem clearly dominates.",
    "- Escalate concern only with real red-flag clues.",
    "",
    "FORBIDDEN placeholders / platitudes (use real draft wording instead): generic ตามความเหมาะสม only, follow up as appropriate, no automated syndrome match, สรุปตามการตรวจจริงเท่านั้น as empty filler.",
    "",
    "VISIT_MODE (from rule engine) changes reasoning priority and note style — it does NOT replace the problem list; multiple problems per visit remain valid.",
    "When systemicRedFlags or RULE_RED_FLAGS indicate urgent risk, prioritize acute safety over routine OPD phrasing even if visit mode is OPD.",
    "",
    "Use RULE ENGINE context in the user message; follow it unless raw text clearly contradicts.",
    "",
    "STEP 2 (this model) — you perform:",
    "- CC rewrite; PI timeline rewrite; PE extraction rewrite (objective only).",
    "- Problem grouping & prioritization consistent with RULE + SYMPTOM_PACKS.",
    "- Ranked provisional diagnosis and ranked differential per problem.",
    "- Problem-based plan drafting; practical patient advice / return precautions.",
    "",
    "STEP 3–4 — SYMPTOM_PACKS block lists templates (ask/exam/negatives/DDx/plan hints) by roadmap order; synthesize into problems[] — do not dump raw lists.",
    "",
    "STEP 5 — disease-specific refinement is future; prefer evidence in raw text + RULE over rare diagnoses.",
    "",
    "MEDICATION_SUPPORT (when plan includes drugs):",
    "- For each problem with pharmacologic treatment, add suggestedMedications[] (tier=suggested) — draft / assistant-generated; NOT the legally finalized prescription.",
    "- Use finalizedMedications[] ONLY when the chart explicitly documents a confirmed order/prescription the clinician is finalizing; otherwise leave empty.",
    "- Each medication object MUST include ALL string keys: drugName, strength, dosePerAdministration, route, frequency, timingInstruction, duration, prnCondition, maxDailyDose, pediatricWeightBasedNote — use \"—\" for unknown (never omit keys; never hide missing details).",
    "- PRN: set prnCondition when PRN; otherwise \"—\". maxDailyDose when relevant; otherwise \"—\".",
    "- Pediatrics: if MEDICATION_SUPPORT_CONTEXT.blockPediatricWeightBasedNumericalDosing is true, do NOT write numeric mg/kg or weight-based calculated doses — put explanation in pediatricWeightBasedNote (e.g. need weight in kg).",
    "- medicationSafetyFlags on a problem is optional; rule layer may add allergy/duplicate hints.",
    "",
    "ANTIBIOTIC_RDU / STEWARDSHIP (when ANTIBIOTIC_RDU_OVERLAY is active in the user message):",
    "- Align antibacterial discussion with rule supportLevel (evidence_weak / incomplete / partially_supportive / severe_complicated); do not default antibiotics for typical viral URI without bacterial features.",
    "- Do not change diagnosis solely to justify antibiotics; document conditional reasoning (e.g. if focal crackles + hypoxemia emerge, pneumonia becomes more supportable).",
    "- If evidence remains weak: prefer symptomatic care, safety-net, follow-up — state what exam/test would strengthen a bacterial diagnosis.",
    "",
    "AUDIT_FRIENDLY_LANGUAGE (always in user message): use conditional phrasing (consider if / if exam shows…); avoid fabricated certainty; separate fact vs inference.",
    "LIKELY_ADMIT_BRIDGE (when active in user message): document inpatient-relevant gaps (I/O, perfusion, MS, severity, admission labs/imaging) when admission trajectory is plausible.",
    "DYSPNEA_HYPOXEMIA_ER_OVERLAY (when active): lead with ABC/oxygenation/stabilization before routine OPD-style CC/PI; do not bury breathing emergencies.",
    "SEIZURE_ALTERED_MENTAL_STATUS_ER_OVERLAY (when active): lead with ABC/AMS/GCS stabilization before routine OPD-style CC/PI; do not bury seizure or reduced consciousness.",
    "ANAPHYLAXIS_ER_OVERLAY (when active): suspected anaphylaxis — IM epinephrine first-line per protocol; ABC before long HPI; do not treat as rash-only when systemic involvement is present.",
  ].join("\n");
}

function buildLaborRoomClinicalSystemPrompt(): string {
  return [
    formatGlobalRulesOnlyForSystemPrompt(),
    "",
    "You draft Thai obstetric triage / labor-room documentation for physicians. Output ONE JSON object only (no markdown). Concise medical Thai; English for usual terms (GA, EGA, FHR, CTG, PPH, etc.).",
    "VISIT_MODE is LABOR_ROOM — obstetric acute / labor evaluation; do NOT structure like a routine URI/respiratory OPD note.",
    "",
    "SURFACE EARLY (labor evaluation — weave into structured keys + obGyneTriageSummary; not CC-only):",
    "- Pregnancy status, gestational age, parity / prior cesarean.",
    "- Contraction frequency, duration, pattern; membrane status (ROM time, fluid).",
    "- Vaginal bleeding (quantify; obGyneBleedingSeverity).",
    "- Fetal movement vs baseline; fetal status (FHR/CTG) if documented.",
    "- Maternal vitals — no invented numbers.",
    "",
    "PRIORITY:",
    "1) obGynePregnancyStatus + obGyneGestationalAge + obGyneBleedingSeverity — must appear as structured keys (early in JSON); pregnancy status and GA are never buried only inside PI.",
    "2) obGyneClinicalPathway — set to the matching token when RULE_OB_GYNE_PATHWAY_HINTS applies (e.g. preeclampsia_severe_features, postpartum_urgent_ob); otherwise general_labor_obstetric or none.",
    "3) obGyneTriageSummary — short narrative tying parity, fetal status, vitals/hemodynamics, and red flags.",
    "4) cc — chief concern anchor.",
    "5) pi — contractions/labor course; for headache/visual/epigastric pain in pregnancy, document preeclampsia spectrum explicitly when applicable.",
    "6) pe — objective; no invented vitals/FHR.",
    "7) problemList + problems[] — rank by acuity (PPH, severe HTN / preeclampsia, non-reassuring fetal status, sepsis) first.",
    "8) obGyneDisposition — explicit: latent labor / active labor / observe / urgent OB review / refer / L&D admit / OR / transfer / discharge with safety-net (match local workflow).",
    "9) patientAdvice — brief.",
    "",
    "REQUIRED JSON KEYS (LABOR_ROOM):",
    "- obGynePregnancyStatus: pregnant / not pregnant / unknown / postpartum / unable to assess (or concise Thai).",
    "- obGyneGestationalAge: GA/EGA string (e.g. 34+2 wks, ไม่ทราบแน่ชัด) — use \"—\" only if truly not discussed.",
    "- obGyneBleedingSeverity: object { level, quantifiedDetails } — level ∈ none|minimal|light|moderate|heavy|life_threatening|not_applicable|unknown; quantifiedDetails = pads/h, clots, estimated loss, orthostasis, transfusion (\"—\" if unknown).",
    "- obGyneClinicalPathway: token string (see RULE_OB_GYNE_PATHWAY_HINTS in user message when present).",
    "- obGyneTriageSummary, cc, pi, pastHistoryMedsAllergy, pe, problemList, problems[], obGyneDisposition, patientAdvice.",
    "- investigations[] (optional v1): see INVESTIGATIONS_SCHEMA_V1 in user message (U/S, β-hCG, labs when ordered); omit key if none.",
    "- problems[]: optional confidenceLevel, uncertaintyReasons, evidenceSupport per PROBLEM_EVIDENCE_V1 in user message.",
    "",
    "PATHWAY RULES (must align problems[] + plan when triggered):",
    "- Severe headache / visual disturbance / epigastric or RUQ pain / severe-range BP or named preeclampsia in pregnancy → preeclampsia_severe_features pathway; urgent OB assessment — not URI.",
    "- Postpartum heavy bleeding OR postpartum fever / infection concern → postpartum_urgent_ob; quantify bleeding and vitals; explicit disposition.",
    "- Pain + bleeding in early pregnancy (when presenting as such) → early_pregnancy_bleeding_ectopic_miscarriage; ectopic vs miscarriage DDx and workup language.",
    "",
    "RULES:",
    "- Do not anchor mild URI symptoms when presentation is obstetric.",
    "- Labor notes must not look like URI/OPD-only structure — obstetric triage fields lead.",
    "- If bleeding, absent or reduced fetal movement, severe pain, or unstable maternal vitals — urgent obstetric pathway in obGyneDisposition and triage summary (not routine outpatient follow-up alone).",
    "- No invented vitals, FHR, or labs.",
    "- No AI filler phrases.",
    "",
    "LABOR_ROOM_LABOR_EVALUATION_OVERLAY (when active in user message): labor pain / labor evaluation checklist; disposition vocabulary and urgent pathway cues.",
    "",
    "AUDIT_FRIENDLY_LANGUAGE + LIKELY_ADMIT_BRIDGE + ANTIBIOTIC_RDU: follow matching blocks in the user message when present.",
    "ANTEPARTUM_BLEEDING_OVERLAY (when active): same surface rules as LABOR_ROOM for bleeding in pregnancy; early + pain → ectopic/miscarriage; later → urgent OB; unstable vitals → immediate concern at top.",
    "PREECLAMPSIA_OVERLAY (when active): pregnancy status, GA, BP, headache, visual, RUQ/epigastric, seizure, fetal concern; urgent OB when severe features — not routine OPD headache structure.",
    "EARLY_PREGNANCY_PAIN_BLEEDING_OVERLAY (when active): pregnancy status, LMP/GA, pain severity/laterality, bleeding amount, hemodynamics, ectopic risk clues; pain+bleeding → ectopic/miscarriage pathway; unstable or peritonism → urgent GYNE/ER.",
    "ABNORMAL_UTERINE_BLEEDING_OVERLAY (when active): clarify pregnancy early; hemodynamics first; heavy/unstable → urgent pathway; nonpregnant acute AUB not merged with routine dysmenorrhea note.",
    "Use RULE ENGINE context in the user message; follow it unless raw text clearly contradicts.",
  ].join("\n");
}

function buildGyneClinicalSystemPrompt(): string {
  return [
    formatGlobalRulesOnlyForSystemPrompt(),
    "",
    "You draft Thai gynecologic acute-care documentation for physicians. Output ONE JSON object only (no markdown). Concise medical Thai; English for usual terms (PID, TVS, β-hCG, etc.).",
    "VISIT_MODE is GYNE — gynecologic acute; do NOT structure like a routine URI/respiratory OPD note.",
    "",
    "SURFACE EARLY (weave into structured keys + obGyneTriageSummary; not CC-only):",
    "- Pregnancy status and GA when pregnant (or LMP/estimate).",
    "- Hemodynamic status when relevant (BP/HR/perfusion concern) — early in triage summary or structured fields.",
    "- Bleeding: obGyneBleedingSeverity (level + quantifiedDetails) — not narrative-only.",
    "",
    "PRIORITY:",
    "1) obGynePregnancyStatus + obGyneGestationalAge + obGyneBleedingSeverity — structured keys first; pregnancy status and GA must never appear only deep inside PI.",
    "2) obGyneClinicalPathway — match RULE_OB_GYNE_PATHWAY_HINTS when applicable (e.g. early_pregnancy_bleeding_ectopic_miscarriage, preeclampsia_severe_features); else general_gynecologic_acute or none.",
    "3) obGyneTriageSummary — hemodynamics, pain severity, bleeding, sepsis/torsion cues.",
    "4) cc — chief complaint anchor.",
    "5) pi — early pregnancy: ectopic vs miscarriage pathway when pain + bleeding; AUB, PID, torsion, postmenopausal bleeding per context.",
    "6) pe — objective only.",
    "7) problemList + problems[] — urgent first (ectopic, torsion, sepsis, severe bleeding).",
    "8) obGyneDisposition — explicit urgent GYN review / OR / admit / observe / clinic / refer.",
    "9) patientAdvice — precautions.",
    "",
    "REQUIRED JSON KEYS (GYNE):",
    "- obGynePregnancyStatus: pregnant / not pregnant / unknown / postpartum / unable to assess.",
    "- obGyneGestationalAge: GA/EGA or LMP-based estimate — key field; \"—\" if not applicable (e.g. not pregnant) or unknown.",
    "- obGyneBleedingSeverity: object { level, quantifiedDetails } — same level scale as LABOR_ROOM; not_applicable when no bleeding.",
    "- obGyneClinicalPathway: token aligned with hints + presentation.",
    "- obGyneTriageSummary, cc, pi, pastHistoryMedsAllergy, pe, problemList, problems[], obGyneDisposition, patientAdvice.",
    "- investigations[] (optional v1): see INVESTIGATIONS_SCHEMA_V1 in user message; omit key if none.",
    "- problems[]: optional confidenceLevel, uncertaintyReasons, evidenceSupport per PROBLEM_EVIDENCE_V1 in user message.",
    "",
    "PATHWAY RULES:",
    "- Pain + bleeding in early pregnancy → early_pregnancy_bleeding_ectopic_miscarriage; ranked DDx (ectopic, threatened/incomplete/complete abortion) and disposition to local protocol.",
    "- Pregnancy + severe headache / visual / epigastric pain / severe HTN or preeclampsia language → preeclampsia_severe_features.",
    "- Postpartum heavy bleeding or febrile postpartum → postpartum_urgent_ob.",
    "",
    "RULES:",
    "- No invented tests or vitals.",
    "- No AI filler phrases.",
    "",
    "AUDIT_FRIENDLY_LANGUAGE + LIKELY_ADMIT_BRIDGE + ANTIBIOTIC_RDU: follow matching blocks in the user message when present.",
    "ANTEPARTUM_BLEEDING_OVERLAY (when active): GA, bleeding amount, pain, hemodynamics, fetal concern; early + pain → ectopic/miscarriage pathway; unstable vitals → immediate concern first in obGyneTriageSummary.",
    "PREECLAMPSIA_OVERLAY (when active): pregnancy status, GA, BP, headache, visual, RUQ/epigastric, seizure, fetal concern; pregnancy + severe headache/visual/severe BP → urgent OB — not routine headache note format.",
    "EARLY_PREGNANCY_PAIN_BLEEDING_OVERLAY (when active): LMP/GA, pain severity/laterality, bleeding, hemodynamics, ectopic clues; pain+bleeding → ectopic/miscarriage pathway; unstable or peritonism → urgent GYNE/ER.",
    "ABNORMAL_UTERINE_BLEEDING_OVERLAY (when active): pregnancy clarification early; hemodynamics first; instability → urgent pathway; nonpregnant AUB not primary dysmenorrhea template.",
    "Use RULE ENGINE context in the user message; follow it unless raw text clearly contradicts.",
  ].join("\n");
}

function buildErClinicalSystemPrompt(): string {
  return [
    "You draft Thai emergency department / acute care notes for physicians. Output ONE JSON object only (no markdown). Concise medical Thai; English for usual terms (SpO2, ABC, ESI, etc.).",
    "VISIT_MODE is ER — ER-first reasoning: life threats → immediate stabilization / actions → focused history & exam → disposition. Do NOT bury urgent concerns under routine OPD-style narrative.",
    "",
    "PRIORITY ORDER (default ER):",
    "1) Life threats / acute instability — erTriageConcern and erPrimarySurvey (A–E).",
    "2) Focused history (pi) and focused exam (pe) — tight; no outpatient filler.",
    "3) Immediate stabilization and orders — erImmediateManagement.",
    "4) Problem list, reassessment, disposition.",
    "",
    "IMMEDIATE LIFE THREAT OVERRIDE: when ER_IMMEDIATE_LIFE_THREAT_EXPORT_ORDER appears in the user message — follow that numbered order exactly (immediate concern → vitals/exam → immediate actions → history → problem list → reassessment → disposition). It overrides the default export order below.",
    "",
    "MULTIPLE PROBLEMS: still separate problems[] when more than one active issue — list most urgent first; do not merge unrelated tracks.",
    "",
    "REQUIRED JSON KEYS (all strings except erPrimarySurvey object and problems array):",
    "- cc: one-line chief complaint anchor (may mirror triage).",
    "- erTriageConcern: acuity / why now / ESI or triage-level narrative — the triage concern line.",
    "- erPrimarySurvey: object with keys airway, breathing, circulation, disability, exposure — each value is a short clinical line (ใช้ — หรือ ยังไม่ได้ประเมิน ถ้าไม่มีข้อมูล).",
    "- pi: focused history — onset, course, pertinent positives/negatives; not a dump.",
    "- pastHistoryMedsAllergy: relevant PMH/meds/allergy only.",
    "- pe: focused exam — vitals context, targeted physical findings; objective only.",
    "- problemList: numbered-style lines or short bullets for active problems (primary first).",
    "- problems[]: same shape as OPD (role, title, assessment, provisionalDiagnosis, differential, plan, askNext, examineNext; optional suggestedMedications/finalizedMedications per MEDICATION_SUPPORT rules; optional confidenceLevel, uncertaintyReasons, evidenceSupport per PROBLEM_EVIDENCE_V1 in user message) — use for clinical reasoning; immediate ED actions also belong in erImmediateManagement.",
    "- erImmediateManagement: lines for IV, O2, neb, labs, imaging, meds given, consults — what was done / ordered now.",
    "- erReassessment: response to treatment, repeat vitals, pending results — or รอผล / สังเกตอาการ.",
    "- erDisposition: admit / discharge / observe / transfer / pending — ชัดเจน.",
    "- patientAdvice: brief if discharged; return precautions or handoff pearls.",
    "- investigations[] (optional v1): structured labs / imaging / ECG — see INVESTIGATIONS_SCHEMA_V1 in user message; omit key if none.",
    "",
    "DEFAULT EXPORT ORDER (when ER_IMMEDIATE_LIFE_THREAT_EXPORT_ORDER is absent): Triage concern → Primary survey A–E → Focused history → Focused exam → Problem list → Immediate management → Reassessment → Disposition.",
    "",
    "STYLE:",
    "- ABC first; unstable patients: immediate concern and management before chronologic story.",
    "- No invented vitals or tests; no default sepsis/pneumonia without support.",
    "- No AI filler phrases (โดยสรุปจากข้อมูล, it is important to note, etc.).",
    "",
    "AUDIT_FRIENDLY_LANGUAGE + LIKELY_ADMIT_BRIDGE + ANTIBIOTIC_RDU: follow matching blocks in the user message when present.",
    "ANAPHYLAXIS_ER_OVERLAY (when active): IM epinephrine first-line per protocol; ABC + exposure/timing + response to treatment before long HPI; not rash-only when systemic features present.",
    "DYSPNEA_HYPOXEMIA_ER_OVERLAY (when active): triage concern + breathing + SpO₂ + stabilization before long HPI; urgent escalation rules override OPD narrative order.",
    "SEIZURE_ALTERED_MENTAL_STATUS_ER_OVERLAY (when active): triage concern + ABC + neuro/AMS + stabilization before long HPI; do not bury seizure or coma status.",
    "SEPSIS_SHOCK_ER_OVERLAY (when active): circulation/perfusion + source + lactate; put erImmediateManagement (fluids, antibiotics per protocol, monitoring) before long HPI when hypoperfusion or septic shock concern; reconsider non-infectious mimics when infection source is uncertain.",
    "POISONING_OVERDOSE_ER_OVERLAY (when active): ABC + glucose + ECG early; stabilization and antidotes/supportive care before syndrome labels; opioid pattern — ventilation/naloxone titration goals, not \"wake up\" alone; poison center/toxicology pathway when severe or unclear.",
    "",
    "Use RULE ENGINE context in the user message; follow it unless raw text clearly contradicts.",
  ].join("\n");
}

function buildTraumaClinicalSystemPrompt(): string {
  return [
    formatGlobalRulesOnlyForSystemPrompt(),
    "",
    "You draft Thai trauma / injury documentation for physicians. Output ONE JSON object only (no markdown). Concise medical Thai; English for usual terms (GCS, C-spine, FAST, etc.).",
    "VISIT_MODE is TRAUMA — mechanism-first and survey-first; do NOT write like a routine outpatient OPD visit (CC/PI/PE as the only frame).",
    "",
    "PRIORITY:",
    "1) Life-threatening injury patterns first (airway, breathing, circulation, disability, exposure) — traumaPrimarySurvey.",
    "2) Mechanism and time — traumaMechanism, traumaTimeOfInjury.",
    "3) Secondary survey (regional exam findings) — traumaSecondarySurvey; use pe for detailed objective findings if you split them.",
    "4) Problem list after surveys — problemList + problems[]; rank life-threat / unstable first.",
    "5) Focused assessment (traumaFocusedAssessment) and Plan (traumaPlan + traumaImagingProcedure) and disposition (traumaDisposition).",
    "",
    "REQUIRED JSON KEYS:",
    "- cc: one-line anchor (may echo chief injury).",
    "- traumaMechanism: force, direction, protective equipment, environment — mechanism narrative.",
    "- traumaTimeOfInjury: when — ถ้าไม่มีให้บันทึก ยังไม่ทราบ / ประมาณ ...",
    "- traumaPrimarySurvey: object airway, breathing, circulation, disability, exposure — each line short.",
    "- traumaSecondarySurvey: head/face/neck/chest/abdomen/pelvis/extremities — deformity, tenderness, NVS, wounds.",
    "- pi: additional history (LOC, vomiting, anticoagulants, etc.) if not already in mechanism.",
    "- pastHistoryMedsAllergy: PMH, meds, allergy, anticoagulation.",
    "- pe: optional duplicate of key exam if you separate primary vs secondary; avoid invention.",
    "- problemList + problems[]: role, title, assessment, provisionalDiagnosis, differential, plan, askNext, examineNext; optional suggestedMedications/finalizedMedications per MEDICATION_SUPPORT rules; optional confidenceLevel, uncertaintyReasons, evidenceSupport (PROBLEM_EVIDENCE_V1).",
    "- traumaFocusedAssessment: synthesis after survey — provisional injuries / concerns.",
    "- traumaImagingProcedure: CT/XR/FAST/splint/closure — what is indicated or done.",
    "- traumaPlan: immediate management steps (resuscitation, immobilization, consults).",
    "- traumaDisposition: OR, admit, discharge, transfer, observe — ชัดเจน.",
    "- patientAdvice: brief if discharged; precautions.",
    "- investigations[] (optional v1): see INVESTIGATIONS_SCHEMA_V1 in user message; omit key if none.",
    "",
    "EXPORT ORDER: Mechanism of injury → Time of injury → Primary survey A–E → Secondary survey → Problem list → Assessment → Plan (include imaging/procedure) → Disposition.",
    "",
    "RULES:",
    "- Multiple injuries: separate problems[]; do not merge incompatible tracks.",
    "- No invented vitals or imaging results.",
    "- No AI filler phrases.",
    "",
    "AUDIT_FRIENDLY_LANGUAGE + LIKELY_ADMIT_BRIDGE + ANTIBIOTIC_RDU: follow matching blocks in the user message when present.",
    "ANAPHYLAXIS_ER_OVERLAY (when active): ABC + epinephrine IM + allergen exposure; distinguish anaphylaxis from isolated urticaria by systemic features.",
    "DYSPNEA_HYPOXEMIA_ER_OVERLAY (when active): breathing + oxygenation + survey alignment with chest injury / airway risk.",
    "SEIZURE_ALTERED_MENTAL_STATUS_ER_OVERLAY (when active): primary survey + neuro status + seizure/AMS documentation alongside injury survey.",
    "SEPSIS_SHOCK_ER_OVERLAY (when active): perfusion and infection concern alongside injury survey; do not anchor shock solely on trauma without vitals/source.",
    "POISONING_OVERDOSE_ER_OVERLAY (when active): consider occult ingestion/co-ingestion with altered mental status or unclear history; ABC + glucose + ECG alongside trauma survey.",
    "",
    "Use RULE ENGINE context in the user message; follow it unless raw text clearly contradicts.",
  ].join("\n");
}

function buildPsychClinicalSystemPrompt(): string {
  return [
    formatGlobalRulesOnlyForSystemPrompt(),
    "",
    "You draft Thai psychiatric / behavioral health documentation for physicians. Output ONE JSON object only (no markdown). Concise medical Thai; English for usual terms (MSE, SI, HI, etc.).",
    "VISIT_MODE is PSYCH — safety-first; do NOT structure like a routine URI/respiratory OPD note.",
    "",
    "PRIORITY:",
    "1) Chief psychiatric concern + risk (suicide, violence, psychosis, substance) — explicit in psychRiskAssessment object.",
    "2) HPI (psychHpi) — onset, course, symptoms, stressors, supports.",
    "3) Mental status examination (psychMentalStatusExam) — appearance through insight/judgment.",
    "4) Problem list after HPI/risk/MSE framing — problemList + problems[].",
    "5) psychSynthesisAssessment, psychPlan, psychDispositionReferral — disposition and referral must be clear.",
    "",
    "REQUIRED JSON KEYS:",
    "- cc: short anchor line (may mirror chief concern).",
    "- psychChiefConcern: presenting psychiatric/behavioral focus.",
    "- psychHpi: history of present illness — narrative.",
    "- psychRiskAssessment: object with keys suicidalIdeation, suicidalPlan, selfHarmHistory, homicidalIdeation, psychosis, substanceUse — each string; use — or ปฏิเสธ/ไม่มี ตามการสอบถาม.",
    "- psychMentalStatusExam: MSE narrative (appearance, speech, mood/affect, thought process/content, perception, cognition, insight/judgment).",
    "- pi / pastHistoryMedsAllergy / pe: may overlap; avoid duplication — prefer psychHpi + psychMentalStatusExam for PSYCH export.",
    "- problemList + problems[]: rank safety-critical problems first; separate medical vs psychiatric when both apply; optional suggestedMedications/finalizedMedications per MEDICATION_SUPPORT rules; optional confidenceLevel, uncertaintyReasons, evidenceSupport (PROBLEM_EVIDENCE_V1).",
    "- psychSynthesisAssessment: formulation after problem list.",
    "- psychPlan: meds, safety planning, referral, follow-up, labs if indicated.",
    "- psychDispositionReferral: discharge, admit, crisis, OP psych, ส่งต่อ — ชัดเจน.",
    "- patientAdvice: brief; may mirror disposition.",
    "- investigations[] (optional v1): see INVESTIGATIONS_SCHEMA_V1 in user message if labs/ECG ordered; omit key if none.",
    "",
    "ESCALATION: If high suicide risk, violence risk, or acute psychosis — state clearly in psychRiskAssessment and psychPlan; do not bury under soft language.",
    "",
    "EXPORT ORDER: Chief psychiatric concern → HPI → Risk assessment → MSE → Problem list → Assessment → Plan → Disposition/referral.",
    "",
    "AUDIT_FRIENDLY_LANGUAGE + LIKELY_ADMIT_BRIDGE + ANTIBIOTIC_RDU: follow matching blocks in the user message when present.",
    "ANAPHYLAXIS_ER_OVERLAY (when active): suspected anaphylaxis — medical stabilization and epinephrine pathway before attributing symptoms to anxiety alone.",
    "SEIZURE_ALTERED_MENTAL_STATUS_ER_OVERLAY (when active): medical seizure/AMS/toxic-metabolic emergency overrides pure psych narrative order.",
    "DYSPNEA_HYPOXEMIA_ER_OVERLAY (when active): breathing compromise alongside behavioral presentation — document vitals and ABCs.",
    "",
    "Use RULE ENGINE context in the user message; follow it unless raw text clearly contradicts.",
  ].join("\n");
}

function buildClinicalSystemPrompt(mode: AssistMode): string {
  if (mode === "ER") return buildErClinicalSystemPrompt();
  if (mode === "TRAUMA") return buildTraumaClinicalSystemPrompt();
  if (mode === "PSYCH") return buildPsychClinicalSystemPrompt();
  if (mode === "LABOR_ROOM") return buildLaborRoomClinicalSystemPrompt();
  if (mode === "GYNE") return buildGyneClinicalSystemPrompt();
  return buildOpdClinicalSystemPrompt();
}

function buildClinicalUserPayload(rawText: string, base: OpdAssistRuleAnalysis): string {
  const {
    caseProfile,
    assistantBundle,
    opdFramework,
    diseaseCards,
    mode,
    problemPackResolution,
    visitModeReason,
    clinicalContradictions,
    dispositionSuggestions,
  } = base;
  const problems = opdFramework.layer2.map((b) => `${b.system}: ${b.summaryLine}`).join("\n");
  const problemBlockIdsTable = opdFramework.layer2
    .map((b) => `${b.id} | ${b.system} | ${b.summaryLine}`)
    .join("\n");
  const facts = assistantBundle.detectedFacts.slice(0, 28).join("\n");
  const redFlags = assistantBundle.redFlags.join("; ");
  const sn = base.structuredNote;
  const packPrompt = formatProblemPacksForAiPrompt(problemPackResolution);
  const activePackIds = new Set(problemPackResolution.activeMatches.map((m) => m.packId));
  const erChestPainUrgencyBlock =
    mode === "ER" && activePackIds.has("er_chest_pain")
      ? [
          "ER_CHEST_PAIN_WORKFLOW (er_chest_pain pack matched):",
          "- Acute chest pain must not read as routine OPD until ECG + vitals + SpO₂ are clearly documented in erTriageConcern / erImmediateManagement (or equivalent).",
          "- Consider troponin pathway when ACS suspected; serial ECG / repeat troponin if initial ECG nondiagnostic but suspicion remains high.",
          "- After immediate danger is excluded and low-risk criteria are met, structured conservative disposition with return precautions is appropriate.",
        ].join("\n")
      : "";
  const uriFw = base.uriRespiratoryFramework;
  const uriFrameworkBlock =
    uriFw.active ? formatUriRespiratoryFrameworkForAi(uriFw) : "(URI_RESPIRATORY_FRAMEWORK inactive)";

  const feverFw = base.feverChildFramework;
  const feverFrameworkBlock =
    feverFw.active ? formatFeverChildFrameworkForAi(feverFw) : "(FEVER_CHILD_FRAMEWORK inactive)";

  const feverUrgencyBlock =
    feverFw.active && feverFw.urgencyHint === "prefer_er_or_urgent"
      ? [
          "FEVER_URGENCY (fixed rules):",
          "- Danger signs documented — prioritize ABCs, hydration, and source exam; disposition toward ER/urgent care.",
          "- Do not anchor assessment on sepsis or empiric antibiotics by default; document why if escalating care.",
          "- Lead with stability and danger signs before long benign narrative.",
        ].join("\n")
      : "";

  const giFw = base.giDehydrationFramework;
  const giFrameworkBlock =
    giFw.active ? formatGiDehydrationFrameworkForAi(giFw) : "(GI_DEHYDRATION_FRAMEWORK inactive)";

  const giUrgencyBlock =
    giFw.active && giFw.urgencyHint === "prefer_er_or_urgent"
      ? [
          "GI_DEHYDRATION_URGENCY (fixed rules):",
          "- Severe dehydration or systemic instability — lead with volume status, perfusion, and ORS/IV plan; disposition toward ER/urgent care.",
          "- Do not bury shock/poor perfusion/unable to drink below routine OPD narrative.",
          "- Separate acute gastroenteritis from dehydration severity when documenting.",
        ].join("\n")
      : "";

  const abdFw = base.abdominalPainFramework;
  const abdominalFrameworkBlock =
    abdFw.active ? formatAbdominalPainFrameworkForAi(abdFw) : "(ABDOMINAL_PAIN_FRAMEWORK inactive)";

  const abdominalUrgencyBlock =
    abdFw.active && abdFw.urgencyHint === "prefer_er_or_urgent"
      ? [
          "ABDOMINAL_PAIN_URGENCY (fixed rules):",
          "- Prioritize surgical / peritonitis / obstruction clues before benign DDx; document serial exam when evolving.",
          "- If trauma context — align with TRAUMA primary survey; abdomen as focused secondary survey.",
          "- Do not default to broad imaging/labs; match workup to red flags and stability.",
        ].join("\n")
      : "";

  const dysuriaFw = base.dysuriaUtiFramework;
  const dysuriaUtiFrameworkBlock =
    dysuriaFw.active ? formatDysuriaUtiFrameworkForAi(dysuriaFw) : "(DYSURIA_UTI_FRAMEWORK inactive)";

  const dysuriaUtiUrgencyBlock =
    dysuriaFw.active &&
    (dysuriaFw.pediatricSpecialistEscalation ||
      dysuriaFw.utiConcernTier === "upper_suspected" ||
      dysuriaFw.lowerUtiLikelihoodReduced ||
      dysuriaFw.genitalIrritationProminent)
      ? [
          "DYSURIA_UTI_URGENCY (fixed rules):",
          dysuriaFw.pediatricSpecialistEscalation
            ? "- URGENT pediatric pathway: suspected UTI under 3 months — escalate per pediatric specialist / children hospital pathway; not uncomplicated outpatient cystitis."
            : "",
          dysuriaFw.utiConcernTier === "upper_suspected"
            ? "- Upper UTI path: fever/systemic illness or flank/loin/CVA — prioritize over isolated urinary symptoms; document and disposition accordingly."
            : "",
          dysuriaFw.lowerUtiLikelihoodReduced
            ? "- Alternative-cause check: no dysuria + clear other infection focus — lower UTI likelihood reduced; document dominant focus."
            : "",
          dysuriaFw.genitalIrritationProminent
            ? "- Genital irritation/discharge prominent — consider vulvovaginitis / local irritation as non-UTI urinary mimic before anchoring UTI alone."
            : "",
          "- Obtain urine before antibiotics when feasible; if critically ill and urine delayed, do not withhold urgent treatment solely for culture.",
        ]
          .filter((line) => line.trim().length > 0)
          .join("\n")
      : "";

  const headacheFw = base.headacheDizzinessFramework;
  const preeForHeadache = base.preeclampsiaOverlay;
  const headacheDizzinessFrameworkBlock =
    preeForHeadache.active && preeForHeadache.avoidRoutineHeadacheNoteFormat
      ? [
          "(HEADACHE_DIZZINESS_FRAMEWORK: not used as primary OPD headache template — PREECLAMPSIA_OVERLAY active.)",
          "Structure the note around pregnancy status, GA, BP, headache severity, visual symptoms, RUQ/epigastric pain, seizure/eclampsia concern, and fetal status per PREECLAMPSIA_OVERLAY; do not export as routine primary headache visit.",
        ].join("\n")
      : headacheFw.active
        ? formatHeadacheDizzinessFrameworkForAi(headacheFw)
        : "(HEADACHE_DIZZINESS_FRAMEWORK inactive)";

  const headacheDizzinessUrgencyBlock =
    headacheFw.active && headacheFw.erPriorityConcern
      ? [
          "HEADACHE_DIZZINESS_URGENCY (fixed rules):",
          "- Sudden severe headache, thunderclap pattern, focal deficit, neck stiffness, altered MS, seizure — prioritize ER disposition / neuroimaging per protocol; do not anchor benign migraine/vertigo alone.",
          "- Do not label benign peripheral vertigo if focal neuro signs, severe ataxia, or diplopia are present.",
        ].join("\n")
      : "";

  const backMskFw = base.backMusculoskeletalFramework;
  const backMusculoskeletalFrameworkBlock =
    backMskFw.active ? formatBackMusculoskeletalFrameworkForAi(backMskFw) : "(BACK_MSK_FRAMEWORK inactive)";

  const backMskUrgencyBlock =
    backMskFw.active &&
    (backMskFw.urgentCaudaOrNeuroEmergency ||
      backMskFw.infectionConsideration ||
      backMskFw.traumaImagingConsideration)
      ? [
          "BACK_MSK_URGENCY (fixed rules):",
          backMskFw.urgentCaudaOrNeuroEmergency
            ? "- Bowel/bladder dysfunction or saddle anesthesia — urgent / ER pathway; not benign strain alone."
            : "",
          backMskFw.infectionConsideration
            ? "- Fever with spine/back context — consider spinal infection / systemic workup per protocol; disposition accordingly."
            : "",
          backMskFw.traumaImagingConsideration
            ? "- Trauma + midline bony tenderness / deformity — trauma/imaging pathway; document mechanism and exam."
            : "",
          "- Do not overcall radiculopathy without radiating symptoms or neurologic exam support.",
        ]
          .filter((line) => line.trim().length > 0)
          .join("\n")
      : "";

  const traumaFw = base.traumaFramework;
  const traumaFrameworkBlock =
    traumaFw.active ? formatTraumaFrameworkForAi(traumaFw) : "(TRAUMA_FRAMEWORK inactive)";

  const psychFw = base.psychFramework;
  const psychFrameworkBlock =
    psychFw.active ? formatPsychFrameworkForAi(psychFw) : "(PSYCH_FRAMEWORK inactive)";

  const abxRdu = base.antibioticRduOverlay;
  const antibioticRduOverlayBlock =
    abxRdu.active ? formatAntibioticRduOverlayForAi(abxRdu) : "(ANTIBIOTIC_RDU_OVERLAY inactive)";

  const antibioticRduStewardshipBlock =
    abxRdu.active && abxRdu.supportLevel === "severe_complicated_pattern"
      ? [
          "ANTIBIOTIC_RDU_URGENCY (fixed rules):",
          "- Severe / complicated infection pattern — prioritize sepsis/source control pathways per local protocol; stewardship still requires indication + duration documentation.",
          "- Do not anchor benign viral URI when systemic compromise or focal bacterial features are present.",
        ].join("\n")
      : "";

  const erFirstBlock =
    mode === "ER" && !base.erImmediateLifeThreat.reorderNarrative
      ? [
          "ER_FIRST_PRIORITY (fixed rules):",
          "- Lead with life threats and immediate actions — triage concern + ABCDE (erPrimarySurvey) + erImmediateManagement come before long HPI.",
          "- Do not structure the note like routine OPD (CC/PI first with acute risk buried at the end).",
          "- Multiple problems: keep separate problems[] entries when applicable; urgent problem first.",
          "- Then focused history (pi), focused exam (pe), reassessment, disposition.",
        ].join("\n")
      : "";

  const erLifeThreatOrderBlock =
    mode === "ER" && base.erImmediateLifeThreat.reorderNarrative
      ? [
          "ER_IMMEDIATE_LIFE_THREAT_EXPORT_ORDER (fixed rules — rule engine detected immediate life threat):",
          "Follow this numbered order for prose and JSON field priority (overrides default ER export order below). Do NOT bury resuscitation under routine OPD flow.",
          "1) Immediate concern — erTriageConcern (acuity / why now / ESI).",
          "2) Critical vitals & focused exam — erPrimarySurvey (A–E) then pe (vitals + targeted exam).",
          "3) Immediate actions — erImmediateManagement (O2, access, meds, monitoring, consults) before long HPI.",
          "4) Focused history — pi (+ pastHistoryMedsAllergy).",
          "5) Problem list — problemList + problems[] (most urgent first).",
          "6) Reassessment — erReassessment.",
          "7) Disposition — erDisposition (patientAdvice if discharged).",
          `Detection reasons: ${base.erImmediateLifeThreat.reasons.join("; ")}`,
        ].join("\n")
      : "";

  const traumaFirstBlock =
    mode === "TRAUMA"
      ? [
          "TRAUMA_FIRST_PRIORITY (fixed rules):",
          "- Mechanism + time before long narrative; primary survey (ABCDE) before problem list.",
          "- Secondary survey (regional) after primary; do not bury unstable findings under routine OPD headings.",
          "- Problem list after surveys; life-threatening / unstable first.",
          "- Plan includes imaging/procedure considerations (traumaImagingProcedure) when relevant.",
        ].join("\n")
      : "";

  const psychFirstBlock =
    mode === "PSYCH"
      ? [
          "PSYCH_FIRST_PRIORITY (fixed rules):",
          "- Safety and risk before routine counseling — psychRiskAssessment + psychChiefConcern lead.",
          "- MSE before generic problem-list fluff; do not write like URI/CC-only OPD.",
          "- Problem list after risk/MSE framing; escalate disposition clearly when high risk.",
        ].join("\n")
      : "";

  const laborRoomFirstBlock =
    mode === "LABOR_ROOM"
      ? [
          "LABOR_ROOM_FIRST_PRIORITY (fixed rules):",
          "- Required structured keys first: obGynePregnancyStatus, obGyneGestationalAge, obGyneBleedingSeverity { level, quantifiedDetails } — then obGyneClinicalPathway when RULE_OB_GYNE_PATHWAY_HINTS fire.",
          "- Preeclampsia / severe-range BP with headache or visual symptoms in pregnancy → document preeclampsia pathway; postpartum heavy bleeding or postpartum fever → urgent obstetric pathway.",
          "- Do not structure like routine URI OPD; obGyneDisposition must be explicit: observe, L&D admit, urgent OB review, OR, transfer, or discharge with safety-net per protocol.",
        ].join("\n")
      : "";

  const gyneFirstBlock =
    mode === "GYNE"
      ? [
          "GYNE_FIRST_PRIORITY (fixed rules):",
          "- Required structured keys first: obGynePregnancyStatus, obGyneGestationalAge, obGyneBleedingSeverity — pregnancy status and GA are never CC-only buried fields.",
          "- Pain + bleeding in early pregnancy → ectopic/miscarriage pathway (obGyneClinicalPathway + DDx + plan).",
          "- Pregnancy with headache/visual/severe HTN → preeclampsia pathway; postpartum heavy bleeding or fever → postpartum urgent obstetric pathway.",
          "- obGyneDisposition explicit: urgent GYN review, OR, admit, observe, clinic follow-up, refer, or discharge with precautions.",
        ].join("\n")
      : "";

  const obGynePathwayBlock =
    mode === "LABOR_ROOM" || mode === "GYNE"
      ? formatObGynePathwayHintsForAi(inferObGynePathwayHints(normalizeClinicalText(rawText), mode))
      : "";

  const anaphylaxisOv = base.anaphylaxisErOverlay;
  const anaphylaxisErOverlayBlock = formatAnaphylaxisErOverlayForAi(anaphylaxisOv);

  const anaphylaxisUrgencyBlock =
    anaphylaxisOv.active && anaphylaxisOv.emergencyEscalationLikely
      ? [
          "ANAPHYLAXIS_URGENCY (fixed rules):",
          "- Suspected anaphylaxis — prioritize airway/breathing/circulation; IM epinephrine first-line per local protocol when criteria met; do not document as simple rash only if respiratory, circulatory, or significant mucosal involvement is present.",
          "- Lead with triage concern, exposure/timing, and immediate management (epinephrine, oxygen, access, adjuncts as indicated) before routine OPD-style narrative.",
          "- Document response to treatment and reassessment; note observation / biphasic risk per protocol when applicable.",
        ].join("\n")
      : "";

  const seizureAmsOv = base.seizureAlteredMentalStatusErOverlay;
  const seizureAlteredMentalStatusErOverlayBlock = formatSeizureAlteredMentalStatusErOverlayForAi(seizureAmsOv);

  const seizureAlteredMentalStatusUrgencyBlock =
    seizureAmsOv.active && seizureAmsOv.emergencyEscalationLikely
      ? [
          "SEIZURE_ALTERED_MENTAL_STATUS_URGENCY (fixed rules):",
          "- Ongoing or recurrent seizure, failure to return to baseline, or severely reduced consciousness — lead with triage concern, ABCs, monitoring, and stabilization before routine OPD narrative.",
          "- Do not bury seizure/AMS/coma below benign HPI; document witnessed features, postictal state, and objective neuro exam (GCS, pupils, focality) when applicable.",
          "- If course is unclear — separate witnessed facts from inference.",
        ].join("\n")
      : "";

  const dyspneaOv = base.dyspneaHypoxemiaErOverlay;
  const dyspneaHypoxemiaErOverlayBlock = formatDyspneaHypoxemiaErOverlayForAi(dyspneaOv);

  const dyspneaHypoxemiaUrgencyBlock =
    dyspneaOv.active && dyspneaOv.emergencyEscalationLikely
      ? [
          "DYSPNEA_HYPOXEMIA_URGENCY (fixed rules):",
          "- Severe respiratory compromise or hypoxemia pattern — lead with triage concern, breathing, SpO₂ (room air vs device), and immediate stabilization before routine OPD narrative.",
          "- Do not anchor benign URI or cough alone when emergency escalation criteria apply; document ABCDE / primary survey first.",
          "- If reassessment / response to treatment is missing — state pending rather than implying stability.",
        ].join("\n")
      : "";

  const sepsisOv = base.sepsisShockErOverlay;
  const sepsisShockErOverlayBlock = formatSepsisShockErOverlayForAi(sepsisOv);

  const sepsisShockUrgencyBlock =
    sepsisOv.active && sepsisOv.emergencyEscalationLikely
      ? [
          "SEPSIS_SHOCK_URGENCY (fixed rules):",
          "- Hypoperfusion or septic shock concern — lead with triage concern, circulation, perfusion, suspected source, and immediate management (access, fluids, monitoring, antibiotics per protocol) before routine OPD narrative.",
          "- Adults: lactate when available; early antibiotics when septic shock or high-likelihood sepsis; crystalloid resuscitation per pathway; reassess response.",
          "- Children: lactate when available; cultures before antibiotics when feasible without meaningful delay; rapid antibiotics for suspected septic shock; bolus and reassess per pediatric pathway.",
          "- If infection source is uncertain — keep re-evaluating non-infectious mimics (hypovolemia, cardiogenic shock, obstruction, endocrine, toxin, anaphylaxis).",
        ].join("\n")
      : "";

  const poisoningOv = base.poisoningOverdoseErOverlay;
  const poisoningOverdoseErOverlayBlock = formatPoisoningOverdoseErOverlayForAi(poisoningOv);

  const poisoningOverdoseUrgencyBlock =
    poisoningOv.active && poisoningOv.emergencyEscalationLikely
      ? [
          "POISONING_OVERDOSE_URGENCY (fixed rules):",
          "- Suspected poisoning or overdose with escalation cues — lead with ABCs, mental status, glucose, and early ECG before routine OPD narrative.",
          "- Stabilization before syndrome labeling; use toxidrome reasoning when the agent is unknown.",
          "- Opioid pattern — document ventilation/respiratory targets with naloxone titration; not merely \"wake patient up\".",
          "- Severe, unstable, or unclear exposures — note poison center / toxicology consultation per local pathway.",
        ].join("\n")
      : "";

  const laborLaborOv = base.laborRoomLaborEvaluationOverlay;
  const laborRoomLaborEvaluationOverlayBlock = formatLaborRoomLaborEvaluationOverlayForAi(laborLaborOv);

  const laborRoomLaborUrgencyBlock =
    laborLaborOv.active && laborLaborOv.urgentPathwayLikely
      ? [
          "LABOR_ROOM_LABOR_URGENCY (fixed rules):",
          "- Vaginal bleeding, absent or reduced fetal movement, severe pain, or unstable maternal vitals — document urgent obstetric pathway in obGyneDisposition and obGyneTriageSummary.",
          "- Do not substitute expectant OPD/URI-style disposition when obstetric red flags are present.",
        ].join("\n")
      : "";

  const apBleedOv = base.antepartumBleedingOverlay;
  const antepartumBleedingOverlayBlock = formatAntepartumBleedingOverlayForAi(apBleedOv);

  const antepartumBleedingImmediateBlock =
    apBleedOv.active && apBleedOv.immediateConcernFirst
      ? [
          "ANTEPARTUM_BLEEDING_IMMEDIATE_CONCERN (fixed rules):",
          "- Unstable maternal vitals or shock concern — lead obGyneTriageSummary with immediate concern, hemodynamic status, and resuscitation/monitoring before long routine HPI.",
          "- Still document GA, bleeding quantification, and fetal status in structured fields.",
        ].join("\n")
      : "";

  const preeOv = base.preeclampsiaOverlay;
  const preeclampsiaOverlayBlock = formatPreeclampsiaOverlayForAi(preeOv);

  const preeclampsiaUrgentBlock =
    preeOv.active && preeOv.urgentObPathwayLikely
      ? [
          "PREECLAMPSIA_URGENCY (fixed rules):",
          "- Pregnancy with severe headache, visual symptoms, severe-range or worsening BP, RUQ/epigastric pain, seizure or eclampsia concern, or named preeclampsia spectrum — urgent obstetric assessment; set obGyneClinicalPathway to preeclampsia_severe_features when applicable.",
          "- Do not use the generic OPD headache note as the primary frame; hypertensive disorder of pregnancy triage fields lead (see PREECLAMPSIA_OVERLAY).",
        ].join("\n")
      : "";

  const earlyPbOv = base.earlyPregnancyPainBleedingOverlay;
  const earlyPregnancyPainBleedingOverlayBlock = formatEarlyPregnancyPainBleedingOverlayForAi(earlyPbOv);

  const earlyPregnancyPainBleedingImmediateBlock =
    earlyPbOv.active && earlyPbOv.immediateGyneErConcern
      ? [
          "EARLY_PREGNANCY_PAIN_BLEEDING_IMMEDIATE (fixed rules):",
          "- Unstable maternal vitals/shock concern OR peritoneal signs / acute abdomen (including shoulder-tip pain) — urgent GYN / ER pathway; lead obGyneTriageSummary with immediate concern and stabilization before long routine HPI.",
          "- Still document LMP/GA, pain lateralization, bleeding quantification, and ectopic risk factors in structured fields.",
        ].join("\n")
      : "";

  const aubOv = base.abnormalUterineBleedingOverlay;
  const abnormalUterineBleedingOverlayBlock = formatAbnormalUterineBleedingOverlayForAi(aubOv);

  const abnormalUterineBleedingImmediateBlock =
    aubOv.active && aubOv.urgentPathwayLikely
      ? [
          "ABNORMAL_UTERINE_BLEEDING_URGENCY (fixed rules):",
          "- Hemodynamic instability with acute abnormal uterine bleeding — urgent GYN/ER pathway; lead obGyneTriageSummary with circulation, bleeding quantification, and resuscitation before long routine HPI.",
          "- Pregnancy status must still be clarified (UPT/β-hCG) per protocol — do not anchor nonpregnant dysmenorrhea narrative alone when pregnancy status is unknown.",
        ].join("\n")
      : "";

  return [
    `VISIT_MODE: ${mode} (detection: ${visitModeReason})`,
    `VISIT_MODE_STYLE: ${getVisitModeStyleGuidance(mode)}`,
    erFirstBlock ? `${erFirstBlock}\n` : "",
    erLifeThreatOrderBlock ? `${erLifeThreatOrderBlock}\n` : "",
    erChestPainUrgencyBlock ? `${erChestPainUrgencyBlock}\n` : "",
    traumaFirstBlock ? `${traumaFirstBlock}\n` : "",
    psychFirstBlock ? `${psychFirstBlock}\n` : "",
    laborRoomFirstBlock ? `${laborRoomFirstBlock}\n` : "",
    gyneFirstBlock ? `${gyneFirstBlock}\n` : "",
    obGynePathwayBlock ? `${obGynePathwayBlock}\n` : "",
    anaphylaxisUrgencyBlock ? `${anaphylaxisUrgencyBlock}\n` : "",
    seizureAlteredMentalStatusUrgencyBlock ? `${seizureAlteredMentalStatusUrgencyBlock}\n` : "",
    dyspneaHypoxemiaUrgencyBlock ? `${dyspneaHypoxemiaUrgencyBlock}\n` : "",
    sepsisShockUrgencyBlock ? `${sepsisShockUrgencyBlock}\n` : "",
    poisoningOverdoseUrgencyBlock ? `${poisoningOverdoseUrgencyBlock}\n` : "",
    laborRoomLaborUrgencyBlock ? `${laborRoomLaborUrgencyBlock}\n` : "",
    antepartumBleedingImmediateBlock ? `${antepartumBleedingImmediateBlock}\n` : "",
    preeclampsiaUrgentBlock ? `${preeclampsiaUrgentBlock}\n` : "",
    earlyPregnancyPainBleedingImmediateBlock ? `${earlyPregnancyPainBleedingImmediateBlock}\n` : "",
    abnormalUterineBleedingImmediateBlock ? `${abnormalUterineBleedingImmediateBlock}\n` : "",
    feverUrgencyBlock ? `${feverUrgencyBlock}\n` : "",
    giUrgencyBlock ? `${giUrgencyBlock}\n` : "",
    abdominalUrgencyBlock ? `${abdominalUrgencyBlock}\n` : "",
    dysuriaUtiUrgencyBlock ? `${dysuriaUtiUrgencyBlock}\n` : "",
    headacheDizzinessUrgencyBlock ? `${headacheDizzinessUrgencyBlock}\n` : "",
    backMskUrgencyBlock ? `${backMskUrgencyBlock}\n` : "",
    antibioticRduStewardshipBlock ? `${antibioticRduStewardshipBlock}\n` : "",
    `CASE_PROFILE: caseType=${caseProfile.caseType}; dominantTheme=${caseProfile.dominantTheme}; systemicRedFlags=${caseProfile.hasSystemicRedFlags}`,
    "",
    "ANAPHYLAXIS_ER_OVERLAY (suspected anaphylaxis — rule; inactive when not triggered):",
    anaphylaxisErOverlayBlock,
    "",
    "SEIZURE_ALTERED_MENTAL_STATUS_ER_OVERLAY (seizure / AMS — rule; inactive when not triggered):",
    seizureAlteredMentalStatusErOverlayBlock,
    "",
    "DYSPNEA_HYPOXEMIA_ER_OVERLAY (breathing emergency structure — rule; inactive when not triggered):",
    dyspneaHypoxemiaErOverlayBlock,
    "",
    "SEPSIS_SHOCK_ER_OVERLAY (hypoperfusion / sepsis concern — rule; inactive when not triggered):",
    sepsisShockErOverlayBlock,
    "",
    "POISONING_OVERDOSE_ER_OVERLAY (poisoning / overdose — rule; inactive when not triggered):",
    poisoningOverdoseErOverlayBlock,
    "",
    "LABOR_ROOM_LABOR_EVALUATION_OVERLAY (labor pain / labor evaluation — rule; inactive when not triggered):",
    laborRoomLaborEvaluationOverlayBlock,
    "",
    "ANTEPARTUM_BLEEDING_OVERLAY (antepartum / pregnancy bleeding — rule; inactive when not triggered):",
    antepartumBleedingOverlayBlock,
    "",
    "PREECLAMPSIA_OVERLAY (hypertensive disorder of pregnancy / preeclampsia concern — rule; inactive when not triggered):",
    preeclampsiaOverlayBlock,
    "",
    "EARLY_PREGNANCY_PAIN_BLEEDING_OVERLAY (early pregnancy pain/bleeding — rule; inactive when not triggered):",
    earlyPregnancyPainBleedingOverlayBlock,
    "",
    "ABNORMAL_UTERINE_BLEEDING_OVERLAY (acute AUB — rule; inactive when not triggered):",
    abnormalUterineBleedingOverlayBlock,
    "",
    "RULE_CONTRADICTION_CHECKS (reconcile if any):",
    clinicalContradictions.length ? clinicalContradictions.join("\n") : "(none flagged)",
    "",
    "RULE_DISPOSITION_SUGGESTIONS (mode + severity — advisory only):",
    dispositionSuggestions.length ? dispositionSuggestions.join("\n") : "(none)",
    "",
    "RULE_CANDIDATE_PROBLEMS:",
    problems || "(none)",
    "",
    "RULE_PROBLEM_BLOCK_IDS (emit clinicalProblemId on each problems[] item — copy id from first column):",
    problemBlockIdsTable || "(none)",
    "",
    "INVESTIGATIONS_SCHEMA_V1 (optional root key investigations[]):",
    "Emit when any lab, imaging (CXR/CT/US/X-ray), ECG, or bedside test is ordered or resulted in this visit.",
    "Each item: investigationId (unique string), kind ∈ lab|imaging|ecg|ultrasound|ct|xray|bedside, label (short Thai/EN), optional status ordered|done|pending, priority routine|urgent|critical, problemRefId (match clinicalProblemId when applicable).",
    "Results / narrative: summary, impression, keyFindings[], rawText; imaging: bodyPart; ECG: rate, rhythm, sttSummary.",
    "If no investigations in the visit — omit the investigations key entirely (do not send []).",
    "",
    "PROBLEM_EVIDENCE_V1 (optional fields on each problems[] item):",
    "confidenceLevel — qualitative fit of assessment/diagnosis to documented evidence.",
    "uncertaintyReasons — short bullets (missing data, conflict, pending tests).",
    "evidenceSupport — discrete lines; type history|exam|investigation; relation supports|against|missing; refId optional — link to investigationId from investigations[] or clinicalProblemId.",
    "",
    "PROBLEM_SPLIT_GUIDANCE (documentation — not a hard rule):",
    "- AGE (acute gastroenteritis) vs dehydration severity: may be two separate problems when clinically useful.",
    "- Fever without focus + URI symptoms: may be two problems or one viral URI/ILI syndrome — choose by context and exam.",
    "- \"ไม่มีไข้\" / explicit no fever: do not anchor a fever problem; \"กินได้ดี\" down-tiers dehydration in GI framework; \"ไม่มีเลือดในอุจจาระ\" lowers dysentery weighting unless other cues.",
    "",
    `SYMPTOM_PACKS (mode=${problemPackResolution.mode}; matched templates — roadmap order; negation-aware keyword hits):`,
    packPrompt,
    "",
    formatMedicationSupportForAiPrompt(base.medicationSupportContext),
    "",
    "URI_RESPIRATORY_FRAMEWORK (cough / URI / sore throat — only when triggered by keywords; negation-aware):",
    uriFrameworkBlock,
    "",
    "FEVER_CHILD_FRAMEWORK (fever without focus / febrile child — negation-aware; not default sepsis/antibiotics):",
    feverFrameworkBlock,
    "",
    "GI_DEHYDRATION_FRAMEWORK (diarrhea / vomiting / dehydration — negation-aware):",
    giFrameworkBlock,
    "",
    "ABDOMINAL_PAIN_FRAMEWORK (acute abdomen — surgical red flags; negation-aware):",
    abdominalFrameworkBlock,
    "",
    "DYSURIA_UTI_FRAMEWORK (lower vs upper UTI vs mimics — negation-aware; suppress if alternative infection focus without urinary clues):",
    dysuriaUtiFrameworkBlock,
    "",
    "HEADACHE_DIZZINESS_FRAMEWORK (headache / vertigo / imbalance — neuro red flags; OPD/ER):",
    headacheDizzinessFrameworkBlock,
    "",
    "BACK_MSK_FRAMEWORK (back / neck / MSK pain — red flags; OPD/ER):",
    backMusculoskeletalFrameworkBlock,
    "",
    "TRAUMA_FRAMEWORK (mechanism/survey prompts — when active):",
    traumaFrameworkBlock,
    "",
    "PSYCH_FRAMEWORK (safety/MSE/risk prompts — when active):",
    psychFrameworkBlock,
    "",
    "ANTIBIOTIC_RDU_OVERLAY (Thai stewardship — antibiotic indication strength; when infection/antibiotic context triggers):",
    antibioticRduOverlayBlock,
    "",
    formatAuditFriendlyLanguageForAiPrompt(),
    "",
    formatLikelyAdmitBridgeForAi(base.likelyAdmitBridge),
    "",
    "RULE_DETECTED_FACTS:",
    facts || "(none)",
    "",
    "RULE_RED_FLAGS:",
    redFlags || "(none)",
    "",
    "ACTIVE_CARDS:",
    diseaseCards.map((c) => c.label).join(", ") || "(none)",
    "",
    "RULE_BASELINE_DRAFT (improve clarity; do not preserve low-quality boilerplate):",
    `CC: ${sn.cc}`,
    `PI: ${sn.pi}`,
    `PMH/Allergy: ${sn.pastHistory}`,
    `PE: ${sn.pe}`,
    `Assessment: ${sn.assessment}`,
    `Diagnosis: ${sn.diagnosis}`,
    `Differential: ${sn.differential}`,
    `Plan: ${sn.plan}`,
    `Advice: ${sn.patientAdvice}`,
    "",
    "AI_FIRST_INPUT (read this block last; it is the physician's source text):",
    "You interpret RAW_CLINICAL_TEXT as the primary clinical narrative. All RULE_* / framework / overlay sections above are deterministic guardrails — align your JSON with them (negation, visit mode, red flags, RDU, med safety). When a rule conflicts with a superficial read of the text, prefer the rule block.",
    "",
    "RAW_CLINICAL_TEXT:",
    rawText.trim(),
  ].join("\n");
}

async function callOpenAiClinicalNoteJson(
  systemPrompt: string,
  userPayload: string,
  rule: OpdAssistRuleAnalysis,
): Promise<OpdAiClinicalNoteJson> {
  const model = process.env.OPD_ASSIST_AI_MODEL || "gpt-4o-mini";
  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.25,
    max_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPayload },
    ],
  });
  const text = completion.choices[0]?.message?.content ?? "";
  const parsed = extractJsonObject<Record<string, unknown>>(text);
  if (!parsed) throw new Error("Model returned non-JSON");
  return coerceToClinicalNoteJson(parsed, rule);
}

/**
 * AI-first note generation: builds user payload from guardrail analysis, calls the model, then post-check.
 */
export async function mergeOpdAssistAiPhase1(
  rawText: string,
  base: OpdAssistRuleAnalysis,
): Promise<OpdAssistHybridResult> {
  const { systemPrompt, userPayload, promptStats } = prepareClinicalAiRequest(rawText, base);
  console.info("[opd-assist] promptStats", JSON.stringify(promptStats));

  if (process.env.OPD_ASSIST_AI_ENABLED === "false") {
    return finalizeHybrid(
      { ...base, aiAssist: { phase1: { used: false, fallbackReason: "disabled" } } },
      null,
      { promptStats },
    );
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return finalizeHybrid(
      { ...base, aiAssist: { phase1: { used: false, fallbackReason: "no_api_key" } } },
      null,
      { promptStats },
    );
  }

  const canonicalProblemOrder = base.opdFramework.layer2.map((b) => b.id);

  try {
    const rawAi = await callOpenAiClinicalNoteJson(systemPrompt, userPayload, base);
    const checked = postCheckOpdAiClinicalNote(
      rawText,
      base.structuredNote,
      rawAi,
      base.caseProfile,
      base.assistantBundle,
      base.mode,
      base.medicationSupportContext,
      canonicalProblemOrder,
    );

    if (!checked.ok) {
      return finalizeHybrid(
        {
          ...base,
          aiAssist: {
            phase1: {
              used: false,
              fallbackReason: "post_check_failed",
              warnings: checked.warnings,
            },
          },
        },
        null,
        { promptStats },
      );
    }

    const structuredNote = buildStructuredNoteFromClinicalAi(checked.ai, base.structuredNote);
    const layer1 = buildLayer1FromClinicalAi(checked.ai, base.opdFramework.layer1);

    const model = process.env.OPD_ASSIST_AI_MODEL || "gpt-4o-mini";
    const meta: OpdAssistAiPhase1Meta = {
      used: true,
      model,
      warnings: checked.warnings.length ? checked.warnings : undefined,
    };

    const inv = checked.ai.investigations ?? [];
    const investigationsStats = computeOpdAssistInvestigationsStatsV1(inv);
    console.info("[opd-assist] investigationsStats", JSON.stringify(investigationsStats));

    const probs = checked.ai.problems ?? [];
    console.info("[opd-assist] problemEvidenceStats", JSON.stringify(summarizeProblemEvidenceForLog(probs)));

    return finalizeHybrid(
      {
        ...base,
        structuredNote,
        opdFramework: {
          ...base.opdFramework,
          layer1,
        },
        aiAssist: { phase1: meta },
      },
      checked.ai,
      {
        promptStats,
        investigations: inv.length ? inv : undefined,
        investigationsStats,
        aiProblems: probs.length ? probs : undefined,
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("mergeOpdAssistAiPhase1:", msg);
    return finalizeHybrid(
      {
        ...base,
        aiAssist: {
          phase1: {
            used: false,
            fallbackReason: /json|parse|invalid/i.test(msg) ? "parse_error" : "request_error",
          },
        },
      },
      null,
      { promptStats },
    );
  }
}
