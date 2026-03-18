import crypto from "crypto";

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordSet(text: string): Set<string> {
  const s = new Set<string>();
  for (const w of normalizeText(text).split(" ")) {
    if (!w) continue;
    if (w.length <= 2) continue;
    s.add(w);
  }
  return s;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const v of a) if (b.has(v)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function trigrams(text: string): Set<string> {
  const t = normalizeText(text).replace(/ /g, "");
  const out = new Set<string>();
  if (t.length < 3) return out;
  for (let i = 0; i <= t.length - 3; i += 1) {
    out.add(t.slice(i, i + 3));
  }
  return out;
}

export function similarityScore(a: string, b: string): number {
  // lightweight “semantic-ish”: combine token overlap + char n-gram overlap
  const token = jaccard(wordSet(a), wordSet(b));
  const tri = jaccard(trigrams(a), trigrams(b));
  return 0.55 * token + 0.45 * tri;
}

export function feedbackFingerprint(message: string, payloadStr: string | null): string {
  const base = `${normalizeText(message).slice(0, 400)}\n${payloadStr ? String(payloadStr).slice(0, 200) : ""}`;
  return crypto.createHash("sha256").update(base).digest("hex");
}

