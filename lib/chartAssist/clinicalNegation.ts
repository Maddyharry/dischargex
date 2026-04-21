/**
 * Negation-aware substring matching for clinical keyword scoring.
 * If a cue appears after "no / denies / ไม่มี …" within a short window, it does not count as a positive hit.
 */

const NEGATION_WINDOW = 52;

/** Match at end of the text *before* a keyword hit (Thai + English charting) */
const NEGATION_BEFORE_KEY: RegExp[] = [
  /\bno\s+$/i,
  /\bnot\s+$/i,
  /\bwithout\s+$/i,
  /\bdenies\s+$/i,
  /\bdeny\s+$/i,
  /\bdenied\s+$/i,
  /\bnegative\s+for\s+$/i,
  /\babsent\s+$/i,
  /\bno\s+family\s+$/i,
  /\bno\s+household\s+$/i,
  /\bwithout\s+any\s+$/i,
  /ไม่มี\s*$/,
  /ไม่พบ\s*$/,
  /ปฏิเสธ\s*$/,
  /ไม่มีอาการ\s*$/,
  /ไม่มีคนในบ้าน\s*$/,
  /คนในบ้านไม่\s*$/,
];

/**
 * True if the match at `matchStart` is negated by wording immediately before it.
 */
export function isNegatedBefore(text: string, matchStart: number): boolean {
  if (matchStart < 0) return false;
  const winStart = Math.max(0, matchStart - NEGATION_WINDOW);
  const before = text.slice(winStart, matchStart);
  return NEGATION_BEFORE_KEY.some((re) => re.test(before));
}

/**
 * Count keyword hits; each occurrence that falls in a negated span is skipped.
 * Longer keys are processed first to reduce double-counting on overlapping substrings.
 */
export function scoreKeysNegationAware(text: string, keys: string[]): number {
  const sorted = [...keys].sort((a, b) => b.length - a.length);
  const countedAt = new Set<number>();
  let total = 0;
  for (const k of sorted) {
    if (!k.length) continue;
    let from = 0;
    while (true) {
      const i = text.indexOf(k, from);
      if (i < 0) break;
      if (!countedAt.has(i) && !isNegatedBefore(text, i)) {
        countedAt.add(i);
        total += 1;
      }
      from = i + 1;
    }
  }
  return total;
}

/** Any key present at least once and not in a negated span */
export function hasAnyKeywordNonNegated(text: string, keys: string[]): boolean {
  const sorted = [...keys].sort((a, b) => b.length - a.length);
  for (const k of sorted) {
    if (!k.length) continue;
    let from = 0;
    while (true) {
      const i = text.indexOf(k, from);
      if (i < 0) break;
      if (!isNegatedBefore(text, i)) return true;
      from = i + 1;
    }
  }
  return false;
}

/**
 * True if regex matches at least once and some match is not negated (uses lastIndex-safe global exec).
 */
export function anyNonNegatedRegexMatch(text: string, re: RegExp): boolean {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const r = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null) {
    if (m.index !== undefined && !isNegatedBefore(text, m.index)) return true;
  }
  return false;
}
