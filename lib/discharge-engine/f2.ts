export type F2RawEntry = {
  cc_code?: string;
  cc_label?: string;
  principal_exclusions?: string[];
  same_as?: string;
  note?: string;
};

export type F2RawBundle = {
  version?: string;
  source?: string;
  entries?: F2RawEntry[];
};

export type F2ExclusionEntry = {
  ccCode: string;
  ccLabel: string;
  principalExclusions: string[];
  source: string;
  note: string;
};

export type F2ExclusionHit = {
  pdxIcd10: string;
  sdxIcd10: string;
  ccCode: string;
  ccLabel: string;
  source: string;
};

export function normalizeIcd10Token(v: string): string {
  return (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeExclusionToken(v: string): string {
  const raw = String(v || "").toUpperCase().replace(/\s+/g, "");
  const dash = raw.indexOf("-");
  if (dash <= 0 || dash >= raw.length - 1) return normalizeIcd10Token(raw);
  const start = normalizeIcd10Token(raw.slice(0, dash));
  const end = normalizeIcd10Token(raw.slice(dash + 1));
  if (!start || !end) return "";
  return `${start}-${end}`;
}

function uniqueIcdCodes(v: string[]): string[] {
  const out: string[] = [];
  for (const item of v) {
    const n = normalizeIcd10Token(item);
    if (!n) continue;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

function uniqueExclusionTokens(v: string[]): string[] {
  const out: string[] = [];
  for (const item of v) {
    const n = normalizeExclusionToken(item);
    if (!n) continue;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

function extractExclusionTokens(line: string): string[] {
  const tokens: string[] = [];
  const re = /([A-Z][0-9][A-Z0-9]{1,5})(?:\s*-\s*([A-Z][0-9][A-Z0-9]{1,5}))?/g;
  let m: RegExpExecArray | null = null;
  while ((m = re.exec((line || "").toUpperCase())) !== null) {
    const start = normalizeIcd10Token(m[1] || "");
    const end = normalizeIcd10Token(m[2] || "");
    if (!start) continue;
    if (end) tokens.push(`${start}-${end}`);
    else tokens.push(start);
  }
  return tokens;
}

function looksLikeCcCodeLine(line: string): boolean {
  return /^[A-Z][0-9][A-Z0-9]{1,5}\s+/.test((line || "").trim());
}

function isLikelyExclusionLine(line: string): boolean {
  const stripped = (line || "")
    .toUpperCase()
    .replace(/([A-Z][0-9][A-Z0-9]{1,5})(?:\s*-\s*([A-Z][0-9][A-Z0-9]{1,5}))?/g, "")
    .replace(/[\s,.;:()[\]-]/g, "");
  return stripped.length === 0;
}

export function parseF2AppendixText(text: string): F2RawEntry[] {
  const entries: F2RawEntry[] = [];
  let current: F2RawEntry | null = null;

  const lines = (text || "").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = (rawLine || "").trim();
    if (!line) continue;
    if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line)) continue;
    if (/^Appendix F2/i.test(line)) continue;
    if (/^Thai DRG Version/i.test(line)) continue;
    if (/^\d+$/.test(line)) continue;

    const sameAsMatch = line.match(/^the same as\s+([A-Z][0-9][A-Z0-9]{1,5})/i);
    if (sameAsMatch && current) {
      current.same_as = normalizeIcd10Token(sameAsMatch[1]);
      continue;
    }

    if (current && isLikelyExclusionLine(line)) {
      const tokens = extractExclusionTokens(line);
      current.principal_exclusions = uniqueExclusionTokens([
        ...(current.principal_exclusions || []),
        ...tokens,
      ]);
      continue;
    }

    if (looksLikeCcCodeLine(line)) {
      const m = line.match(/^([A-Z][0-9][A-Z0-9]{1,5})\s+(.+)$/);
      if (!m) continue;
      current = {
        cc_code: normalizeIcd10Token(m[1]),
        cc_label: (m[2] || "").trim(),
        principal_exclusions: [],
      };
      entries.push(current);
      continue;
    }

    if (!current) continue;
    const tokens = extractExclusionTokens(line);
    if (!tokens.length) {
      if (current.cc_label && !current.cc_label.endsWith("-") && line.length < 80) {
        current.cc_label = `${current.cc_label} ${line}`.replace(/\s+/g, " ").trim();
      }
      continue;
    }
    current.principal_exclusions = uniqueExclusionTokens([
      ...(current.principal_exclusions || []),
      ...tokens,
    ]);
  }

  const filtered = entries.filter((e) => e.cc_code && e.cc_label);

  // F2 note: for consecutive CC codes sharing the same exclusion list,
  // "the same as ..." may appear only on the last code of the series.
  for (let i = 0; i < filtered.length; i++) {
    const row = filtered[i];
    const sameAs = normalizeIcd10Token(String(row.same_as || ""));
    if (!sameAs) continue;
    for (let j = i - 1; j >= 0; j--) {
      const prev = filtered[j];
      const hasOwnRules = Array.isArray(prev.principal_exclusions) && prev.principal_exclusions.length > 0;
      const hasSameAs = !!normalizeIcd10Token(String(prev.same_as || ""));
      if (hasOwnRules || hasSameAs) break;
      prev.same_as = sameAs;
    }
  }

  return filtered;
}

export function resolveF2Entries(rawBundle: F2RawBundle): F2ExclusionEntry[] {
  const source = String(rawBundle.source || "TDRG 6.3.3 Appendix F2");
  const rawEntries = Array.isArray(rawBundle.entries) ? rawBundle.entries : [];
  const byCode = new Map<string, F2RawEntry>();
  for (const row of rawEntries) {
    const code = normalizeIcd10Token(String(row.cc_code || ""));
    if (!code) continue;
    if (!byCode.has(code)) byCode.set(code, row);
  }

  const resolving = new Set<string>();
  const cache = new Map<string, string[]>();

  const resolvePrincipalExclusions = (code: string): string[] => {
    if (cache.has(code)) return cache.get(code) || [];
    if (resolving.has(code)) return [];
    resolving.add(code);

    const row = byCode.get(code);
    if (!row) {
      resolving.delete(code);
      return [];
    }

    const exclusions: string[] = [];
    const direct = Array.isArray(row.principal_exclusions) ? row.principal_exclusions : [];
    exclusions.push(...direct.map((x) => String(x)));

    const sameAsCode = normalizeIcd10Token(String(row.same_as || ""));
    if (sameAsCode && sameAsCode !== code) {
      exclusions.push(...resolvePrincipalExclusions(sameAsCode));
    }

    const normalized = uniqueExclusionTokens(exclusions);
    cache.set(code, normalized);
    resolving.delete(code);
    return normalized;
  };

  const output: F2ExclusionEntry[] = [];
  for (const [ccCode, row] of byCode) {
    output.push({
      ccCode,
      ccLabel: String(row.cc_label || ccCode),
      principalExclusions: resolvePrincipalExclusions(ccCode),
      source,
      note: String(row.note || ""),
    });
  }
  return output;
}

function expandRangeToken(token: string): { start: string; end: string } | null {
  const cleaned = (token || "").toUpperCase().replace(/\s+/g, "");
  const dash = cleaned.indexOf("-");
  if (dash <= 0 || dash >= cleaned.length - 1) return null;
  const start = normalizeIcd10Token(cleaned.slice(0, dash));
  const end = normalizeIcd10Token(cleaned.slice(dash + 1));
  if (!start || !end) return null;
  return { start, end };
}

function isIcd10InRange(code: string, start: string, end: string): boolean {
  const target = normalizeIcd10Token(code);
  if (!target) return false;
  const maxLen = Math.max(target.length, start.length, end.length);
  const targetPad = target.padEnd(maxLen, "0");
  const startPad = start.padEnd(maxLen, "0");
  const endPad = end.padEnd(maxLen, "Z");
  return targetPad >= startPad && targetPad <= endPad;
}

function matchesPrincipalExclusion(pdxIcd10: string, token: string): boolean {
  const normalizedPdx = normalizeIcd10Token(pdxIcd10);
  const normalizedToken = normalizeIcd10Token(token);
  if (!normalizedPdx || !normalizedToken) return false;

  const range = expandRangeToken(token);
  if (range) return isIcd10InRange(normalizedPdx, range.start, range.end);

  return normalizedPdx.startsWith(normalizedToken);
}

function normalizeIcd10List(input: string[]): string[] {
  return uniqueIcdCodes(input.flatMap((v) => String(v || "").split(",")));
}

/** Longest-prefix match: F2 lists specific CC codes; shorter prefixes must not win. */
export function sortF2EntriesForLookup(entries: F2ExclusionEntry[]): F2ExclusionEntry[] {
  return [...entries].sort((a, b) => b.ccCode.length - a.ccCode.length);
}

function findF2EntryForSdx(sdxIcd10: string, sortedByLengthDesc: F2ExclusionEntry[]): F2ExclusionEntry | undefined {
  for (const row of sortedByLengthDesc) {
    if (sdxIcd10.startsWith(row.ccCode)) return row;
  }
  return undefined;
}

export function evaluateF2CcExclusionsFromEntries(params: {
  principalIcd10List: string[];
  secondaryIcd10List: string[];
  entries: F2ExclusionEntry[];
}): F2ExclusionHit[] {
  const pdxList = normalizeIcd10List(params.principalIcd10List);
  const sdxList = normalizeIcd10List(params.secondaryIcd10List);
  if (!pdxList.length || !sdxList.length) return [];
  if (!params.entries.length) return [];

  const sorted = sortF2EntriesForLookup(params.entries);

  const hits: F2ExclusionHit[] = [];
  for (const sdxIcd10 of sdxList) {
    const entry = findF2EntryForSdx(sdxIcd10, sorted);
    if (!entry) continue;
    if (!entry.principalExclusions.length) continue;

    for (const pdxIcd10 of pdxList) {
      const excluded = entry.principalExclusions.some((ruleToken) =>
        matchesPrincipalExclusion(pdxIcd10, ruleToken)
      );
      if (!excluded) continue;
      hits.push({
        pdxIcd10,
        sdxIcd10,
        ccCode: entry.ccCode,
        ccLabel: entry.ccLabel,
        source: entry.source,
      });
    }
  }

  const uniq = new Map<string, F2ExclusionHit>();
  for (const hit of hits) {
    const key = `${hit.pdxIcd10}|${hit.sdxIcd10}|${hit.ccCode}`;
    if (!uniq.has(key)) uniq.set(key, hit);
  }
  return [...uniq.values()];
}
