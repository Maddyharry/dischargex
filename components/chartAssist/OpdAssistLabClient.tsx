"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AssistCardResult } from "@/lib/chartAssist/cardTypes";
import type { AssistMode } from "@/lib/chartAssist/cardTypes";
import type { SafetySweep } from "@/lib/chartAssist/cardTypes";
import type { AssistantBundle } from "@/lib/chartAssist/structuredNote";
import type { StructuredOpdNote } from "@/lib/chartAssist/structuredNote";
import type { EvidenceLevel } from "@/lib/chartAssist/structuredNote";
import type { CaseClinicalProfile } from "@/lib/chartAssist/caseClinicalProfile";
import type { MinimumOpdRecord, ProblemBlock } from "@/lib/chartAssist/opdRecordFramework";
import { applyProblemOrder } from "@/lib/chartAssist/opdRecordFramework";
import { getRulePackMeta } from "@/lib/chartAssist/rulePackMeta";
import ReferenceDrawer from "./ReferenceDrawer";
import PhysicianReferenceBlock from "./PhysicianReferenceBlock";
import { ClinicalScoreCardsForPack } from "./ClinicalScoreCards";
import {
  assignScoresToActivePacks,
  CLINICAL_SCORE_DEFINITIONS,
  evaluateClinicalScore,
} from "@/lib/chartAssist/clinicalScores";
import {
  getReferenceIdsForAssistOverlay,
  getReferenceIdsForFramework,
  getReferenceIdsForPack,
} from "@/lib/chartAssist/packOverlayReferenceMap";
import { OB_GYNE_SHARED_DOCUMENTATION_RULES } from "@/lib/chartAssist/obGyneModeSharedRules";
import { OPD_ASSIST_DEMOS } from "./opdAssistDemos";
import type {
  ClinicalInvestigationV1,
  OpdAssistAiBundle,
  OpdAssistInvestigationsStatsV1,
  OpdAssistPromptStats,
  OpdAiProblemJson,
} from "@/lib/chartAssist/opdAssistAiTypes";
import type { OpdProblemPackResolution } from "@/lib/chartAssist/opdProblemPacks";
import type { VisitModeReasonCode } from "@/lib/chartAssist/analyzeCase";
import type { UriRespiratoryOpdFramework } from "@/lib/chartAssist/uriRespiratoryOpdFramework";
import { formatUriRespiratoryFrameworkForAi } from "@/lib/chartAssist/uriRespiratoryOpdFramework";
import type { TraumaOpdFramework } from "@/lib/chartAssist/traumaOpdFramework";
import { formatTraumaFrameworkForAi } from "@/lib/chartAssist/traumaOpdFramework";
import type { PsychOpdFramework } from "@/lib/chartAssist/psychOpdFramework";
import { formatPsychFrameworkForAi } from "@/lib/chartAssist/psychOpdFramework";
import type { FeverChildOpdFramework } from "@/lib/chartAssist/feverChildOpdFramework";
import { formatFeverChildFrameworkForAi } from "@/lib/chartAssist/feverChildOpdFramework";
import type { GiDehydrationOpdFramework } from "@/lib/chartAssist/giDehydrationOpdFramework";
import { formatGiDehydrationFrameworkForAi } from "@/lib/chartAssist/giDehydrationOpdFramework";
import type { AbdominalPainOpdFramework } from "@/lib/chartAssist/abdominalPainOpdFramework";
import { formatAbdominalPainFrameworkForAi } from "@/lib/chartAssist/abdominalPainOpdFramework";
import type { DysuriaUtiOpdFramework } from "@/lib/chartAssist/dysuriaUtiOpdFramework";
import { formatDysuriaUtiFrameworkForAi } from "@/lib/chartAssist/dysuriaUtiOpdFramework";
import type { HeadacheDizzinessOpdFramework } from "@/lib/chartAssist/headacheDizzinessOpdFramework";
import { formatHeadacheDizzinessFrameworkForAi } from "@/lib/chartAssist/headacheDizzinessOpdFramework";
import type { BackMusculoskeletalOpdFramework } from "@/lib/chartAssist/backMusculoskeletalOpdFramework";
import { formatBackMusculoskeletalFrameworkForAi } from "@/lib/chartAssist/backMusculoskeletalOpdFramework";
import type { MedicationSupportContextV1 } from "@/lib/chartAssist/medicationSupportLayer";
import type { AntibioticRduOverlay } from "@/lib/chartAssist/antibioticRduOverlay";
import { formatAntibioticRduOverlayForAi } from "@/lib/chartAssist/antibioticRduOverlay";
import type { LikelyAdmitBridge } from "@/lib/chartAssist/likelyAdmitBridge";
import { formatLikelyAdmitBridgeForAi } from "@/lib/chartAssist/likelyAdmitBridge";
import type { DyspneaHypoxemiaErOverlay } from "@/lib/chartAssist/dyspneaHypoxemiaErOverlay";
import { formatDyspneaHypoxemiaErOverlayForAi } from "@/lib/chartAssist/dyspneaHypoxemiaErOverlay";
import type { SepsisShockErOverlay } from "@/lib/chartAssist/sepsisShockErOverlay";
import { formatSepsisShockErOverlayForAi } from "@/lib/chartAssist/sepsisShockErOverlay";
import type { PoisoningOverdoseErOverlay } from "@/lib/chartAssist/poisoningOverdoseErOverlay";
import { formatPoisoningOverdoseErOverlayForAi } from "@/lib/chartAssist/poisoningOverdoseErOverlay";
import type { LaborRoomLaborEvaluationOverlay } from "@/lib/chartAssist/laborRoomLaborEvaluationOverlay";
import { formatLaborRoomLaborEvaluationOverlayForAi } from "@/lib/chartAssist/laborRoomLaborEvaluationOverlay";
import type { AntepartumBleedingOverlay } from "@/lib/chartAssist/antepartumBleedingOverlay";
import { formatAntepartumBleedingOverlayForAi } from "@/lib/chartAssist/antepartumBleedingOverlay";
import type { PreeclampsiaOverlay } from "@/lib/chartAssist/preeclampsiaOverlay";
import { formatPreeclampsiaOverlayForAi } from "@/lib/chartAssist/preeclampsiaOverlay";
import type { EarlyPregnancyPainBleedingOverlay } from "@/lib/chartAssist/earlyPregnancyPainBleedingOverlay";
import { formatEarlyPregnancyPainBleedingOverlayForAi } from "@/lib/chartAssist/earlyPregnancyPainBleedingOverlay";
import type { AbnormalUterineBleedingOverlay } from "@/lib/chartAssist/abnormalUterineBleedingOverlay";
import { formatAbnormalUterineBleedingOverlayForAi } from "@/lib/chartAssist/abnormalUterineBleedingOverlay";
import type { SeizureAlteredMentalStatusErOverlay } from "@/lib/chartAssist/seizureAlteredMentalStatusErOverlay";
import { formatSeizureAlteredMentalStatusErOverlayForAi } from "@/lib/chartAssist/seizureAlteredMentalStatusErOverlay";
import type { AnaphylaxisErOverlay } from "@/lib/chartAssist/anaphylaxisErOverlay";
import { formatAnaphylaxisErOverlayForAi } from "@/lib/chartAssist/anaphylaxisErOverlay";
import { formatAuditFriendlyLanguageForAiPrompt } from "@/lib/chartAssist/auditFriendlyLanguage";
import type { ErImmediateLifeThreatMeta } from "@/lib/chartAssist/erImmediateLifeThreat";
import { buildAssistantDisplayReply } from "@/lib/chartAssist/opdAssistChatReply";
import { buildMissingDataStrip } from "@/lib/chartAssist/opdAssistMissingStrip";
import type { OpdChartProvenance, OpdChatMessage } from "@/lib/chartAssist/opdAssistTypes";
import OpdAssistChatPane from "./opdAssist/OpdAssistChatPane";
import { BulletList, InlineAssistBlock } from "./opdAssist/OpdAssistAssistBlocks";

const DRAFT_KEY = "opd-assist-draft-text-v2";
const ANALYSIS_TRANSCRIPT_KEY = "opd-assist-analysis-transcript-v1";
const CHAT_MESSAGES_KEY = "opd-assist-chat-messages-v1";
const SCORES_KEY = "opd-assist-clinical-scores-v1";

const NOTE_PRIORITY_KEYS: (keyof StructuredOpdNote)[] = [
  "assessment",
  "diagnosis",
  "differential",
  "plan",
  "patientAdvice",
];
const NOTE_SECONDARY_KEYS: (keyof StructuredOpdNote)[] = ["cc", "pi", "pastHistory", "pe"];

type OpdFrameworkPayload = {
  layer1: MinimumOpdRecord;
  layer2: ProblemBlock[];
};

type AnalyzeOk = {
  ok: true;
  mode: AssistMode;
  visitModeReason: VisitModeReasonCode;
  safetySweep: SafetySweep;
  diseaseCards: AssistCardResult[];
  referenceIds: string[];
  rulePack: ReturnType<typeof getRulePackMeta>;
  structuredNote: StructuredOpdNote;
  assistantBundle: AssistantBundle;
  evidenceLevel: EvidenceLevel;
  caseProfile: CaseClinicalProfile;
  opdFramework: OpdFrameworkPayload;
  /** Final layer-2 id order after optional client reorder */
  appliedProblemOrder: string[];
  /** Hybrid: rule pre/post + AI clinical note draft when enabled */
  aiAssist?: OpdAssistAiBundle;
  /** User + system prompt size when hybrid AI path runs (~4 chars/token) */
  promptStats?: OpdAssistPromptStats;
  /** Normalized investigations v1 when AI returned any */
  investigations?: ClinicalInvestigationV1[];
  /** Coverage / richness after post-check */
  investigationsStats?: OpdAssistInvestigationsStatsV1;
  /** Post-checked AI problems[] (confidence / evidence v1 when present) */
  aiProblems?: OpdAiProblemJson[];
  /** Canonical CC → Advice layout for copy/export */
  formattedClinicalNote?: string;
  /** Step 3–4: symptom/problem packs matched (roadmap order) */
  problemPackResolution: OpdProblemPackResolution;
  /** Affirmative + denial cues for same concept — review before finalizing */
  clinicalContradictions: string[];
  /** Rule-based disposition hints (mode + severity) */
  dispositionSuggestions: string[];
  /** URI / cough / sore throat — structured prompts when respiratory keywords hit */
  uriRespiratoryFramework: UriRespiratoryOpdFramework;
  /** Fever child / fever without focus — structured prompts; not default sepsis */
  feverChildFramework: FeverChildOpdFramework;
  /** Diarrhea / vomiting / dehydration — structured prompts */
  giDehydrationFramework: GiDehydrationOpdFramework;
  /** Acute abdominal pain — surgical / urgent red flags */
  abdominalPainFramework: AbdominalPainOpdFramework;
  /** Trauma — mechanism/survey prompts when visit mode or trauma keywords */
  traumaFramework: TraumaOpdFramework;
  /** Psych — safety/MSE/risk prompts when visit mode or psych keywords */
  psychFramework: PsychOpdFramework;
  /** Dysuria / UTI-like — lower vs upper vs mimics */
  dysuriaUtiFramework: DysuriaUtiOpdFramework;
  /** Headache / dizziness / vertigo — neuro red flags */
  headacheDizzinessFramework: HeadacheDizzinessOpdFramework;
  /** Back / neck / MSK pain — neurologic & systemic red flags */
  backMusculoskeletalFramework: BackMusculoskeletalOpdFramework;
  /** Weight / pediatric / allergy context for structured medication layer */
  medicationSupportContext: MedicationSupportContextV1;
  /** Thai antibiotic stewardship / RDU overlay when infection–antibiotic context */
  antibioticRduOverlay: AntibioticRduOverlay;
  /** Inpatient documentation checklist when admission trajectory is plausible */
  likelyAdmitBridge: LikelyAdmitBridge;
  /** Dyspnea / hypoxemia — ER overlay (ABC first; not routine OPD when escalated) */
  dyspneaHypoxemiaErOverlay: DyspneaHypoxemiaErOverlay;
  /** Shock / sepsis concern — ER overlay (perfusion, source, bundles) */
  sepsisShockErOverlay: SepsisShockErOverlay;
  /** Poisoning / overdose — ER overlay (ABC, glucose, ECG, tox pathway) */
  poisoningOverdoseErOverlay: PoisoningOverdoseErOverlay;
  /** Seizure / AMS — ER overlay (stabilization first) */
  seizureAlteredMentalStatusErOverlay: SeizureAlteredMentalStatusErOverlay;
  /** Suspected anaphylaxis — ER overlay (IM epinephrine + ABCs) */
  anaphylaxisErOverlay: AnaphylaxisErOverlay;
  /** ER: when true, AI + export use life-threat section order */
  erImmediateLifeThreat: ErImmediateLifeThreatMeta;
  /** LABOR_ROOM: labor pain / labor evaluation overlay (rule) */
  laborRoomLaborEvaluationOverlay: LaborRoomLaborEvaluationOverlay;
  /** LABOR_ROOM / GYNE: antepartum / pregnancy bleeding overlay (rule) */
  antepartumBleedingOverlay: AntepartumBleedingOverlay;
  /** LABOR_ROOM / GYNE: preeclampsia / hypertensive disorder of pregnancy overlay (rule) */
  preeclampsiaOverlay: PreeclampsiaOverlay;
  /** LABOR_ROOM / GYNE: early pregnancy pain/bleeding — ectopic/miscarriage pathway (rule) */
  earlyPregnancyPainBleedingOverlay: EarlyPregnancyPainBleedingOverlay;
  /** LABOR_ROOM / GYNE: acute abnormal uterine bleeding (rule) */
  abnormalUterineBleedingOverlay: AbnormalUterineBleedingOverlay;
};

