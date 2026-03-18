const patterns: RegExp[] = [
  /\bHN\s*:\s*\w+\b/gi,
  /\bAN\s*:\s*\w+\b/gi,
  /\bCID\s*:\s*\d{10,13}\b/gi,
  /\b\d{13}\b/g,
  /(นาย|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.)\s*[ก-๙]+\s*[ก-๙]+/g,
  /\b0\d{1,2}-?\d{3}-?\d{4}\b/g,
];

export function deidentify(text: string) {
  let t = text.replace(/\s+/g, " ").trim();
  for (const p of patterns) t = t.replace(p, "[REDACTED]");
  return t;
}