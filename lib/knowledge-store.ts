import { prisma } from "@/lib/prisma";
import { DISEASE_SUMMARIES, type DiseaseSummary } from "@/lib/clinical-knowledge";

const KNOWLEDGE_OVERRIDE_KEY = "knowledge_overrides_v1";
const KNOWLEDGE_DYNAMIC_KEY = "knowledge_dynamic_entries_v1";
const KNOWLEDGE_PENDING_KEY = "knowledge_pending_entries_v1";
const KNOWLEDGE_SUPPLEMENT_KEY = "knowledge_topic_supplements_v1";

type KnowledgeOverride = {
  slug: string;
  deprecated?: boolean;
  version?: string;
  effectiveDate?: string;
};

export type PendingKnowledgeEntry = {
  id: string;
  question: string;
  suggestedTitle: string;
  draftSummary: string;
  refs: string[];
  externalSources?: Array<{ title: string; url: string; sourceName: string }>;
  icd10Candidates?: string[];
  createdAt: string;
};

type KnowledgeSupplement = {
  diagnosisToWrite: string[];
  thinkWhen: string[];
  considerMore: string[];
  investigations: string[];
  icd10: string[];
  refs: string[];
  updatedAt: string;
};

export type PendingKnowledgeGap = {
  id: string;
  topicKey: string;
  suggestedTitle: string;
  summary: string;
  questionCount: number;
  sampleQuestions: string[];
  refs: string[];
  icd10Candidates: string[];
  externalSources: Array<{ title: string; url: string; sourceName: string }>;
  createdAt: string;
  lastSeenAt: string;
  suggestedAction: "new_topic" | "expand_topic";
  candidateTargetSlugs: string[];
  priorityScore: number;
  priorityTier: "high" | "review_later";
};

function normalizeSlug(input: string) {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9ก-๙\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  return cleaned.slice(0, 64) || `topic-${Date.now()}`;
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

function toIsoDate(input: string | undefined) {
  const dt = input ? new Date(input) : new Date();
  return Number.isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
}

function pickTopBullets(text: string, limit = 5) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("-") || s.startsWith("•"))
    .map((s) => s.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function summarizeDraft(entry: PendingKnowledgeEntry) {
  const bullets = pickTopBullets(entry.draftSummary, 4);
  if (bullets.length) return bullets.join("\n");
  return entry.draftSummary.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 2).join("\n");
}

function mergeUniqueLimited(base: string[], incoming: string[], max = 20) {
  return uniq([...base, ...incoming.map((x) => x.trim()).filter(Boolean)]).slice(0, max);
}

function isLowSignalQuestion(question: string) {
  const q = question.trim().toLowerCase();
  if (!q) return true;
  if (q.length < 12) return true;
  if (/^(ขอละเอียด|ละเอียดเลย|ช่วยอธิบาย|ต่อ|เพิ่มเติม|แล้วถ้า|ถ้าอย่างนั้น|อีกข้อ|ครับ|ค่ะ|โอเค|ได้ไหม)/i.test(q)) {
    return true;
  }
  const containsClinicalSignal =
    /(ไข้|ปวด|เจ็บ|เหนื่อย|หอบ|ชัก|อาเจียน|ถ่าย|งู|พิษ|sepsis|stroke|mi|copd|asthma|diabetes|ht|htn|ckd|renal|antivenom|icd|diagnosis|investigation|lab|ยา|dose|dosing)/i.test(
      q
    );
  return !containsClinicalSignal;
}

function calculateGapPriorityScore(params: {
  questionCount: number;
  hasIcd10: boolean;
  hasExternalSources: boolean;
  hasCandidateTargets: boolean;
  summary: string;
  sampleQuestions: string[];
}) {
  let score = 0;
  score += Math.min(4, params.questionCount);
  if (params.hasIcd10) score += 2;
  if (params.hasExternalSources) score += 2;
  if (params.hasCandidateTargets) score += 1;
  if (pickTopBullets(params.summary, 3).length > 0) score += 1;
  const lowSignalCount = params.sampleQuestions.filter((q) => isLowSignalQuestion(q)).length;
  if (lowSignalCount > 0) score -= Math.min(2, lowSignalCount);
  return score;
}

