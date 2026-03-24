import fs from "node:fs";
import path from "node:path";

function normalizeIcd10Token(v) {
  return String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function normalizeExclusionToken(v) {
  const raw = String(v || "").toUpperCase().replace(/\s+/g, "");
  const dash = raw.indexOf("-");
  if (dash <= 0 || dash >= raw.length - 1) return normalizeIcd10Token(raw);
  const start = normalizeIcd10Token(raw.slice(0, dash));
  const end = normalizeIcd10Token(raw.slice(dash + 1));
  if (!start || !end) return "";
  return `${start}-${end}`;
}

function uniqueExclusionTokens(list) {
  const out = [];
  for (const item of list) {
    const n = normalizeExclusionToken(item);
    if (!n) continue;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

function extractExclusionTokens(line) {
  const out = [];
  const re = /([A-Z][0-9][A-Z0-9]{1,5})(?:\s*-\s*([A-Z][0-9][A-Z0-9]{1,5}))?/g;
  let m;
  while ((m = re.exec(String(line || "").toUpperCase())) !== null) {
    const start = normalizeIcd10Token(m[1]);
    const end = normalizeIcd10Token(m[2]);
    if (!start) continue;
    out.push(end ? `${start}-${end}` : start);
  }
  return out;
}

function looksLikeCodeLine(line) {
  return /^[A-Z][0-9][A-Z0-9]{1,5}\s+/.test(String(line || "").trim());
}

function isLikelyExclusionLine(line) {
  const stripped = String(line || "")
    .toUpperCase()
    .replace(/([A-Z][0-9][A-Z0-9]{1,5})(?:\s*-\s*([A-Z][0-9][A-Z0-9]{1,5}))?/g, "")
    .replace(/[\s,.;:()[\]-]/g, "");
  return stripped.length === 0;
}

function parseF2Text(text) {
  const entries = [];
  let current = null;
  const lines = String(text || "").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^--\s*\d+\s+of\s+\d+\s*--$/i.test(line)) continue;
    if (/^Appendix F2/i.test(line)) continue;
    if (/^Thai DRG Version/i.test(line)) continue;
    if (/^\d+$/.test(line)) continue;

    const sameAs = line.match(/^the same as\s+([A-Z][0-9][A-Z0-9]{1,5})/i);
    if (sameAs && current) {
      current.same_as = normalizeIcd10Token(sameAs[1]);
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

    if (looksLikeCodeLine(line)) {
      const m = line.match(/^([A-Z][0-9][A-Z0-9]{1,5})\s+(.+)$/);
      if (!m) continue;
      current = {
        cc_code: normalizeIcd10Token(m[1]),
        cc_label: String(m[2] || "").trim(),
        principal_exclusions: [],
      };
      entries.push(current);
      continue;
    }

    if (!current) continue;
    const tokens = extractExclusionTokens(line);
    if (tokens.length) {
      current.principal_exclusions = uniqueExclusionTokens([
        ...(current.principal_exclusions || []),
        ...tokens,
      ]);
      continue;
    }

    if (current.cc_label && !current.cc_label.endsWith("-") && line.length < 80) {
      current.cc_label = `${current.cc_label} ${line}`.replace(/\s+/g, " ").trim();
    }
  }

  const filtered = entries.filter((x) => x.cc_code && x.cc_label);
  for (let i = 0; i < filtered.length; i++) {
    const row = filtered[i];
    const sameAs = normalizeIcd10Token(row.same_as || "");
    if (!sameAs) continue;
    for (let j = i - 1; j >= 0; j--) {
      const prev = filtered[j];
      const hasOwnRules = Array.isArray(prev.principal_exclusions) && prev.principal_exclusions.length > 0;
      const hasSameAs = !!normalizeIcd10Token(prev.same_as || "");
      if (hasOwnRules || hasSameAs) break;
      prev.same_as = sameAs;
    }
  }
  return filtered;
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: node scripts/build-f2-exclusion-from-text.mjs <appendix-f2.txt>");
    process.exit(1);
  }
  const abs = path.resolve(inputPath);
  const rawText = fs.readFileSync(abs, "utf8");
  const entries = parseF2Text(rawText);
  const payload = {
    version: "TDRG-6.3.3-F2",
    source: `Thai DRG Appendix F2 (imported from ${path.basename(abs)})`,
    entries,
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main();
