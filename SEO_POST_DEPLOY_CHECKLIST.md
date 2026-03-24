# SEO Post-Deploy Checklist

Use this checklist after deploying SEO changes to production.

## 0) Choose metadata variant before deploy

Set `SEO_VARIANT` in production environment:

- `conversion` (default): conversion-focused snippets
- `technical`: technical/detail-focused snippets
- `thai_brand`: Thai brand-focused snippets

## 1) Submit sitemap

1. Open [Google Search Console](https://search.google.com/search-console).
2. Select property: `https://dischargex.net`.
3. Go to **Sitemaps**.
4. Submit `https://dischargex.net/sitemap.xml`.

## 2) Request indexing (priority pages)

Request indexing for:

- `https://dischargex.net/`
- `https://dischargex.net/pricing`
- `https://dischargex.net/guidelines`
- `https://dischargex.net/about`

## 3) Verify crawler-facing pages

- Check `https://dischargex.net/robots.txt` returns expected rules and sitemap URL.
- Check `https://dischargex.net/sitemap.xml` includes only intended indexable pages.

## 4) Monitor for 2-4 weeks

In Search Console, track:

- Queries containing brand + Thai intent terms (for example: `dischargex`, `ai สรุปชาร์จ`, `discharge summary`).
- Click-through rate (CTR) on home/pricing/guidelines.
- Index coverage errors or excluded URLs.

## 5) Iterate if needed

- Refine title/description for pages with high impressions but low CTR.
- Expand FAQ content for queries with impressions but no clicks.
