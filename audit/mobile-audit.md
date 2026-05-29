# EmpirePicks Mobile Audit

Date: May 29, 2026

## Summary

Mobile is functional but not yet launch-grade for repeated subscriber use. The visual regression mobile homepage shows the main board still rendered as a horizontally scrollable table. Game detail uses large readable cards, but the fixed bottom nav competes with data tables. Casual bettors can read the marketing sections; experienced bettors will struggle to consume dense board rows quickly on phone.

## Findings

| Issue | Why it matters | Severity | Expected impact | Exact implementation recommendation | Files requiring modification |
|---|---|---:|---|---|---|
| Board table remains the primary mobile row UI | Hidden columns and horizontal scroll make picks harder to consume. | High | Mobile retention | Render a mobile card list using the existing board row view model. Keep the table for desktop. | `components/board/BoardTable.tsx`, `components/board/workstation.module.css` |
| Hero consumes much of first viewport | Clear but leaves less room for proof/CTA context. | Medium | Better mobile conversion | Keep concise hero; add trust strip and pricing CTA. | `app/page.tsx`, `app/page.module.css` |
| Bottom nav can visually overlap full-page captures | Fixed nav is useful but should not obscure final content. | Medium | Usability | Maintain bottom padding and verify critical actions are not hidden. Consider reducing nav height. | `components/layout/layout.module.css` |
| Advanced controls hidden by default | Good for casual users but experienced users may miss model controls. | Low | Clarity | Keep beginner default; add clear Advanced toggle label. | `components/board/BoardFilters.tsx` |
| Touch targets are mostly adequate | Buttons/selects are generally 32px+ but some table links are dense. | Medium | Accessibility | Mobile cards should expose larger row links. | `components/board/BoardTable.tsx` |

## Device Notes

- iPhone/mobile viewport: content is readable, but board row data is truncated unless scrolled horizontally.
- Android-equivalent width: same risk due CSS breakpoint behavior.
- Tablet: grid and table are likely acceptable, but board remains dense.

## Implementation-Ready Tasks

1. Add `.mobileCards` layout in the board table component.
2. Hide `.tableWrap` on mobile and show mobile cards.
3. Include best line, fair line, EV, gap, confidence, book, and updated fields per card.
4. Keep row links accessible with full-card click target or clear detail link.
