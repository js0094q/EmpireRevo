# EmpirePicks SEO Audit

Date: May 29, 2026

## Summary

The site has solid global metadata in [app/layout.tsx](/Users/josephstewart/Documents/EmpireRevo/app/layout.tsx), but technical SEO is incomplete because no App Router sitemap or robots route exists. Content SEO is also thin: there are no strategy/education pages around EV betting, CLV, bankroll, line shopping, or market inefficiencies.

## Technical SEO Findings

| Issue | Why it matters | Severity | Expected impact | Exact implementation recommendation | Files requiring modification |
|---|---|---:|---|---|---|
| No `app/sitemap.ts` | Search engines lack an explicit route inventory. | High | Better crawl discovery | Add generated sitemap with public pages. | `app/sitemap.ts` |
| No `app/robots.ts` | Crawlers lack index/disallow guidance. | High | Cleaner crawling | Allow public pages, disallow `/internal` and `/api/internal`, point to sitemap. | `app/robots.ts` |
| No Pricing metadata | Pricing route does not exist. | Critical | Commercial search and conversion | Add route with targeted title/description. | `app/pricing/page.tsx` |
| No transparency metadata | Trust page does not exist. | High | Authority | Add route with methodology-focused metadata. | `app/transparency/page.tsx` |
| Dynamic board pages may be indexed with query variants | Query URLs can create duplicate crawl targets. | Medium | Avoid crawl waste | Add canonical strategy after public URL set is stable. | page metadata/future canonical helpers |
| OpenGraph image is SVG | Present in `public/opengraph-image.svg`. Some platforms handle SVG inconsistently. | Medium | Share card reliability | Later add PNG/WebP OG image with dimensions. | `public/opengraph-image.png` future |

## Content SEO Findings

| Topic | Current coverage | Severity | Recommendation | Files |
|---|---|---:|---|---|
| EV betting | Mentioned in FAQ/board labels. | High | Add educational article/page explaining EV without promising profit. | future `app/learn/ev-betting/page.tsx` |
| CLV | Internal docs only. | High | Public CLV methodology page or transparency section. | `app/transparency/page.tsx` |
| Bankroll management | Not covered. | Medium | Add responsible, non-advisory bankroll education. | future learn pages |
| Line shopping | Homepage mentions examples. | Medium | Add landing/learn page for line shopping. | future learn pages |
| Market inefficiencies | Not covered in public content. | Medium | Add explainers tied to fair lines and book coverage. | future learn pages |
| Sports betting strategy | Not covered. | Medium | Build an educational content cluster. | future `app/learn/*` |

## Metadata Review

- Global title template and description exist.
- OpenGraph and Twitter metadata exist.
- `metadataBase` uses `NEXT_PUBLIC_SITE_URL` fallback to `https://www.empirepicks.com`.
- Public pages have basic metadata.
- No schema.org structured data was found. Add `SoftwareApplication` or `WebApplication` schema after product/pricing details are finalized.

## Implementation-Ready Tasks

1. Add `app/robots.ts`.
2. Add `app/sitemap.ts`.
3. Add `app/pricing/page.tsx` metadata.
4. Add `app/transparency/page.tsx` metadata.
5. Plan content cluster after launch: EV, CLV, line shopping, bankroll, market inefficiency, responsible betting.