const TOPIC_KEYWORDS: Array<{ key: string; title: string; pattern: RegExp }> = [
  { key: "snakebite-envenomation", title: "Snakebite envenomation", pattern: /(งู|snake|envenomation|antivenom|anti-venom|cobra|viper|krait)/i },
  { key: "anaphylaxis", title: "Anaphylaxis", pattern: /(anaphylaxis|แพ้รุนแรง|ช็อกจากแพ้|allergic shock)/i },
  { key: "sepsis", title: "Sepsis", pattern: /(sepsis|septic|ติดเชื้อรุนแรง|ช็อกจากการติดเชื้อ)/i },
];

function deriveTopicSignature(entry: PendingKnowledgeEntry) {
  const signal = [entry.suggestedTitle, entry.question, entry.draftSummary, ...(entry.icd10Candidates || [])].join("\n");
  const byKeyword = TOPIC_KEYWORDS.find((row) => row.pattern.test(signal));
  if (byKeyword) {
    return { key: byKeyword.key, title: byKeyword.title };
  }
  const icd = (entry.icd10Candidates || []).find((code) => /^[A-Z]\d{1,2}(\.\d+)?$/i.test(code.trim()));
  if (icd) {
    return { key: `icd10-${icd.toLowerCase()}`, title: `ICD-10 ${icd.toUpperCase()}` };
  }
  const title = (entry.suggestedTitle || entry.question).trim();
  return { key: normalizeSlug(title), title: title.slice(0, 80) || "Untitled knowledge gap" };
}

function parseRefs(text: string) {
  const refs = text.match(/\[R\d+\]/g) || [];
  return uniq(refs.map((r) => r.replace("[", "").replace("]", "")));
}

