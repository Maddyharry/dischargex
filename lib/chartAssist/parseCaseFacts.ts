import type { AssistMode, ParsedCaseFact } from "./cardTypes";

export function normalizeClinicalText(raw: string): string {
  return raw.normalize("NFC").replace(/[A-Z]/g, (c) => c.toLowerCase());
}

export function buildParsedCaseFact(
  rawText: string,
  mode: AssistMode = "OPD"
): ParsedCaseFact {
  return {
    rawText,
    normalizedText: normalizeClinicalText(rawText),
    mode,
  };
}
