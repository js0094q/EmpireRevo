# EmpirePicks Launch Readiness Assessment

Date: May 29, 2026

## Before Fixes

| Category | Score | Notes |
|---|---:|---|
| Product | 7/10 | Strong fair-line board and model foundations. |
| UX | 6/10 | Desktop strong; mobile board consumption was table-first. |
| Trust | 5/10 | Internal CLV/ROI infrastructure existed, but public methodology was not surfaced. |
| Performance | 6/10 | Homepage depended on odds feed/config before rendering useful public content. |
| Mobile | 5/10 | Mobile table required horizontal scanning for core pick data. |
| Conversion | 2/10 | No pricing, signup, trial, checkout, or launch-access path. |
| Scalability | 7/10 | Caching, validation, persistence, diagnostics, and tests were present. |

Overall Launch Score: 5.4/10

## After Implemented High/Critical Fixes

| Category | Score | Notes |
|---|---:|---|
| Product | 7/10 | Core board/model logic preserved; public methodology now clearer. |
| UX | 7/10 | Homepage now separates product value from board availability. |
| Trust | 7/10 | Public transparency page explains fair-line, CLV, ROI, and sample-size boundaries. |
| Performance | 7/10 | Homepage no longer collapses into a full-page board/config error. |
| Mobile | 7/10 | Board rows now have mobile cards with core metrics visible without horizontal scroll. |
| Conversion | 6/10 | Pricing/launch-access route and tracked CTAs exist; payment/CRM still future work. |
| Scalability | 7/10 | No new persistence or payment dependency added. |

Overall Launch Score: 6.9/10

## Remaining Launch Blockers

| Issue | Why it matters | Severity | Expected impact | Exact implementation recommendation | Files requiring modification |
|---|---|---:|---|---|---|
| No payment/entitlement system | Users still cannot self-serve a paid subscription. | Critical | Revenue | Integrate selected checkout provider and account entitlement checks. | future payment/auth files |
| No durable lead capture | Tracked launch-access clicks are measurable, but contact capture still depends on email/manual flow. | High | Sales operations | Add provider-backed form or CRM/email integration. | future API/action + provider config |
| No public historical record page | Transparency methodology exists, but users still cannot filter audited records. | High | Trust/retention | Add `/history` after sample data is durable and sample-size gates are met. | future `app/history/page.tsx` |
| Production env missing in current shell | `npm run validate:env` fails locally without `ODDS_API_KEY`. | High | Runtime readiness | Confirm production Vercel env vars before deploy. | deployment environment |
