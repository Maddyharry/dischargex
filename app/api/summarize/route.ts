import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getDailyApproxLimit,
  getCreditCycleBounds,
  getCreditsRequiredForCase,
  getPeriodBounds,
  getPlanDefinition,
  normalizePlanId,
  planRank,
} from "@/lib/billing-rules";
import { markReferralFirstUsage } from "@/lib/referral";
import {
  evaluateF2CcExclusions,
  summarizeRulesForPrompt,
} from "@/lib/discharge-engine/rules";
import { REFERENCE_SET_NAME } from "@/lib/reference-info";
import { detectLinkageInText } from "@/lib/discharge-engine/linkage";
import {
  mergeEngineAuditWarnings,
  validatePrincipalAndEngine,
} from "@/lib/discharge-engine/validators";
import {
  alignPrincipalEngineToPrincipalBlock,
  mergePartialEngine,
  synthesizeEngineFromBlocks,
  type NormalizedBlock as EngineNormalizedBlock,
} from "@/lib/discharge-engine/normalize-engine";
import type {
  CaseGraph,
  ConceptNode,
  DischargeEnginePayload,
  ExtractionLayer,
  LinkageEdge,
} from "@/lib/discharge-engine/types";
import { trackTelemetry } from "@/lib/telemetry";
import {
  estimateTokenBillingThb,
  getPlanTokenBudgetThb,
  readUsageSummary,
  type TokenUsageSummary,
  shouldEnforceLegacyCreditLimit,
} from "@/lib/token-billing";
import { deidentify } from "@/lib/deidentify";
import { getMergedKnowledge, queuePendingKnowledgeEntry } from "@/lib/knowledge-store";
import { retrieveExternalEvidence } from "@/lib/reference-retriever";

export const runtime = "nodejs";

function formatBangkokDateTime(date: Date) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function compactKnowledgeForSummaryPrompt(
  clinical: string,
  items: Awaited<ReturnType<typeof getMergedKnowledge>>
) {
  const q = clinical.toLowerCase();
  const scored = items
    .map((d) => {
      const tokens = [d.name, ...d.aliases, ...d.icd10].map((x) => x.toLowerCase());
      const score = tokens.reduce((acc, token) => (q.includes(token) ? acc + 1 : acc), 0);
      return { d, score };
    })
    .sort((a, b) => b.score - a.score);
  const ranked = scored.slice(0, 12).map((x) => x.d);
  return {
    hasStrongMatch: (scored[0]?.score || 0) > 0,
    items: ranked.map((d) => ({
    name: d.name,
    diagnosisToWrite: d.diagnosisToWrite.slice(0, 3),
    investigations: d.investigations.slice(0, 3),
    icd10: d.icd10.slice(0, 6),
    refs: d.refs,
    })),
  };
}

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const BASIC_PLAN_ONLY_KEYS = new Set([
  "principal_dx",
  "comorbidity",
  "complication",
  "other_diag",
  "external_cause",
  "icd9",
]);

const BASIC_PLAN_LOCKED_KEYS = new Set([
  "admit_date",
  "discharge_date",
  "final_diag",
  "investigations",
  "treatment",
  "outcome",
  "follow_up",
  "home_med",
]);

const DEVICE_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type Block = {
  key: string;
  title: string;
  order: number;
};

type NormalizedBlock = {
  key: string;
  title: string;
  order: number;
  content: string;
  icd10: string;
};

type ReqBody = {
  mode?: "generate" | "recalc";
  template: { blocks: Block[] };
  currentBlocks?: NormalizedBlock[];
  /** lab/radiology in body are ignored — evidence comes from order_sheet paste only */
  inputs: { order_sheet?: string; lab?: string; radiology?: string; other?: string };
  imageInputs?: Array<{ name?: string; dataUrl: string }>;
  extraNote?: string;
  templateRules?: string;
  settings?: {
    autoDeidentify?: boolean;
    model?: string;
    fast?: boolean;
    strategy?: "strict_audit_safe" | "what_if_optimize";
    alternativeSearch?: boolean;
  };
};

type UploadedImageInput = { name?: string; dataUrl: string };

type PreprocessSummary = {
  originalChars: number;
  cleanedChars: number;
  removedChars: number;
  removedSummary: string[];
  cleanedPreview: string;
};