const NOTE_SECTIONS: { key: keyof StructuredOpdNote; label: string }[] = [
  { key: "cc", label: "CC" },
  { key: "pi", label: "PI / HPI" },
  { key: "pastHistory", label: "PMH / meds / allergies" },
  { key: "pe", label: "PE / vitals" },
  { key: "assessment", label: "Assessment" },
  { key: "diagnosis", label: "Diagnosis" },
  { key: "differential", label: "Differential" },
  { key: "plan", label: "Plan" },
  { key: "patientAdvice", label: "Patient instructions" },
];

const LAYER1_SECTIONS: { key: keyof MinimumOpdRecord; label: string }[] = [
  { key: "cc", label: "CC" },
  { key: "pi", label: "PI / HPI" },
  { key: "drugAllergy", label: "แพ้ยา" },
  { key: "pastHistoryAndMeds", label: "โรคประจำตัว / ยา" },
  { key: "vitalSigns", label: "Vital signs" },
  { key: "physicalExamSignificant", label: "PE ที่สำคัญ" },
  { key: "problemListOrDx", label: "รายการปัญหา / Dx" },
  { key: "treatmentAndMeds", label: "การรักษา / ยา" },
  { key: "adviceFollowUp", label: "คำแนะนำ / นัด" },
];

function formatNoteForCopy(
  formattedClinicalNote: string | undefined,
  n: StructuredOpdNote,
  layer1: MinimumOpdRecord | null,
  problemBlocks: ProblemBlock[],
  anaphylaxisFw?: AnaphylaxisErOverlay,
  seizureAmsFw?: SeizureAlteredMentalStatusErOverlay,
  dyspneaErFw?: DyspneaHypoxemiaErOverlay,
  sepsisShockFw?: SepsisShockErOverlay,
  poisoningFw?: PoisoningOverdoseErOverlay,
  laborLaborFw?: LaborRoomLaborEvaluationOverlay,
  antepartumBleedingFw?: AntepartumBleedingOverlay,
  preeclampsiaFw?: PreeclampsiaOverlay,
  earlyPregnancyPainBleedingFw?: EarlyPregnancyPainBleedingOverlay,
  abnormalUterineBleedingFw?: AbnormalUterineBleedingOverlay,
  uriFw?: UriRespiratoryOpdFramework,
  feverFw?: FeverChildOpdFramework,
  giFw?: GiDehydrationOpdFramework,
  abdFw?: AbdominalPainOpdFramework,
  dysuriaUtiFw?: DysuriaUtiOpdFramework,
  headacheFw?: HeadacheDizzinessOpdFramework,
  backMskFw?: BackMusculoskeletalOpdFramework,
  abxRdu?: AntibioticRduOverlay,
  likelyAdmit?: LikelyAdmitBridge,
  traumaFw?: TraumaOpdFramework,
  psychFw?: PsychOpdFramework,
): string {
  if (formattedClinicalNote?.trim()) {
    return formattedClinicalNote.trim();
  }

  const lines: string[] = [];

  lines.push("=== OPD — ประเด็น (ลากเรียงแล้ว) ===", "");
  for (let i = 0; i < problemBlocks.length; i++) {
    const b = problemBlocks[i];
    const tag = i === 0 ? "primary" : `secondary ${i}`;
    lines.push(`${i + 1}. [${tag}] ${b.system}`, b.summaryLine, "");
  }

  if (anaphylaxisFw?.active) {
    lines.push("", "=== Suspected anaphylaxis — ER overlay (rule) ===", formatAnaphylaxisErOverlayForAi(anaphylaxisFw), "");
  }

  if (seizureAmsFw?.active) {
    lines.push(
      "",
      "=== Seizure / altered mental status — ER overlay (rule) ===",
      formatSeizureAlteredMentalStatusErOverlayForAi(seizureAmsFw),
      "",
    );
  }

  if (dyspneaErFw?.active) {
    lines.push("", "=== Dyspnea / hypoxemia — ER overlay (rule) ===", formatDyspneaHypoxemiaErOverlayForAi(dyspneaErFw), "");
  }

  if (sepsisShockFw?.active) {
    lines.push("", "=== Shock / sepsis concern — ER overlay (rule) ===", formatSepsisShockErOverlayForAi(sepsisShockFw), "");
  }

  if (poisoningFw?.active) {
    lines.push("", "=== Poisoning / overdose — ER overlay (rule) ===", formatPoisoningOverdoseErOverlayForAi(poisoningFw), "");
  }

  if (laborLaborFw?.active) {
    lines.push("", "=== Labor room — labor evaluation (rule) ===", formatLaborRoomLaborEvaluationOverlayForAi(laborLaborFw), "");
  }

  if (antepartumBleedingFw?.active) {
    lines.push("", "=== Antepartum / pregnancy bleeding (rule) ===", formatAntepartumBleedingOverlayForAi(antepartumBleedingFw), "");
  }

  if (preeclampsiaFw?.active) {
    lines.push("", "=== Preeclampsia / hypertensive disorder of pregnancy (rule) ===", formatPreeclampsiaOverlayForAi(preeclampsiaFw), "");
  }

  if (earlyPregnancyPainBleedingFw?.active) {
    lines.push(
      "",
      "=== Early pregnancy pain / bleeding — ectopic vs miscarriage (rule) ===",
      formatEarlyPregnancyPainBleedingOverlayForAi(earlyPregnancyPainBleedingFw),
      "",
    );
  }

  if (abnormalUterineBleedingFw?.active) {
    lines.push(
      "",
      "=== Acute abnormal uterine bleeding (rule) ===",
      formatAbnormalUterineBleedingOverlayForAi(abnormalUterineBleedingFw),
      "",
    );
  }

  if (uriFw?.active) {
    lines.push("", "=== URI / ไอ / เจ็บคอ — ตัวช่วย (rule) ===", formatUriRespiratoryFrameworkForAi(uriFw), "");
  }

  if (feverFw?.active) {
    lines.push("", "=== ไข้เด็ก / fever without focus — ตัวช่วย (rule) ===", formatFeverChildFrameworkForAi(feverFw), "");
  }

  if (giFw?.active) {
    lines.push("", "=== ท้องเสีย / อาเจียน / ขาดน้ำ — ตัวช่วย (rule) ===", formatGiDehydrationFrameworkForAi(giFw), "");
  }

  if (abdFw?.active) {
    lines.push("", "=== ปวดท้องเฉียบพลัน / acute abdomen — ตัวช่วย (rule) ===", formatAbdominalPainFrameworkForAi(abdFw), "");
  }

  if (dysuriaUtiFw?.active) {
    lines.push("", "=== ปัสสาวะแสบ / UTI-like — ตัวช่วย (rule) ===", formatDysuriaUtiFrameworkForAi(dysuriaUtiFw), "");
  }

  if (
    headacheFw?.active &&
    !(preeclampsiaFw?.active && preeclampsiaFw.avoidRoutineHeadacheNoteFormat)
  ) {
    lines.push("", "=== ปวดหัว / เวียนหัว — ตัวช่วย (rule) ===", formatHeadacheDizzinessFrameworkForAi(headacheFw), "");
  }

  if (backMskFw?.active) {
    lines.push("", "=== ปวดหลัง / คอ / MSK — ตัวช่วย (rule) ===", formatBackMusculoskeletalFrameworkForAi(backMskFw), "");
  }

  if (abxRdu?.active) {
    lines.push("", "=== Antibiotic RDU / stewardship (rule) ===", formatAntibioticRduOverlayForAi(abxRdu), "");
  }

  if (likelyAdmit?.active) {
    lines.push("", "=== Likely-admit documentation bridge (rule) ===", formatLikelyAdmitBridgeForAi(likelyAdmit), "");
  }

  lines.push("", "=== Audit-friendly language (rule) ===", formatAuditFriendlyLanguageForAiPrompt(), "");

  if (traumaFw?.active) {
    lines.push("", "=== Trauma — ตัวช่วย (rule) ===", formatTraumaFrameworkForAi(traumaFw), "");
  }

  if (psychFw?.active) {
    lines.push("", "=== Psych — ตัวช่วย (rule) ===", formatPsychFrameworkForAi(psychFw), "");
  }

  lines.push("=== Layer 1 — บันทึกขั้นต่ำ ===", "");
  if (layer1) {
    for (const { key, label } of LAYER1_SECTIONS) {
      lines.push(label, layer1[key].trim() || "—", "");
    }
  } else {
    for (const { key, label } of NOTE_SECTIONS) {
      lines.push(label, n[key].trim() || "—", "");
    }
  }

  lines.push("=== Layer 2 — ถามต่อ / ตรวจต่อ (ตามประเด็น) ===", "");
  for (const b of problemBlocks) {
    lines.push(`— ${b.system} —`, "ถามต่อ:", ...(b.historyAskNext.length ? b.historyAskNext : ["—"]));
    lines.push("ตรวจต่อ:", ...(b.examFocusNext.length ? b.examFocusNext : ["—"]));
    lines.push(
      b.system === "skin" ? "ข้อเท็จจริงที่จับได้แล้ว:" : "Pertinent +:",
      ...(b.pertinentPositives.length ? b.pertinentPositives : ["—"]),
    );
    lines.push(
      "Pertinent negatives (ให้บันทึกถ้าตรวจแล้วไม่มี):",
      ...(b.pertinentNegativesToDocument.length ? b.pertinentNegativesToDocument : ["—"]),
    );
    if (b.assessment?.trim()) lines.push("Assessment:", b.assessment.trim());
    if (b.diagnosis?.trim()) lines.push("Diagnosis:", b.diagnosis.trim());
    if (b.differential?.trim()) lines.push("Differential:", b.differential.trim());
    if (b.plan?.trim()) lines.push("Plan:", b.plan.trim());
    lines.push("");
  }

  lines.push("=== Structured note (เดิม) ===", "");
  for (const { key, label } of NOTE_SECTIONS) {
    lines.push(`${label}`, n[key].trim() || "—", "");
  }
  return lines.join("\n").trim();
}

function inlineHintsForSection(
  key: keyof StructuredOpdNote,
  bundle: AssistantBundle,
): { title: string; items: string[] } | null {
  const h = bundle.sectionHints;
  switch (key) {
    case "pi":
      return h.piMissing.length ? { title: "ช่องว่างประวัติที่ควรเติม", items: h.piMissing } : null;
    case "pe":
      return h.peMissing.length ? { title: "การตรวจ / vital ที่ยังขาด", items: h.peMissing } : null;
    case "differential":
      return h.differentialClues.length
        ? { title: "Key clues / anchors", items: h.differentialClues }
        : null;
    case "plan":
      return h.planActions.length ? { title: "Suggested actions", items: h.planActions } : null;
    default:
      return null;
  }
}

