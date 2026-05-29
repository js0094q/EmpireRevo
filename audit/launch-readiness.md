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
| Conversion | 7/10 | Pricing, lead capture, checkout URL hooks, and tracked CTAs exist; provider URLs/webhook still need production configuration. |
| Scalability | 7/10 | No new persistence or payment dependency added. |

Overall Launch Score: 7.5/10

## Remaining Launch Blockers

| Issue | Why it matters | Severity | Expected impact | Exact implementation recommendation | Files requiring modification |
|---|---|---:|---|---|---|
| Checkout URLs not configured | Users still cannot self-serve paid subscription until provider URLs are supplied. | High | Revenue | Configure `NEXT_PUBLIC_EMPIRE_CHECKOUT_INDIVIDUAL_URL` and `NEXT_PUBLIC_EMPIRE_CHECKOUT_PRO_URL`; add account entitlement checks when auth is selected. | deployment environment, future auth files |
| Lead webhook not configured | Lead modal validates and submits, but durable delivery requires a destination. | High | Sales operations | Configure `LEAD_CAPTURE_WEBHOOK_URL`; current API returns a safe email-fallback response when unset. | deployment environment |
| Public historical record data not yet published | `/history` now explains methodology, but no audited pick rows are published. | High | Trust/retention | Publish rows only after validation events, outcomes, close references, and sample-size gates are ready. | future data-backed history surface |
| Production env missing in current shell | `npm run validate:env` fails locally without `ODDS_API_KEY`. | High | Runtime readiness | Confirm production Vercel env vars before deploy. | deployment environment |
