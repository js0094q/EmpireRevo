# EmpirePicks Implementation Roadmap

Date: May 29, 2026

## Phase 1: Highest ROI

Expected to increase conversion, authority, mobile engagement, and launch confidence.

| Task | Issue | Severity | Expected impact | Exact implementation recommendation | Files requiring modification |
|---|---|---:|---|---|---|
| Pricing/access route | No monetization path | Critical | Conversion | Add `/pricing`, nav/footer links, launch-access CTA. | `app/pricing/page.tsx`, `components/layout/SiteHeader.tsx`, `app/layout.tsx` |
| Resilient homepage | Live odds dependency can break landing | Critical | Trust/performance | Render homepage value sections even when board data unavailable. | `app/page.tsx` |
| Public transparency page | No public record methodology | High | Trust | Add `/transparency` with CLV/ROI/sample-size methodology. | `app/transparency/page.tsx`, nav/footer |
| Mobile board cards | Table-first mobile board | High | Retention | Add mobile row-card layout. | `components/board/BoardTable.tsx`, `components/board/workstation.module.css` |
| SEO discovery files | No sitemap/robots | High | Search readiness | Add App Router generated routes. | `app/sitemap.ts`, `app/robots.ts` |
| CTA analytics | CTA clicks untracked | High | Conversion learning | Add tracked-link primitive and use on major CTAs. | `components/analytics/TrackedLink.tsx`, public pages |

## Phase 2: Design Improvements

| Task | Issue | Severity | Recommendation | Files |
|---|---|---:|---|---|
| Hero trust proof | Above-the-fold proof is light | Medium | Add concise trust strip: fair lines, coverage, CLV-ready, responsible use. | `app/page.tsx`, `app/page.module.css` |
| Contact route polish | Passive email-only contact | Medium | Add launch access prompts and tracked links. | `app/contact/page.tsx` |
| Mobile nav audit | Fixed nav competes with dense content | Medium | Validate after mobile cards; reduce height if needed. | `components/layout/layout.module.css` |

## Phase 3: SEO Expansion

| Task | Issue | Severity | Recommendation | Files |
|---|---|---:|---|---|
| Learn cluster | Thin content SEO | Medium | Implemented education pages for EV betting, CLV, bankroll, line shopping, and market inefficiencies. | `app/learn/*` |
| Structured data | No schema | Medium | Implemented WebApplication schema in root layout. | `app/layout.tsx` |
| OG image | SVG-only OG image | Medium | Implemented raster social card. | `public/opengraph-image.png` |

## Phase 4: Long-Term Authority Platform

| Task | Issue | Severity | Recommendation | Files |
|---|---|---:|---|---|
| Public pick history | No auditable history | High | Implemented methodology page; publish real rows only after sample-size gates are met. | `app/history/page.tsx`, future data-backed rows |
| Subscriber retention | No saved state/account layer | High | Add auth, saved books, alerts, daily slate digest, and account billing. | future auth/checkout |
| Payment system | No checkout | Critical | Integrate selected provider, likely Stripe, with server-side entitlement checks. | future payment routes |

## Verification Plan

Before completion:

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`
5. `npm run test:visual`

`npm run predeploy:check` is expected to remain blocked in the current shell until `ODDS_API_KEY` is present.
