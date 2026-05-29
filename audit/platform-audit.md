# EmpirePicks Platform Audit

Date: May 29, 2026

## Executive Summary

EmpirePicks already presents as a serious sportsbook pricing workstation rather than a generic pick-selling site. The product has stronger-than-usual foundations: fair-line math, vig removal, book weighting, confidence labels, stale-market handling, internal diagnostics, validation events, CLV/ROI methodology, and visual regression coverage.

The launch risk is commercial. The public product has no pricing route, no signup/trial/checkout path, no lead form, no public record/transparency surface, and no subscriber onboarding flow. A visitor can understand that EmpirePicks is an odds board, but cannot quickly answer why they should subscribe or how to become a customer.

## Strengths

- Board-first product surface in [app/page.tsx](/Users/josephstewart/Documents/EmpireRevo/app/page.tsx) and [components/board/BoardView.tsx](/Users/josephstewart/Documents/EmpireRevo/components/board/BoardView.tsx) supports a data-platform feel.
- Pricing logic stays out of ad hoc UI code through [lib/server/odds/fairEngine.ts](/Users/josephstewart/Documents/EmpireRevo/lib/server/odds/fairEngine.ts), [lib/server/odds/fairMath.ts](/Users/josephstewart/Documents/EmpireRevo/lib/server/odds/fairMath.ts), and [lib/ui/view-models/boardViewModel.ts](/Users/josephstewart/Documents/EmpireRevo/lib/ui/view-models/boardViewModel.ts).
- Internal evaluation APIs exist under [app/api/internal/evaluation/route.ts](/Users/josephstewart/Documents/EmpireRevo/app/api/internal/evaluation/route.ts), with ROI/CLV methodology documented in [docs/clv-and-evaluation.md](/Users/josephstewart/Documents/EmpireRevo/docs/clv-and-evaluation.md).
- Visual regression covers populated, empty, stale, error, games, detail, and internal surfaces via [scripts/visual-regression.ts](/Users/josephstewart/Documents/EmpireRevo/scripts/visual-regression.ts).

## Weaknesses

- No `/pricing`, `/signup`, `/trial`, `/subscribe`, or checkout route exists.
- Homepage live-odds dependency can replace the entire first impression with a configuration or upstream error state.
- Public trust module does not expose record methodology, CLV availability, sample-size caveats, or how users can audit results.
- Mobile board currently depends on a wide table with horizontal scrolling.
- Primary CTA says "Open board", which is useful for product use but weak for paid conversion.
- Navigation omits Pricing and any launch access path.

## High Impact Improvements

| Issue | Why it matters | Severity | Expected impact | Exact implementation recommendation | Files requiring modification |
|---|---|---:|---|---|---|
| No monetization path | Launch within 30 days requires a visible subscription or waitlist path. Users cannot convert. | Critical | High conversion lift and clearer product intent | Add `/pricing` with launch-access tiers, fit notes, transparency promises, and contact/waitlist CTA. Add nav/footer links and homepage CTA. | `app/pricing/page.tsx`, `components/layout/SiteHeader.tsx`, `app/layout.tsx`, `app/page.tsx` |
| Homepage depends on live odds before value proposition | Missing API key or feed outage makes the site look broken to first-time users. | Critical | Trust and resilience | Render hero, trust, and conversion sections even when odds config/feed fails. Move board errors into the board section. | `app/page.tsx` |
| No public record/transparency surface | Betting products fail when users cannot audit results and methodology. | High | Trust, retention, pricing power | Add a public transparency page explaining what is tracked now, what is withheld until sample size is valid, and how CLV/ROI are computed. Link from homepage/pricing/footer. | `app/transparency/page.tsx`, `app/layout.tsx`, `components/layout/SiteHeader.tsx`, `app/page.tsx` |
| Mobile board is table-first without a mobile card fallback | Casual bettors and subscribers will use phones. Horizontal scrolling hides key fields. | High | Mobile engagement and retention | Render mobile row cards from the existing `BoardRowViewModel`, with event, market, best, fair, EV, confidence, and update. Keep table for desktop. | `components/board/BoardTable.tsx`, `components/board/workstation.module.css` |
| CTA tracking is not instrumented | There is Vercel Analytics, but conversion actions are not measured. | High | Faster launch iteration | Add a small client tracked link primitive and track hero, pricing, contact, board, transparency, and mobile alpha clicks. | `components/analytics/TrackedLink.tsx`, pages using CTAs |
| No SEO discovery files | Metadata exists, but no `robots` or `sitemap` files are generated. | High | Search discovery and launch polish | Add App Router `app/robots.ts` and `app/sitemap.ts` using `NEXT_PUBLIC_SITE_URL` fallback. | `app/robots.ts`, `app/sitemap.ts` |

## Quick Wins

