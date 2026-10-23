import { describe, expect, it } from "vitest";
import {
  getKnowledgeSitemapUrls,
  getPublicKnowledgeSlugs,
  getPublicKnowledgeTopic,
  getPublicKnowledgeTopics,
} from "@/lib/knowledge-seo";

describe("static knowledge SEO route data", () => {
  it("includes only canonical slugs with verified catalog reference links", () => {
    const topics = getPublicKnowledgeTopics();
    expect(topics.length).toBeGreaterThan(0);
    for (const topic of topics) {
      expect(topic.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(topic.references.length).toBeGreaterThan(0);
      expect(getPublicKnowledgeTopic(topic.slug)?.slug).toBe(topic.slug);
    }
    expect(getPublicKnowledgeTopic("not-a-catalog-topic")).toBeNull();
  });

  it("adds only static knowledge detail URLs to the detail sitemap helper", () => {
    const urls = getKnowledgeSitemapUrls();
    expect(urls).toEqual(getPublicKnowledgeSlugs().map((slug) => `https://dischargex.net/knowledge/${slug}`));
    expect(urls.every((url) => /^https:\/\/dischargex\.net\/knowledge\/[a-z0-9-]+$/.test(url))).toBe(true);
    expect(urls.some((url) => /\?|#|\/app\//.test(url))).toBe(false);
  });
});
