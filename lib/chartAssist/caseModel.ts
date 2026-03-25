import type { AssistMode } from "./cardTypes";

export const CASE_SCHEMA_VERSION = 1;

export type TimelineEntry = {
  entryId: string;
  at: string;
  text: string;
};

export type CaseDocument = {
  schemaVersion: number;
  caseId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEntry[];
  modeOverride: AssistMode | null;
};

export function createEmptyCaseDocument(caseId: string): CaseDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: CASE_SCHEMA_VERSION,
    caseId,
    version: 1,
    createdAt: now,
    updatedAt: now,
    timeline: [],
    modeOverride: null,
  };
}

export function timelinePlainText(timeline: TimelineEntry[]): string {
  return timeline
    .map((e) => e.text.trim())
    .filter(Boolean)
    .join("\n");
}

export function deriveCaseTabLabel(doc: CaseDocument): string {
  const combined = timelinePlainText(doc.timeline);
  const ageMatch = combined.match(/(\d+)\s*(ปี|ขวบ|เดือน|ด\.|y|m|mo)\b/i);
  const agePart = ageMatch ? `${ageMatch[1]} ${ageMatch[2]}` : "";
  const first = doc.timeline[0]?.text.trim() || "";
  const snippetSource = first || combined || "เคสใหม่";
  const snippet =
    snippetSource.length > 32 ? `${snippetSource.slice(0, 32)}…` : snippetSource;
  if (agePart) return `${agePart} · ${snippet}`;
  return snippet;
}
