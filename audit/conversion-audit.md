# EmpirePicks Conversion Audit

Date: May 29, 2026

## Summary

Conversion is the lowest-scoring launch area. The site gives users a board, but not a buying journey. The product needs a clear pricing/access page, stronger hero CTA, trust/transparency proof, and measurable conversion events before launch traffic arrives.

## Findings

| Issue | Why it matters | Severity | Expected impact | Exact implementation recommendation | Files requiring modification |
|---|---|---:|---|---|---|
| No pricing page | Users cannot understand offer, price anchor, or plan fit. | Critical | Subscription conversion | Add `/pricing` launch-access page with tiers or staged access. | `app/pricing/page.tsx` |
| No signup/trial/checkout route | Visitor -> paid subscriber flow is absent. | Critical | Revenue | For immediate launch, add tracked launch-access CTAs. For payment, integrate Stripe or selected provider separately. | `app/pricing/page.tsx`, future checkout files |
| Hero CTA optimizes use, not conversion | "Open board" is not a paid-intent CTA. | High | Higher qualified clicks | Make primary CTA "View launch access"; keep "Open live board" secondary. | `app/page.tsx` |
| No social proof or transparency proof | Betting buyers need proof more than polish. | High | Trust | Add transparency section and link to methodology. Avoid fake ROI. | `app/page.tsx`, `app/transparency/page.tsx` |
| Contact page is passive | Email link works but is not a guided lead capture. | Medium | Better lead quality | Add launch access options and tracked CTAs. Durable lead storage requires provider selection. | `app/contact/page.tsx` |
| Conversion events missing | Analytics package is installed but CTA events are not tracked. | High | Faster iteration | Add `TrackedLink` client primitive with Vercel `track`. | `components/analytics/TrackedLink.tsx` |

## Landing Page Review

Current headline is clear but not subscription-oriented. It communicates edge discovery, not why someone should pay. The homepage should support this scan order:

1. What it is: sportsbook pricing workstation.
2. Why trust it: no-vig fair lines, book coverage, freshness, CLV-ready history.
3. Why pay: faster line-shopping, audited decision trail, professional workflow.
4. What to do: view launch access or open board.

## Subscription Flow

Current flow:

```text
Visitor -> Board/About/Contact -> email link
```

Recommended launch flow:

```text
Visitor -> Pricing -> Request launch access -> Contact/CRM capture -> Manual onboarding or checkout
```

Future paid flow:

```text
Visitor -> Pricing -> Checkout -> Account -> Dashboard -> Saved books/alerts -> Daily return loop
```

## Lead Magnets and Retention Hooks

Recommended assets:

- Weekly CLV/ROI methodology brief.
- "How to read no-vig fair lines" guide.
- Bankroll and unit-sizing explainer.
- Daily slate email with top market gaps.
- Saved-book and pinned-book onboarding sequence.

These should not claim historical profitability until backed by public, reproducible data.
