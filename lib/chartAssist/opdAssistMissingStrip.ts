/**
 * Compact “missing key data” hints for chat UI — pure, no I/O.
 */
import type { ClinicalInvestigationV1 } from "./clinicalInvestigationV1";

export type MissingDataStrip = {
  missing: string[];
  askNext: string[];
};

type PackMatch = {
  def?: { askNext?: string[] };
};

type AnalysisSnapshot = {
  assistantBundle?: {
    missingInfo?: string[];
    sectionHints?: {
      piMissing?: string[];
      peMissing?: string[];
    };
  };
  problemPackResolution?: {
    activeMatches?: PackMatch[];
  };
  investigations?: ClinicalInvestigationV1[];
  aiProblems?: {
    evidenceSupport?: { relation?: string; text?: string }[];
  }[];
};

function investigationNeedsDetail(x: ClinicalInvestigationV1): boolean {
  return !(
    x.summary?.trim() ||
    x.impression?.trim() ||
    x.rawText?.trim() ||
    (x.keyFindings && x.keyFindings.length > 0) ||
    x.status === "done" ||
    (x.bodyPart && x.bodyPart.trim()) ||
    (x.rate && x.rate.trim()) ||
    (x.rhythm && x.rhythm.trim()) ||
    (x.sttSummary && x.sttSummary.trim())
  );
}

function dedupeShort(items: string[], maxLen: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const s = raw.trim();
    if (!s || s.length > maxLen) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

const MAX_MISSING = 8;
const MAX_ASK = 4;
/** ~2 lines in UI: rough char budget for “+N more” truncation */
const STRIP_CHAR_BUDGET = 220;

/**
 * Merge rule/bundle hints, pack askNext, investigations, and evidence “missing”.
 */
export function buildMissingDataStrip(
  analysis: AnalysisSnapshot | null | undefined,
  _note?: unknown
): MissingDataStrip {
  if (!analysis) {
    return { missing: [], askNext: [] };
  }

  const missing: string[] = [];
  const askNext: string[] = [];

  const bundle = analysis.assistantBundle;
  if (bundle?.missingInfo?.length) {
    missing.push(...bundle.missingInfo.slice(0, 12));
  }
  if (bundle?.sectionHints?.piMissing?.length) {
    missing.push(...bundle.sectionHints.piMissing.slice(0, 6));
  }
  if (bundle?.sectionHints?.peMissing?.length) {
    missing.push(...bundle.sectionHints.peMissing.slice(0, 6));
  }

  const matches = analysis.problemPackResolution?.activeMatches ?? [];
  for (const m of matches.slice(0, 3)) {
    const qs = m.def?.askNext ?? [];
    askNext.push(...qs.slice(0, 2));
  }

  const inv = analysis.investigations ?? [];
  for (const x of inv) {
    if (investigationNeedsDetail(x)) {
      missing.push(`${x.label} (detail)`);
    }
  }

  for (const p of analysis.aiProblems ?? []) {
    for (const ev of p.evidenceSupport ?? []) {
      if (ev.relation === "missing" && ev.text?.trim()) {
        missing.push(ev.text.trim());
      }
    }
  }

  return {
    missing: dedupeShort(missing, 120).slice(0, MAX_MISSING),
    askNext: dedupeShort(askNext, 160).slice(0, MAX_ASK),
  };
}

export function formatMissingDataStripLines(strip: MissingDataStrip, opts?: { maxChars?: number }): {
  missingLine: string | null;
  askLine: string | null;
} {
  const maxChars = opts?.maxChars ?? STRIP_CHAR_BUDGET;

  function oneLine(prefix: string, items: string[]): string | null {
    if (!items.length) return null;
    let acc = prefix;
    for (let i = 0; i < items.length; i++) {
      const part = `${i === 0 ? "" : ", "}${items[i]}`;
      if (acc.length + part.length > maxChars - 6 && i > 0) {
        const rest = items.length - i;
        return `${acc} (+${rest})`;
      }
      acc += part;
      if (acc.length > maxChars) {
        return `${acc.slice(0, maxChars - 1)}…`;
      }
    }
    return acc;
  }

  return {
    missingLine: oneLine("Missing: ", strip.missing),
    askLine: oneLine("Ask next: ", strip.askNext),
  };
}