export default function OpdAssistLabClient() {
  const caseIdRef = useRef<string>(crypto.randomUUID());
  /** Canonical text sent to POST /api/opd-assist/analyze */
  const [analysisTranscript, setAnalysisTranscript] = useState("");
  /** Current composer line (display thread turn — appended to transcript on send) */
  const [composerText, setComposerText] = useState("");
  /** Short chat bubbles — not the raw analyze payload */
  const [chatMessages, setChatMessages] = useState<OpdChatMessage[]>([]);
  const [chartFieldProvenance, setChartFieldProvenance] = useState<
    Partial<Record<keyof StructuredOpdNote | "layer1", OpdChartProvenance>>
  >({});
  const [chartAccepted, setChartAccepted] = useState<
    Partial<Record<keyof StructuredOpdNote | "layer1", boolean>>
  >({});
  const [modeOverride, setModeOverride] = useState<AssistMode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeOk | null>(null);
  const [note, setNote] = useState<StructuredOpdNote | null>(null);
  const [layer1, setLayer1] = useState<MinimumOpdRecord | null>(null);
  const [problemBlocks, setProblemBlocks] = useState<ProblemBlock[]>([]);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [scoreInputs, setScoreInputs] = useState<Record<string, Record<string, unknown>>>({});
  const [scoreMarkedNa, setScoreMarkedNaMap] = useState<Record<string, boolean>>({});
  const [lastMissingStrip, setLastMissingStrip] = useState(() => buildMissingDataStrip(null));

  /** Opt-in only — keeps the lab UI case-first; no debug strip in normal use */
  const showDebug =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_OPD_ASSIST_DEBUG === "true";

  useEffect(() => {
    try {
      const t = localStorage.getItem(ANALYSIS_TRANSCRIPT_KEY);
      if (t) {
        setAnalysisTranscript(t);
      } else {
        const legacy = localStorage.getItem(DRAFT_KEY);
        if (legacy) setAnalysisTranscript(legacy);
      }
      const msg = localStorage.getItem(CHAT_MESSAGES_KEY);
      if (msg) {
        const parsed = JSON.parse(msg) as OpdChatMessage[];
        if (Array.isArray(parsed)) setChatMessages(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const s = localStorage.getItem(SCORES_KEY);
      if (!s) return;
      const parsed = JSON.parse(s) as {
        inputs?: Record<string, Record<string, unknown>>;
        na?: Record<string, boolean>;
      };
      if (parsed.inputs && typeof parsed.inputs === "object") setScoreInputs(parsed.inputs);
      if (parsed.na && typeof parsed.na === "object") setScoreMarkedNaMap(parsed.na);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        SCORES_KEY,
        JSON.stringify({ inputs: scoreInputs, na: scoreMarkedNa })
      );
    } catch {
      /* ignore */
    }
  }, [scoreInputs, scoreMarkedNa]);

  useEffect(() => {
    try {
      localStorage.setItem(ANALYSIS_TRANSCRIPT_KEY, analysisTranscript);
      localStorage.setItem(DRAFT_KEY, analysisTranscript);
    } catch {
      /* ignore */
    }
  }, [analysisTranscript]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_MESSAGES_KEY, JSON.stringify(chatMessages));
    } catch {
      /* ignore */
    }
  }, [chatMessages]);

  const updateNoteField = useCallback((key: keyof StructuredOpdNote, value: string) => {
    setNote((prev) => (prev ? { ...prev, [key]: value } : prev));
    setChartFieldProvenance((p) => ({ ...p, [key]: "user" }));
    setChartAccepted((a) => ({ ...a, [key]: false }));
  }, []);

  const updateLayer1Field = useCallback((key: keyof MinimumOpdRecord, value: string) => {
    setLayer1((prev) => (prev ? { ...prev, [key]: value } : prev));
    setChartFieldProvenance((p) => ({ ...p, layer1: "user" }));
    setChartAccepted((a) => ({ ...a, layer1: false }));
  }, []);

  const reorderProblems = useCallback((from: number, to: number) => {
    if (from === to) return;
    setProblemBlocks((prev) => {
      const ids = prev.map((b) => b.id);
      const nextIds = [...ids];
      const [moved] = nextIds.splice(from, 1);
      nextIds.splice(to, 0, moved);
      return applyProblemOrder(prev, nextIds);
    });
  }, []);

  const runAnalyze = async (
    rawText: string,
    opts?: { source?: "analyze" | "demo"; demoKey?: string; orderedProblemIds?: string[] },
  ) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/opd-assist/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          modeOverride,
          caseId: caseIdRef.current,
          source: opts?.source ?? "analyze",
          demoKey: opts?.demoKey,
          ...(opts?.orderedProblemIds?.length ? { orderedProblemIds: opts.orderedProblemIds } : {}),
        }),
      });
      const data = (await res.json()) as AnalyzeOk | { ok: false; error?: string };
      if (!res.ok || !("ok" in data) || !data.ok) {
        setError((data as { error?: string }).error ?? "วิเคราะห์ไม่สำเร็จ");
        setAnalysis(null);
        setNote(null);
        return;
      }
      setAnalysis(data);
      setNote(data.structuredNote);
      setLayer1(data.opdFramework.layer1);
      setProblemBlocks(data.opdFramework.layer2);
      const prov: Partial<Record<keyof StructuredOpdNote | "layer1", OpdChartProvenance>> = {};
      for (const k of NOTE_PRIORITY_KEYS) prov[k] = "ai";
      for (const k of NOTE_SECONDARY_KEYS) prov[k] = "ai";
      prov.layer1 = "ai";
      setChartFieldProvenance(prov);
      setChartAccepted({});
      const strip = buildMissingDataStrip(data);
      setLastMissingStrip(strip);
      const activeSet = new Set(data.problemPackResolution.activeMatches.map((m) => m.packId));
      let ready = 0;
      let inc = 0;
      for (const def of CLINICAL_SCORE_DEFINITIONS) {
        const ev = evaluateClinicalScore(def, scoreInputs[def.id] ?? {}, {
          activePackIds: activeSet,
          markedNa: !!scoreMarkedNa[def.id],
        });
        if (ev.state === "ready") ready += 1;
        else if (ev.state === "incomplete") inc += 1;
      }
      const scoreLine =
        ready + inc > 0 ? `คะแนนคลินิก: ${ready} ready · ${inc} incomplete` : null;
      const orderMatch =
        !data.appliedProblemOrder?.length ||
        data.appliedProblemOrder.join("\0") ===
          data.opdFramework.layer2.map((b) => b.id).join("\0");
      const body = buildAssistantDisplayReply(
        data,
        data.structuredNote,
        data.opdFramework.layer2,
        strip,
        { problemOrderOutOfSync: !orderMatch, scoreLine }
      );
      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          body,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      setError("เครือข่ายผิดพลาด");
      setAnalysis(null);
      setNote(null);
    } finally {
      setLoading(false);
    }
  };

  const sendTurn = () => {
    if (!composerText.trim()) {
      setError("พิมพ์รอบนี้ก่อน แล้วกดส่ง");
      return;
    }
    const line = composerText.trim();
    setChatMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        body: line,
        createdAt: new Date().toISOString(),
      },
    ]);
    const nextTranscript = analysisTranscript.trim()
      ? `${analysisTranscript.trim()}\n\n${line}`
      : line;
    setAnalysisTranscript(nextTranscript);
    setComposerText("");
    void runAnalyze(nextTranscript);
  };

  const clearCase = () => {
    setAnalysisTranscript("");
    setComposerText("");
    setChatMessages([]);
    setChartFieldProvenance({});
    setChartAccepted({});
    setLastMissingStrip(buildMissingDataStrip(null));
    setAnalysis(null);
    setNote(null);
    setLayer1(null);
    setProblemBlocks([]);
    setDragFromIndex(null);
    setScoreInputs({});
    setScoreMarkedNaMap({});
    setError(null);
    caseIdRef.current = crypto.randomUUID();
    try {
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(ANALYSIS_TRANSCRIPT_KEY);
      localStorage.removeItem(CHAT_MESSAGES_KEY);
      localStorage.removeItem(SCORES_KEY);
    } catch {
      /* ignore */
    }
  };

  const setScoreField = useCallback((scoreId: string, fieldId: string, value: unknown) => {
    setScoreInputs((prev) => {
      const cur = { ...(prev[scoreId] ?? {}) };
      if (value === "" || value === undefined) {
        delete cur[fieldId];
      } else {
        cur[fieldId] = value;
      }
      return { ...prev, [scoreId]: cur };
    });
  }, []);

  const updateScoreMarkedNa = useCallback((scoreId: string, v: boolean) => {
    setScoreMarkedNaMap((prev) => {
      const next = { ...prev, [scoreId]: v };
      if (!v) delete next[scoreId];
      return next;
    });
  }, []);

  const loadDemo = (text: string, demoKey: string) => {
    const next = analysisTranscript.trim() ? `${analysisTranscript.trim()}\n\n${text}` : text;
    setAnalysisTranscript(next);
    setChatMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        body: `[demo] ${demoKey}`,
        createdAt: new Date().toISOString(),
      },
    ]);
    void runAnalyze(next, { source: "demo", demoKey });
  };

  const copyFullNote = async () => {
    if (!note) return;
    try {
      await navigator.clipboard.writeText(
        formatNoteForCopy(
          analysis?.formattedClinicalNote,
          note,
          layer1,
          problemBlocks,
          analysis?.anaphylaxisErOverlay,
          analysis?.seizureAlteredMentalStatusErOverlay,
          analysis?.dyspneaHypoxemiaErOverlay,
          analysis?.sepsisShockErOverlay,
          analysis?.poisoningOverdoseErOverlay,
          analysis?.laborRoomLaborEvaluationOverlay,
          analysis?.antepartumBleedingOverlay,
          analysis?.preeclampsiaOverlay,
          analysis?.earlyPregnancyPainBleedingOverlay,
          analysis?.abnormalUterineBleedingOverlay,
          analysis?.uriRespiratoryFramework,
          analysis?.feverChildFramework,
          analysis?.giDehydrationFramework,
          analysis?.abdominalPainFramework,
          analysis?.dysuriaUtiFramework,
          analysis?.headacheDizzinessFramework,
          analysis?.backMusculoskeletalFramework,
          analysis?.antibioticRduOverlay,
          analysis?.likelyAdmitBridge,
          analysis?.traumaFramework,
          analysis?.psychFramework,
        ),
      );
    } catch {
      setError("คัดลอกไม่สำเร็จ — ลองเลือกข้อความด้วยมือ");
    }
  };

  const bundle = analysis?.assistantBundle;
  const evLabel = useMemo(() => {
    const lvl = analysis?.evidenceLevel;
    if (lvl === "low") return { text: "หลักฐานยังบาง — สรุประมัดระวัง", tone: "amber" as const };
    if (lvl === "medium") return { text: "หลักฐานปานกลาง — เติมข้อมูลก่อนปิดเคส", tone: "zinc" as const };
    return { text: "หลักฐานค่อนข้างครบ — ปรับตามการตรวจจริง", tone: "emerald" as const };
  }, [analysis?.evidenceLevel]);

  const problemOrderOutOfSync = useMemo(() => {
    if (!analysis?.appliedProblemOrder?.length || !problemBlocks.length) return false;
    const server = analysis.appliedProblemOrder.join("\0");
    const local = problemBlocks.map((b) => b.id).join("\0");
    return server !== local;
  }, [analysis?.appliedProblemOrder, problemBlocks]);

  const scorePackAssignment = useMemo(() => {
    const matches = analysis?.problemPackResolution.activeMatches ?? [];
    const activeSet = new Set<string>(matches.map((m) => m.packId));
    const rows = matches.length
      ? assignScoresToActivePacks(CLINICAL_SCORE_DEFINITIONS, matches)
      : [];
    return { rows, activeSet };
  }, [analysis]);

  const promptStatsLine = useMemo(() => {
    if (!analysis?.promptStats) return null;
    let s = `Prompt ~${analysis.promptStats.approxTokens} tok (user ${analysis.promptStats.userPayloadCharCount} + system ${analysis.promptStats.systemPromptCharCount} chars) · ${analysis.promptStats.problemBlockCount} problem block(s)`;
    if (analysis.investigationsStats) {
      s += ` · inv ${analysis.investigationsStats.returned ? `${analysis.investigationsStats.count}` : "0"} (detail ${analysis.investigationsStats.completeCount}`;
      s += analysis.investigationsStats.withProblemRefCount
        ? ` · ref ${analysis.investigationsStats.withProblemRefCount})`
        : ")";
    }
    return s;
  }, [analysis]);

  const globalStatusLine = useMemo(() => {
    if (!note) return null;
    const parts = [evLabel.text, "ชาร์ตอัปเดตแล้ว"];
    if (problemOrderOutOfSync) parts.push("ลำดับประเด็น unsync");
    return parts.join(" · ");
  }, [note, evLabel.text, problemOrderOutOfSync]);

  const modeOptions: AssistMode[] = ["OPD", "ER", "TRAUMA", "PSYCH", "LABOR_ROOM", "GYNE"];

  const modeLabels: Record<AssistMode, string> = {
    OPD: "OPD (outpatient)",
    ER: "ER (emergency)",
    TRAUMA: "Trauma",
    PSYCH: "Psychiatry",
    LABOR_ROOM: "Labor room (OB triage)",
    GYNE: "Gynecology (acute)",
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-50">
      <div className="border-b border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
              OPD Assist
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              วางประวัติดิบ → AI ร่างโน้ตแพทย์ + กฎความปลอดภัย — ไม่ใช่ AI อย่างเดียว
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-xs">
            <Link
              href="/admin"
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Admin
            </Link>
            <Link
              href="/admin/opd-assist-logs"
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              บันทึกการทดสอบ
            </Link>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-4 py-4 md:px-6 md:py-6">
        <div className="grid min-h-[70vh] grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          <OpdAssistChatPane
            modeOverride={modeOverride}
            modeOptions={modeOptions}
            modeLabels={modeLabels}
            onModeChange={setModeOverride}
            composerText={composerText}
            onComposerChange={setComposerText}
            messages={chatMessages}
            onSend={sendTurn}
            onClearCase={clearCase}
            loading={loading}
            error={error}
            missingStrip={lastMissingStrip}
            globalStatusLine={globalStatusLine}
            problemOrderOutOfSync={problemOrderOutOfSync}
            demos={OPD_ASSIST_DEMOS.map((d) => ({
              key: d.key,
              label: d.label,
              onClick: () => loadDemo(d.text, d.key),
            }))}
            promptStatsLine={promptStatsLine}
            showDebug={showDebug}
            debugLine={analysis ? `Debug: mode ${analysis.mode} · pack ${analysis.rulePack.ruleVersion}` : null}
          />

          {/* RIGHT — CHART */}
          <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-7">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Clinical note</h2>
                <p className="text-xs text-slate-500">แก้ไขได้ทุกช่อง — คัดลอกไป EMR</p>
                {analysis?.caseProfile ? (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Pattern:{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {analysis.caseProfile.caseType}
                    </span>
                    {" · "}
                    {analysis.caseProfile.dominantTheme}
                    {" · "}
                    <span className="font-medium text-slate-700 dark:text-slate-300" title={analysis.visitModeReason}>
                      {analysis.mode}
                    </span>
                    {analysis.visitModeReason ? (
                      <span className="text-slate-400"> ({analysis.visitModeReason})</span>
                    ) : null}
                  </p>
                ) : null}
                {analysis && (analysis.mode === "LABOR_ROOM" || analysis.mode === "GYNE") ? (
                  <details className="group mt-2 rounded-lg border border-rose-200/70 bg-rose-50/40 px-2.5 py-1.5 dark:border-rose-900/40 dark:bg-rose-950/20">
                    <summary className="cursor-pointer list-none text-[11px] font-medium text-rose-900 dark:text-rose-100 [&::-webkit-details-marker]:hidden">
                      <span className="text-rose-700 dark:text-rose-200">
                        OB/GYNE shared rules (documentation)
                      </span>
                      <span className="ml-1 text-rose-400 group-open:hidden">▸</span>
                      <span className="ml-1 hidden text-rose-400 group-open:inline">▾</span>
                    </summary>
                    <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[10px] leading-relaxed text-rose-900/95 dark:text-rose-100/95">
                      {OB_GYNE_SHARED_DOCUMENTATION_RULES.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {analysis ? (
                  <span
                    className={[
                      "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                      evLabel.tone === "amber"
                        ? "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                        : evLabel.tone === "emerald"
                          ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
                    ].join(" ")}
                  >
                    {evLabel.text}
                  </span>
                ) : null}
                {problemOrderOutOfSync ? (
                  <span
                    className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-950 dark:bg-amber-950/50 dark:text-amber-100"
                    title="ลำดับประเด็นในเครื่องยังไม่ตรงกับรอบวิเคราะห์ล่าสุด — กด「ใช้ลำดับนี้แล้ววิเคราะห์ใหม่」เพื่อ sync"
                  >
                    ลำดับประเด็น unsync
                  </span>
                ) : null}
                {analysis?.aiAssist?.phase1.used ? (
                  <span
                    className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-medium text-violet-900 dark:bg-violet-950/50 dark:text-violet-200"
                    title={
                      analysis.aiAssist.phase1.model
                        ? `Thai OPD draft (AI) · ${analysis.aiAssist.phase1.model}`
                        : "Thai OPD clinical note draft (AI + rule check)"
                    }
                  >
                    AI · OPD note
                  </span>
                ) : analysis?.aiAssist?.phase1.fallbackReason ? (
                  <span
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    title={`Rule-only fallback: ${analysis.aiAssist.phase1.fallbackReason}`}
                  >
                    Rule-only
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    const next: Partial<Record<keyof StructuredOpdNote | "layer1", boolean>> = {};
                    for (const k of NOTE_PRIORITY_KEYS) next[k] = true;
                    for (const k of NOTE_SECONDARY_KEYS) next[k] = true;
                    next.layer1 = true;
                    setChartAccepted((p) => ({ ...p, ...next }));
                  }}
                  disabled={!note}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 disabled:opacity-40 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
                >
                  Accept all chart
                </button>
                <button
                  type="button"
                  onClick={copyFullNote}
                  disabled={!note}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"
                >
                  คัดลอกทั้งหมด
                </button>
              </div>
            </div>

            {!note ? (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                <p className="max-w-md text-sm text-slate-500">
                  พิมพ์รอบสั้นๆ ในแชท แล้วกด <strong className="text-slate-700 dark:text-slate-300">ส่งและวิเคราะห์</strong>{" "}
                  — ชาร์ตจะเติมทางขวา
                </p>
              </div>
            ) : (
              <div className="mt-3 max-h-[calc(100vh-200px)] space-y-4 overflow-y-auto pr-1">
                {bundle && analysis && bundle.redFlags.length > 0 ? (
                  <div className="rounded-lg border border-red-200/80 bg-red-50/80 px-3 py-2 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                    <span className="font-semibold">Red flags: </span>
                    {bundle.redFlags.join(" · ")}
                  </div>
                ) : null}

                {problemBlocks.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        ประเด็นหลายระบบ — ลากเรียงลำดับ (อันแรก = primary)
                      </div>
                      {problemOrderOutOfSync ? (
                        <span className="max-w-[min(100%,260px)] rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                          Problem order changed locally — not yet applied to server analysis
                        </span>
                      ) : null}
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {problemBlocks.map((b, i) => (
                        <li
                          key={b.id}
                          draggable
                          onDragStart={() => setDragFromIndex(i)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragFromIndex === null) return;
                            reorderProblems(dragFromIndex, i);
                            setDragFromIndex(null);
                          }}
                          onDragEnd={() => setDragFromIndex(null)}
                          className="flex cursor-grab items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm active:cursor-grabbing dark:border-slate-600 dark:bg-slate-950"
                        >
                          <span className="text-[11px] font-medium text-slate-400">⋮⋮</span>
                          <span
                            className={[
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                              i === 0
                                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                            ].join(" ")}
                          >
                            {i === 0 ? "primary" : `P${i + 1}`}
                          </span>
                          <span className="font-medium text-slate-800 dark:text-slate-100">{b.system}</span>
                          <span className="text-[12px] text-slate-600 dark:text-slate-400">{b.summaryLine}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => {
                        if (!analysisTranscript.trim()) {
                          setError("วางหรือพิมพ์ประวัติผู้ป่วยก่อน แล้วกดปุ่มนี้");
                          return;
                        }
                        void runAnalyze(analysisTranscript, { orderedProblemIds: problemBlocks.map((b) => b.id) });
                      }}
                      disabled={loading}
                      className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
                    >
                      ใช้ลำดับนี้แล้ววิเคราะห์ใหม่
                    </button>
                  </div>
                ) : null}

                <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/30 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                    Assessment / Dx / DDx / Plan / Advice
                  </h3>
                  <div className="mt-2 space-y-3">
                    {NOTE_PRIORITY_KEYS.map((key) => {
                      const label = NOTE_SECTIONS.find((s) => s.key === key)?.label ?? key;
                      const hints = bundle ? inlineHintsForSection(key, bundle) : null;
                      const prov = chartFieldProvenance[key];
                      const acc = chartAccepted[key];
                      return (
                        <div key={key} className="block">
                          <label className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                            {label}
                            {prov === "ai" && !acc ? (
                              <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
                                AI draft
                              </span>
                            ) : null}
                            {prov === "user" ? (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                                Edited
                              </span>
                            ) : null}
                            {acc ? (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                                Accepted
                              </span>
                            ) : null}
                          </label>
                          <textarea
                            className="mt-1 min-h-[72px] w-full resize-y rounded-lg border border-slate-200 bg-white p-2.5 text-sm leading-relaxed text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                            value={note[key]}
                            onChange={(e) => updateNoteField(key, e.target.value)}
                            spellCheck={false}
                          />
                          {hints ? <InlineAssistBlock title={hints.title} items={hints.items} /> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {analysis?.investigations?.length ? (
                  <div className="rounded-lg border border-cyan-200/80 bg-cyan-50/70 px-3 py-2 text-xs text-cyan-950 dark:border-cyan-900/40 dark:bg-cyan-950/30 dark:text-cyan-100">
                    <div className="font-semibold">Investigations (structured v1)</div>
                    <ul className="mt-1.5 space-y-1.5">
                      {analysis.investigations.map((inv) => (
                        <li key={inv.investigationId} className="border-t border-cyan-200/50 pt-1.5 first:border-t-0 first:pt-0 dark:border-cyan-800/50">
                          <span className="font-medium">
                            [{inv.kind}] {inv.label}
                          </span>
                          {inv.status ? <span className="text-cyan-800/90 dark:text-cyan-200/90"> — {inv.status}</span> : null}
                          {inv.problemRefId ? (
                            <span className="ml-1 text-[10px] text-cyan-700 dark:text-cyan-300">ref {inv.problemRefId}</span>
                          ) : null}
                          {inv.bodyPart ? <div className="mt-0.5 text-[11px]">Site: {inv.bodyPart}</div> : null}
                          {inv.summary ? <div className="mt-0.5 whitespace-pre-wrap text-[11px]">{inv.summary}</div> : null}
                          {inv.impression ? (
                            <div className="mt-0.5 text-[11px] text-cyan-900/95 dark:text-cyan-100/95">Impression: {inv.impression}</div>
                          ) : null}
                          {inv.kind === "ecg" ? (
                            <div className="mt-0.5 text-[11px]">
                              {[inv.rate, inv.rhythm, inv.sttSummary].filter(Boolean).join(" · ") || null}
                            </div>
                          ) : null}
                          {inv.keyFindings?.length ? (
                            <ul className="mt-0.5 list-inside list-disc text-[11px]">
                              {inv.keyFindings.map((k, ki) => (
                                <li key={`${inv.investigationId}-kf-${ki}`}>{k}</li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <details className="group rounded-xl border border-slate-200 bg-slate-50/40 dark:border-slate-700 dark:bg-slate-900/40">
                  <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 [&::-webkit-details-marker]:hidden">
                    Clinical frameworks & overlays (collapsed)
                    <span className="ml-1 text-slate-400 group-open:hidden">▸</span>
                    <span className="ml-1 hidden text-slate-400 group-open:inline">▾</span>
                  </summary>
                  <div className="space-y-4 border-t border-slate-200 px-3 pb-3 pt-2 dark:border-slate-700">
                {analysis?.anaphylaxisErOverlay?.active ? (
                  <div className="rounded-lg border border-orange-300/90 bg-orange-50/90 px-3 py-2 text-xs text-orange-950 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-100">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>Anaphylaxis — ER overlay (rule)</span>
                      {analysis.anaphylaxisErOverlay.emergencyEscalationLikely ? (
                        <span className="rounded bg-rose-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-950 dark:bg-rose-900/80 dark:text-rose-100">
                          emergency escalation
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-orange-900/90 dark:text-orange-200/95">
                      IM epinephrine first-line ตาม protocol · ABC ก่อนเรื่องเล่า OPD — ไม่สรุปแค่ผื่นเมื่อมีระบบร่วม
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="เหตุผลที่เปิด overlay" items={analysis.anaphylaxisErOverlay.activationRationale} />
                      <InlineAssistBlock title="สิ่งที่โน้ตสนับสนุนแล้ว" items={analysis.anaphylaxisErOverlay.factsAlreadyPresent} />
                      <InlineAssistBlock title="ถามต่อ (ประวัติ)" items={analysis.anaphylaxisErOverlay.askNext} />
                      <InlineAssistBlock title="ตรวจต่อ" items={analysis.anaphylaxisErOverlay.examNext} />
                      <InlineAssistBlock title="Immediate management (rule hints)" items={analysis.anaphylaxisErOverlay.immediateManagementHints} />
                      <InlineAssistBlock title="Stewardship / documentation" items={analysis.anaphylaxisErOverlay.stewardshipRules} />
                      <InlineAssistBlock
                        title="Emergency escalation (จากข้อความ)"
                        items={analysis.anaphylaxisErOverlay.emergencyEscalationMatched}
                      />
                      <InlineAssistBlock title="เกณฑ์ escalation (เต็ม)" items={analysis.anaphylaxisErOverlay.emergencyEscalationRules} />
                      <InlineAssistBlock title="สไตล์โน้ต" items={analysis.anaphylaxisErOverlay.outputStyleHints} />
                    </div>
                    <PhysicianReferenceBlock sourceIds={getReferenceIdsForAssistOverlay("anaphylaxisEr")} />
                  </div>
                ) : null}

                {analysis?.seizureAlteredMentalStatusErOverlay?.active ? (
                  <div className="rounded-lg border border-indigo-300/90 bg-indigo-50/90 px-3 py-2 text-xs text-indigo-950 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-100">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>Seizure / AMS — ER overlay (rule)</span>
                      {analysis.seizureAlteredMentalStatusErOverlay.emergencyEscalationLikely ? (
                        <span className="rounded bg-rose-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-950 dark:bg-rose-900/80 dark:text-rose-100">
                          emergency escalation
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-indigo-900/90 dark:text-indigo-200/95">
                      ABC / GCS / neuro ก่อนเรื่องเล่า OPD ยาว — ไม่ฝังชักหรือซึมไว้ท้ายโน้ต
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="เหตุผลที่เปิด overlay" items={analysis.seizureAlteredMentalStatusErOverlay.activationRationale} />
                      <InlineAssistBlock title="สิ่งที่โน้ตสนับสนุนแล้ว" items={analysis.seizureAlteredMentalStatusErOverlay.factsAlreadyPresent} />
                      <InlineAssistBlock title="ถามต่อ (ประวัติ)" items={analysis.seizureAlteredMentalStatusErOverlay.askNext} />
                      <InlineAssistBlock title="ตรวจต่อ" items={analysis.seizureAlteredMentalStatusErOverlay.examNext} />
                      <InlineAssistBlock
                        title="Emergency escalation (จากข้อความ)"
                        items={analysis.seizureAlteredMentalStatusErOverlay.emergencyEscalationMatched}
                      />
                      <InlineAssistBlock title="เกณฑ์ escalation (เต็ม)" items={analysis.seizureAlteredMentalStatusErOverlay.emergencyEscalationRules} />
                      <InlineAssistBlock title="สไตล์โน้ต" items={analysis.seizureAlteredMentalStatusErOverlay.outputStyleHints} />
                    </div>
                    <PhysicianReferenceBlock sourceIds={getReferenceIdsForAssistOverlay("seizureAmsEr")} />
                  </div>
                ) : null}

                {analysis?.dyspneaHypoxemiaErOverlay?.active ? (
                  <div className="rounded-lg border border-sky-300/90 bg-sky-50/90 px-3 py-2 text-xs text-sky-950 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>Dyspnea / hypoxemia — ER overlay (rule)</span>
                      {analysis.dyspneaHypoxemiaErOverlay.emergencyEscalationLikely ? (
                        <span className="rounded bg-rose-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-950 dark:bg-rose-900/80 dark:text-rose-100">
                          emergency escalation
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-sky-900/90 dark:text-sky-200/95">
                      ABC / breathing / SpO₂ ก่อนเรื่องเล่า OPD ยาว — ระบุทริจ & stabilization ด้านบน
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="เหตุผลที่เปิด overlay" items={analysis.dyspneaHypoxemiaErOverlay.activationRationale} />
                      <InlineAssistBlock title="สิ่งที่โน้ตสนับสนุนแล้ว" items={analysis.dyspneaHypoxemiaErOverlay.factsAlreadyPresent} />
                      <InlineAssistBlock title="ถามต่อ (ประวัติ)" items={analysis.dyspneaHypoxemiaErOverlay.askNext} />
                      <InlineAssistBlock title="ตรวจต่อ" items={analysis.dyspneaHypoxemiaErOverlay.examNext} />
                      <InlineAssistBlock
                        title="Emergency escalation (จากข้อความ)"
                        items={analysis.dyspneaHypoxemiaErOverlay.emergencyEscalationMatched}
                      />
                      <InlineAssistBlock title="เกณฑ์ escalation (เต็ม)" items={analysis.dyspneaHypoxemiaErOverlay.emergencyEscalationRules} />
                      <InlineAssistBlock title="สไตล์โน้ต" items={analysis.dyspneaHypoxemiaErOverlay.outputStyleHints} />
                    </div>
                    <PhysicianReferenceBlock sourceIds={getReferenceIdsForAssistOverlay("dyspneaEr")} />
                  </div>
                ) : null}

                {analysis?.sepsisShockErOverlay?.active ? (
                  <div className="rounded-lg border border-orange-300/90 bg-orange-50/90 px-3 py-2 text-xs text-orange-950 dark:border-orange-800 dark:bg-orange-950/35 dark:text-orange-100">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>Shock / sepsis concern — ER overlay (rule)</span>
                      {analysis.sepsisShockErOverlay.emergencyEscalationLikely ? (
                        <span className="rounded bg-rose-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-950 dark:bg-rose-900/80 dark:text-rose-100">
                          emergency escalation
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-orange-900/90 dark:text-orange-200/95">
                      hypoperfusion / septic shock / mimic — circulation & immediate management ก่อนเรื่องเล่า OPD ยาว
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="เหตุผลที่เปิด overlay" items={analysis.sepsisShockErOverlay.activationRationale} />
                      <InlineAssistBlock title="สิ่งที่โน้ตสนับสนุนแล้ว" items={analysis.sepsisShockErOverlay.factsAlreadyPresent} />
                      <InlineAssistBlock title="ถามต่อ (ประวัติ)" items={analysis.sepsisShockErOverlay.askNext} />
                      <InlineAssistBlock title="ตรวจต่อ" items={analysis.sepsisShockErOverlay.examNext} />
                      <InlineAssistBlock title="Negatives สำคัญ (บันทึกถ้าไม่มี)" items={analysis.sepsisShockErOverlay.pertinentNegatives} />
                      <InlineAssistBlock title="กฎคลินิก (ผู้ใหญ่ / เด็ก)" items={analysis.sepsisShockErOverlay.clinicalRulesAdultPediatric} />
                      <InlineAssistBlock
                        title="Emergency escalation (จากข้อความ)"
                        items={analysis.sepsisShockErOverlay.emergencyEscalationMatched}
                      />
                      <InlineAssistBlock title="เกณฑ์ escalation (เต็ม)" items={analysis.sepsisShockErOverlay.emergencyEscalationRules} />
                      <InlineAssistBlock title="สไตล์โน้ต" items={analysis.sepsisShockErOverlay.outputStyleHints} />
                    </div>
                  </div>
                ) : null}

                {analysis?.poisoningOverdoseErOverlay?.active ? (
                  <div className="rounded-lg border border-teal-300/90 bg-teal-50/90 px-3 py-2 text-xs text-teal-950 dark:border-teal-800 dark:bg-teal-950/35 dark:text-teal-100">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>Poisoning / overdose — ER overlay (rule)</span>
                      {analysis.poisoningOverdoseErOverlay.emergencyEscalationLikely ? (
                        <span className="rounded bg-rose-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-950 dark:bg-rose-900/80 dark:text-rose-100">
                          emergency escalation
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-teal-900/90 dark:text-teal-200/95">
                      ABC / glucose / ECG ก่อน — stabilization & tox pathway; opioid เน้นหายใจ + naloxone ไม่ใช่แค่ปลุก
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="เหตุผลที่เปิด overlay" items={analysis.poisoningOverdoseErOverlay.activationRationale} />
                      <InlineAssistBlock title="สิ่งที่โน้ตสนับสนุนแล้ว" items={analysis.poisoningOverdoseErOverlay.factsAlreadyPresent} />
                      <InlineAssistBlock title="ถามต่อ (ประวัติ)" items={analysis.poisoningOverdoseErOverlay.askNext} />
                      <InlineAssistBlock title="ตรวจต่อ" items={analysis.poisoningOverdoseErOverlay.examNext} />
                      <InlineAssistBlock title="Negatives สำคัญ (บันทึกถ้าไม่มี)" items={analysis.poisoningOverdoseErOverlay.pertinentNegatives} />
                      <InlineAssistBlock title="กฎคลินิก" items={analysis.poisoningOverdoseErOverlay.clinicalRules} />
                      <InlineAssistBlock
                        title="Emergency escalation (จากข้อความ)"
                        items={analysis.poisoningOverdoseErOverlay.emergencyEscalationMatched}
                      />
                      <InlineAssistBlock title="เกณฑ์ escalation (เต็ม)" items={analysis.poisoningOverdoseErOverlay.emergencyEscalationRules} />
                      <InlineAssistBlock title="สไตล์โน้ต" items={analysis.poisoningOverdoseErOverlay.outputStyleHints} />
                    </div>
                  </div>
                ) : null}

                {analysis?.laborRoomLaborEvaluationOverlay?.active ? (
                  <div className="rounded-lg border border-rose-300/90 bg-rose-50/90 px-3 py-2 text-xs text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-100">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>Labor room — labor evaluation (rule)</span>
                      {analysis.laborRoomLaborEvaluationOverlay.urgentPathwayLikely ? (
                        <span className="rounded bg-rose-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-950 dark:bg-rose-900/80 dark:text-rose-100">
                          urgent OB pathway
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-rose-900/90 dark:text-rose-200/95">
                      GA / parity / ตัวคลอด / น้ำเดิน / เลือด / FM / vitals — ไม่เขียนแบบ URI; disposition ชัด (latent / active / observe / urgent OB / refer)
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="Surface early (structured + triage)" items={analysis.laborRoomLaborEvaluationOverlay.surfaceEarly} />
                      <InlineAssistBlock title="ถามต่อ (ประวัติ)" items={analysis.laborRoomLaborEvaluationOverlay.askNext} />
                      <InlineAssistBlock title="ตรวจต่อ" items={analysis.laborRoomLaborEvaluationOverlay.examNext} />
                      <InlineAssistBlock title="กฎคลินิก" items={analysis.laborRoomLaborEvaluationOverlay.clinicalRules} />
                      <InlineAssistBlock title="ตัวอย่าง disposition" items={analysis.laborRoomLaborEvaluationOverlay.dispositionHints} />
                      <InlineAssistBlock
                        title="Urgent pathway (จากข้อความ)"
                        items={analysis.laborRoomLaborEvaluationOverlay.urgentPathwayMatched}
                      />
                      <InlineAssistBlock title="เหตุผลที่เปิด overlay" items={analysis.laborRoomLaborEvaluationOverlay.activationRationale} />
                    </div>
                    <PhysicianReferenceBlock sourceIds={getReferenceIdsForAssistOverlay("laborEval")} />
                  </div>
                ) : null}

                {analysis?.antepartumBleedingOverlay?.active ? (
                  <div className="rounded-lg border border-red-300/90 bg-red-50/90 px-3 py-2 text-xs text-red-950 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-100">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>Antepartum / pregnancy bleeding (rule)</span>
                      {analysis.antepartumBleedingOverlay.immediateConcernFirst ? (
                        <span className="rounded bg-rose-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-950 dark:bg-rose-900/80 dark:text-rose-100">
                          immediate concern first
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-red-900/90 dark:text-red-200/95">
                      GA / เลือด / ปวด / hemodynamics / fetal — early+ปวด → ectopic/miscarriage; หลังท้อง → urgent OB; vitals ไม่นิ่ง → triage นำสำคัญก่อน
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock
                        title="Surface (structured + triage)"
                        items={analysis.antepartumBleedingOverlay.surfaceAlways}
                      />
                      <InlineAssistBlock title="ถามต่อ" items={analysis.antepartumBleedingOverlay.askNext} />
                      <InlineAssistBlock title="ตรวจต่อ" items={analysis.antepartumBleedingOverlay.examNext} />
                      <InlineAssistBlock title="กฎคลินิก" items={analysis.antepartumBleedingOverlay.clinicalRules} />
                      <InlineAssistBlock
                        title="Immediate concern / pathway notes"
                        items={analysis.antepartumBleedingOverlay.immediateConcernReasons}
                      />
                      <InlineAssistBlock title="เหตุผลที่เปิด overlay" items={analysis.antepartumBleedingOverlay.activationRationale} />
                    </div>
                    <PhysicianReferenceBlock sourceIds={getReferenceIdsForAssistOverlay("antepartumBleed")} />
                  </div>
                ) : null}

                {analysis?.preeclampsiaOverlay?.active ? (
                  <div className="rounded-lg border border-violet-300/90 bg-violet-50/90 px-3 py-2 text-xs text-violet-950 dark:border-violet-900/60 dark:bg-violet-950/35 dark:text-violet-100">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>Preeclampsia / HDP concern (rule)</span>
                      {analysis.preeclampsiaOverlay.urgentObPathwayLikely ? (
                        <span className="rounded bg-rose-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-950 dark:bg-rose-900/80 dark:text-rose-100">
                          urgent OB pathway
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-violet-900/90 dark:text-violet-200/95">
                      สถานะครรภ์ / GA / BP / ปวดหัว / สายตา / RUQ-epigastric / ชัก / fetal — ไม่ใช้โครงปวดหัว OPD ทั่วไป
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock
                        title="Surface (structured + triage)"
                        items={analysis.preeclampsiaOverlay.surfaceAlways}
                      />
                      <InlineAssistBlock title="ถามต่อ" items={analysis.preeclampsiaOverlay.askNext} />
                      <InlineAssistBlock title="ตรวจต่อ" items={analysis.preeclampsiaOverlay.examNext} />
                      <InlineAssistBlock title="กฎคลินิก" items={analysis.preeclampsiaOverlay.clinicalRules} />
                      <InlineAssistBlock
                        title="Urgent OB pathway (reasons)"
                        items={analysis.preeclampsiaOverlay.urgentObPathwayReasons}
                      />
                      <InlineAssistBlock title="เหตุผลที่เปิด overlay" items={analysis.preeclampsiaOverlay.activationRationale} />
                    </div>
                    <PhysicianReferenceBlock sourceIds={getReferenceIdsForAssistOverlay("preeclampsia")} />
                  </div>
                ) : null}

                {analysis?.earlyPregnancyPainBleedingOverlay?.active ? (
                  <div className="rounded-lg border border-amber-300/90 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-100">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>Early pregnancy — pain / bleeding (rule)</span>
                      {analysis.earlyPregnancyPainBleedingOverlay.ectopicMiscarriagePathwayRequired ? (
                        <span className="rounded bg-amber-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-950 dark:bg-amber-900/80 dark:text-amber-50">
                          ectopic / miscarriage pathway
                        </span>
                      ) : null}
                      {analysis.earlyPregnancyPainBleedingOverlay.immediateGyneErConcern ? (
                        <span className="rounded bg-rose-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-950 dark:bg-rose-900/80 dark:text-rose-100">
                          urgent GYNE/ER
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/95">
                      LMP/GA / ปวด+ข้าง / เลือด / hemodynamics / ectopic clues — ปวด+เลือดระยะแรก → ectopic vs แท้ง; vitals ไม่นิ่งหรือท้องเฉียบพลัน → urgent
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock
                        title="Surface (structured + triage)"
                        items={analysis.earlyPregnancyPainBleedingOverlay.surfaceAlways}
                      />
                      <InlineAssistBlock title="ถามต่อ" items={analysis.earlyPregnancyPainBleedingOverlay.askNext} />
                      <InlineAssistBlock title="ตรวจต่อ" items={analysis.earlyPregnancyPainBleedingOverlay.examNext} />
                      <InlineAssistBlock title="กฎคลินิก" items={analysis.earlyPregnancyPainBleedingOverlay.clinicalRules} />
                      <InlineAssistBlock
                        title="Ectopic clues (จากข้อความ)"
                        items={analysis.earlyPregnancyPainBleedingOverlay.ectopicRiskCluesMatched}
                      />
                      <InlineAssistBlock
                        title="Immediate concern"
                        items={analysis.earlyPregnancyPainBleedingOverlay.immediateConcernReasons}
                      />
                      <InlineAssistBlock
                        title="เหตุผลที่เปิด overlay"
                        items={analysis.earlyPregnancyPainBleedingOverlay.activationRationale}
                      />
                    </div>
                    <PhysicianReferenceBlock sourceIds={getReferenceIdsForAssistOverlay("earlyPregnancyPb")} />
                  </div>
                ) : null}

                {analysis?.abnormalUterineBleedingOverlay?.active ? (
                  <div className="rounded-lg border border-sky-300/90 bg-sky-50/90 px-3 py-2 text-xs text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-100">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>Acute AUB — abnormal uterine bleeding (rule)</span>
                      {analysis.abnormalUterineBleedingOverlay.urgentPathwayLikely ? (
                        <span className="rounded bg-rose-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-950 dark:bg-rose-900/80 dark:text-rose-100">
                          urgent pathway
                        </span>
                      ) : null}
                      {analysis.abnormalUterineBleedingOverlay.nonPregnantAubHint ? (
                        <span className="rounded bg-sky-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-950 dark:bg-sky-900/80 dark:text-sky-50">
                          nonpregnant hint
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-sky-900/90 dark:text-sky-200/95">
                      สถานะครรภ์ชัดก่อน / hemodynamics ก่อน — เลือดมาก+ไม่นิ่ง → urgent; AUB ไม่ใช่โน้ตปวดประจำเดือนทั่วไป
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock
                        title="Surface (structured + triage)"
                        items={analysis.abnormalUterineBleedingOverlay.surfaceAlways}
                      />
                      <InlineAssistBlock title="ถามต่อ" items={analysis.abnormalUterineBleedingOverlay.askNext} />
                      <InlineAssistBlock title="ตรวจต่อ" items={analysis.abnormalUterineBleedingOverlay.examNext} />
                      <InlineAssistBlock title="กฎคลินิก" items={analysis.abnormalUterineBleedingOverlay.clinicalRules} />
                      <InlineAssistBlock
                        title="Urgent pathway (reasons)"
                        items={analysis.abnormalUterineBleedingOverlay.urgentPathwayReasons}
                      />
                      <InlineAssistBlock
                        title="เหตุผลที่เปิด overlay"
                        items={analysis.abnormalUterineBleedingOverlay.activationRationale}
                      />
                    </div>
                    <PhysicianReferenceBlock sourceIds={getReferenceIdsForAssistOverlay("aub")} />
                  </div>
                ) : null}

                {analysis?.traumaFramework.active ? (
                  <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/45 dark:bg-amber-950/25 dark:text-amber-100">
                    <div className="font-semibold">Trauma — framework (rule)</div>
                    <p className="mt-1 text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/95">
                      mechanism / survey ก่อน problem list — ไม่เรียงเหมือน OPD ล้วนๆ
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="สิ่งที่โน้ตสนับสนุนแล้ว" items={analysis.traumaFramework.factsAlreadyPresent} />
                      <InlineAssistBlock title="ประวัติ — ถามเพิ่ม" items={analysis.traumaFramework.historyAskNext} />
                      <InlineAssistBlock title="ตรวจ — โฟกัส" items={analysis.traumaFramework.examFocusNext} />
                      <InlineAssistBlock title="Negatives สำคัญ" items={analysis.traumaFramework.importantNegatives} />
                    </div>
                    <div className="mt-2">
                      <InlineAssistBlock title="กฎให้คิด" items={analysis.traumaFramework.reasoningRules} />
                    </div>
                    <PhysicianReferenceBlock sourceIds={getReferenceIdsForFramework("trauma")} />
                  </div>
                ) : null}

                {analysis?.psychFramework.active ? (
                  <div className="rounded-lg border border-violet-200/80 bg-violet-50/60 px-3 py-2 text-xs text-violet-950 dark:border-violet-900/45 dark:bg-violet-950/25 dark:text-violet-100">
                    <div className="font-semibold">Psych — framework (rule)</div>
                    <p className="mt-1 text-[11px] leading-relaxed text-violet-900/90 dark:text-violet-200/95">
                      safety / risk / MSE ก่อน — ไม่เขียนแบบ URI ทั่วไป
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="สิ่งที่โน้ตสนับสนุนแล้ว" items={analysis.psychFramework.factsAlreadyPresent} />
                      <InlineAssistBlock title="ประวัติ — ถามเพิ่ม" items={analysis.psychFramework.historyAskNext} />
                      <InlineAssistBlock title="MSE" items={analysis.psychFramework.mentalStatusPrompts} />
                      <InlineAssistBlock title="Risk" items={analysis.psychFramework.riskPrompts} />
                      <InlineAssistBlock title="Negatives สำคัญ" items={analysis.psychFramework.importantNegatives} />
                    </div>
                    <div className="mt-2">
                      <InlineAssistBlock title="กฎให้คิด" items={analysis.psychFramework.reasoningRules} />
                    </div>
                    <PhysicianReferenceBlock sourceIds={getReferenceIdsForFramework("psych")} />
                  </div>
                ) : null}

                {analysis?.uriRespiratoryFramework.active ? (
                  <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-950 dark:border-emerald-900/45 dark:bg-emerald-950/25 dark:text-emerald-100">
                    <div className="font-semibold">URI / ไอ / เจ็บคอ — framework (rule)</div>
                    <p className="mt-1 text-[11px] leading-relaxed text-emerald-900/90 dark:text-emerald-200/95">
                      ไม่ default pneumonia จากไข้+ไอ — ใช้ RR / SpO₂ / work of breathing กำหนดความรุนแรง
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="สิ่งที่โน้ตสนับสนุนแล้ว" items={analysis.uriRespiratoryFramework.factsAlreadyPresent} />
                      <InlineAssistBlock title="ถามต่อ (ประวัติ)" items={analysis.uriRespiratoryFramework.askNext} />
                      <InlineAssistBlock title="ตรวจต่อ" items={analysis.uriRespiratoryFramework.examNext} />
                      <InlineAssistBlock
                        title="Negatives สำคัญ (บันทึกถ้าไม่มี)"
                        items={analysis.uriRespiratoryFramework.importantNegatives}
                      />
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="ตัวอย่าง differential" items={analysis.uriRespiratoryFramework.differentialExamples} />
                      <InlineAssistBlock title="กฎให้คิด" items={analysis.uriRespiratoryFramework.reasoningRules} />
                    </div>
                    <div className="mt-2">
                      <InlineAssistBlock title="สไตล์โน้ต" items={analysis.uriRespiratoryFramework.outputStyleHints} />
                    </div>
                    <PhysicianReferenceBlock sourceIds={getReferenceIdsForFramework("uriRespiratory")} />
                  </div>
                ) : null}

                {analysis?.feverChildFramework?.active ? (
                  <div className="rounded-lg border border-rose-200/80 bg-rose-50/65 px-3 py-2 text-xs text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-100">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>ไข้เด็ก / fever without focus (rule)</span>
                      {analysis.feverChildFramework.urgencyHint === "prefer_er_or_urgent" ? (
                        <span className="rounded bg-rose-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-950 dark:bg-rose-900/80 dark:text-rose-100">
                          urgent / ER bias
                        </span>
                      ) : null}
                      {analysis.feverChildFramework.secondaryToOtherSystem ? (
                        <span className="text-[10px] font-normal text-rose-800/90 dark:text-rose-200/90">
                          secondary: {analysis.feverChildFramework.secondarySystemNote ?? "—"}
                        </span>
                      ) : null}
                    </div>
                    {analysis.feverChildFramework.dangerSignMatches.length ? (
                      <p className="mt-1 text-[11px] font-medium text-rose-900 dark:text-rose-200">
                        Danger signs: {analysis.feverChildFramework.dangerSignMatches.join(" · ")}
                      </p>
                    ) : null}
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="สิ่งที่โน้ตสนับสนุนแล้ว" items={analysis.feverChildFramework.factsAlreadyPresent} />
                      <InlineAssistBlock title="ถามต่อ (ประวัติ)" items={analysis.feverChildFramework.askNext} />
                      <InlineAssistBlock title="ตรวจต่อ" items={analysis.feverChildFramework.examNext} />
                      <InlineAssistBlock
                        title="Negatives สำคัญ (บันทึกถ้าไม่มี)"
                        items={analysis.feverChildFramework.importantNegatives}
                      />
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="ตัวอย่าง differential" items={analysis.feverChildFramework.differentialExamples} />
                      <InlineAssistBlock title="กฎให้คิด" items={analysis.feverChildFramework.reasoningRules} />
                    </div>
                    <div className="mt-2">
                      <InlineAssistBlock title="สไตล์โน้ต" items={analysis.feverChildFramework.outputStyleHints} />
                    </div>
                    <PhysicianReferenceBlock sourceIds={getReferenceIdsForFramework("feverChild")} />
                  </div>
                ) : null}

                {analysis?.giDehydrationFramework?.active ? (
                  <div className="rounded-lg border border-sky-200/80 bg-sky-50/70 px-3 py-2 text-xs text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-100">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>ท้องเสีย / อาเจียน / ขาดน้ำ (rule)</span>
                      <span className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-900 dark:bg-slate-800 dark:text-sky-100">
                        dehydration: {analysis.giDehydrationFramework.dehydrationLevel}
                      </span>
                      {analysis.giDehydrationFramework.urgencyHint === "prefer_er_or_urgent" ? (
                        <span className="rounded bg-sky-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-950 dark:bg-sky-900/80 dark:text-sky-100">
                          urgent / ER bias
                        </span>
                      ) : null}
                      {analysis.giDehydrationFramework.secondaryToOtherSystem ? (
                        <span className="text-[10px] font-normal text-sky-800/90 dark:text-sky-200/90">
                          secondary: {analysis.giDehydrationFramework.secondarySystemNote ?? "—"}
                        </span>
                      ) : null}
                    </div>
                    {analysis.giDehydrationFramework.dehydrationRationale.length ? (
                      <ul className="mt-1.5 list-inside list-disc text-[11px] leading-relaxed text-sky-900/95 dark:text-sky-200/95">
                        {analysis.giDehydrationFramework.dehydrationRationale.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="สิ่งที่โน้ตสนับสนุนแล้ว" items={analysis.giDehydrationFramework.factsAlreadyPresent} />
                      <InlineAssistBlock title="ถามต่อ (ประวัติ)" items={analysis.giDehydrationFramework.askNext} />
                      <InlineAssistBlock title="ตรวจต่อ" items={analysis.giDehydrationFramework.examNext} />
                      <InlineAssistBlock
                        title="Negatives สำคัญ (บันทึกถ้าไม่มี)"
                        items={analysis.giDehydrationFramework.importantNegatives}
                      />
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="ตัวอย่าง differential" items={analysis.giDehydrationFramework.differentialExamples} />
                      <InlineAssistBlock title="กฎให้คิด" items={analysis.giDehydrationFramework.reasoningRules} />
                    </div>
                    <div className="mt-2">
                      <InlineAssistBlock title="สไตล์โน้ต" items={analysis.giDehydrationFramework.outputStyleHints} />
                    </div>
                    <PhysicianReferenceBlock sourceIds={getReferenceIdsForFramework("giDehydration")} />
                  </div>
                ) : null}

                {analysis?.abdominalPainFramework?.active ? (
                  <div className="rounded-lg border border-orange-200/80 bg-orange-50/70 px-3 py-2 text-xs text-orange-950 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-100">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>ปวดท้องเฉียบพลัน / acute abdomen (rule)</span>
                      {analysis.abdominalPainFramework.urgencyHint === "prefer_er_or_urgent" ? (
                        <span className="rounded bg-orange-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-950 dark:bg-orange-900/80 dark:text-orange-100">
                          urgent / ER bias
                        </span>
                      ) : null}
                      {analysis.abdominalPainFramework.traumaContextPresent ? (
                        <span className="text-[10px] font-normal text-orange-800/90 dark:text-orange-200/90">
                          trauma context — align TRAUMA survey
                        </span>
                      ) : null}
                      {analysis.abdominalPainFramework.secondaryToOtherSystem ? (
                        <span className="text-[10px] font-normal text-orange-800/90 dark:text-orange-200/90">
                          secondary: {analysis.abdominalPainFramework.secondarySystemNote ?? "—"}
                        </span>
                      ) : null}
                    </div>
                    {analysis.abdominalPainFramework.surgicalRedFlagMatches.length ? (
                      <p className="mt-1 text-[11px] font-medium text-orange-900 dark:text-orange-200">
                        Surgical / urgent: {analysis.abdominalPainFramework.surgicalRedFlagMatches.join(" · ")}
                      </p>
                    ) : null}
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="สิ่งที่โน้ตสนับสนุนแล้ว" items={analysis.abdominalPainFramework.factsAlreadyPresent} />
                      <InlineAssistBlock title="ถามต่อ (ประวัติ)" items={analysis.abdominalPainFramework.askNext} />
                      <InlineAssistBlock title="ตรวจต่อ" items={analysis.abdominalPainFramework.examNext} />
                      <InlineAssistBlock
                        title="Negatives สำคัญ (บันทึกถ้าไม่มี)"
                        items={analysis.abdominalPainFramework.importantNegatives}
                      />
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="ตัวอย่าง differential" items={analysis.abdominalPainFramework.differentialExamples} />
                      <InlineAssistBlock title="กฎให้คิด" items={analysis.abdominalPainFramework.reasoningRules} />
                    </div>
                    <div className="mt-2">
                      <InlineAssistBlock title="สไตล์โน้ต" items={analysis.abdominalPainFramework.outputStyleHints} />
                    </div>
                    <PhysicianReferenceBlock sourceIds={getReferenceIdsForFramework("abdominalPain")} />
                  </div>
                ) : null}

                {analysis?.dysuriaUtiFramework?.active ? (
                  <div className="rounded-lg border border-cyan-200/80 bg-cyan-50/70 px-3 py-2 text-xs text-cyan-950 dark:border-cyan-900/50 dark:bg-cyan-950/30 dark:text-cyan-100">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>ปัสสาวะแสบ / UTI-like — lower vs upper (rule)</span>
                      <span className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-900 dark:bg-slate-800 dark:text-cyan-100">
                        tier: {analysis.dysuriaUtiFramework.utiConcernTier}
                      </span>
                      {analysis.dysuriaUtiFramework.dysuriaPresent ? (
                        <span className="rounded bg-emerald-500/25 px-1.5 py-0.5 text-[10px] font-medium text-emerald-900 dark:text-emerald-100">
                          dysuria มี
                        </span>
                      ) : (
                        <span className="rounded bg-slate-500/25 px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-400">
                          dysuria ไม่ชัด
                        </span>
                      )}
                      {analysis.dysuriaUtiFramework.pediatricSpecialistEscalation ? (
                        <span className="rounded bg-rose-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-950 dark:bg-rose-900/80 dark:text-rose-100">
                          urgent &lt;3 mo
                        </span>
                      ) : null}
                      {analysis.dysuriaUtiFramework.lowerUtiLikelihoodReduced ? (
                        <span className="rounded bg-amber-500/25 px-1.5 py-0.5 text-[10px] text-amber-900 dark:text-amber-100">
                          lower UTI น่าจะต่ำ
                        </span>
                      ) : null}
                      {analysis.dysuriaUtiFramework.genitalIrritationProminent ? (
                        <span className="rounded bg-fuchsia-500/25 px-1.5 py-0.5 text-[10px] text-fuchsia-900 dark:text-fuchsia-100">
                          genital irritation เด่น
                        </span>
                      ) : null}
                      {analysis.dysuriaUtiFramework.alternativeFocusPossible ? (
                        <span className="text-[10px] font-normal text-cyan-800/90 dark:text-cyan-200/90">
                          โฟกัส infection อื่นเป็นไปได้ — ชั่ง urinary clues
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="สิ่งที่โน้ตสนับสนุนแล้ว" items={analysis.dysuriaUtiFramework.factsAlreadyPresent} />
                      <InlineAssistBlock title="ถามต่อ (ประวัติ)" items={analysis.dysuriaUtiFramework.askNext} />
                      <InlineAssistBlock title="ตรวจต่อ" items={analysis.dysuriaUtiFramework.examNext} />
                      <InlineAssistBlock
                        title="Negatives สำคัญ (บันทึกถ้าไม่มี)"
                        items={analysis.dysuriaUtiFramework.importantNegatives}
                      />
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="ตัวอย่าง differential" items={analysis.dysuriaUtiFramework.differentialExamples} />
                      <InlineAssistBlock title="กฎให้คิด" items={analysis.dysuriaUtiFramework.reasoningRules} />
                    </div>
                    <div className="mt-2">
                      <InlineAssistBlock title="สไตล์โน้ต" items={analysis.dysuriaUtiFramework.outputStyleHints} />
                    </div>
                    <PhysicianReferenceBlock sourceIds={getReferenceIdsForFramework("dysuriaUti")} />
                  </div>
                ) : null}

                {analysis?.headacheDizzinessFramework?.active ? (
                  <div className="rounded-lg border border-violet-200/80 bg-violet-50/70 px-3 py-2 text-xs text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-100">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>ปวดหัว / เวียนหัว — framework (rule)</span>
                      {analysis.headacheDizzinessFramework.erPriorityConcern ? (
                        <span className="rounded bg-rose-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-950 dark:bg-rose-900/80 dark:text-rose-100">
                          ER / neuro priority
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-violet-900/90 dark:text-violet-200/95">
                      red flags ก่อน benign migraine / BPPV — แยก headache vs dizziness เมื่อเป็นคนละเรื่อง
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="สิ่งที่โน้ตสนับสนุนแล้ว" items={analysis.headacheDizzinessFramework.factsAlreadyPresent} />
                      <InlineAssistBlock title="ถามต่อ (ประวัติ)" items={analysis.headacheDizzinessFramework.askNext} />
                      <InlineAssistBlock title="ตรวจต่อ" items={analysis.headacheDizzinessFramework.examNext} />
                      <InlineAssistBlock
                        title="Negatives สำคัญ (บันทึกถ้าไม่มี)"
                        items={analysis.headacheDizzinessFramework.importantNegatives}
                      />
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="ตัวอย่าง differential" items={analysis.headacheDizzinessFramework.differentialExamples} />
                      <InlineAssistBlock title="กฎให้คิด" items={analysis.headacheDizzinessFramework.reasoningRules} />
                    </div>
                    <div className="mt-2">
                      <InlineAssistBlock title="สไตล์โน้ต" items={analysis.headacheDizzinessFramework.outputStyleHints} />
                    </div>
                  </div>
                ) : null}

                {analysis?.backMusculoskeletalFramework?.active ? (
                  <div className="rounded-lg border border-stone-200/80 bg-stone-50/70 px-3 py-2 text-xs text-stone-950 dark:border-stone-700/80 dark:bg-stone-900/40 dark:text-stone-100">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>ปวดหลัง / คอ / MSK — framework (rule)</span>
                      {analysis.backMusculoskeletalFramework.urgentCaudaOrNeuroEmergency ? (
                        <span className="rounded bg-rose-200/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-950 dark:bg-rose-900/80 dark:text-rose-100">
                          urgent / cauda pathway
                        </span>
                      ) : null}
                      {analysis.backMusculoskeletalFramework.infectionConsideration ? (
                        <span className="rounded bg-amber-500/25 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:text-amber-100">
                          fever + spine — infection path
                        </span>
                      ) : null}
                      {analysis.backMusculoskeletalFramework.traumaImagingConsideration ? (
                        <span className="rounded bg-sky-500/25 px-1.5 py-0.5 text-[10px] font-medium text-sky-900 dark:text-sky-100">
                          trauma + bony — imaging
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-stone-800/90 dark:text-stone-200/95">
                      red flags ก่อน mechanical diagnosis — แยก radicular จาก strain เมื่อไม่มี radiation / neuro
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="สิ่งที่โน้ตสนับสนุนแล้ว" items={analysis.backMusculoskeletalFramework.factsAlreadyPresent} />
                      <InlineAssistBlock title="ถามต่อ (ประวัติ)" items={analysis.backMusculoskeletalFramework.askNext} />
                      <InlineAssistBlock title="ตรวจต่อ" items={analysis.backMusculoskeletalFramework.examNext} />
                      <InlineAssistBlock
                        title="Negatives สำคัญ (บันทึกถ้าไม่มี)"
                        items={analysis.backMusculoskeletalFramework.importantNegatives}
                      />
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="ตัวอย่าง differential" items={analysis.backMusculoskeletalFramework.differentialExamples} />
                      <InlineAssistBlock title="กฎให้คิด" items={analysis.backMusculoskeletalFramework.reasoningRules} />
                    </div>
                    <div className="mt-2">
                      <InlineAssistBlock title="สไตล์โน้ต" items={analysis.backMusculoskeletalFramework.outputStyleHints} />
                    </div>
                    <PhysicianReferenceBlock sourceIds={getReferenceIdsForFramework("backMusculoskeletal")} />
                  </div>
                ) : null}

                {analysis?.antibioticRduOverlay?.active ? (
                  <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      <span>ยาปฏิชีวนะ / RDU — stewardship (rule)</span>
                      <span className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-900 dark:bg-slate-800 dark:text-emerald-100">
                        {analysis.antibioticRduOverlay.supportLevel === "evidence_weak_for_antibiotic"
                          ? "หลักฐานอ่อน"
                          : analysis.antibioticRduOverlay.supportLevel === "evidence_incomplete"
                            ? "หลักฐานไม่ครบ"
                            : analysis.antibioticRduOverlay.supportLevel === "bacterial_features_partially_supportive"
                              ? "สนับสนุนบางส่วน"
                              : "รุนแรง/ซับซ้อน"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-emerald-900/90 dark:text-emerald-200/95">
                      ไม่แนะนำยาปฏิชีวนะเป็น default สำหรับ URI ไวรัสทั่วไป — บันทึก rationale และทางเลือก non-antibiotic
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="หลักฐาน / เหตุผล" items={analysis.antibioticRduOverlay.evidenceRationale} />
                      <InlineAssistBlock title="ถามต่อ" items={analysis.antibioticRduOverlay.askNext} />
                      <InlineAssistBlock title="ตรวจต่อ" items={analysis.antibioticRduOverlay.examNext} />
                      <InlineAssistBlock
                        title="ตรวจเสริมที่เสริมการตีความแบคทีเรีย"
                        items={analysis.antibioticRduOverlay.testsToStrengthenBacterial}
                      />
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock
                        title="ทางเลือกที่น่าจะเป็น (ไม่ใช่แอนติไบโอติก) ณ ตอนนี้"
                        items={analysis.antibioticRduOverlay.alternativeNonAntibioticLikely}
                      />
                      <InlineAssistBlock title="ถ้าพบอะไรเพิ่ม → สนับสนุนมากขึ้น" items={analysis.antibioticRduOverlay.conditionalSupportExamples} />
                    </div>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock
                        title="ยังขาดก่อนพิจารณา abx อย่างมีเหตุผล"
                        items={analysis.antibioticRduOverlay.missingBeforeAntibioticConsideration}
                      />
                      <InlineAssistBlock title="กฎ stewardship" items={analysis.antibioticRduOverlay.stewardshipRules} />
                      <InlineAssistBlock title="สไตล์โน้ต" items={analysis.antibioticRduOverlay.outputStyleHints} />
                    </div>
                    <PhysicianReferenceBlock sourceIds={getReferenceIdsForAssistOverlay("abxRdu")} />
                  </div>
                ) : null}

                {analysis?.likelyAdmitBridge?.active ? (
                  <div className="rounded-lg border border-slate-300/90 bg-slate-50/80 px-3 py-2 text-xs text-slate-950 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-100">
                    <div className="font-semibold">Likely-admit bridge — บันทึกสำหรับ inpatient / handoff (rule)</div>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-800/95 dark:text-slate-200/95">
                      dehydration · nutrition · UO · perfusion · MS · severity · admit labs/imaging — เติมถ้ายังไม่ได้จด
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <InlineAssistBlock title="เหตุผลที่เปิด bridge" items={analysis.likelyAdmitBridge.activationRationale} />
                      <InlineAssistBlock
                        title="รายการที่ควรมีในบันทึก (ถ้ายังไม่ครบ)"
                        items={analysis.likelyAdmitBridge.suggestedMissingAssessments}
                      />
                      <InlineAssistBlock title="สไตล์โน้ต" items={analysis.likelyAdmitBridge.outputStyleHints} />
                    </div>
                    <PhysicianReferenceBlock sourceIds={getReferenceIdsForFramework("likelyAdmit")} />
                  </div>
                ) : null}

                  </div>
                </details>

                <details className="group mt-2 rounded-xl border border-slate-200 bg-slate-50/40 dark:border-slate-700 dark:bg-slate-900/40">
                  <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 [&::-webkit-details-marker]:hidden">
                    Audit / contradictions / disposition
                    <span className="ml-1 text-slate-400 group-open:hidden">▸</span>
                    <span className="ml-1 hidden text-slate-400 group-open:inline">▾</span>
                  </summary>
                  <div className="space-y-4 border-t border-slate-200 px-3 pb-3 pt-2 dark:border-slate-700">
                <div className="rounded-lg border border-zinc-200/90 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-100">
                  <div className="font-semibold">Audit-friendly language (rule)</div>
                  <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[11px] leading-relaxed">
                    {[
                      "consider if… / พิจารณาได้ถ้า…",
                      "if exam shows… then diagnosis becomes more supportable",
                      "avoid fabricated certainty — แยก fact vs inference",
                    ].map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>

                {analysis?.clinicalContradictions?.length ? (
                  <div className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100">
                    <div className="font-semibold">Contradiction checks (rule)</div>
                    <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[11px] leading-relaxed">
                      {analysis.clinicalContradictions.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {analysis?.dispositionSuggestions?.length ? (
                  <div className="rounded-lg border border-teal-200/80 bg-teal-50/70 px-3 py-2 text-xs text-teal-950 dark:border-teal-900/50 dark:bg-teal-950/35 dark:text-teal-100">
                    <div className="font-semibold">Disposition suggestions (mode + severity)</div>
                    <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[11px] leading-relaxed">
                      {analysis.dispositionSuggestions.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                  </div>
                </details>

                {analysis?.problemPackResolution.activeMatches.length ? (
                  <div className="rounded-lg border border-indigo-200/80 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-950 dark:border-indigo-900/50 dark:bg-indigo-950/35 dark:text-indigo-100">
                    <div className="font-semibold">
                      Symptom packs — {analysis.problemPackResolution.mode} (rule, roadmap order)
                    </div>
                    <div className="mt-2 space-y-2">
                      {analysis.problemPackResolution.activeMatches.map((m, idx) => (
                        <div
                          key={m.packId}
                          className="rounded-md border border-indigo-200/60 bg-white/50 px-2 py-1.5 dark:border-indigo-800/60 dark:bg-slate-900/30"
                        >
                          <div
                            className="text-[10px] font-medium text-indigo-900 dark:text-indigo-100"
                            title={m.def.titleEn}
                          >
                            #{m.order} {m.def.titleTh}
                          </div>
                          <details className="mt-1">
                            <summary className="cursor-pointer text-[10px] font-medium text-indigo-800 dark:text-indigo-200">
                              References (collapsed)
                            </summary>
                            <div className="mt-1">
                              <PhysicianReferenceBlock
                                sourceIds={getReferenceIdsForPack(m.packId)}
                                contextLabel="Clinical pack"
                              />
                            </div>
                          </details>
                          <ClinicalScoreCardsForPack
                            scoreIds={scorePackAssignment.rows[idx]?.scoreIds ?? []}
                            scoreInputs={scoreInputs}
                            scoreMarkedNa={scoreMarkedNa}
                            activePackIds={scorePackAssignment.activeSet}
                            setScoreField={setScoreField}
                            setScoreMarkedNa={updateScoreMarkedNa}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {layer1 ? (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Layer 1 — บันทึกขั้นต่ำ (OPD)
                    </h3>
                    {LAYER1_SECTIONS.map(({ key, label }) => (
                      <div key={key} className="block">
                        <label className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                          {label}
                          {chartFieldProvenance.layer1 === "ai" && !chartAccepted.layer1 ? (
                            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
                              AI draft
                            </span>
                          ) : null}
                          {chartFieldProvenance.layer1 === "user" ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                              Edited
                            </span>
                          ) : null}
                          {chartAccepted.layer1 ? (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                              Accepted
                            </span>
                          ) : null}
                        </label>
                        <textarea
                          className="mt-1 min-h-[72px] w-full resize-y rounded-lg border border-slate-200 bg-white p-2.5 text-sm leading-relaxed text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                          value={layer1[key]}
                          onChange={(e) => updateLayer1Field(key, e.target.value)}
                          spellCheck={false}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}

                {problemBlocks.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Layer 2 — ถามต่อ / ตรวจต่อ (ตามประเด็น)
                    </h3>
                    {problemBlocks.map((b, i) => {
                      const aiP =
                        analysis?.aiProblems?.find((p) => p.clinicalProblemId === b.id) ??
                        (analysis?.aiProblems?.length === problemBlocks.length ? analysis.aiProblems![i] : undefined);
                      const hasEvidence =
                        aiP &&
                        (aiP.confidenceLevel ||
                          (aiP.uncertaintyReasons && aiP.uncertaintyReasons.length > 0) ||
                          (aiP.evidenceSupport && aiP.evidenceSupport.length > 0));
                      return (
                      <div
                        key={b.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/30 p-3 dark:border-slate-700 dark:bg-slate-900/30"
                      >
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {b.system}{" "}
                          <span className="font-normal text-slate-500 dark:text-slate-400">— {b.summaryLine}</span>
                        </div>
                        {hasEvidence && aiP ? (
                          <div className="mt-2 rounded-lg border border-violet-200/80 bg-violet-50/50 px-3 py-2 text-[11px] text-violet-950 dark:border-violet-900/40 dark:bg-violet-950/25 dark:text-violet-100">
                            <div className="font-semibold text-violet-900 dark:text-violet-200">
                              Confidence / evidence (AI)
                            </div>
                            {aiP.confidenceLevel ? (
                              <div className="mt-1">
                                <span className="font-medium">Confidence:</span> {aiP.confidenceLevel}
                              </div>
                            ) : null}
                            {aiP.uncertaintyReasons?.length ? (
                              <>
                                <div className="mt-1 font-medium text-violet-900 dark:text-violet-200">Uncertainty</div>
                                <ul className="mt-0.5 list-inside list-disc space-y-0.5">
                                  {aiP.uncertaintyReasons.map((u, ui) => (
                                    <li key={`u-${b.id}-${ui}`}>{u}</li>
                                  ))}
                                </ul>
                              </>
                            ) : null}
                            {aiP.evidenceSupport?.length ? (
                              <>
                                <div className="mt-1 font-medium text-violet-900 dark:text-violet-200">Evidence</div>
                                <ul className="mt-0.5 space-y-1">
                                {aiP.evidenceSupport.map((ev, ei) => (
                                  <li key={`e-${b.id}-${ei}`} className="leading-snug">
                                    <span className="font-medium text-violet-900 dark:text-violet-200">
                                      [{ev.type}] {ev.relation}
                                    </span>
                                    {ev.refId ? (
                                      <span className="ml-1 text-[10px] text-violet-700 dark:text-violet-300">
                                        ref {ev.refId}
                                      </span>
                                    ) : null}
                                    : {ev.text}
                                  </li>
                                ))}
                              </ul>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          <div>
                            <InlineAssistBlock title="ถามต่อ" items={b.historyAskNext} />
                          </div>
                          <div>
                            <InlineAssistBlock title="ตรวจต่อ" items={b.examFocusNext} />
                          </div>
                        </div>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          <div>
                            <InlineAssistBlock
                              title={b.system === "skin" ? "ข้อเท็จจริงที่จับได้แล้ว" : "Pertinent +"}
                              items={b.pertinentPositives}
                            />
                          </div>
                          <div>
                            <InlineAssistBlock
                              title="Pertinent negatives (ให้บันทึกถ้าตรวจแล้วไม่มี)"
                              items={b.pertinentNegativesToDocument}
                            />
                          </div>
                        </div>
                        {b.assessment || b.diagnosis || b.differential || b.plan ? (
                          <div className="mt-3 space-y-2 rounded-lg border border-emerald-200/50 bg-emerald-50/20 px-3 py-2 text-sm dark:border-emerald-900/30 dark:bg-emerald-950/15">
                            {b.assessment ? (
                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300/90">
                                  Assessment
                                </div>
                                <p className="mt-0.5 text-slate-800 dark:text-slate-200">{b.assessment}</p>
                              </div>
                            ) : null}
                            {b.diagnosis ? (
                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300/90">
                                  Diagnosis
                                </div>
                                <p className="mt-0.5 text-slate-800 dark:text-slate-200">{b.diagnosis}</p>
                              </div>
                            ) : null}
                            {b.differential ? (
                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300/90">
                                  Differential
                                </div>
                                <pre className="mt-0.5 whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-200">
                                  {b.differential}
                                </pre>
                              </div>
                            ) : null}
                            {b.plan ? (
                              <div>
                                <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300/90">
                                  Plan
                                </div>
                                <pre className="mt-0.5 whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-200">
                                  {b.plan}
                                </pre>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                    })}
                  </div>
                ) : null}

                <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Chart fields — CC / PI / PMH / PE
                  </h3>
                </div>

                {NOTE_SECONDARY_KEYS.map((key) => {
                  const label = NOTE_SECTIONS.find((s) => s.key === key)?.label ?? key;
                  const hints = bundle ? inlineHintsForSection(key, bundle) : null;
                  const prov = chartFieldProvenance[key];
                  const acc = chartAccepted[key];
                  return (
                    <div key={key} className="block">
                      <label className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                        {label}
                        {prov === "ai" && !acc ? (
                          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
                            AI draft
                          </span>
                        ) : null}
                        {prov === "user" ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                            Edited
                          </span>
                        ) : null}
                        {acc ? (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                            Accepted
                          </span>
                        ) : null}
                      </label>
                      <textarea
                        className="mt-1 min-h-[72px] w-full resize-y rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 text-sm leading-relaxed text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                        value={note[key]}
                        onChange={(e) => updateNoteField(key, e.target.value)}
                        spellCheck={false}
                      />
                      {hints ? <InlineAssistBlock title={hints.title} items={hints.items} /> : null}
                    </div>
                  );
                })}

                {bundle && analysis ? (
                  <details className="rounded-xl border border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/50">
                    <summary className="cursor-pointer select-none px-3 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                      รายละเอียดเพิ่มเติมจากผู้ช่วย (ข้อเท็จจริงครบ, แหล่งอ้างอิง)
                    </summary>
                    <div className="space-y-4 border-t border-slate-200 px-3 pb-3 pt-2 dark:border-slate-700">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          ข้อเท็จจริงที่จับได้
                        </p>
                        <BulletList items={bundle.detectedFacts} empty="—" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          ช่องว่างทั้งหมด (รวม)
                        </p>
                        <BulletList items={bundle.missingInfo} empty="—" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          สรุปช่วยประเมิน
                        </p>
                        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                          {bundle.provisionalAssessment}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          ขั้นต่อ / ถามเพิ่ม
                        </p>
                        <BulletList items={bundle.nextStepSuggestions} empty="—" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          แนวคิดวินิจฉัย (เต็ม)
                        </p>
                        <BulletList items={bundle.diagnosisIdeas} empty="—" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          การรักษา / ยา
                        </p>
                        <BulletList items={bundle.treatmentHints} empty="—" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          คำแนะนำผู้ป่วย (เต็ม)
                        </p>
                        <BulletList items={bundle.patientAdviceHints} empty="—" />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          แหล่งอ้างอิง
                        </p>
                        {bundle.guidelineSourceIds.length ? (
                          <ReferenceDrawer
                            title="เอกสารอ้างอิงที่เกี่ยวข้องกับเคสนี้"
                            sourceIds={bundle.guidelineSourceIds}
                          />
                        ) : (
                          <p className="text-sm text-slate-500">—</p>
                        )}
                      </div>
                    </div>
                  </details>
                ) : null}
              </div>
            )}
          </section>
        </div>

        <footer className="mt-6 border-t border-slate-200 pt-4 text-center text-[11px] text-slate-400 dark:border-slate-800">
          ข้อมูลเป็นตัวช่วยจัดโครงสร้าง ไม่ใช่คำสั่งทางการแพทย์ — ตรวจสอบกับผู้ป่วยและหลักฐานจริงเสมอ
        </footer>
      </div>
    </main>
  );
}
