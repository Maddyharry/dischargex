/**
 * Per-problem confidence / uncertainty / evidence (v1) — lightweight, human-readable.
 * refId may match `investigations[].investigationId` or echo `clinicalProblemId` for traceability (no span citations).
 */

export type ClinicalConfidenceLevelV1 = "high" | "medium" | "low" | "unknown";

export type EvidenceSupportKindV1 = "history" | "exam" | "investigation";

export type EvidenceSupportRelationV1 = "supports" | "against" | "missing";

export type EvidenceSupportItemV1 = {
  type: EvidenceSupportKindV1;
  /** Short human-readable line (Thai or mixed) */
  text: string;
  relation: EvidenceSupportRelationV1;
  /** Optional link: investigations[].investigationId or problem id */
  refId?: string | null;
};

const CONFIDENCE = new Set<string>(["high", "medium", "low", "unknown"]);
const EVID_TYPES = new Set<string>(["history", "exam", "investigation"]);
const RELATIONS = new Set<string>(["supports", "against", "missing"]);

export function normalizeConfidenceLevel(
  raw: unknown,
  warnings: string[],
): ClinicalConfidenceLevelV1 | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const s = String(raw).trim().toLowerCase();
  if (CONFIDENCE.has(s)) return s as ClinicalConfidenceLevelV1;
  warnings.push(`confidenceLevel invalid (${String(raw).slice(0, 40)}) — omitted`);
  return undefined;
}

export function normalizeUncertaintyReasons(raw: unknown, warnings: string[]): string[] | undefined {
  if (!Array.isArray(raw)) {
    if (raw !== undefined && raw !== null) warnings.push("uncertaintyReasons is not an array — omitted");
    return undefined;
  }
  const out = raw
    .map((x) => String(x).trim())
    .filter(Boolean)
    .map((x) => (x.length <= 400 ? x : `${x.slice(0, 399)}…`))
    .slice(0, 12);
  return out.length ? out : undefined;
}

export function normalizeEvidenceSupportItems(
  raw: unknown,
  warnings: string[],
): EvidenceSupportItemV1[] | undefined {
  if (!Array.isArray(raw)) {
    if (raw !== undefined && raw !== null) warnings.push("evidenceSupport is not an array — omitted");
    return undefined;
  }
  const out: EvidenceSupportItemV1[] = [];
  for (const item of raw.slice(0, 24)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const text = String(o.text ?? "").trim();
    if (!text) {
      warnings.push("evidenceSupport row skipped — empty text");
      continue;
    }
    const typeRaw = String(o.type ?? "history").trim().toLowerCase();
    let type: EvidenceSupportKindV1 = "history";
    if (EVID_TYPES.has(typeRaw)) type = typeRaw as EvidenceSupportKindV1;
    else if (typeRaw) warnings.push(`evidenceSupport.type "${typeRaw}" invalid — coerced to history`);

    const relRaw = String(o.relation ?? "supports").trim().toLowerCase();
    let relation: EvidenceSupportRelationV1 = "supports";
    if (RELATIONS.has(relRaw)) relation = relRaw as EvidenceSupportRelationV1;
    else if (relRaw) warnings.push(`evidenceSupport.relation "${relRaw}" invalid — coerced to supports`);

    const safeText = text.length <= 600 ? text : `${text.slice(0, 599)}…`;
    const row: EvidenceSupportItemV1 = { type, text: safeText, relation };
    if (o.refId === null) row.refId = null;
    else if (typeof o.refId === "string" && o.refId.trim()) {
      const r = o.refId.trim();
      row.refId = r.length <= 128 ? r : `${r.slice(0, 127)}…`;
    }
    out.push(row);
  }
  return out.length ? out : undefined;
}

export function summarizeProblemEvidenceForLog(problems: {
  confidenceLevel?: unknown;
  uncertaintyReasons?: unknown;
  evidenceSupport?: unknown;
}[]): {
  problemCount: number;
  withConfidence: number;
  withUncertainty: number;
  withEvidenceLines: number;
} {
  let withConfidence = 0;
  let withUncertainty = 0;
  let withEvidenceLines = 0;
  for (const p of problems) {
    if (p.confidenceLevel !== undefined && p.confidenceLevel !== null && String(p.confidenceLevel).trim())
      withConfidence += 1;
    if (Array.isArray(p.uncertaintyReasons) && p.uncertaintyReasons.length) withUncertainty += 1;
    if (Array.isArray(p.evidenceSupport) && p.evidenceSupport.length) withEvidenceLines += 1;
  }
  return {
    problemCount: problems.length,
    withConfidence,
    withUncertainty,
    withEvidenceLines,
  };
}
