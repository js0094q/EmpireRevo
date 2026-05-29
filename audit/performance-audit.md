# EmpirePicks Performance Audit

Date: May 29, 2026

## Summary

The current app has good asset discipline: no large bitmap image dependency, limited dependencies, App Router server rendering, caching around odds payloads, and visual regression coverage. The main performance risk is architectural: the homepage is `force-dynamic` and blocks first meaningful public content on live odds fetching. That is a conversion risk and a Core Web Vitals risk during upstream slowness.

## Measurements and Evidence

- `npm run test:visual` passed on May 29, 2026 for desktop/mobile home, games, game detail, error, stale, empty, and internal states.
- `npm run validate:env` failed in the current shell because `ODDS_API_KEY` was missing.
- No oversized public images were found in `public/`; only SVG/webmanifest assets are present.
- Next.js route bundle metrics still need to be captured with `npm run build` after code changes.

## Core Web Vitals Findings

| Issue | Why it matters | Severity | Expected impact | Exact implementation recommendation | Files requiring modification |
|---|---|---:|---|---|---|
| Homepage blocks on live board fetch | Slow odds feed can delay LCP and make the landing page unavailable. | Critical | LCP/TTFB and conversion | Keep public hero/trust/pricing content renderable when board data is unavailable. Longer-term split board into a child streamed boundary or route. | `app/page.tsx` |
| Large client board embedded on homepage | `BoardView` hydrates filters/table on the primary landing page. | High | INP and bundle size | Keep board, but add lighter mobile cards and consider lazy-loading the board after launch hero/pricing sections. | `app/page.tsx`, `components/board/BoardTable.tsx` |
| Mobile table horizontal scroll | Wide tables increase interaction cost and perceived slowness on phones. | High | Mobile engagement | Add mobile card layout from existing row view model. | `components/board/BoardTable.tsx`, `components/board/workstation.module.css` |
| Sticky header and sticky toolbar compete | On desktop this is useful; on shorter viewports it consumes vertical space. | Medium | Better scanning | Keep sticky toolbar on desktop; continue static toolbar on mobile. Validate no content is hidden. | `components/board/workstation.module.css` |
| Visual gradients are CSS-heavy | No image cost, but multiple radial gradients add paint complexity. | Low | Small paint improvement | Avoid adding more decorative gradients. Existing paint is acceptable for launch. | `app/page.module.css` |

## Image Optimization

No PNG/JPG product assets were present in `public/`, so PNG/JPG to WebP conversion is not applicable. Team/book logos are remote or generated and controlled through existing domain allowlists.

Recommendation: if future screenshots or product assets are added, use `next/image`, WebP/AVIF where possible, explicit dimensions, and lazy loading below the fold.

## Next.js Optimization

| Area | Finding | Severity | Recommendation | Files |
|---|---|---:|---|---|
| Server components | Public pages are mostly server components; board controls are client-only where needed. | Low | Preserve this boundary. | `app/*`, `components/board/*` |
| Client components | `SiteHeader`, `BoardView`, and `BoardFilters` are client components. | Medium | Acceptable, but do not move pricing/transparency static pages client-side. | `components/layout/SiteHeader.tsx`, `components/board/*` |
| Dynamic imports | No obvious heavy third-party UI library. | Low | No new dependency needed. | N/A |
| Route loading | Homepage is dynamic because it loads odds. | Critical | Make non-board content resilient, then consider streaming/lazy board. | `app/page.tsx` |

## Backend Performance

| Area | Finding | Severity | Recommendation | Files |
|---|---|---:|---|---|
| API latency | Public board fetches upstream odds and then fair board. Cache TTLs exist. | Medium | Monitor `/api/board` latency in production and keep cache windows explicit. | `lib/server/odds/oddsService.ts`, `app/api/board/route.ts` |
| Cache | Raw normalized odds TTL 15s, fair board TTL 30s. | Low | Good for live odds while limiting upstream pressure. | `lib/server/odds/oddsService.ts` |
| Status route | `/api/status` calls upstream `/v4/sports` with a 3s timeout. | Medium | Keep timeout; do not use status route as page-render dependency. | `app/api/status/route.ts` |
