# EmpirePicks Trust Audit

Date: May 29, 2026

## Summary

EmpirePicks has unusually strong internal trust infrastructure for a betting product, but too little of it is visible publicly. The repo supports persisted validation events, CLV evaluation, ROI summaries, outcome storage, probability calibration, and factor performance. Public pages currently show fair line and confidence, but not an auditable record, sample size, CLV methodology, or constraints.

## Findings

| Issue | Why it matters | Severity | Expected impact | Exact implementation recommendation | Files requiring modification |
|---|---|---:|---|---|---|
| No public record page | Bettors need to audit wins, losses, pushes, units, ROI, and sample size independently. | Critical | Trust and paid conversion | Add `/transparency` page explaining tracked metrics, current limitations, and audit methodology. Do not fabricate numbers. | `app/transparency/page.tsx`, `app/layout.tsx`, `components/layout/SiteHeader.tsx` |
| ROI/CLV are internal only | The internal endpoint computes ROI/CLV, but prospects cannot see methodology. | High | Authority and retention | Surface methodology publicly; keep raw diagnostics protected. | `docs/clv-and-evaluation.md`, `app/transparency/page.tsx` |
| No public pick history/filtering | Users cannot review historical picks by date, sport, market, book, or outcome. | High | Subscriber trust | Add a future `/history` surface backed by validation events and persisted outcomes after sample sufficiency. | future `app/history/page.tsx`, `lib/server/odds/validationStore.ts` |
| No sample-size caveat near performance claims | Short-run ROI can mislead. The code handles confidence tiers, but public copy does not. | High | Compliance and credibility | Add copy that ROI and calibration remain hidden or caveated until sample size is meaningful. | `app/transparency/page.tsx`, `app/about/page.tsx` |
| "Trusted odds intelligence" lacks proof | The hero uses trust language without visible proof. | Medium | First-impression authority | Replace or support it with concrete signals: no-vig fair lines, book coverage, CLV-ready history, internal diagnostics. | `app/page.tsx` |

## Record Tracking Review

Implementation reviewed:

- [lib/server/odds/roiEvaluation.ts](/Users/josephstewart/Documents/EmpireRevo/lib/server/odds/roiEvaluation.ts) computes ROI only from matched persisted outcomes.
- [lib/server/odds/clv.ts](/Users/josephstewart/Documents/EmpireRevo/lib/server/odds/clv.ts) computes CLV in implied-probability space.
- [app/api/internal/evaluation/route.ts](/Users/josephstewart/Documents/EmpireRevo/app/api/internal/evaluation/route.ts) protects evaluation data with internal authorization.
- [docs/clv-and-evaluation.md](/Users/josephstewart/Documents/EmpireRevo/docs/clv-and-evaluation.md) documents null-safe CLV/ROI limitations.

Accuracy risk: no formula error found in reviewed ROI/EV/CLV paths. Public risk is under-disclosure, not mathematical overclaiming.

## Recommended Metrics

Do not publish these until underlying samples are durable and reproducible:

- ROI
- Units Won
- Win Rate
- CLV
- Average Edge
- Closing Line Performance
- Sample size and settled sample size
- Push/void/unknown counts
- Sport and market split

## Implementation-Ready Tasks

1. Add `/transparency` with "Tracked now", "Published only when sample is meaningful", and "Methodology" sections.
2. Link `/transparency` from homepage, pricing, header, and footer.
3. Later: add `/history` backed by validation and outcome stores, with filters for date, sport, market, book, result, CLV, and edge.
