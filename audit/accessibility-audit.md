# EmpirePicks Accessibility Audit

Date: May 29, 2026

## Summary

Accessibility is generally reasonable for a dense workstation, but there are launch issues to address. The app uses semantic tables, real links/buttons, labels for most controls, and visible enough contrast in the main dark theme. Missing pieces are skip navigation, stronger mobile consumption, more explicit form/CTA semantics for lead capture, and continued color-contrast checks for muted text.

## Findings

| Issue | Why it matters | Severity | Expected impact | Exact implementation recommendation | Files requiring modification |
|---|---|---:|---|---|---|
| No skip link | Keyboard users must tab through repeated header/nav. | Medium | WCAG navigation usability | Add "Skip to content" link targeting `main`. | `app/layout.tsx`, `app/globals.css` |
| Mobile board table is hard to consume | Accessibility includes cognitive and motor accessibility. Horizontal data tables are high-friction. | High | Mobile usability | Add mobile card layout with larger touch targets. | `components/board/BoardTable.tsx`, `components/board/workstation.module.css` |
| Muted text may be low contrast in some sections | `--text-muted` on dark surfaces can be marginal for small labels. | Medium | Readability | Validate contrast after visual changes; reserve muted text for non-critical labels. | `app/globals.css`, component CSS |
| CTA links lack event/state confirmation | Users need clear intent labels. | Medium | Conversion and screen-reader clarity | Use descriptive CTA copy like "View launch access" and "Open live board". | `app/page.tsx`, `app/pricing/page.tsx` |
| No lead form exists | Form accessibility cannot be validated until form exists. | High | Conversion accessibility | If form is added, labels, validation messages, and status updates must be explicit. | future lead form files |

## Keyboard Navigation

Current controls are standard links/buttons/selects/inputs, which is positive. Add skip link and keep focus-visible styling.

## Screen Readers

Tables have column headers and scoped headings. Mobile cards should use clear labels for numeric values, not color alone.

## WCAG AA Target

Immediate launch target:

1. Add skip link.
2. Add mobile cards.
3. Keep button/link labels descriptive.
4. Validate color contrast with a browser/a11y pass after visual changes.
