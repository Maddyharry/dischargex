import type { AssistMode } from "./cardTypes";

export const CASE_SCHEMA_VERSION = 1;

/** V1 — reserve union for future mobile/voice/image */
export type InputChannel = "desktop";

/** V1 — reserve union for transcript/ocr later */
export type TimelineEntryKind = "text";

export type TimelinePayloadText = {
  text: string;
};

export type TimelineEntry = {
  entryId: string;
  at: string;
  channel: InputChannel;
  kind: TimelineEntryKind;
  payload: TimelinePayloadText;
};

/** Placeholder for future file / image refs */
export type CaseAttachmentStub = {
  attachmentId: string;
  kind: "placeholder";
  createdAt: string;
};

export type WorkspaceSectionId =
  | "cc"
  | "pi"
  | "pastHistory"
  | "pe"
  | "assessment"
  | "diagnosis"
  | "differential"
  | "plan"
  | "patientAdvice";

export type CaseWorkspace = Partial<Record<WorkspaceSectionId, string>>;

export type CaseDocument = {
  schemaVersion: number;
  caseId: string;
  /** Monotonic — reserved for optimistic locking / sync later */
  version: number;
  createdAt: string;
  updatedAt: string;
  timeline: TimelineEntry[];
  modeOverride: AssistMode | null;
  attachments: CaseAttachmentStub[];
  workspace: CaseWorkspace;
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
    attachments: [],
    workspace: {},
  };
}

/** Normalize legacy timeline rows (text-only) to V1 shape */
export function normalizeTimelineEntry(raw: unknown): TimelineEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  let entryId = typeof o.entryId === "string" ? o.entryId : "";
  const at = typeof o.at === "string" ? o.at : new Date().toISOString();
  if (!entryId) entryId = crypto.randomUUID();

  let text = "";
  if (typeof o.text === "string") text = o.text;
  else if (o.payload && typeof o.payload === "object" && typeof (o.payload as { text?: string }).text === "string") {
    text = (o.payload as { text: string }).text;
  }
  text = text.trim();

  return {
    entryId,
    at,
    channel: "desktop",
    kind: "text",
    payload: { text },
  };
}

export function timelinePlainText(timeline: TimelineEntry[]): string {
  return timeline
    .map((e) => e.payload.text.trim())
    .filter(Boolean)
    .join("\n");
}

export function deriveCaseTabLabel(doc: CaseDocument): string {
  const combined = timelinePlainText(doc.timeline);
  const ageMatch = combined.match(/(\d+)\s*(ปี|ขวบ|เดือน|ด\.|y|m|mo)\b/i);
  const agePart = ageMatch ? `${ageMatch[1]} ${ageMatch[2]}` : "";
  const first = doc.timeline[0]?.payload.text.trim() || "";
  const snippetSource = first || combined || "เคสใหม่";
  const snippet =
    snippetSource.length > 32 ? `${snippetSource.slice(0, 32)}…` : snippetSource;
  if (agePart) return `${agePart} · ${snippet}`;
  return snippet;
}