function parseDraftToDisease(entry: PendingKnowledgeEntry): DiseaseSummary {
  const lines = entry.draftSummary
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const bullets = lines
    .filter((s) => s.startsWith("-") || s.startsWith("•"))
    .map((s) => s.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
  const defaultBullet = `ตรวจทานเพิ่มเติมจากคำถาม: ${entry.question}`;
  const diagnosisToWrite = bullets.slice(0, 4);
  const thinkWhen = bullets.slice(4, 8);

  return {
    slug: normalizeSlug(entry.suggestedTitle || entry.question),
    name: entry.suggestedTitle || entry.question.slice(0, 80),
    version: new Date(entry.createdAt).toISOString().slice(0, 10),
    effectiveDate: new Date(entry.createdAt).toISOString().slice(0, 10),
    deprecated: false,
    aliases: [],
    diagnosisToWrite: diagnosisToWrite.length ? diagnosisToWrite : [defaultBullet],
    thinkWhen: thinkWhen.length ? thinkWhen : [defaultBullet],
    considerMore: [`สรุปจากคำถามผู้ใช้: ${entry.question.slice(0, 180)}`],
    notYetDiagnosis: ["ยังไม่ควรลงวินิจฉัยแบบฟันธง หากยังไม่มีหลักฐานจากเอกสารมาตรฐานที่เพียงพอ"],
    investigations: ["ตรวจสอบหลักฐานจากเวชระเบียนและ guideline ต้นทางก่อนลงรหัส"],
    icd10: [],
    seeAlso: [],
    refs: entry.refs,
  };
}

function parseDraftToSupplement(entry: PendingKnowledgeEntry): Omit<KnowledgeSupplement, "updatedAt"> {
  const bullets = pickTopBullets(entry.draftSummary, 8);
  const fallback = `เติมความรู้จากคำถามผู้ใช้: ${entry.question}`.slice(0, 220);
  const keyPoints = bullets.length ? bullets : [fallback];
  return {
    diagnosisToWrite: keyPoints.slice(0, 4),
    thinkWhen: keyPoints.slice(4, 8).length ? keyPoints.slice(4, 8) : keyPoints.slice(0, 2),
    considerMore: [`ประเด็นเพิ่มเติม: ${entry.question.slice(0, 200)}`],
    investigations: keyPoints.filter((x) => /(ตรวจ|cbc|coag|renal|bun|creatin|x-ray|ct|mri|lab|investigation)/i.test(x)).slice(0, 4),
    icd10: (entry.icd10Candidates || []).slice(0, 8),
    refs: entry.refs || [],
  };
}

async function getJsonSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  if (!row?.value) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

async function setJsonSetting<T>(key: string, value: T) {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
}

export async function getKnowledgeOverrides(): Promise<Record<string, KnowledgeOverride>> {
  const parsed = await getJsonSetting<Record<string, KnowledgeOverride>>(KNOWLEDGE_OVERRIDE_KEY, {});
  return parsed && typeof parsed === "object" ? parsed : {};
}

async function getKnowledgeSupplements(): Promise<Record<string, KnowledgeSupplement>> {
  const parsed = await getJsonSetting<Record<string, KnowledgeSupplement>>(KNOWLEDGE_SUPPLEMENT_KEY, {});
  return parsed && typeof parsed === "object" ? parsed : {};
}

async function setKnowledgeSupplements(value: Record<string, KnowledgeSupplement>) {
  await setJsonSetting(KNOWLEDGE_SUPPLEMENT_KEY, value);
}

function inferCandidateTargetSlugs(entry: PendingKnowledgeEntry, knowledge: DiseaseSummary[]) {
  const signal = [entry.question, entry.suggestedTitle, entry.draftSummary, ...(entry.icd10Candidates || [])].join(" ").toLowerCase();
  return knowledge
    .map((topic) => {
      const tokens = [topic.name, ...topic.aliases, ...topic.icd10].map((x) => x.toLowerCase());
      const score = tokens.reduce((acc, token) => (token && signal.includes(token) ? acc + 1 : acc), 0);
      return { slug: topic.slug, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.slug);
}

export async function getPendingKnowledgeGaps(): Promise<PendingKnowledgeGap[]> {
  const pending = await getPendingKnowledgeEntries();
  const knowledge = await getMergedKnowledge(true);
  const grouped = new Map<
    string,
    {
      entries: PendingKnowledgeEntry[];
      title: string;
      candidateTargetSlugs: string[];
      refs: string[];
      icd10: string[];
      externalSources: Array<{ title: string; url: string; sourceName: string }>;
    }
  >();

  for (const entry of pending) {
    const sign = deriveTopicSignature(entry);
    const suggestTargets = inferCandidateTargetSlugs(entry, knowledge);
    const current = grouped.get(sign.key);
    if (!current) {
      grouped.set(sign.key, {
        entries: [entry],
        title: sign.title,
        candidateTargetSlugs: suggestTargets,
        refs: [...(entry.refs || [])],
        icd10: [...(entry.icd10Candidates || [])],
        externalSources: [...(entry.externalSources || [])],
      });
      continue;
    }
    current.entries.push(entry);
    current.candidateTargetSlugs = mergeUniqueLimited(current.candidateTargetSlugs, suggestTargets, 8);
    current.refs = mergeUniqueLimited(current.refs, entry.refs || [], 12);
    current.icd10 = mergeUniqueLimited(current.icd10, entry.icd10Candidates || [], 12);
    const ext = [...current.externalSources, ...(entry.externalSources || [])];
    const extByUrl = new Map<string, { title: string; url: string; sourceName: string }>();
    for (const src of ext) {
      if (!src?.url) continue;
      if (!extByUrl.has(src.url)) extByUrl.set(src.url, src);
    }
    current.externalSources = Array.from(extByUrl.values()).slice(0, 8);
  }

  const prioritized = Array.from(grouped.entries())
    .map(([topicKey, row]) => {
      const sortedEntries = row.entries
        .slice()
        .sort((a, b) => toIsoDate(b.createdAt).localeCompare(toIsoDate(a.createdAt)));
      const first = sortedEntries[sortedEntries.length - 1];
      const latest = sortedEntries[0];
      const summary = summarizeDraft(latest);
      const suggestedAction: "new_topic" | "expand_topic" = row.candidateTargetSlugs.length ? "expand_topic" : "new_topic";
      return {
        id: `gap-${topicKey}`,
        topicKey,
        suggestedTitle: row.title,
        summary,
        questionCount: row.entries.length,
        sampleQuestions: uniq(sortedEntries.map((x) => x.question).slice(0, 3)),
        refs: row.refs,
        icd10Candidates: row.icd10,
        externalSources: row.externalSources,
        createdAt: toIsoDate(first?.createdAt),
        lastSeenAt: toIsoDate(latest?.createdAt),
        suggestedAction,
        candidateTargetSlugs: row.candidateTargetSlugs,
        priorityScore: 0,
        priorityTier: "review_later",
      } satisfies PendingKnowledgeGap;
    })
    .map((gap) => ({
      gap,
      score: calculateGapPriorityScore({
        questionCount: gap.questionCount,
        hasIcd10: gap.icd10Candidates.length > 0,
        hasExternalSources: gap.externalSources.length > 0,
        hasCandidateTargets: gap.candidateTargetSlugs.length > 0,
        summary: gap.summary,
        sampleQuestions: gap.sampleQuestions,
      }),
    }))
    .sort((a, b) => (b.score === a.score ? b.gap.lastSeenAt.localeCompare(a.gap.lastSeenAt) : b.score - a.score))
    .map(({ gap, score }) => {
      const high = score >= 3 || gap.questionCount >= 2;
      return {
        ...gap,
        priorityScore: score,
        priorityTier: high ? ("high" as const) : ("review_later" as const),
      } satisfies PendingKnowledgeGap;
    });

  return prioritized;
}

export async function getPendingKnowledgeEntries(): Promise<PendingKnowledgeEntry[]> {
  return getJsonSetting<PendingKnowledgeEntry[]>(KNOWLEDGE_PENDING_KEY, []);
}

export async function queuePendingKnowledgeEntry(
  question: string,
  draftSummary: string,
  meta?: {
    externalSources?: Array<{ title: string; url: string; sourceName: string }>;
    icd10Candidates?: string[];
  }
) {
  const q = question.trim();
  const draft = draftSummary.trim();
  if (!q || !draft) return null;
  const pending = await getPendingKnowledgeEntries();
  const duplicate = pending.find((x) => x.question.trim().toLowerCase() === q.toLowerCase());
  if (duplicate) return duplicate;

  const suggestedTitle = q.slice(0, 80);
  const entry: PendingKnowledgeEntry = {
    id: `kn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question: q,
    suggestedTitle,
    draftSummary: draft.slice(0, 4000),
    refs: parseRefs(draft),
    externalSources: meta?.externalSources?.slice(0, 8) || [],
    icd10Candidates: meta?.icd10Candidates?.slice(0, 15) || [],
    createdAt: new Date().toISOString(),
  };
  await setJsonSetting(KNOWLEDGE_PENDING_KEY, [entry, ...pending].slice(0, 300));
  return entry;
}

type ReviewPendingKnowledgeOptions = {
  publishMode?: "new_topic" | "expand_topic";
  targetSlug?: string;
  topicName?: string;
};

async function appendSupplementsToTopic(slug: string, entries: PendingKnowledgeEntry[]) {
  const allSupplements = await getKnowledgeSupplements();
  const current = allSupplements[slug] || {
    diagnosisToWrite: [],
    thinkWhen: [],
    considerMore: [],
    investigations: [],
    icd10: [],
    refs: [],
    updatedAt: new Date().toISOString(),
  };
  let merged = { ...current };
  for (const entry of entries) {
    const patch = parseDraftToSupplement(entry);
    merged = {
      ...merged,
      diagnosisToWrite: mergeUniqueLimited(merged.diagnosisToWrite, patch.diagnosisToWrite, 20),
      thinkWhen: mergeUniqueLimited(merged.thinkWhen, patch.thinkWhen, 20),
      considerMore: mergeUniqueLimited(merged.considerMore, patch.considerMore, 20),
      investigations: mergeUniqueLimited(merged.investigations, patch.investigations, 20),
      icd10: mergeUniqueLimited(merged.icd10, patch.icd10, 20),
      refs: mergeUniqueLimited(merged.refs, patch.refs, 20),
      updatedAt: new Date().toISOString(),
    };
  }
  allSupplements[slug] = merged;
  await setKnowledgeSupplements(allSupplements);
}

async function publishAsNewTopic(entries: PendingKnowledgeEntry[], topicName?: string) {
  const dynamic = await getJsonSetting<PendingKnowledgeEntry[]>(KNOWLEDGE_DYNAMIC_KEY, []);
  const latest = entries
    .slice()
    .sort((a, b) => toIsoDate(b.createdAt).localeCompare(toIsoDate(a.createdAt)))[0];
  const mergedQuestion = uniq(entries.map((x) => x.question)).join(" | ").slice(0, 500);
  const mergedDraft = entries.map((x) => summarizeDraft(x)).filter(Boolean).join("\n").slice(0, 3500);
  const mergedEntry: PendingKnowledgeEntry = {
    ...latest,
    id: `dyn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question: mergedQuestion || latest.question,
    suggestedTitle: (topicName || deriveTopicSignature(latest).title || latest.suggestedTitle).slice(0, 80),
    draftSummary: mergedDraft || latest.draftSummary,
    refs: mergeUniqueLimited([], entries.flatMap((x) => x.refs || []), 20),
    icd10Candidates: mergeUniqueLimited([], entries.flatMap((x) => x.icd10Candidates || []), 20),
    externalSources: entries.flatMap((x) => x.externalSources || []).slice(0, 8),
    createdAt: new Date().toISOString(),
  };
  const merged = [mergedEntry, ...dynamic];
  await setJsonSetting(KNOWLEDGE_DYNAMIC_KEY, merged.slice(0, 300));
}

export async function reviewPendingKnowledgeEntry(id: string, action: "approve" | "reject", options?: ReviewPendingKnowledgeOptions) {
  const pending = await getPendingKnowledgeEntries();
  const target = pending.find((x) => x.id === id);
  if (!target) return { ok: false as const };
  const remain = pending.filter((x) => x.id !== id);
  await setJsonSetting(KNOWLEDGE_PENDING_KEY, remain);
  if (action === "reject") return { ok: true as const, published: false };
  if (options?.publishMode === "expand_topic" && options?.targetSlug) {
    await appendSupplementsToTopic(options.targetSlug, [target]);
    return { ok: true as const, published: true };
  }
  await publishAsNewTopic([target], options?.topicName);
  return { ok: true as const, published: true };
}

export async function reviewPendingKnowledgeGap(gapId: string, action: "approve" | "reject", options?: ReviewPendingKnowledgeOptions) {
  const pending = await getPendingKnowledgeEntries();
  const gaps = await getPendingKnowledgeGaps();
  const gap = gaps.find((x) => x.id === gapId);
  if (!gap) return { ok: false as const };
  const topicEntryIds = new Set(
    pending.filter((entry) => deriveTopicSignature(entry).key === gap.topicKey).map((entry) => entry.id)
  );
  const targetEntries = pending.filter((entry) => topicEntryIds.has(entry.id));
  if (!targetEntries.length) return { ok: false as const };
  const remain = pending.filter((entry) => !topicEntryIds.has(entry.id));
  await setJsonSetting(KNOWLEDGE_PENDING_KEY, remain);
  if (action === "reject") return { ok: true as const, published: false, count: targetEntries.length };

  if (options?.publishMode === "expand_topic" && options?.targetSlug) {
    await appendSupplementsToTopic(options.targetSlug, targetEntries);
    return { ok: true as const, published: true, count: targetEntries.length };
  }
  await publishAsNewTopic(targetEntries, options?.topicName || gap.suggestedTitle);
  return { ok: true as const, published: true, count: targetEntries.length };
}

export async function getDynamicKnowledgeAsDiseaseSummaries(): Promise<DiseaseSummary[]> {
  const dynamic = await getJsonSetting<PendingKnowledgeEntry[]>(KNOWLEDGE_DYNAMIC_KEY, []);
  return dynamic.map(parseDraftToDisease);
}

export async function getMergedKnowledge(includeDeprecated = false): Promise<DiseaseSummary[]> {
  const overrides = await getKnowledgeOverrides();
  const supplements = await getKnowledgeSupplements();
  const dynamic = await getDynamicKnowledgeAsDiseaseSummaries();
  const merged = [...dynamic, ...DISEASE_SUMMARIES].map((item) => {
    const ov = overrides[item.slug] || {};
    const supplement = supplements[item.slug];
    return {
      ...item,
      diagnosisToWrite: mergeUniqueLimited(item.diagnosisToWrite || [], supplement?.diagnosisToWrite || [], 20),
      thinkWhen: mergeUniqueLimited(item.thinkWhen || [], supplement?.thinkWhen || [], 20),
      considerMore: mergeUniqueLimited(item.considerMore || [], supplement?.considerMore || [], 20),
      investigations: mergeUniqueLimited(item.investigations || [], supplement?.investigations || [], 20),
      icd10: mergeUniqueLimited(item.icd10 || [], supplement?.icd10 || [], 20),
      refs: mergeUniqueLimited(item.refs || [], supplement?.refs || [], 20),
      deprecated: ov.deprecated ?? item.deprecated ?? false,
      version: ov.version ?? item.version ?? "2026.04",
      effectiveDate: ov.effectiveDate ?? supplement?.updatedAt?.slice(0, 10) ?? item.effectiveDate ?? "2026-04-21",
    };
  });
  return includeDeprecated ? merged : merged.filter((x) => !x.deprecated);
}

export async function updateKnowledgeOverride(slug: string, patch: KnowledgeOverride) {
  const current = await getKnowledgeOverrides();
  current[slug] = {
    ...(current[slug] || {}),
    ...patch,
    slug,
  };
  await setJsonSetting(KNOWLEDGE_OVERRIDE_KEY, current);
}

