import type { CaseDocument, TimelineEntry } from "./caseModel";
import { CASE_SCHEMA_VERSION, createEmptyCaseDocument } from "./caseModel";

const PREFIX = "opdAssist.case.v1:";
const INDEX_KEY = "opdAssist.case.v1:index";

function safeParse(raw: string | null): CaseDocument | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as CaseDocument;
    if (v.schemaVersion !== CASE_SCHEMA_VERSION || typeof v.caseId !== "string") return null;
    return v;
  } catch {
    return null;
  }
}

function safeParseIndex(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export type CaseStore = {
  load(caseId: string): CaseDocument | null;
  save(doc: CaseDocument): void;
  listRecentIds(max?: number): string[];
};

export function createLocalStorageCaseStore(): CaseStore {
  if (typeof window === "undefined") {
    return {
      load: () => null,
      save: () => {},
      listRecentIds: () => [],
    };
  }

  return {
    load(caseId) {
      return safeParse(localStorage.getItem(PREFIX + caseId));
    },
    save(doc) {
      localStorage.setItem(PREFIX + doc.caseId, JSON.stringify(doc));
      const idx = safeParseIndex(localStorage.getItem(INDEX_KEY));
      const next = [doc.caseId, ...idx.filter((id) => id !== doc.caseId)].slice(0, 12);
      localStorage.setItem(INDEX_KEY, JSON.stringify(next));
    },
    listRecentIds(max = 12) {
      return safeParseIndex(localStorage.getItem(INDEX_KEY)).slice(0, max);
    },
  };
}

export function ensureCaseInStore(store: CaseStore, caseId: string): CaseDocument {
  const existing = store.load(caseId);
  if (existing) return existing;
  const doc = createEmptyCaseDocument(caseId);
  store.save(doc);
  return doc;
}

export function appendTimelineEntry(
  doc: CaseDocument,
  text: string,
  entryId?: string
): CaseDocument {
  const now = new Date().toISOString();
  const entry: TimelineEntry = {
    entryId: entryId ?? crypto.randomUUID(),
    at: now,
    text: text.trim(),
  };
  return {
    ...doc,
    version: doc.version + 1,
    updatedAt: now,
    timeline: [...doc.timeline, entry],
  };
}
