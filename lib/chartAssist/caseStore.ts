import type { CaseDocument, TimelineEntry } from "./caseModel";
import {
  CASE_SCHEMA_VERSION,
  createEmptyCaseDocument,
  normalizeTimelineEntry,
} from "./caseModel";

const PREFIX = "chartAssist.case.v1:";
const LEGACY_PREFIX = "opdAssist.case.v1:";
const INDEX_KEY = "chartAssist.case.v1:index";
const LEGACY_INDEX_KEY = "opdAssist.case.v1:index";

function migrateCaseDocument(raw: CaseDocument): CaseDocument {
  const timeline: TimelineEntry[] = (raw.timeline ?? [])
    .map((e) => normalizeTimelineEntry(e))
    .filter((e): e is TimelineEntry => e !== null);
  return {
    ...raw,
    schemaVersion: CASE_SCHEMA_VERSION,
    timeline,
    attachments: raw.attachments ?? [],
    workspace: raw.workspace ?? {},
  };
}

function safeParse(raw: string | null): CaseDocument | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as CaseDocument;
    if (typeof v.caseId !== "string") return null;
    if (v.schemaVersion !== CASE_SCHEMA_VERSION) return null;
    return migrateCaseDocument(v);
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

function mergeIndexKeys(): string[] {
  if (typeof window === "undefined") return [];
  const next = safeParseIndex(localStorage.getItem(INDEX_KEY));
  const legacy = safeParseIndex(localStorage.getItem(LEGACY_INDEX_KEY));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...next, ...legacy]) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

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
      const cur = safeParse(localStorage.getItem(PREFIX + caseId));
      if (cur) return cur;
      const legacyDoc = safeParse(localStorage.getItem(LEGACY_PREFIX + caseId));
      if (legacyDoc) {
        localStorage.setItem(PREFIX + caseId, JSON.stringify(legacyDoc));
        return legacyDoc;
      }
      return null;
    },
    save(doc) {
      localStorage.setItem(PREFIX + doc.caseId, JSON.stringify(doc));
      const idx = mergeIndexKeys();
      const next = [doc.caseId, ...idx.filter((id) => id !== doc.caseId)].slice(0, 12);
      localStorage.setItem(INDEX_KEY, JSON.stringify(next));
    },
    listRecentIds(max = 12) {
      return mergeIndexKeys().slice(0, max);
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
  entryId?: string,
): CaseDocument {
  const now = new Date().toISOString();
  const entry: TimelineEntry = {
    entryId: entryId ?? crypto.randomUUID(),
    at: now,
    channel: "desktop",
    kind: "text",
    payload: { text: text.trim() },
  };
  return {
    ...doc,
    version: doc.version + 1,
    updatedAt: now,
    timeline: [...doc.timeline, entry],
  };
}
