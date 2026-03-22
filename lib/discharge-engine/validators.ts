import type { DischargeEnginePayload } from "./types";
import coreRulesJson from "@/config/discharge/core_rules.json";

type CoreRules = typeof coreRulesJson & {
  unacceptable_principal_icd10_prefixes?: string[];
  unacceptable_principal_text_hints?: string[];
  status_categories_require_explicit_documentation?: Record<string, string>;
};

export type ValidationIssue = {
  code: string;
  severity: "warning" | "error";
  message_th: string;
};

function normalizeIcd10Token(s: string) {
  return (s || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .split(",")[0]
    .trim();
}

function principalText(blockPrincipal: string, engine?: DischargeEnginePayload) {
  const fromEngine = engine?.principal_diagnosis?.text?.trim();
  if (fromEngine) return fromEngine;
  return (blockPrincipal || "").trim();
}

function principalIcd(blockIcd: string, engine?: DischargeEnginePayload) {
  const fromEngine = engine?.principal_diagnosis?.icd10?.trim();
  if (fromEngine) return fromEngine;
  return (blockIcd || "").trim();
}

export function validatePrincipalAndEngine(params: {
  principalBlockText: string;
  principalBlockIcd10: string;
  engine?: DischargeEnginePayload | null;
  patientAgeText?: string;
  patientSex?: string;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { engine } = params;

  const pText = principalText(params.principalBlockText, engine || undefined);
  const pIcd = principalIcd(params.principalBlockIcd10, engine || undefined);

  if (!pText) {
    issues.push({
      code: "principal_missing",
      severity: "error",
      message_th: "Principal diagnosis ว่าง — ต้องมี 1 รายการที่มีหลักฐานรองรับ",
    });
    return issues;
  }

  const rules = coreRulesJson as CoreRules;
  const badPrefixes = rules.unacceptable_principal_icd10_prefixes || [];
  const token = normalizeIcd10Token(pIcd);
  for (const pref of badPrefixes) {
    if (token.startsWith(pref.toUpperCase())) {
      issues.push({
        code: "unacceptable_principal_icd_prefix",
        severity: "warning",
        message_th: `ICD-10 หลัก ${token} อาจไม่เหมาะเป็น principal ตามกติกา status/follow-up/convalescence — ต้องมีเอกสารชัดเจนว่าเป็นเหตุหลักของการรับไว้`,
      });
    }
  }

  const hints = (rules.unacceptable_principal_text_hints || []).map((h) => h.toLowerCase());
  const lower = pText.toLowerCase();
  for (const h of hints) {
    if (h.length >= 3 && lower.includes(h)) {
      issues.push({
        code: "unacceptable_principal_text_hint",
        severity: "warning",
        message_th: `คำสำคัญใน principal (“${h}”) อาจสื่อถึง observation/follow-up/convalescence — ตรวจทานตามมาตรฐาน Thai coding`,
      });
      break;
    }
  }

  const sex = (params.patientSex || "").toLowerCase();
  const obCodes = ["O", "Z34", "Z35", "Z36"];
  if (sex === "male" && obCodes.some((c) => token.startsWith(c))) {
    issues.push({
      code: "sex_conflict",
      severity: "warning",
      message_th: "รหัสที่เกี่ยวกับการตั้งครรภ์/คลอด ไม่สอดคล้องกับเพศชาย — ตรวจสอบรหัสและเวชระเบียน",
    });
  }

  const ageStr = params.patientAgeText || "";
  const yearMatch = ageStr.match(/(\d+)\s*ปี/);
  const years = yearMatch ? parseInt(yearMatch[1], 10) : null;
  if (years !== null && years < 15 && (token.startsWith("O") || lower.includes("pregnancy"))) {
    issues.push({
      code: "age_conflict",
      severity: "warning",
      message_th: "รหัสที่เกี่ยวกับการตั้งครรภ์/คลอด อาจไม่สอดคล้องกับอายุ — ตรวจสอบรหัสและเวชระเบียน",
    });
  }

  return issues;
}

export function mergeEngineAuditWarnings(
  engine: DischargeEnginePayload | null | undefined,
  extra: string[]
): DischargeEnginePayload | null {
  if (!engine) return null;
  const base = engine.drg_estimation?.audit_warnings || [];
  return {
    ...engine,
    drg_estimation: {
      ...engine.drg_estimation,
      status: "estimated",
      audit_warnings: Array.from(new Set([...base, ...extra])),
      disclaimer_th:
        engine.drg_estimation?.disclaimer_th ||
        "นี่คือการประมาณการจากข้อมูลใน chart เท่านั้น ไม่ใช่ผลจาก grouper จริง และไม่รับประกันการเบิกจ่าย",
    },
  };
}
