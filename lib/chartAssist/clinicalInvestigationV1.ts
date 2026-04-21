/**
 * Investigations schema v1 — structured labs / imaging / ECG / bedside for hybrid OPD assist.
 *
 * Minimum fields (by modality) — enforced in post-normalization for validity; richer fields optional:
 * - **lab**: `investigationId`, `kind: "lab"`, `label`; prefer `summary` or `keyFindings` when results exist.
 * - **imaging** (incl. xray | ct | ultrasound | generic imaging): `investigationId`, `kind`, `label`;
 *   prefer `bodyPart` when known; when done, `impression` or `summary` or `keyFindings`.
 * - **ecg**: `investigationId`, `kind: "ecg"`, `label`; prefer `rate`, `rhythm`, `sttSummary` (or `summary`).
 * - **bedside**: `investigationId`, `kind: "bedside"`, `label`; `summary` or `keyFindings` as appropriate.
 */

export type ClinicalInvestigationKindV1 =
  | "lab"
  | "imaging"
  | "ecg"
  | "ultrasound"
  | "ct"
  | "xray"
  | "bedside";

export const CLINICAL_INVESTIGATION_KINDS_V1: readonly ClinicalInvestigationKindV1[] = [
  "lab",
  "imaging",
  "ecg",
  "ultrasound",
  "ct",
  "xray",
  "bedside",
] as const;

const KIND_SET = new Set<string>(CLINICAL_INVESTIGATION_KINDS_V1);

export type ClinicalInvestigationV1 = {
  investigationId: string;
  kind: ClinicalInvestigationKindV1;
  label: string;
  status?: "ordered" | "done" | "pending";
  priority?: "routine" | "urgent" | "critical";
  problemRefId?: string | null;

  rawText?: string;
  summary?: string;
  impression?: string;

  urgent?: boolean;

  bodyPart?: string;
  keyFindings?: string[];

  /** ECG-specific */
  rate?: string;
  rhythm?: string;
  sttSummary?: string;
};

/** Observability for hybrid pipeline — investigations[] presence and richness */
export type OpdAssistInvestigationsStatsV1 = {
  returned: boolean;
  count: number;
  /** Rows with at least one of: summary, impression, rawText, keyFindings, status done, bodyPart, ECG fields */
  completeCount: number;
  withProblemRefCount: number;
  byKind: Partial<Record<ClinicalInvestigationKindV1, number>>;
};

const MAX_INV = 32;
const MAX_ID = 128;
const MAX_LABEL = 240;
const MAX_STR = 4000;
const MAX_FINDINGS = 12;

function clampStr(s: unknown, max: number): string {
  const t = String(s ?? "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function coerceKind(raw: string, investigationId: string, warnings: string[]): ClinicalInvestigationKindV1 {
  const k = raw.trim().toLowerCase();
  if (KIND_SET.has(k)) return k as ClinicalInvestigationKindV1;
  warnings.push(`investigation ${investigationId}: unknown kind "${raw}" — coerced to "lab"`);
  return "lab";
}

/**
 * Normalize AI / JSON input; drops invalid rows. Empty array if missing or invalid.
 */
export function normalizeClinicalInvestigationsV1(raw: unknown, warnings: string[]): ClinicalInvestigationV1[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    warnings.push("investigations is not an array — discarded");
    return [];
  }
  const out: ClinicalInvestigationV1[] = [];
  for (const item of raw.slice(0, MAX_INV)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const investigationId = clampStr(o.investigationId, MAX_ID);
    const label = clampStr(o.label, MAX_LABEL);
    if (!investigationId || !label) {
      warnings.push("investigation row skipped — missing investigationId or label");
      continue;
    }
    const kind = coerceKind(String(o.kind ?? "lab"), investigationId, warnings);
    const row: ClinicalInvestigationV1 = {
      investigationId,
      kind,
      label,
    };
    const st = String(o.status ?? "").trim();
    if (st === "ordered" || st === "done" || st === "pending") row.status = st;
    const pr = String(o.priority ?? "").trim();
    if (pr === "routine" || pr === "urgent" || pr === "critical") row.priority = pr;
    if (o.problemRefId === null) row.problemRefId = null;
    else if (typeof o.problemRefId === "string" && o.problemRefId.trim()) row.problemRefId = o.problemRefId.trim();

    const rawText = clampStr(o.rawText, MAX_STR);
    const summary = clampStr(o.summary, MAX_STR);
    const impression = clampStr(o.impression, MAX_STR);
    if (rawText) row.rawText = rawText;
    if (summary) row.summary = summary;
    if (impression) row.impression = impression;
    if (o.urgent === true) row.urgent = true;

    const bodyPart = clampStr(o.bodyPart, 200);
    if (bodyPart) row.bodyPart = bodyPart;
    if (Array.isArray(o.keyFindings)) {
      const kf = o.keyFindings
        .map((x) => clampStr(x, 800))
        .filter(Boolean)
        .slice(0, MAX_FINDINGS);
      if (kf.length) row.keyFindings = kf;
    }
    if (kind === "ecg") {
      const rate = clampStr(o.rate, 80);
      const rhythm = clampStr(o.rhythm, 200);
      const sttSummary = clampStr(o.sttSummary, MAX_STR);
      if (rate) row.rate = rate;
      if (rhythm) row.rhythm = rhythm;
      if (sttSummary) row.sttSummary = sttSummary;
    }
    out.push(row);
  }
  return out;
}

function hasDetailRow(x: ClinicalInvestigationV1): boolean {
  return Boolean(
    x.summary?.trim() ||
      x.impression?.trim() ||
      x.rawText?.trim() ||
      (x.keyFindings && x.keyFindings.length > 0) ||
      x.status === "done" ||
      (x.bodyPart && x.bodyPart.trim()) ||
      (x.rate && x.rate.trim()) ||
      (x.rhythm && x.rhythm.trim()) ||
      (x.sttSummary && x.sttSummary.trim()),
  );
}

export function computeOpdAssistInvestigationsStatsV1(
  items: ClinicalInvestigationV1[],
): OpdAssistInvestigationsStatsV1 {
  const byKind: Partial<Record<ClinicalInvestigationKindV1, number>> = {};
  for (const x of items) {
    byKind[x.kind] = (byKind[x.kind] ?? 0) + 1;
  }
  let withProblemRefCount = 0;
  let completeCount = 0;
  for (const x of items) {
    if (x.problemRefId) withProblemRefCount += 1;
    if (hasDetailRow(x)) completeCount += 1;
  }
  return {
    returned: items.length > 0,
    count: items.length,
    completeCount,
    withProblemRefCount,
    byKind,
  };
}
