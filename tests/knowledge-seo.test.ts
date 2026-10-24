import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { metadata as legalMetadata } from "@/app/legal/page";
import { metadata as privacyMetadata } from "@/app/privacy-policy/page";
import { metadata as termsMetadata } from "@/app/terms-of-service/page";
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

  it("contains exactly the indexable public routes and excludes pages marked noindex", () => {
    const entries = sitemap();
    const urls = entries.map(({ url }) => url);
    const paths = urls.map((url) => new URL(url).pathname);
    const knowledgeDetails = paths.filter((path) => /^\/knowledge\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path));
    const basePaths = paths.filter((path) => !path.startsWith("/knowledge/"));
    const noindexPages = [
      ["/legal", legalMetadata],
      ["/privacy-policy", privacyMetadata],
      ["/terms-of-service", termsMetadata],
    ] as const;

    expect(urls).toHaveLength(55);
    expect(new Set(urls).size).toBe(55);
    expect(knowledgeDetails).toHaveLength(45);
    expect(basePaths.sort()).toEqual([
      "/",
      "/about",
      "/automator",
      "/downloads",
      "/guidelines",
      "/icd10-review",
      "/knowledge",
      "/learn",
      "/pricing",
      "/summary-charge",
    ]);

    for (const [path, metadata] of noindexPages) {
      expect(metadata.robots).toMatchObject({ index: false });
      expect(paths).not.toContain(path);
    }
  });
});