type GenerateModelOutput = {
  analysis?: {
    admission_reason?: string;
    active_diagnoses?: string[];
    chronic_comorbidities?: string[];
    likely_in_hospital_complications?: string[];
    likely_procedures?: string[];
    principal_candidates?: string[];
    best_principal_clinical?: string;
    best_principal_adjrw_safe?: string;
  };
  extraction?: Record<string, unknown>;
  case_graph?: Record<string, unknown>;
  concepts?: unknown[];
  linkage?: unknown[];
  classification?: Record<string, unknown>;
  engine?: Partial<DischargeEnginePayload>;
  blocks?: Array<{
    key?: string;
    title?: string;
    order?: number;
    content?: string;
    icd10?: string;
  }>;
  warnings?: string[];
  meta?: {
    adjrw_estimate?: number | string;
    upgrade?: {
      new_principal?: string;
      add_icd9?: string[];
      projected_adjrw?: number | string;
      increase?: number | string;
      audit_risk?: string;
      reason_th?: string;
    } | null;
  };
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizeIncomingBlocks(blocks: NormalizedBlock[] | undefined) {
  return Array.isArray(blocks)
    ? blocks.map((b) => ({
        key: String(b.key || ""),
        title: String(b.title || ""),
        order: Number(b.order || 0),
        content: String(b.content || ""),
        icd10: String(b.icd10 || ""),
      }))
    : [];
}

function stripTimeKeepDate(s: string) {
  const m = (s || "").match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  return m ? m[1] : (s || "").trim();
}

function parseThaiShortDate(d: string) {
  const m = d.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  let yy = parseInt(m[3], 10);
  if (yy < 100) yy = 2500 + yy;
  const greg = yy - 543;
  return new Date(Date.UTC(greg, mm - 1, dd));
}

function getAllDates(text: string) {
  const matches = [...(text || "").matchAll(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g)].map((m) => m[1]);
  return Array.from(new Set(matches));
}

function extractDates(text: string) {
  const admit =
    text.match(/-\s*Admit[\s\S]{0,220}?วันที่เริ่ม\s*:\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i)?.[1] ||
    text.match(/\bAdmit\b[\s\S]{0,140}?([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i)?.[1] ||
    text.match(/admit รพ[\s\S]{0,80}?([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i)?.[1] ||
    null;

  const dcKeywords =
    text.match(/(?:D\/C|DC|discharge|จำหน่าย)[\s\S]{0,150}?([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i)?.[1] ||
    null;

  const finalDispositionKeywords =
    text.match(/(?:refer|referred|dead|against advice|against medical advice)[\s\S]{0,150}?([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i)?.[1] ||
    null;

  const allDates = getAllDates(text)
    .map((d) => ({ raw: d, dt: parseThaiShortDate(d) }))
    .filter((x) => x.dt !== null) as Array<{ raw: string; dt: Date }>;

  allDates.sort((a, b) => a.dt.getTime() - b.dt.getTime());
  const latest = allDates.length ? allDates[allDates.length - 1].raw : null;

  return {
    admit,
    discharge: dcKeywords || finalDispositionKeywords || latest,
  };
}

function losDaysFromDDMMYY(admit: string | null, discharge: string | null) {
  if (!admit || !discharge) return null;

  const a = parseThaiShortDate(admit);
  const d = parseThaiShortDate(discharge);
  if (!a || !d) return null;

  const diff = Math.round((d.getTime() - a.getTime()) / 86400000);
  return Math.max(1, diff);
}

function splitIcd9LinesKeepProceduresOnly(text: string) {
  const lines = (text || "")
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  const keep: string[] = [];
  const removed: string[] = [];
  const codeRe = /^\d{2,3}(\.\d{1,2})?\b/;

  for (const line of lines) {
    if (codeRe.test(line)) keep.push(line);
    else removed.push(line);
  }
  return { keep, removed };
}

function stripCodeFences(s: string) {
  return (s || "").replace(/```json|```/g, "").trim();
}

function tryParseJson<T>(s: string): T | null {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function extractJsonObject<T>(text: string) {
  const s = stripCodeFences(text);
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end < 0 || end <= start) return null;
  return tryParseJson<T>(s.slice(start, end + 1));
}

function sanitizeImageInputs(raw: unknown): UploadedImageInput[] {
  if (!Array.isArray(raw)) return [];
  const out: UploadedImageInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const dataUrl = String(o.dataUrl || "").trim();
    if (!/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(dataUrl)) continue;
    if (dataUrl.length > 7_000_000) continue;
    const name = String(o.name || "").trim();
    out.push({ dataUrl, ...(name ? { name: name.slice(0, 120) } : {}) });
    if (out.length >= 4) break;
  }
  return out;
}

async function extractClinicalTextFromImages(openai: OpenAI, images: UploadedImageInput[]) {
  if (!images.length) return "";
  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    max_output_tokens: 1400,
    input: [
      {
        role: "system",
        content:
          "Extract visible clinical text from uploaded medical images/screenshots. Output plain text only. Preserve line breaks for key sections like diagnosis, orders, labs, medications, dates. If unreadable, say briefly which parts are unclear.",
      },
      {
        role: "user",
        content: [
          {
            type: "input_text" as const,
            text: "อ่านข้อความทางการแพทย์จากรูปให้มากที่สุด (ไทย/อังกฤษ) แล้วสรุปเป็น plain text สำหรับนำไปทำสรุปชาร์จ",
          },
          ...images.map((img) => ({
            type: "input_image" as const,
            image_url: img.dataUrl,
            detail: "auto" as const,
          })),
        ],
      },
    ],
  });
  return ("output_text" in response ? String(response.output_text || "") : "").trim();
}

async function callModelJSON<T>(
  openai: OpenAI,
  model: string,
  system: string,
  user: string,
  options?: { max_output_tokens?: number }
) {
  const usageTotal: TokenUsageSummary = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const addUsage = (next: TokenUsageSummary) => {
    usageTotal.inputTokens += next.inputTokens;
    usageTotal.outputTokens += next.outputTokens;
    usageTotal.totalTokens += next.totalTokens;
  };
  const createParams = {
    model,
    ...(options?.max_output_tokens != null && { max_output_tokens: options.max_output_tokens }),
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };

  const resp = await openai.responses.create(
    createParams as unknown as Parameters<typeof openai.responses.create>[0]
  );
  const respUsage = "usage" in resp ? resp.usage : undefined;
  addUsage(readUsageSummary(respUsage));

  const text = "output_text" in resp ? resp.output_text || "" : "";
  const obj = extractJsonObject<T>(text);
  if (obj) return { data: obj, usage: usageTotal };

  const repair = await openai.responses.create({
    ...createParams,
    input: [
      { role: "system", content: system },
      {
        role: "user",
        content:
          "Rewrite your previous answer as STRICT JSON only. No markdown.\n\nPREVIOUS:\n" +
          text,
      },
    ],
  });
  const repairUsage = "usage" in repair ? repair.usage : undefined;
  addUsage(readUsageSummary(repairUsage));

  const repairText = "output_text" in repair ? repair.output_text || "" : "";
  const obj2 = extractJsonObject<T>(repairText);
  if (!obj2) throw new Error("Model returned non-JSON");
  return { data: obj2, usage: usageTotal };
}

function normalizeIcd10List(s: string) {
  return (s || "")
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
}

function mergeUniqueWarnings(base: string[], extras: string[]) {
  for (const msg of extras) {
    if (!msg) continue;
    if (!base.includes(msg)) base.push(msg);
  }
}

function uniqueWarningsList(messages: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of messages) {
    const msg = String(raw || "").trim();
    if (!msg || seen.has(msg)) continue;
    seen.add(msg);
    out.push(msg);
  }
  return out;
}

function overlapsIcd10(a: string, b: string) {
  const A = new Set(normalizeIcd10List(a));
  const B = new Set(normalizeIcd10List(b));
  for (const x of A) if (B.has(x)) return true;
  return false;
}

function looksPreExisting(text: string) {
  const t = (text || "").toLowerCase();
  const phrases = [
    "came with",
    "history of",
    "known case of",
    "underlying",
    "on admission",
    "initially",
  ];
  return phrases.some((k) => t.includes(k));
}

function containsMajorAcuteDiagnosis(text: string) {
  const t = (text || "").toLowerCase();
  const keys = [
    "septic shock",
    "shock",
    "acute respiratory failure",
    "respiratory failure",
    "acute kidney injury",
    "aki",
    "dic",
    "acute heart failure",
    "sepsis",
    "hypokalemia",
    "hypoglycemia",
    "dka",
    "gastrointestinal bleeding",
    "gi bleed",
    "stroke",
    "pulmonary embolism",
    "rhabdomyolysis",
    "pneumonia",
  ];
  return keys.some((k) => t.includes(k));
}

function hasTreatmentSupportForDiagnosis(text: string) {
  const t = (text || "").toLowerCase();
  const keys = [
    "hypokalemia",
    "hypoglycemia",
    "septic shock",
    "acute respiratory failure",
    "acute kidney injury",
    "sepsis",
    "shock",
    "pneumonia",
  ];
  return keys.some((k) => t.includes(k));
}

function principalIsSepsisFamily(text: string) {
  const t = (text || "").toLowerCase();
  return t.includes("sepsis") || t.includes("septic shock");
}

function containsLikelyInfectionSource(text: string) {
  const t = (text || "").toLowerCase();
  const sources = [
    "pneumonia",
    "pyelonephritis",
    "uti",
    "urinary tract infection",
    "cholangitis",
    "cellulitis",
    "intra-abdominal infection",
    "peritonitis",
    "abscess",
    "gastroenteritis",
  ];
  return sources.some((k) => t.includes(k));
}

function hasAcuteDiagnosis(text: string) {
  const t = (text || "").toLowerCase();
  const keys = [
    "acute ",
    "shock",
    "sepsis",
    "respiratory failure",
    "kidney injury",
    "hypokalemia",
    "hypoglycemia",
    "pneumonia",
  ];
  return keys.some((k) => t.includes(k));
}

function toNum(x: unknown): number | null {
  const n = typeof x === "number" ? x : Number(String(x ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function stripNumberedPrefix(line: string) {
  return line.replace(/^\s*\d+[\.\)]\s*/, "").trim();
}

function splitCommaItems(text: string) {
  return (text || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function oneLineCommaSeparated(text: string) {
  if (!text) return "";
  return text
    .split(/\r?\n/)
    .map((x) => stripNumberedPrefix(x))
    .filter(Boolean)
    .join(", ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/,\s*,/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^,\s*/, "")
    .replace(/,\s*$/, "");
}

function normalizeOutcome(text: string) {
  const raw = (text || "").trim();
  const lower = raw.toLowerCase();

  if (!raw) return "";

  const build = (prefix: string) => {
    let detail = raw;
    const re = new RegExp(`^${prefix}\\s*,?\\s*`, "i");
    detail = detail.replace(re, "").trim();
    detail = detail.replace(re, "").trim();
    return detail ? `${prefix}, ${detail}` : prefix;
  };

  if (lower.startsWith("refer") || lower.includes("referred")) return build("refer");
  if (lower.startsWith("improved")) return build("improved");
  if (lower.startsWith("dead") || lower.includes("expired") || lower.includes("death")) return build("dead");
  if (lower.includes("against advice") || lower.includes("against medical advice") || lower === "ama") {
    return build("against advice");
  }

  return raw;
}

function mergeCommaLists(a: string, b: string) {
  const items = [...normalizeIcd10List(a), ...normalizeIcd10List(b)];
  return Array.from(new Set(items)).join(", ");
}

function mergeDiagnosisText(a: string, b: string) {
  const items = [...splitCommaItems(a), ...splitCommaItems(b)];
  return Array.from(new Set(items)).join(", ");
}

function normalizeLegacyDiagnosisTerm(text: string) {
  return (text || "")
    .replace(/\bacute gastroenteritis\s*\(age\)\b/gi, "Acute infectious diarrhea")
    .replace(/\bacute gastroenteritis\b/gi, "Acute infectious diarrhea")
    .replace(/\bage\b/gi, "acute infectious diarrhea");
}

function blockMap(blocks: NormalizedBlock[]) {
  return new Map(blocks.map((b) => [b.key, b] as const));
}

function preferModelOrExisting(
  modelValue: unknown,
  existingValue: string,
  mode: "generate" | "recalc"
) {
  const next = String(modelValue ?? "").trim();

  if (mode === "recalc") {
    return next || existingValue || "";
  }

  return next;
}

function inferSexFromTitle(text: string) {
  if (/ชื่อ\s*:\s*นาย/.test(text)) return "Male";
  if (/ชื่อ\s*:\s*(นาง|น\.ส\.|นางสาว)/.test(text)) return "Female";
  return "";
}

function preprocessClinicalText(raw: string): { cleaned: string; summary: PreprocessSummary } {
  const original = raw || "";
  const lines = original.split(/\r?\n/);

  let removedBlankLines = 0;
  let removedUiLines = 0;
  let removedStaffLines = 0;
  let removedPatientHeader = 0;
  let removedDuplicateLines = 0;
  let normalizedWhitespace = 0;
  let removedAckTail = 0;
  let strippedStaffNameAfterDatetime = 0;

  const out: string[] = [];
  let previousNonEmpty = "";

  let keptSex = "";
  let keptAge = "";
  let keptAllergy = "";

  for (const rawLine of lines) {
    let s = (rawLine ?? "")
      .replace(/\t/g, " ")
      .replace(/\u00A0/g, " ");

    const beforeTrim = s;
    s = s.trim();
    if (beforeTrim !== s) normalizedWhitespace++;

    if (!s) {
      removedBlankLines++;
      continue;
    }

    if (
      /(AN\s*:|HN\s*:|CID\s*:|ชื่อ\s*:|อายุ\s*:|แพ้ยา\s*:|Drug allergy\s*:)/i.test(s)
    ) {
      if (!keptSex) keptSex = inferSexFromTitle(s);

      const ageMatch =
        s.match(/อายุ\s*:\s*([^C]+?)(?:CID|แพ้ยา|$)/i)?.[1]?.trim() ||
        s.match(/Age\s*:\s*(.+?)(?:CID|Drug allergy|$)/i)?.[1]?.trim() ||
        "";
      if (ageMatch && !keptAge) keptAge = ageMatch;

      const allergyMatch =
        s.match(/แพ้ยา\s*:\s*(.+)$/i)?.[1]?.trim() ||
        s.match(/Drug allergy\s*:\s*(.+)$/i)?.[1]?.trim() ||
        "";
      if (
        allergyMatch &&
        !/ไม่มีประวัติการแพ้|none|no known drug allergy|nkda/i.test(allergyMatch)
      ) {
        keptAllergy = allergyMatch;
      }

      removedPatientHeader++;
      continue;
    }

    const beforeUi = s;
    s = s
      .replace(/\[Add Order\]|\[Template Order\]|\[Med\. Reconciliation\]|\[SOAP\]|\[Certificate\]/gi, "")
      .replace(/\[ Edit \]|\[ReOrder\]/gi, "")
      .trim();

    if (s !== beforeUi) normalizedWhitespace++;

    if (!s) {
      removedUiLines++;
      continue;
    }

    if (
      /^DOCTOR'S ORDER SHEET$/i.test(s) ||
      /^Date Time$/i.test(s) ||
      /^ORDER FOR ONE DAY$/i.test(s) ||
      /^CONTINUOUS ORDER$/i.test(s)
    ) {
      removedUiLines++;
      continue;
    }

    const beforeTailStrip = s;
    s = s
      .replace(/ผู้รับคำสั่ง\s*:[^\n\r]*$/i, "")
      .replace(/ผู้สั่ง\s*:[^\n\r]*$/i, "")
      .replace(/รับทราบเมื่อ[^\n\r]*$/i, "")
      .replace(/^รคส\.[^\n\r]*$/i, "")
      .trim();

    if (s !== beforeTailStrip) {
      removedAckTail++;
    }

    if (!s) {
      removedStaffLines++;
      continue;
    }

    if (
      /^ผู้รับคำสั่ง\s*:|^ผู้สั่ง\s*:|^รับทราบเมื่อ|^รคส\./i.test(s)
    ) {
      removedStaffLines++;
      continue;
    }

    if (
      /^\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}\s+(นาย|นาง|น\.ส\.|นางสาว|นพ\.|พญ\.|Mr\.|Mrs\.|Miss)/i.test(
        s
      )
    ) {
      s = s.replace(
        /^(\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}).*$/,
        "$1"
      );
      strippedStaffNameAfterDatetime++;
    }

    if (/^(นาย|นาง|น\.ส\.|นางสาว|นพ\.|พญ\.)\s*\S+(\s+\S+){0,3}$/.test(s)) {
      removedStaffLines++;
      continue;
    }

    const beforeSpaceNormalize = s;
    s = s.replace(/[ ]{2,}/g, " ").trim();
    if (beforeSpaceNormalize !== s) normalizedWhitespace++;

    if (!s) continue;

    if (previousNonEmpty && previousNonEmpty === s) {
      removedDuplicateLines++;
      continue;
    }

    out.push(s);
    previousNonEmpty = s;
  }

  const prefix: string[] = [];
  if (keptSex) prefix.push(`Sex: ${keptSex}`);
  if (keptAge) prefix.push(`Age: ${keptAge}`);
  if (keptAllergy) prefix.push(`Drug allergy: ${keptAllergy}`);

  const cleanedBody = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const cleaned = [...prefix, cleanedBody].filter(Boolean).join("\n").trim();

  const removedSummary: string[] = [];

  if (removedPatientHeader > 0) {
    removedSummary.push(`ลบ patient identifier / header ${removedPatientHeader} block แต่เก็บ sex / age / drug allergy ที่สำคัญไว้`);
  }
  if (removedStaffLines > 0) {
    removedSummary.push(`ลบบรรทัดชื่อพยาบาล / ผู้รับคำสั่ง / ผู้สั่ง ${removedStaffLines} บรรทัด`);
  }
  if (removedAckTail > 0) {
    removedSummary.push(`ลบข้อความท้ายบรรทัดประเภทผู้รับคำสั่ง / รับทราบ ${removedAckTail} ครั้ง`);
  }
  if (removedUiLines > 0) {
    removedSummary.push(`ลบข้อความ UI / table header ${removedUiLines} บรรทัด`);
  }
  if (removedDuplicateLines > 0) {
    removedSummary.push(`ลบบรรทัดซ้ำ ${removedDuplicateLines} บรรทัด`);
  }
  if (removedBlankLines > 0) {
    removedSummary.push(`ลบบรรทัดว่าง ${removedBlankLines} บรรทัด`);
  }
  if (strippedStaffNameAfterDatetime > 0) {
    removedSummary.push(`ตัดชื่อเจ้าหน้าที่หลังวันเวลา ${strippedStaffNameAfterDatetime} บรรทัด`);
  }
  if (normalizedWhitespace > 0) {
    removedSummary.push(`ปรับ spacing / enter / whitespace ${normalizedWhitespace} จุด`);
  }

  return {
    cleaned,
    summary: {
      originalChars: original.length,
      cleanedChars: cleaned.length,
      removedChars: Math.max(0, original.length - cleaned.length),
      removedSummary,
      cleanedPreview: cleaned.slice(0, 2500),
    },
  };
}

function postProcessBlocks(blocks: NormalizedBlock[], warnings: string[]) {
  const m = blockMap(blocks);

  const principal = m.get("principal_dx");
  const finalDiag = m.get("final_diag");
  const comorbidity = m.get("comorbidity");
  const complication = m.get("complication");
  const otherDiag = m.get("other_diag");
  const investigations = m.get("investigations");
  const treatment = m.get("treatment");
  const homeMed = m.get("home_med");
  const followUp = m.get("follow_up");
  const outcome = m.get("outcome");
  const icd9Block = m.get("icd9");
  const externalCause = m.get("external_cause");

  for (const b of blocks) {
    if (
      b.key === "principal_dx" ||
      b.key === "comorbidity" ||
      b.key === "complication" ||
      b.key === "other_diag" ||
      b.key === "final_diag"
    ) {
      const before = b.content;
      b.content = normalizeLegacyDiagnosisTerm(b.content);
      if (before !== b.content && !warnings.includes("Legacy term adjusted: replaced AGE/acute gastroenteritis with acute infectious diarrhea. Verify wording against chart.")) {
        warnings.push(
          "Legacy term adjusted: replaced AGE/acute gastroenteritis with acute infectious diarrhea. Verify wording against chart."
        );
      }
    }
  }

  if (principal?.content) principal.content = oneLineCommaSeparated(principal.content);
  if (finalDiag?.content) finalDiag.content = oneLineCommaSeparated(finalDiag.content);
  if (comorbidity?.content) comorbidity.content = oneLineCommaSeparated(comorbidity.content);
  if (complication?.content) complication.content = oneLineCommaSeparated(complication.content);
  if (otherDiag?.content) otherDiag.content = oneLineCommaSeparated(otherDiag.content);
  if (investigations?.content) investigations.content = oneLineCommaSeparated(investigations.content);
  if (treatment?.content) treatment.content = oneLineCommaSeparated(treatment.content);
  if (homeMed?.content) homeMed.content = oneLineCommaSeparated(homeMed.content);

  if (followUp?.content) {
    const f = oneLineCommaSeparated(followUp.content);
    followUp.content = /not documented|unknown|none|no follow/i.test(f) ? "" : f;
  }

  if (outcome?.content) {
    outcome.content = normalizeOutcome(outcome.content);
  }

  if (icd9Block?.content) {
    const { keep, removed } = splitIcd9LinesKeepProceduresOnly(icd9Block.content);
    icd9Block.content = keep.join("\n");
    if (removed.length) warnings.push("ICD-9 had non-procedure lines; removed. Verify procedure list from chart.");
  }

  if (complication?.content) {
    const compText = (complication.content || "").trim();
    const compIcd10 = (complication.icd10 || "").trim();
    const priIcd10 = (principal?.icd10 || "").trim();
    const comIcd10 = (comorbidity?.icd10 || "").trim();

    const badByPhrase = !!compText && looksPreExisting(compText) && !hasAcuteDiagnosis(compText);
    const badByOverlap =
      (compIcd10 && priIcd10 && overlapsIcd10(compIcd10, priIcd10)) ||
      (compIcd10 && comIcd10 && overlapsIcd10(compIcd10, comIcd10));

    if (badByPhrase || badByOverlap) {
      complication.content = "";
      complication.icd10 = "";
      warnings.push("Complication removed: must be a NEW in-hospital condition after treatment started.");
    }
  }

  if (otherDiag?.content) {
    const moveByAcute = containsMajorAcuteDiagnosis(otherDiag.content);
    const moveByTreatment = hasTreatmentSupportForDiagnosis(otherDiag.content) && !!treatment?.content;
    const moveBySepsisSource =
      principalIsSepsisFamily(principal?.content || "") && containsLikelyInfectionSource(otherDiag.content);

    if ((moveByAcute || moveByTreatment || moveBySepsisSource) && comorbidity) {
      comorbidity.content = mergeDiagnosisText(comorbidity.content, otherDiag.content);
      comorbidity.icd10 = mergeCommaLists(comorbidity.icd10, otherDiag.icd10);
      otherDiag.content = "";
      otherDiag.icd10 = "";
      warnings.push("Diagnoses were moved from Other Diagnosis to Comorbidity because they appeared active or treated in this admission.");
    }
  }

  const treatmentText = (treatment?.content || "").toLowerCase();
  const hasTransfusion =
    treatmentText.includes("prc") ||
    treatmentText.includes("blood transfusion") ||
    treatmentText.includes("transfusion") ||
    treatmentText.includes("ffp") ||
    treatmentText.includes("platelet");

  const allDiagText = [
    principal?.content || "",
    finalDiag?.content || "",
    comorbidity?.content || "",
    complication?.content || "",
    otherDiag?.content || "",
  ]
    .join(" ")
    .toLowerCase();

  if (hasTransfusion && !allDiagText.includes("anemia") && comorbidity) {
    comorbidity.content = mergeDiagnosisText(comorbidity.content, "Acute posthemorrhagic anemia");
    comorbidity.icd10 = mergeCommaLists(comorbidity.icd10, "D62");
    warnings.push("Anemia was added to Comorbidity because transfusion was documented and anemia should not be omitted.");
  }

  if (finalDiag && !finalDiag.content.trim()) {
    finalDiag.content = [
      principal?.content || "",
      comorbidity?.content || "",
      complication?.content || "",
      otherDiag?.content || "",
      externalCause?.content || "",
    ]
      .filter(Boolean)
      .join(", ")
      .replace(/\s*,\s*/g, ", ")
      .replace(/,\s*,/g, ", ")
      .trim()
      .replace(/^,\s*/, "")
      .replace(/,\s*$/, "");
  }

  return blocks;
}

function computeDiagnosisConfidence(blocks: NormalizedBlock[], warnings: string[]) {
  const m = blockMap(blocks);
  let score = 0;

  if (m.get("principal_dx")?.content) score += 3;
  if (m.get("final_diag")?.content) score += 2;
  if (m.get("outcome")?.content) score += 1;
  if (m.get("icd9")?.content) score += 1;
  if (m.get("comorbidity")?.content || m.get("complication")?.content || m.get("other_diag")?.content) score += 2;
  if (warnings.some((w) => /removed|missing|unknown|not documented/i.test(w))) score -= 2;

  if (score >= 7) return "High";
  if (score >= 4) return "Medium";
  return "Low";
}

function mergeModelBlocksOntoBase(
  base: NormalizedBlock[],
  modelBlocks:
    | Array<{
        key?: string;
        title?: string;
        order?: number;
        content?: string;
        icd10?: string;
      }>
    | undefined,
  mode: "generate" | "recalc"
) {
  const mapB = new Map<string, { content: string; icd10: string }>();

  for (const b of modelBlocks || []) {
    if (b?.key) {
      mapB.set(String(b.key), {
        content: String(b.content ?? ""),
        icd10: String(b.icd10 ?? ""),
      });
    }
  }

  return base.map((b) => ({
    key: b.key,
    title: b.title,
    order: b.order,
    content: preferModelOrExisting(mapB.get(b.key)?.content, b.content, mode),
    icd10: preferModelOrExisting(mapB.get(b.key)?.icd10, b.icd10, mode),
  }));
}

async function runRecalcPass(params: {
  openai: OpenAI;
  model: string;
  clinical: string;
  blocks: NormalizedBlock[];
  admit: string | null;
  discharge: string | null;
  losDays: number | null;
}) {
  const { openai, model, clinical, blocks, admit, discharge, losDays } = params;

  const system = [
    "You are DischargeX (Thai coding-first, LLM-assisted).",
    "Return ONLY JSON. No markdown. No extra explanation outside JSON.",
    "RECALC MODE:",
    "Use CURRENT BLOCKS as the source of truth for diagnosis grouping.",
    "Do NOT move diagnoses between principal/comorbidity/complication/other unless content is impossible or clearly contradictory.",
    "Preserve block content as much as possible.",
    "Your main job is to update ICD-10 / ICD-10-TM mapping per block, keep or improve ICD-9-CM procedure lines when supported, warnings, and meta.adjrw_estimate / meta.upgrade.",
    "Never choose or revise principal diagnosis to maximize RW/AdjRW without chart evidence.",
    "Principal diagnosis must be ONE disease with documentation support.",
    "Diagnosis fields must be full English terms. No abbreviations. No parentheses.",
    "Investigations, Treatment, and Home medication may use standard medical abbreviations, common drug shorthand, and concise workflow-friendly wording.",
    "ICD-9 must contain procedures ONLY (in-hospital procedures for this admission).",
    "Outcome must start with one of only: improved, refer, dead, against advice.",
    "AdjRW / meta.upgrade are ESTIMATES only — not grouper output, not a payment guarantee.",
    "If meta.upgrade is non-null, it must describe documentation/coding capture opportunities supported by chart text, not 'pick higher RW'. Otherwise upgrade must be null.",
  ].join("\n");

  const user = [
    "CURRENT BLOCKS (source of truth):\n" + JSON.stringify(blocks, null, 2),
    "\nADMIT_DATE_HINT: " + (admit || "unknown"),
    "\nDC_DATE_HINT: " + (discharge || "unknown"),
    "\nLOS_DAYS (if known): " + (losDays === null ? "unknown" : String(losDays)),
    "\nCLINICAL TEXT:\n" + clinical,
    "\nReturn same block keys/titles/orders. Keep block content aligned with CURRENT BLOCKS, but update ICD-10 code mapping, warnings, and meta.adjrw_estimate/meta.upgrade.",
    "\nOUTPUT JSON SHAPE EXACTLY:",
    `{
  "analysis":{
    "admission_reason":"",
    "active_diagnoses":[""],
    "chronic_comorbidities":[""],
    "likely_in_hospital_complications":[""],
    "likely_procedures":[""],
    "principal_candidates":[""],
    "best_principal_clinical":"",
    "best_principal_adjrw_safe":""
  },
  "blocks":[{"key":"...","title":"...","order":0,"content":"...","icd10":""}],
  "warnings":["..."],
  "meta":{
    "adjrw_estimate": 0,
    "upgrade": {
      "new_principal": "",
      "add_icd9": ["", ""],
      "projected_adjrw": 0,
      "increase": 0,
      "audit_risk": "Low|Medium|High",
      "reason_th": ""
    } | null
  }
}`,
  ].join("\n\n");

  return callModelJSON<GenerateModelOutput>(openai, model, system, user);
}

function getMaxDevices(rawPlan: string | null | undefined): number {
  const rank = planRank(rawPlan);
  if (rank <= 0) return 1;
  if (rank === 1) return 2;
  if (rank === 2) return 3;
  return 5;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return json({ error: "Unauthorized" }, 401);
    }

    const email = session.user.email;

    const userSelect = {
      id: true,
      plan: true,
      extraCredits: true,
      createdAt: true,
      periodStartedAt: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
      usages: { select: { id: true, count: true } },
    } as const;

    // อ่านหรือสร้าง user ใน DB (กรณี Demo login ก่อนมี user creation)
    let dbUser = await prisma.user.findUnique({
      where: { email },
      select: userSelect,
    });
    if (!dbUser) {
      try {
        const created = await prisma.user.create({
          data: {
            email,
            name: session.user.name ?? "User",
            plan: "trial",
            role: "user",
          },
          select: userSelect,
        });
        dbUser = created;
      } catch {
        dbUser = await prisma.user.findUnique({
          where: { email },
          select: userSelect,
        });
      }
    }

    const userId = dbUser?.id;
    const plan = normalizePlanId(
      dbUser?.plan ?? (session.user as { plan?: string } | null | undefined)?.plan ?? "trial"
    );
    const planDefinition = getPlanDefinition(plan);
    const isBasicPlan = planDefinition.tier === "basic";
    const isProPlan = planDefinition.tier === "pro";
    const includeAdjrwMeta = plan === "trial" || isProPlan;
    const maxDevices = getMaxDevices(plan);
    const extraCredits = dbUser?.extraCredits ?? 0;

    const periodStartDate = dbUser?.periodStartedAt ?? dbUser?.createdAt ?? new Date();
    const { start: periodStart, end: fallbackPeriodEnd } = getPeriodBounds(periodStartDate, plan);
    const periodEnd = dbUser?.subscriptionExpiresAt ?? fallbackPeriodEnd;
    const now = new Date();
    const { cycleStart, cycleEnd } = getCreditCycleBounds(periodStart, plan, now);
    const cycleWindowEnd = cycleEnd.getTime() > periodEnd.getTime() ? periodEnd : cycleEnd;
    const usageInCycle =
      userId != null
        ? await prisma.usageLog.aggregate({
            _sum: { baseCreditsUsed: true },
            where: {
              userId,
              createdAt: { gte: cycleStart, lte: cycleWindowEnd },
            },
          })
        : { _sum: { baseCreditsUsed: 0 } };
    const baseUsedInCycle = usageInCycle._sum.baseCreditsUsed ?? 0;
    const baseRemaining = Math.max(0, planDefinition.creditsPerCycle - baseUsedInCycle);
    const isExpired = now.getTime() > periodEnd.getTime();
    const isLimitedTrialExpired = plan === "trial" && isExpired;
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const todaySummaryCount =
      userId != null
        ? await prisma.usageLog.count({
            where: {
              userId,
              reason: { in: ["generate", "long_case_generate", "token_generate"] },
              createdAt: { gte: dayStart },
            },
          })
        : 0;
    const summaryApproxLimit = getDailyApproxLimit(plan).summaryPerDay;
    const nextDailyResetAt = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    // ตรวจ device limit
    if (userId) {
      const deviceId = req.headers.get("x-dischargex-device-id") || null;
      const activeSince = new Date(Date.now() - DEVICE_SESSION_TTL_MS);

      // เคลียร์อุปกรณ์ที่ไม่ได้ใช้งานเกิน TTL เพื่อคืน slot อัตโนมัติ
      await prisma.deviceSession.deleteMany({
        where: {
          userId,
          lastSeen: { lt: activeSince },
        },
      });

      if (deviceId) {
        const existingDevices = await prisma.deviceSession.findMany({
          where: {
            userId,
            lastSeen: { gte: activeSince },
          },
          select: { deviceId: true },
        });

        type DeviceRow = (typeof existingDevices)[number];
        const hasThisDevice = existingDevices.some((d: DeviceRow) => d.deviceId === deviceId);

        if (!hasThisDevice && existingDevices.length >= maxDevices) {
          return json(
            {
              error: `บัญชีนี้ถูกใช้งานพร้อมกันเกินจำนวนอุปกรณ์ที่อนุญาตสำหรับแผน "${plan}". กรุณาออกจากระบบจากอุปกรณ์อื่น หรืออัปเกรดแผน.`,
            },
            403
          );
        }

        await prisma.deviceSession.upsert({
          where: { userId_deviceId: { userId, deviceId } },
          create: {
            userId,
            deviceId,
            userAgent: req.headers.get("user-agent") || null,
            ip: req.headers.get("x-forwarded-for") || null,
          },
          update: {
            userAgent: req.headers.get("user-agent") || null,
            ip: req.headers.get("x-forwarded-for") || null,
          },
        });
      }
    }

    const body = (await req.json()) as ReqBody;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    const mode = body.mode || "generate";
    const fast = body.settings?.fast ?? false;
    const model = body.settings?.model || (fast ? "gpt-5-mini" : "gpt-5.4");
    const strategy = body.settings?.strategy === "what_if_optimize" ? "what_if_optimize" : "strict_audit_safe";
    const alternativeSearch = body.settings?.alternativeSearch === true;

    const incomingBlocks = normalizeIncomingBlocks(body.currentBlocks);
    const templateBlocks = (body.template?.blocks || []).slice().sort((a, b) => a.order - b.order);

    const blocks: NormalizedBlock[] =
      mode === "recalc" && incomingBlocks.length
        ? incomingBlocks.slice().sort((a, b) => a.order - b.order)
        : templateBlocks.map((b) => ({
            key: b.key,
            title: b.title,
            order: b.order,
            content: "",
            icd10: "",
          }));

    const safeImageInputs = sanitizeImageInputs(body.imageInputs);
    const imageExtractWarnings: string[] = [];
    let imageExtractText = "";
    if (safeImageInputs.length > 0) {
      try {
        imageExtractText = await extractClinicalTextFromImages(openai, safeImageInputs);
        if (!imageExtractText) {
          imageExtractWarnings.push("แนบรูปแล้ว แต่ยังสกัดข้อความจากรูปไม่สำเร็จ");
        }
      } catch {
        imageExtractWarnings.push("สกัดข้อความจากรูปไม่สำเร็จ ระบบจึงใช้เฉพาะข้อความที่พิมพ์ไว้");
      }
    }

    const mergedRaw = [
      body.inputs?.order_sheet ? `=== ORDER_SHEET ===\n${body.inputs.order_sheet}` : "",
      body.inputs?.other ? `=== OTHER ===\n${body.inputs.other}` : "",
      imageExtractText ? `=== IMAGE_EXTRACT ===\n${imageExtractText}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const requiredCreditsForCase = mode === "generate" ? getCreditsRequiredForCase(mergedRaw.length) : 0;
    const availableCredits = baseRemaining + extraCredits;
    const enforceCreditLimit = shouldEnforceLegacyCreditLimit();

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const tokenSpendMonth = userId
      ? await prisma.tokenUsageLedger.aggregate({
          _sum: { estimatedCostThb: true },
          where: { userId, createdAt: { gte: monthStart } },
        })
      : { _sum: { estimatedCostThb: 0 } };
    const tokenSpendThb = Number(tokenSpendMonth._sum.estimatedCostThb || 0);
    const tokenBudgetThb = getPlanTokenBudgetThb(plan);

    if (mode === "generate" && isLimitedTrialExpired) {
      return json(
        {
          error:
            "Trial หมดอายุแล้ว: ปิดการใช้งานสรุปชาร์จชั่วคราว เพื่อให้ใช้งานต่อได้เฉพาะ AI Chat แบบค้นหารหัส ICD-10 เท่านั้น หากต้องการใช้สรุปชาร์จ กรุณาอัปเกรดแพ็กเกจที่ /pricing",
          limitedMode: "trial_expired_icd10_only",
        },
        402
      );
    }

    const preprocess = preprocessClinicalText(mergedRaw);
    const clinical = deidentify(preprocess.cleaned);
    const { admit, discharge } = extractDates(clinical);
    const losDays = losDaysFromDDMMYY(admit, discharge);
    const warnings: string[] = [];
    warnings.push(...imageExtractWarnings);

    if (!clinical || clinical.trim().length < 30) {
      return json({
        result: {
          blocks: blocks.map((b) => ({
            key: b.key,
            title: b.title,
            order: b.order,
            content: mode === "recalc" ? b.content : "",
            icd10: mode === "recalc" ? b.icd10 : "",
          })),
          warnings: ["No clinical content provided."],
          meta: {
            losDays: isBasicPlan ? null : (losDays ?? null),
            adjrw: isBasicPlan ? null : null,
            diagnosis_confidence: "Low",
            upgrade: null,
          },
          preprocess: preprocess.summary,
        },
      });
    }

    const rules = body.templateRules || "";
    const extra = body.extraNote || "";
    const blocksForPrompt =
      isBasicPlan && mode === "generate"
        ? blocks.filter((b) => BASIC_PLAN_ONLY_KEYS.has(b.key))
        : blocks;
    const fieldSpec = blocksForPrompt.map((b) => `- ${b.key}: ${b.title}`).join("\n");

    const system =
      mode === "recalc"
        ? [
            "You are DischargeX (Thai coding-first, LLM-assisted).",
            "Return ONLY JSON. No markdown. No extra explanation outside JSON.",
            `Reference anchor: ${REFERENCE_SET_NAME}. CONFIG_RULES_JSON is the authoritative product rule pack — follow it for ICD/DRG-oriented behavior; do not override it with ad-hoc guesses.`,
            "Source rule: CLINICAL TEXT is ORDER_SHEET plus optional OTHER only. Lab/imaging evidence must appear inside ORDER_SHEET if documented — ignore any separate lab/radiology fields.",
            "RECALC MODE:",
            "Use CURRENT BLOCKS as the source of truth for diagnosis grouping.",
            "Do NOT move diagnoses between principal/comorbidity/complication/other unless content is impossible or clearly contradictory.",
            "Preserve block content as much as possible.",
            ...(includeAdjrwMeta
              ? [
                  "Your main job is to update ICD-10 / ICD-10-TM mapping per block, keep or improve ICD-9-CM procedure lines when supported, warnings, and meta.adjrw_estimate / meta.upgrade.",
                ]
              : [
                  "Your main job is to update ICD-10 code mapping per block, keep or improve ICD-9 procedure content when supported, and warnings.",
                ]),
            ...(strategy === "strict_audit_safe"
              ? [
                  "STRATEGY: strict_audit_safe. Prefer documentation-safe principal diagnosis and conservative coding choice.",
                  "If evidence is marginal, keep safer principal and put alternatives in analysis.principal_candidates.",
                ]
              : [
                  "STRATEGY: what_if_optimize. You may propose a higher complexity alternative ONLY if chart-supported and must clearly flag missing evidence.",
                  "When proposing an optimize option, keep audit_risk explicit and conservative.",
                ]),
            "Never revise coding to maximize RW/AdjRW without chart evidence.",
            "Principal diagnosis must be ONE disease.",
            "Diagnosis fields must be full English terms. No abbreviations. No parentheses.",
            "Investigations, Treatment, and Home medication may use standard medical abbreviations, common drug shorthand, and concise workflow-friendly wording.",
            "ICD-9 must contain procedures ONLY.",
            "Outcome must start with one of only: improved, refer, dead, against advice.",
            ...(includeAdjrwMeta
              ? [
                  "AdjRW / meta.upgrade are ESTIMATES only — not grouper truth.",
                  "meta.upgrade must describe documentation-supported capture opportunities, not selecting higher RW for financial reasons. Otherwise null.",
                ]
              : []),
          ].join("\n")
        : [
            "You are DischargeX — Thai coding-first, LLM-assisted (NOT LLM-first).",
            "Return ONLY JSON. No markdown. No extra explanation outside JSON.",
            `Reference anchor: ${REFERENCE_SET_NAME}. CONFIG_RULES_JSON is the authoritative product rule pack — follow it for ICD/DRG-oriented behavior; do not override it with ad-hoc guesses.`,
            "Source rule: CLINICAL TEXT merges ORDER_SHEET plus optional OTHER only. There is no separate lab/radiology channel — if labs/imaging exist, they must appear inside the ORDER_SHEET paste.",
            "Pipeline you must follow conceptually: Extraction -> Clinical classification -> Concept layer -> Coding -> estimated DRG/AdjRW impact -> Audit safety.",
            "Hard rule: NEVER output a diagnosis/procedure as 'confirmed' unless at least one evidence anchor exists in chart text (physician dx/assessment, objective labs/imaging, procedures, medications, or discharge plan).",
            "Hard rule: NEVER choose principal diagnosis to maximize RW/AdjRW. Choose principal ONLY among evidence-supported candidates using Thai coding/clinical justification (main reason for admission + resource use), not financial optimization.",
            "If multiple principals are plausible, list them in analysis.principal_candidates and pick ONE principal with the strongest documentation + admission alignment.",
            "Concept layer: normalize findings into concepts with onset + evidence strength + active management BEFORE ICD mapping.",
            "Complex cases: populate case_graph (underlying vs acute vs organ/metabolic complications) and activate relevant pattern_pack ids in engine.active_pattern_packs.",
            "Diagnosis fields must be full English terms. No abbreviations. No parentheses.",
            "Principal diagnosis must be exactly ONE disease/condition.",
            "Comorbidity may contain MULTIPLE diagnoses (comma-separated).",
            "Complication may contain MULTIPLE diagnoses (comma-separated).",
            "Other diagnosis: chronic/past conditions without active management this admission (not a dump for acute problems).",
            "Complication: NEW in-hospital condition after admission / caused by treatment course when supported.",
            "Final diagnosis must contain ALL important diagnoses in one line separated by commas. Never use numbered list.",
            "Do not omit clinically important ACTIVE problems if supported (but do not invent).",
            "If transfusion is given and anemia is clinically supported, do not omit anemia.",
            "If principal is sepsis/septic shock, do not place likely infection source in other diagnosis if it is part of active care.",
            "Thai shorthand: U/D underlying, HT hypertension, DM diabetes, CKD chronic kidney disease, COPD, AF atrial fibrillation.",
            "ICD-9-CM lines must be procedures performed in THIS admission only; diagnoses belong in ICD-10 fields.",
            "Follow-up empty if not documented.",
            "Outcome must start with: improved, refer, dead, against advice.",
            "Thai is allowed in coder notes / audit warnings / reason_th fields inside engine/meta as appropriate.",
            ...(includeAdjrwMeta
              ? [
                  "AdjRW / DRG fields are ESTIMATES only — label them as estimated impact, not grouper truth.",
                  "meta.upgrade must only suggest documentation-supported capture opportunities (NOT 'pick highest RW'). Otherwise null.",
                  "engine.chart_capture_hints (Pro/Trial): 0-8 items. Each item = one target diagnosis + ICD that could be BETTER SUPPORTED if chart had more explicit evidence.",
                  "For each hint: missing_in_input must list concrete gaps vs ORDER_SHEET text (and OTHER if present), e.g. order sheet lacks sepsis wording; no lactate line; no baseline creatinine in the pasted page.",
                  "suggested_order_sheet_wording_th = example phrasing clinicians might add IF true — never invent patient facts.",
                  "approx_adjrw_note_th = Thai, APPROXIMATE only: e.g. 'ถ้ามีหลักฐานครบ อาจช่วยให้การ capture diagnosis/complexity สอดคล้องแนวทางมากขึ้น (AdjRW ประมาณการ ไม่รับประกัน)'.",
                  "Never advise falsifying records. Empty chart_capture_hints if nothing reasonable.",
                ]
              : []),
            ...(alternativeSearch
              ? [
                  "ALTERNATIVE SEARCH: expand analysis.principal_candidates with 3-5 plausible principal options when possible.",
                  "Include both conservative and what-if options, but keep one best_principal_clinical only.",
                ]
              : []),
          ].join("\n");

    const dateAndLosLines = isBasicPlan
      ? ""
      : [
          "\nADMIT_DATE_HINT: " + (admit || "unknown"),
          "\nDC_DATE_HINT: " + (discharge || "unknown"),
          "\nLOS_DAYS (if known): " + (losDays === null ? "unknown" : String(losDays)),
        ].join("");
    const metaJsonShape = isBasicPlan || !includeAdjrwMeta
      ? `"warnings":["..."]`
      : `"warnings":["..."],
  "meta":{
    "adjrw_estimate": 0,
    "upgrade": {
      "new_principal": "",
      "add_icd9": ["", ""],
      "projected_adjrw": 0,
      "increase": 0,
      "audit_risk": "Low|Medium|High",
      "reason_th": ""
    } | null
  }`;

    const rulesEmbedded = summarizeRulesForPrompt(
      mode === "generate" ? 9000 : 6000
    );

    const chartHintsShapeBlock =
      includeAdjrwMeta && mode === "generate"
        ? `
    "chart_capture_hints": [
      {
        "target_diagnosis_text": "",
        "target_icd10": "",
        "missing_in_input": [""],
        "suggested_order_sheet_wording_th": "",
        "suggested_lab_or_imaging": [""],
        "approx_adjrw_note_th": "",
        "tier": "suggest_if_documented"
      }
    ],`
        : "";

    const generateExtendedShape =
      mode === "generate" && !isBasicPlan
        ? `,
  "extraction": {
    "admit_date": "",
    "discharge_date": "",
    "discharge_type": "",
    "chief_problem_on_admission": "",
    "final_assessed_conditions": [],
    "conditions_present_on_admission": [],
    "conditions_arising_after_admission": [],
    "symptoms_only": [],
    "abnormal_labs": [],
    "procedures": [],
    "operations": [],
    "investigations": [],
    "treatments": [],
    "discharge_medications": [],
    "maternal_context": {},
    "newborn_context": {},
    "injury_context": {},
    "evidence_map": {}
  },
  "case_graph": {
    "underlying_diseases": [],
    "acute_admission_problems": [],
    "organ_failures": [],
    "metabolic_derangements": [],
    "infections": [],
    "opportunistic_conditions": [],
    "procedures": [],
    "resource_intensive_treatments": [],
    "evidence": {}
  },
  "concepts": [],
  "linkage": [],
  "classification": {
    "principal_candidate": [],
    "comorbidity_candidates": [],
    "complication_candidates": [],
    "other_diagnosis_candidates": [],
    "external_cause_candidates": []
  },
  "engine": {
    "summary_text": "",
    "principal_diagnosis": {
      "text": "",
      "icd10": "",
      "icd10_tm": "",
      "confidence": "confirmed_from_chart",
      "evidence": [],
      "trust_label": "supported_by_chart",
      "existence_confidence": "explicit",
      "coding_linkage_confidence": "unlinked"
    },
    "comorbidities": [],
    "complications": [],
    "other_diagnoses": [],
    "external_causes": [],
    "procedures_icd9": [],
    "drg_estimation": {
      "status": "estimated",
      "drivers": [],
      "possible_complexity_adders": [],
      "audit_warnings": []
    },
    "documentation_gaps": [],
    "coder_notes": [],${chartHintsShapeBlock}
    "why_this_principal_diagnosis": "",
    "active_pattern_packs": [],
    "complex_case": {
      "mode": "pattern_pack",
      "top_principal_candidates": [],
      "missing_documentation": [],
      "possible_combination_categories": [],
      "active_secondary_candidates": [],
      "audit_risk_items": []
    }
  }`
        : "";

    const mergedKnowledge = await getMergedKnowledge(false);
    const knowledgeRanked = compactKnowledgeForSummaryPrompt(clinical, mergedKnowledge);
    const knowledgeForPrompt = knowledgeRanked.items;
    const externalEvidence = knowledgeRanked.hasStrongMatch
      ? { evidences: [], whitelist: [] }
      : await retrieveExternalEvidence(clinical.slice(0, 1200));
    if (!knowledgeRanked.hasStrongMatch && mode === "generate") {
      await queuePendingKnowledgeEntry(
        clinical.slice(0, 600),
        externalEvidence.evidences.map((e) => `${e.title}\n${e.snippet}`).join("\n\n").slice(0, 3000),
        {
          externalSources: externalEvidence.evidences.map((e) => ({
            title: e.title,
            url: e.sourceUrl,
            sourceName: e.sourceName,
          })),
        }
      );
    }
    const user =
      mode === "recalc"
        ? [
            "CURRENT BLOCKS (source of truth):\n" + JSON.stringify(blocks, null, 2),
            dateAndLosLines,
            rulesEmbedded
              ? "\nCONFIG_RULES_JSON (primary reference for coding rules + pattern packs; must conform when applicable — Thai coding > explicit doc > objective evidence > inference):\n" +
                rulesEmbedded
              : "",
            "\nKNOWLEDGE_UPDATES_JSON (approved knowledge updates + standard snippets, cite refs when used):\n" +
              JSON.stringify(knowledgeForPrompt),
            "\nEXTERNAL_REFERENCE_SOURCES_JSON (from whitelist sources; use when internal knowledge is insufficient):\n" +
              JSON.stringify(externalEvidence.evidences),
            "\nCLINICAL TEXT:\n" + clinical,
            isBasicPlan || !includeAdjrwMeta
              ? "\nReturn same block keys/titles/orders. Keep block content aligned with CURRENT BLOCKS, update ICD-10 code mapping and warnings only. Do not include meta."
              : "\nReturn same block keys/titles/orders. Keep block content aligned with CURRENT BLOCKS, but update ICD-10 code mapping, warnings, and meta.adjrw_estimate/meta.upgrade.",
            "\nOUTPUT JSON SHAPE EXACTLY:",
            `{
  "analysis":{
    "admission_reason":"",
    "active_diagnoses":[""],
    "chronic_comorbidities":[""],
    "likely_in_hospital_complications":[""],
    "likely_procedures":[""],
    "principal_candidates":[""],
    "best_principal_clinical":"",
    "best_principal_adjrw_safe":""
  },
  "blocks":[{"key":"...","title":"...","order":0,"content":"...","icd10":""}],
  ${metaJsonShape}
}`,
          ].join("\n\n")
        : [
            "TEMPLATE RULES:\n" + rules,
            "\nFIELDS:\n" + fieldSpec,
            "\nEXTRA NOTE:\n" + (extra || "(none)"),
            dateAndLosLines,
            rulesEmbedded
              ? "\nCONFIG_RULES_JSON (primary reference for coding rules + pattern packs; must conform when applicable — Thai coding > explicit doc > objective evidence > inference):\n" +
                rulesEmbedded
              : "",
            "\nKNOWLEDGE_UPDATES_JSON (approved knowledge updates + standard snippets, cite refs when used):\n" +
              JSON.stringify(knowledgeForPrompt),
            "\nEXTERNAL_REFERENCE_SOURCES_JSON (from whitelist sources; use when internal knowledge is insufficient):\n" +
              JSON.stringify(externalEvidence.evidences),
            "\nCLINICAL TEXT:\n" + clinical,
            "\nOUTPUT JSON SHAPE EXACTLY:",
            `{
  "analysis":{
    "admission_reason":"",
    "active_diagnoses":[""],
    "chronic_comorbidities":[""],
    "likely_in_hospital_complications":[""],
    "likely_procedures":[""],
    "principal_candidates":[""],
    "best_principal_clinical":"",
    "best_principal_adjrw_safe":""
  }${generateExtendedShape},
  "blocks":[{"key":"...","title":"...","order":0,"content":"...","icd10":""}],
  ${metaJsonShape}
}`,
            isBasicPlan
              ? "BASIC PLAN: Fill ONLY the blocks listed in FIELDS (principal_dx, comorbidity, complication, other_diag, external_cause, icd9). Return only those blocks in the blocks array. Do not fill or return any other block keys. Do not include meta."
              : !includeAdjrwMeta
              ? "Fill all blocks from FIELDS. Use empty string if unknown. Do not include meta."
              : "Fill all blocks from FIELDS. Use empty string if unknown. Populate extraction/case_graph/concepts/linkage/classification/engine for non-basic plans as in OUTPUT JSON.",
            "If both KNOWLEDGE_UPDATES_JSON and EXTERNAL_REFERENCE_SOURCES_JSON are empty/insufficient, avoid definitive principal diagnosis and explicitly state missing evidence in warnings.",
          ].join("\n\n");

    if (mode === "generate" && tokenSpendThb >= tokenBudgetThb) {
      const monthResetAt = new Date(monthStart);
      monthResetAt.setMonth(monthResetAt.getMonth() + 1);
      return json(
        {
          error: `โควตาการใช้งานเดือนนี้ครบแล้ว (${tokenSpendThb.toFixed(2)} / ${tokenBudgetThb.toFixed(
            2
          )} บาท) ระบบจะรีเซ็ตอีกครั้งประมาณ ${formatBangkokDateTime(monthResetAt)} หรือคุณสามารถซื้อแพ็กเพิ่มได้ที่หน้า /pricing`,
        },
        402
      );
    }

    if (mode === "generate" && todaySummaryCount >= summaryApproxLimit) {
      return json(
        {
          error: `วันนี้คุณสร้างสรุปชาร์จครบโควตาโดยประมาณแล้ว (${summaryApproxLimit} เคส/วัน) ระบบจะรีเซ็ตอีกครั้งประมาณ ${formatBangkokDateTime(nextDailyResetAt)} หรือคุณสามารถซื้อแพ็กเพิ่มได้ที่หน้า /pricing`,
        },
        429
      );
    }

    if (enforceCreditLimit && mode === "generate" && (isExpired || availableCredits < requiredCreditsForCase)) {
      if (isExpired) {
        return json(
          {
            error: `หมดรอบการใช้งานแล้ว ระบบจะรีเซ็ตอีกครั้งประมาณ ${formatBangkokDateTime(nextDailyResetAt)} หรือคุณสามารถซื้อแพ็กเพิ่มได้ที่หน้า /pricing`,
          },
          402
        );
      }
      return json(
        {
          error: `โควตารอบนี้ไม่พอสำหรับเคสนี้ ระบบจะรีเซ็ตอีกครั้งประมาณ ${formatBangkokDateTime(nextDailyResetAt)} หรือคุณสามารถซื้อแพ็กเพิ่มได้ที่หน้า /pricing`,
        },
        402
      );
    }

    const draftResponse = await callModelJSON<GenerateModelOutput>(openai, model, system, user);
    const draftOut = draftResponse.data;
    const aggregateUsage: TokenUsageSummary = {
      inputTokens: draftResponse.usage.inputTokens,
      outputTokens: draftResponse.usage.outputTokens,
      totalTokens: draftResponse.usage.totalTokens,
    };

    warnings.push(...(draftOut.warnings || []).slice(0, 40));

    const draftBlocks =
      isBasicPlan && mode === "generate"
        ? (draftOut.blocks || []).filter((b) => b?.key && BASIC_PLAN_ONLY_KEYS.has(String(b.key)))
        : draftOut.blocks;

    let normalized = mergeModelBlocksOntoBase(blocks, draftBlocks, mode);

    for (const blk of normalized) {
      if (blk.key === "admit_date") {
        blk.content = stripTimeKeepDate(blk.content || admit || "");
      }
      if (blk.key === "discharge_date") {
        blk.content = stripTimeKeepDate(blk.content || discharge || "");
      }
    }

    if (isBasicPlan) {
      for (const blk of normalized) {
        if (BASIC_PLAN_LOCKED_KEYS.has(blk.key)) {
          blk.content = "";
          blk.icd10 = "";
        }
      }
    }

    normalized = postProcessBlocks(normalized, warnings);

    let adjrwEstimate = includeAdjrwMeta ? toNum(draftOut.meta?.adjrw_estimate) : null;
    let upgradeMeta = includeAdjrwMeta ? (draftOut.meta?.upgrade || null) : null;

    if (mode === "generate" && !fast && includeAdjrwMeta) {
      const recalcResponse = await runRecalcPass({
        openai,
        model,
        clinical,
        blocks: normalized,
        admit,
        discharge,
        losDays,
      });
      const recalcOut = recalcResponse.data;
      aggregateUsage.inputTokens += recalcResponse.usage.inputTokens;
      aggregateUsage.outputTokens += recalcResponse.usage.outputTokens;
      aggregateUsage.totalTokens += recalcResponse.usage.totalTokens;

      warnings.push(...(recalcOut.warnings || []).slice(0, 20));
      normalized = mergeModelBlocksOntoBase(normalized, recalcOut.blocks, "recalc");
      normalized = postProcessBlocks(normalized, warnings);

      if (includeAdjrwMeta) {
        const recalcAdj = toNum(recalcOut.meta?.adjrw_estimate);
        if (recalcAdj !== null) {
          adjrwEstimate = recalcAdj;
        }

        if (recalcOut.meta?.upgrade) {
          upgradeMeta = recalcOut.meta.upgrade;
        }
      }
    }

    let upgrade: {
      new_principal: string;
      add_icd9: string[];
      projected_adjrw: number;
      increase: number;
      audit_risk: string;
      reason_th: string;
    } | null = null;

    if (includeAdjrwMeta && upgradeMeta && typeof upgradeMeta === "object") {
      const inc = toNum(upgradeMeta.increase);
      const proj = toNum(upgradeMeta.projected_adjrw);
      const risk = String(upgradeMeta.audit_risk || "");
      const newPri = String(upgradeMeta.new_principal || "");
      const addIcd9 = Array.isArray(upgradeMeta.add_icd9)
        ? upgradeMeta.add_icd9.map((x) => String(x)).filter(Boolean)
        : [];
      const reason_th = String(upgradeMeta.reason_th || "");

      if (inc !== null && proj !== null && inc > 0.2) {
        upgrade = {
          new_principal: newPri,
          add_icd9: addIcd9,
          projected_adjrw: proj,
          increase: inc,
          audit_risk: risk,
          reason_th,
        };
      }
    }

    let enginePayload: DischargeEnginePayload | null = null;

    if (mode === "generate" || mode === "recalc") {
      const baseEngine = synthesizeEngineFromBlocks(normalized as EngineNormalizedBlock[]);
      enginePayload = mergePartialEngine(baseEngine, draftOut.engine);
      if (draftOut.extraction && typeof draftOut.extraction === "object") {
        enginePayload = {
          ...enginePayload,
          extraction: draftOut.extraction as ExtractionLayer,
        };
      }
      if (draftOut.case_graph && typeof draftOut.case_graph === "object") {
        enginePayload = {
          ...enginePayload,
          case_graph: draftOut.case_graph as CaseGraph,
        };
      }
      if (Array.isArray(draftOut.concepts) && draftOut.concepts.length) {
        enginePayload = { ...enginePayload, concepts: draftOut.concepts as ConceptNode[] };
      }
      if (Array.isArray(draftOut.linkage) && draftOut.linkage.length) {
        enginePayload = { ...enginePayload, linkage: draftOut.linkage as LinkageEdge[] };
      }
      if (draftOut.classification && typeof draftOut.classification === "object") {
        enginePayload = {
          ...enginePayload,
          classification: draftOut.classification as DischargeEnginePayload["classification"],
        };
      }
      if (!enginePayload.linkage?.length) {
        enginePayload = { ...enginePayload, linkage: detectLinkageInText(clinical) };
      }
      if (upgrade && enginePayload.chart_capture_hints?.length) {
        const target = String(upgrade.new_principal || "").toLowerCase();
        const blockingHint = enginePayload.chart_capture_hints.find((h) => {
          const hasMissing = Array.isArray(h.missing_in_input) && h.missing_in_input.length > 0;
          if (!hasMissing) return false;
          const hintTarget = String(h.target_diagnosis_text || "").toLowerCase();
          if (!target) return true;
          return hintTarget.includes(target) || target.includes(hintTarget);
        });
        if (blockingHint) {
          warnings.push(
            "Evidence gate: ยังมีข้อมูลหลักฐานไม่ครบสำหรับคำแนะนำปรับ diagnosis/complexity จึงไม่แสดงทางเลือกที่คาด AdjRW สูงขึ้นในรอบนี้"
          );
          upgrade = null;
        }
      }
      enginePayload = alignPrincipalEngineToPrincipalBlock(enginePayload, normalized);
      const principalBlock = normalized.find((b) => b.key === "principal_dx");
      const ageLine = clinical.match(/Age:\s*([^\n]+)/i)?.[1] || "";
      const sexLine = clinical.match(/Sex:\s*([^\n]+)/i)?.[1] || "";
      const valIssues = validatePrincipalAndEngine({
        principalBlockText: principalBlock?.content || "",
        principalBlockIcd10: principalBlock?.icd10 || "",
        engine: enginePayload,
        patientAgeText: ageLine,
        patientSex: sexLine,
      });
      for (const vi of valIssues) {
        warnings.push(vi.message_th);
      }
      enginePayload =
        mergeEngineAuditWarnings(
          enginePayload,
          valIssues.filter((v) => v.severity === "warning").map((v) => v.message_th)
        ) || enginePayload;

      if (enginePayload && !includeAdjrwMeta) {
        const { chart_capture_hints: _strip, ...rest } = enginePayload;
        enginePayload = rest as DischargeEnginePayload;
      }
    }

    if (mode === "recalc" && incomingBlocks.length) {
      const currentMap = new Map(incomingBlocks.map((b) => [b.key, b]));
      normalized = normalized.map((b) => ({
        ...b,
        title: currentMap.get(b.key)?.title ?? b.title,
        order: currentMap.get(b.key)?.order ?? b.order,
        content: currentMap.get(b.key)?.content ?? b.content,
      }));

      if (includeAdjrwMeta) {
        const recalcAdj = toNum(draftOut.meta?.adjrw_estimate);
        if (recalcAdj !== null) {
          adjrwEstimate = recalcAdj;
        }
      }
    }

    const principalIcd10List = normalizeIcd10List(
      normalized.find((b) => b.key === "principal_dx")?.icd10 || ""
    );
    const secondaryIcd10List = [
      ...normalizeIcd10List(normalized.find((b) => b.key === "comorbidity")?.icd10 || ""),
      ...normalizeIcd10List(normalized.find((b) => b.key === "complication")?.icd10 || ""),
      ...normalizeIcd10List(normalized.find((b) => b.key === "other_diag")?.icd10 || ""),
    ];
    const f2Hits = evaluateF2CcExclusions({
      principalIcd10List,
      secondaryIcd10List,
    });
    mergeUniqueWarnings(
      warnings,
      f2Hits.map(
        (hit) =>
          `F2 exclusion: SDx ${hit.sdxIcd10} (${hit.ccLabel}) may not increase complexity when PDx is ${hit.pdxIcd10}. Review principal-secondary pairing and supporting evidence.`
      )
    );

    if (!isBasicPlan && losDays === null) {
      warnings.push("Missing admit/discharge date for LOS (used as guidance only).");
    }

    const finalWarnings = uniqueWarningsList(warnings);
    const diagnosis_confidence = computeDiagnosisConfidence(normalized, finalWarnings);

    if (isBasicPlan) {
      normalized = normalized.map((b) =>
        BASIC_PLAN_LOCKED_KEYS.has(b.key) ? { ...b, content: "", icd10: "" } : b
      );
    }

    if (mode === "generate" && userId) {
      const baseToUse = Math.min(baseRemaining, requiredCreditsForCase);
      const addonToUse = requiredCreditsForCase - baseToUse;

      const exportText =
        isProPlan
          ? normalized
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((b) => `${b.title}: ${b.content}`)
              .join("\n")
          : null;
      await prisma.$transaction(
        async (tx: PrismaTx) => {
          await tx.usage.upsert({
            where: { userId },
            create: { userId, count: 1 },
            update: { count: { increment: 1 } },
          });

          if (enforceCreditLimit && addonToUse > 0) {
            const updatedCount = await tx.user.updateMany({
              where: { id: userId, extraCredits: { gte: addonToUse } },
              data: {
                extraCredits: { decrement: addonToUse },
                totalGenerations: { increment: 1 },
              },
            });
            if (updatedCount.count === 0) {
              throw new Error("โควตา Boost เสริมไม่เพียงพอ กรุณาลองใหม่อีกครั้ง");
            }
          } else {
            await tx.user.update({
              where: { id: userId },
              data: { totalGenerations: { increment: 1 } },
            });
          }

          await tx.usageLog.create({
            data: {
              userId,
              creditsUsed: enforceCreditLimit ? requiredCreditsForCase : 0,
              baseCreditsUsed: enforceCreditLimit ? baseToUse : 0,
              addonCreditsUsed: enforceCreditLimit ? addonToUse : 0,
              reason: enforceCreditLimit
                ? requiredCreditsForCase > 1
                  ? "long_case_generate"
                  : "generate"
                : "token_generate",
              ...(exportText != null && exportText !== "" ? { summarySnapshot: exportText } : {}),
            },
          });
        },
        { maxWait: 20_000, timeout: 60_000 }
      );
      await markReferralFirstUsage(userId);
    }

    const tokenBilling = estimateTokenBillingThb(aggregateUsage);

    await prisma.tokenUsageLedger.create({
      data: {
        userId,
        source: mode === "generate" ? "summary_generate" : "summary_recalc",
        model,
        inputTokens: aggregateUsage.inputTokens,
        outputTokens: aggregateUsage.outputTokens,
        totalTokens: aggregateUsage.totalTokens,
        estimatedCostThb: tokenBilling.estimatedCostThb,
        payload: JSON.stringify({ plan, diagnosisConfidence: diagnosis_confidence }),
      },
    });

    await trackTelemetry({
      userId,
      source: "summary",
      event: mode === "generate" ? "summary_generated" : "summary_recalc",
      payload: {
        plan,
        warningsCount: warnings.length,
        diagnosisConfidence: diagnosis_confidence,
        creditsRequired: requiredCreditsForCase,
        inputChars: mergedRaw.length,
        tokenUsage: aggregateUsage,
        tokenBilling,
      },
    });

    return json({
      result: {
        blocks: normalized,
        warnings: finalWarnings,
        meta: {
          losDays: isBasicPlan ? null : (losDays ?? null),
          adjrw: includeAdjrwMeta ? adjrwEstimate : null,
          diagnosis_confidence,
          upgrade: includeAdjrwMeta ? upgrade : null,
          token_usage: aggregateUsage,
          token_billing_estimate: tokenBilling,
          privacy: { deidentifiedBeforeModel: true },
        },
        preprocess: preprocess.summary,
        engine: enginePayload,
      },
    });
  } catch (err: unknown) {
    console.error("summarize_route_failed", err);
    return json(
      {
        error: err instanceof Error ? err.message : "Internal Server Error",
      },
      500
    );
  }
}
