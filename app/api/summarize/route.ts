import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getCreditCycleBounds,
  getCreditsRequiredForCase,
  getPeriodBounds,
  getPlanDefinition,
  normalizePlanId,
  planRank,
} from "@/lib/billing-rules";
import { markReferralFirstUsage } from "@/lib/referral";

export const runtime = "nodejs";

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
  inputs: { order_sheet?: string; lab?: string; radiology?: string; other?: string };
  extraNote?: string;
  templateRules?: string;
  settings?: { autoDeidentify?: boolean; model?: string; fast?: boolean };
};

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

type CandidateCompareOutput = {
  candidate_scores?: Array<{
    principal?: string;
    expected_adjrw?: number | string;
    audit_safe?: boolean;
    evidence_strength?: string;
    why?: string;
  }>;
  best_principal?: string;
  best_expected_adjrw?: number | string;
  best_reason_th?: string;
  blocks?: Array<{
    key?: string;
    title?: string;
    order?: number;
    content?: string;
    icd10?: string;
  }>;
  warnings?: string[];
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
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

async function callModelJSON<T>(
  openai: OpenAI,
  model: string,
  system: string,
  user: string,
  options?: { max_output_tokens?: number }
) {
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

  const text = "output_text" in resp ? resp.output_text || "" : "";
  const obj = extractJsonObject<T>(text);
  if (obj) return obj;

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

  const repairText = "output_text" in repair ? repair.output_text || "" : "";
  const obj2 = extractJsonObject<T>(repairText);
  if (!obj2) throw new Error("Model returned non-JSON");
  return obj2;
}

function normalizeIcd10List(s: string) {
  return (s || "")
    .split(",")
    .map((x) => x.trim().toUpperCase())
    .filter(Boolean);
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

function collectPrincipalCandidates(
  out: GenerateModelOutput,
  normalized: NormalizedBlock[]
) {
  const rawCandidates = [
    ...(out.analysis?.principal_candidates || []),
    out.analysis?.best_principal_clinical || "",
    out.analysis?.best_principal_adjrw_safe || "",
    normalized.find((b) => b.key === "principal_dx")?.content || "",
  ];

  const clean = rawCandidates
    .flatMap((x) => String(x || "").split(","))
    .map((x) => x.trim())
    .filter(Boolean);

  const unique = Array.from(new Set(clean));
  return unique.slice(0, 6);
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
    "You are DischargeX, an AI assistant for discharge summary and DRG-oriented coding support in Thai hospitals.",
    "Return ONLY JSON. No markdown. No extra explanation outside JSON.",
    "RECALC MODE:",
    "Use CURRENT BLOCKS as the source of truth for diagnosis grouping.",
    "Do NOT move diagnoses between principal/comorbidity/complication/other unless content is impossible or clearly contradictory.",
    "Preserve block content as much as possible.",
    "Your main job is to update ICD-10 code mapping per block, keep or improve ICD-9 procedure content when supported, warnings, and meta.adjrw_estimate / meta.upgrade.",
    "Principal diagnosis must be ONE disease.",
    "Diagnosis fields must be full English terms. No abbreviations. No parentheses.",
    "Investigations, Treatment, and Home medication may use standard medical abbreviations, common drug shorthand, and concise workflow-friendly wording.",
    "ICD-9 must contain procedures ONLY.",
    "Outcome must start with one of only: improved, refer, dead, against advice.",
    "AdjRW is an estimate only.",
    "Propose only ONE best upgrade suggestion, only if projected increase > 0.2 and still audit-safe. Otherwise upgrade must be null.",
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

async function runCandidateCompare(params: {
  openai: OpenAI;
  model: string;
  clinical: string;
  blocks: NormalizedBlock[];
  candidates: string[];
  admit: string | null;
  discharge: string | null;
  losDays: number | null;
}) {
  const { openai, model, clinical, blocks, candidates, admit, discharge, losDays } = params;

  const system = [
    "You are DischargeX principal selector.",
    "Return ONLY JSON. No markdown. No extra explanation outside JSON.",
    "Compare clinically supportable principal diagnosis candidates for the SAME case.",
    "Goal: choose the candidate with the HIGHEST EXPECTED AdjRW, as long as it remains clinically supportable and audit-safe.",
    "Do not prefer severity wording alone if another clinically supportable principal is expected to yield better AdjRW.",
    "You must estimate each candidate separately, then choose the best one.",
    "Revise the final block set so that the chosen principal is in principal_dx and the remaining diagnoses are redistributed appropriately.",
    "Principal diagnosis must be ONE disease.",
    "Keep diagnosis terms in full English.",
    "ICD-9 must contain procedures only.",
    "Investigations, Treatment, and Home medication may use standard medical abbreviations.",
  ].join("\n");

  const user = [
    "CLINICAL TEXT:\n" + clinical,
    "\nCURRENT DRAFT BLOCKS:\n" + JSON.stringify(blocks, null, 2),
    "\nCANDIDATE PRINCIPALS:\n" + candidates.map((c, i) => `${i + 1}. ${c}`).join("\n"),
    "\nADMIT_DATE_HINT: " + (admit || "unknown"),
    "\nDC_DATE_HINT: " + (discharge || "unknown"),
    "\nLOS_DAYS (if known): " + (losDays === null ? "unknown" : String(losDays)),
    "\nOUTPUT JSON SHAPE EXACTLY:",
    `{
  "candidate_scores":[
    {
      "principal":"...",
      "expected_adjrw":0,
      "audit_safe":true,
      "evidence_strength":"High|Medium|Low",
      "why":"..."
    }
  ],
  "best_principal":"...",
  "best_expected_adjrw":0,
  "best_reason_th":"...",
  "blocks":[{"key":"...","title":"...","order":0,"content":"...","icd10":""}],
  "warnings":["..."]
}`,
  ].join("\n\n");

  return callModelJSON<CandidateCompareOutput>(openai, model, system, user);
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
    const mode = body.mode || "generate";
    const fast = body.settings?.fast ?? false;
    const model = body.settings?.model || (fast ? "gpt-5-mini" : "gpt-5.4");

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

    const mergedRaw = [
      body.inputs?.order_sheet ? `=== ORDER_SHEET ===\n${body.inputs.order_sheet}` : "",
      body.inputs?.lab ? `=== LAB ===\n${body.inputs.lab}` : "",
      body.inputs?.radiology ? `=== RADIOLOGY ===\n${body.inputs.radiology}` : "",
      body.inputs?.other ? `=== OTHER ===\n${body.inputs.other}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const requiredCreditsForCase = mode === "generate" ? getCreditsRequiredForCase(mergedRaw.length) : 0;
    const availableCredits = baseRemaining + extraCredits;

    const preprocess = preprocessClinicalText(mergedRaw);
    const clinical = preprocess.cleaned;
    const { admit, discharge } = extractDates(clinical);
    const losDays = losDaysFromDDMMYY(admit, discharge);
    const warnings: string[] = [];

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
            "You are DischargeX, an AI assistant for discharge summary and DRG-oriented coding support in Thai hospitals.",
            "Return ONLY JSON. No markdown. No extra explanation outside JSON.",
            "RECALC MODE:",
            "Use CURRENT BLOCKS as the source of truth for diagnosis grouping.",
            "Do NOT move diagnoses between principal/comorbidity/complication/other unless content is impossible or clearly contradictory.",
            "Preserve block content as much as possible.",
            ...(includeAdjrwMeta
              ? [
                  "Your main job is to update ICD-10 code mapping per block, keep or improve ICD-9 procedure content when supported, warnings, and meta.adjrw_estimate / meta.upgrade.",
                ]
              : [
                  "Your main job is to update ICD-10 code mapping per block, keep or improve ICD-9 procedure content when supported, and warnings.",
                ]),
            "Principal diagnosis must be ONE disease.",
            "Diagnosis fields must be full English terms. No abbreviations. No parentheses.",
            "Investigations, Treatment, and Home medication may use standard medical abbreviations, common drug shorthand, and concise workflow-friendly wording.",
            "ICD-9 must contain procedures ONLY.",
            "Outcome must start with one of only: improved, refer, dead, against advice.",
            ...(includeAdjrwMeta
              ? [
                  "AdjRW is an estimate only.",
                  "Propose only ONE best upgrade suggestion, only if projected increase > 0.2 and still audit-safe. Otherwise upgrade must be null.",
                ]
              : []),
          ].join("\n")
        : [
            "You are DischargeX, an AI assistant for discharge summary and DRG-oriented coding support in Thai hospitals.",
            "Return ONLY JSON. No markdown. No extra explanation outside JSON.",
            "Think in 2 layers: first analyze the case, then render fields.",
            "Do not lock too early to one principal if there are multiple clinically supportable candidates.",
            "You should expose principal_candidates whenever more than one candidate is plausible.",
            "Diagnosis fields must be full English terms. No abbreviations. No parentheses.",
            "Principal diagnosis must be ONE disease.",
            "Comorbidity may contain MULTIPLE diagnoses and must be comma-separated in one line.",
            "Complication may contain MULTIPLE diagnoses and must be comma-separated in one line.",
            "Other diagnosis means pre-existing / chronic / older diagnoses that are not actively treated in this visit. It must NOT become a dump bucket.",
            "If a diagnosis is active and treated in this visit, prefer principal / comorbidity / complication, not other diagnosis.",
            "Use comorbidity before other diagnosis for active coexisting diagnoses unless there is clear timing support for complication.",
            "Final diagnosis must contain ALL important diagnoses in one line separated by commas. Never use numbered list.",
            "Complication means NEW in-hospital condition after treatment started.",
            "Do not place presenting/pre-existing conditions into complication.",
            "Do not omit clinically important diagnoses such as anemia, sepsis, septic shock, respiratory failure, shock, acute kidney injury, hypokalemia, or hypoglycemia if active in this visit.",
            "If transfusion/PRC/FFP/platelet is given and anemia is clinically supported, anemia must not disappear.",
            "If principal is sepsis or septic shock, the likely infection source such as pneumonia should not be put in other diagnosis.",
            "Understand Thai shorthand: U/D = underlying disease, HT = hypertension, DM = diabetes mellitus, CKD = chronic kidney disease, COPD = chronic obstructive pulmonary disease, AF = atrial fibrillation.",
            "admit รพ. ... [date] usually indicates admission date.",
            "ICD-9 must contain procedures ONLY. Do not place diagnoses in ICD-9.",
            "When ICD-9 is present, prefer full string with code plus English description.",
            "Investigations, Treatment, and Home medication may use standard medical abbreviations, common drug shorthand, and concise workflow-friendly wording.",
            "Investigations, Treatment, and Home medication should remain one line comma-separated.",
            "Follow-up should be empty if not documented. Do not invent follow-up.",
            "Outcome must start with one of only: improved, refer, dead, against advice. If needed, append detail after comma.",
            "Thai is allowed only in reason_th.",
            ...(includeAdjrwMeta
              ? [
                  "AdjRW is an estimate only.",
                  "Propose only ONE best upgrade suggestion, only if projected increase > 0.2 and still audit-safe. Otherwise upgrade must be null.",
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

    const user =
      mode === "recalc"
        ? [
            "CURRENT BLOCKS (source of truth):\n" + JSON.stringify(blocks, null, 2),
            dateAndLosLines,
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
  },
  "blocks":[{"key":"...","title":"...","order":0,"content":"...","icd10":""}],
  ${metaJsonShape}
}`,
            isBasicPlan
              ? "BASIC PLAN: Fill ONLY the blocks listed in FIELDS (principal_dx, comorbidity, complication, other_diag, external_cause, icd9). Return only those blocks in the blocks array. Do not fill or return any other block keys. Do not include meta."
              : !includeAdjrwMeta
              ? "Fill all blocks from FIELDS. Use empty string if unknown. Do not include meta."
              : "Fill all blocks from FIELDS. Use empty string if unknown.",
          ].join("\n\n");

    if (mode === "generate" && (isExpired || availableCredits < requiredCreditsForCase)) {
      if (isExpired) {
        return json(
          {
            error: `หมดรอบการใช้งานแล้ว. กรุณาต่ออายุหรือซื้อแพ็กเกจใหม่ก่อนใช้งาน`,
          },
          402
        );
      }
      return json(
        {
          error: `เครดิตไม่พอสำหรับเคสนี้ (ต้องใช้ ${requiredCreditsForCase} เครดิต, คงเหลือ ${availableCredits}). ต่ออายุหรือซื้อเครดิตเพิ่มที่หน้าแพ็กเกจ`,
        },
        402
      );
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const draftOut = await callModelJSON<GenerateModelOutput>(openai, model, system, user);

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
      const candidates = collectPrincipalCandidates(draftOut, normalized);

      if (candidates.length > 1) {
        const compareOut = await runCandidateCompare({
          openai,
          model,
          clinical,
          blocks: normalized,
          candidates,
          admit,
          discharge,
          losDays,
        });

        warnings.push(...(compareOut.warnings || []).slice(0, 20));

        if (compareOut.blocks?.length) {
          normalized = mergeModelBlocksOntoBase(normalized, compareOut.blocks, "generate");
          normalized = postProcessBlocks(normalized, warnings);
        }

        const comparedAdj = toNum(compareOut.best_expected_adjrw);
        if (comparedAdj !== null) {
          adjrwEstimate = comparedAdj;
        }

        if (compareOut.candidate_scores?.length) {
          warnings.push("Principal candidates were compared by expected AdjRW before final selection.");
        }
      }

      if (!fast) {
        const recalcOut = await runRecalcPass({
          openai,
          model,
          clinical,
          blocks: normalized,
          admit,
          discharge,
          losDays,
        });

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

    if (!isBasicPlan && losDays === null) {
      warnings.push("Missing admit/discharge date for LOS (used as guidance only).");
    }

    const diagnosis_confidence = computeDiagnosisConfidence(normalized, warnings);

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
      await prisma.$transaction(async (tx: PrismaTx) => {
        await tx.usage.upsert({
          where: { userId },
          create: { userId, count: 1 },
          update: { count: { increment: 1 } },
        });

        if (addonToUse > 0) {
          const updatedCount = await tx.user.updateMany({
            where: { id: userId, extraCredits: { gte: addonToUse } },
            data: {
              extraCredits: { decrement: addonToUse },
              totalGenerations: { increment: 1 },
            },
          });
          if (updatedCount.count === 0) {
            throw new Error("เครดิต add-on ไม่เพียงพอ กรุณาลองใหม่อีกครั้ง");
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
            creditsUsed: requiredCreditsForCase,
            baseCreditsUsed: baseToUse,
            addonCreditsUsed: addonToUse,
            reason: requiredCreditsForCase > 1 ? "long_case_generate" : "generate",
            ...(exportText != null && exportText !== "" ? { summarySnapshot: exportText } : {}),
          },
        });
      });
      await markReferralFirstUsage(userId);
    }

    return json({
      result: {
        blocks: normalized,
        warnings,
        meta: {
          losDays: isBasicPlan ? null : (losDays ?? null),
          adjrw: includeAdjrwMeta ? adjrwEstimate : null,
          diagnosis_confidence,
          upgrade: includeAdjrwMeta ? upgrade : null,
        },
        preprocess: preprocess.summary,
      },
    });
  } catch (err: unknown) {
    return json(
      {
        error: err instanceof Error ? err.message : "Internal Server Error",
        raw: String(err instanceof Error ? err.stack || err.message : err || ""),
      },
      500
    );
  }
}