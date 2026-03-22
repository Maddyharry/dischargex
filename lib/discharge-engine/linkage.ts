import type { LinkageEdge } from "./types";

const LINKAGE_PATTERNS: Array<{
  re: RegExp;
  relation: string;
}> = [
  { re: /\b(?:due to|secondary to|caused by)\b/gi, relation: "causing" },
  { re: /\b(?:associated with|in the setting of)\b/gi, relation: "associated_with" },
  { re: /\b(?:with|from)\b/gi, relation: "associated_with" },
  { re: /\b(?:AKI on top of|on top of)\b/gi, relation: "superimposed_on" },
  { re: /\bHIV disease resulting in\b/gi, relation: "hiv_resulting_in" },
  { re: /\bhypertensive renal disease with\b/gi, relation: "combined_manifestation" },
];

/**
 * Lightweight linkage detector: finds explicit phrasing only.
 * Does not infer clinical causation without chart wording.
 */
export function detectLinkageInText(text: string): LinkageEdge[] {
  const t = text || "";
  if (t.length < 20) return [];

  const edges: LinkageEdge[] = [];
  const sentences = t.split(/[\n\r.]+/).map((s) => s.trim()).filter(Boolean);

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const { re, relation } of LINKAGE_PATTERNS) {
      re.lastIndex = 0;
      if (!re.test(sentence)) continue;

      const sep = lower.includes(" due to ")
        ? " due to "
        : lower.includes(" secondary to ")
        ? " secondary to "
        : lower.includes(" with ")
        ? " with "
        : lower.includes(" from ")
        ? " from "
        : null;

      if (sep) {
        const parts = sentence.split(new RegExp(sep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
        if (parts.length >= 2) {
          const source = parts[0].trim().slice(0, 120);
          const target = parts.slice(1).join(sep).trim().slice(0, 120);
          if (source.length > 2 && target.length > 2) {
            edges.push({
              source,
              relation,
              target,
              confidence: 0.75,
              kind: "explicit_wording",
            });
          }
        }
      }
    }
  }

  const dedup = new Map<string, LinkageEdge>();
  for (const e of edges) {
    const k = `${e.source}|${e.relation}|${e.target}`;
    if (!dedup.has(k)) dedup.set(k, e);
  }
  return Array.from(dedup.values()).slice(0, 40);
}
