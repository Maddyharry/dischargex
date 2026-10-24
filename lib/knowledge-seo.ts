import {
  DISEASE_SUMMARIES,
  KNOWLEDGE_REFERENCES,
  auditDiseaseCatalog,
  type DiseaseSummary,
  type KnowledgeReference,
} from "./clinical-knowledge";

export type PublicKnowledgeTopic = DiseaseSummary & { references: KnowledgeReference[] };

const referenceById = new Map(KNOWLEDGE_REFERENCES.map((reference) => [reference.id, reference]));
const issuesBySlug = new Map(auditDiseaseCatalog(DISEASE_SUMMARIES).issues.map((row) => [row.slug, row.issues]));

function toPublicTopic(topic: DiseaseSummary): PublicKnowledgeTopic | null {
  if (topic.deprecated || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.slug)) return null;
  if (issuesBySlug.has(topic.slug) || !topic.refs.length) return null;
  const references = topic.refs.map((id) => referenceById.get(id));
  if (references.some((reference) => !reference)) return null;
  return { ...topic, references: references as KnowledgeReference[] };
}

export function getPublicKnowledgeTopics(): PublicKnowledgeTopic[] {
  return DISEASE_SUMMARIES.map(toPublicTopic).filter((topic): topic is PublicKnowledgeTopic => topic !== null);
}

export function getPublicKnowledgeTopic(slug: string): PublicKnowledgeTopic | null {
  const topic = DISEASE_SUMMARIES.find((item) => item.slug === slug);
  return topic ? toPublicTopic(topic) : null;
}

export function getPublicKnowledgeSlugs(): string[] {
  return getPublicKnowledgeTopics().map((topic) => topic.slug);
}

export function getKnowledgeSitemapUrls(siteUrl = "https://dischargex.net"): string[] {
  return getPublicKnowledgeSlugs().map((slug) => `${siteUrl.replace(/\/$/, "")}/knowledge/${slug}`);
}