| Issue | Why it matters | Severity | Expected impact | Exact implementation recommendation | Files requiring modification |
|---|---|---:|---|---|---|
| Header has no Pricing link | Visitors scan nav before scrolling. | High | Higher intent discovery | Add Pricing to desktop/mobile nav. | `components/layout/SiteHeader.tsx` |
| Footer hides trust/revenue pages | Legal footer is complete but product footer is thin. | Medium | Authority | Add Pricing and Transparency links. | `app/layout.tsx` |
| No skip link | Keyboard users must tab through header/nav every page. | Medium | Accessibility | Add skip link to layout and focus styling. | `app/layout.tsx`, `app/globals.css` |
| Contact page has no structured conversion route | Email link is low-friction but not measurable. | Medium | Lead quality | Add launch-access prompts and tracked CTAs. A durable form requires an email/CRM provider. | `app/contact/page.tsx` |

## Critical Issues

1. No subscription/pricing/customer-acquisition surface.
2. Homepage can fail closed into an operator-style config error for public visitors.
3. No public trust/record page despite internal CLV/ROI infrastructure.

## Landing Pages

### 5-Second Test

- What is EmpirePicks? Mostly yes: "Betting analytics workstation" and "market edge" communicate an odds intelligence product.
- Why should I trust it? Partially: fair odds, book coverage, and market signals appear, but public record methodology is not visible above the fold.
- What makes it different? Partially: fair-line and freshness language differentiates it, but no transparent methodology module exists in the first viewport.
- Why should I subscribe? No: there is no pricing, subscriber benefit, trial, or paid-access language.

### Hero Recommendation

Wireframe:

```text
Hero: EmpirePicks
Subhead: Fair-line sportsbook pricing, line-shopping, and CLV/ROI tracking for bettors who want auditable edges.
Primary CTA: View launch access
Secondary CTA: Open live board
Trust row: No-vig fair lines / Book coverage / CLV-ready tracking / Responsible use
```

## User Flows

| Flow | Current state | Finding | Severity | Recommendation | Files |
|---|---|---|---:|---|---|
| Visitor -> Signup | Visitor can only click Contact or board. | Signup path does not exist. | Critical | Add `/pricing` and launch-access CTA. | `app/pricing/page.tsx`, header/footer |
| Visitor -> Trial | Trial path does not exist. | No way to capture launch interest. | Critical | Add "Request launch access" CTA to Pricing and Contact. | `app/pricing/page.tsx`, `app/contact/page.tsx` |
| Subscription -> Dashboard | Public board is available without account gating. | Monetization boundary is undefined. | High | Decide before launch whether board is teaser, freemium, or subscriber-only. Implement auth/paywall separately. | `app/page.tsx`, future auth/checkout |
| Dashboard -> Pick consumption | Board rows link to detail and show price/fair/EV. | Experienced users can inspect the basis for a pick. | Low | Keep detail path; add public transparency module. | `components/game/*` |

## Dashboard

The desktop board looks professional and data-driven. It is dense, table-first, and avoids tout-style copy. The weakness is onboarding density: casual users see "Gap", "Opportunity", "Signal", "Confidence", and market controls before a strong trust explanation. The mobile state is more fragile because the table compresses into a horizontal scroll instead of a native card workflow.

## Sports Bettor Experience

| Persona | Finding | Severity | Recommendation | Files |
|---|---|---:|---|---|
| Casual bettor | "Open board" gives access but not a simple "what should I do with this?" explanation. | Medium | Keep beginner mode, add microcopy near board and pricing page. | `components/board/BoardFilters.tsx`, `app/pricing/page.tsx` |
| Experienced bettor | EV, fair line, confidence, and CLV/ROI infrastructure exist but public record is not visible. | High | Add transparency page and public methodology copy. | `app/transparency/page.tsx` |
| Paid subscriber | No saved account, alerts, daily recap, or subscriber-only feature hooks are visible. | High | Roadmap subscriber features: saved books, alerts, daily slate email, verified pick history. | future auth/subscription files |
| Competitor | Strong math, weaker commercial funnel. | Critical | Ship pricing/access route and trust page first. | `app/pricing/page.tsx`, `app/transparency/page.tsx` |

## Launch Score Before Fixes

| Category | Score | Notes |
|---|---:|---|
| Product | 7/10 | Strong board and model foundations. |
| UX | 6/10 | Desktop strong, mobile table weak. |
| Trust | 5/10 | Internal evaluation exists; public auditability missing. |
| Performance | 6/10 | Dynamic homepage fetch blocks public value on feed/config failure. |
| Mobile | 5/10 | Wide board table hurts consumption. |
| Conversion | 2/10 | No pricing/signup/trial path. |
| Scalability | 7/10 | Caching, validation, persistence, and internal diagnostics are present. |

Overall Launch Score: 5.4/10
