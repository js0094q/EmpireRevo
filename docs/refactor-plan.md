# Refactor Map

## Added

- `lib/ui/formatters/display.ts`
- `lib/ui/view-models/boardViewModel.ts`
- `lib/ui/view-models/gameDetailViewModel.ts`
- `lib/ui/view-models/internalDiagnosticsViewModel.ts`
- `lib/server/odds/gameDetailPageData.ts`
- `components/primitives/*`
- `components/board/*` new workstation components
- `components/games/*`
- `components/game/*`
- `components/internal/InternalEngineView.tsx`

## Reworked

- `app/layout.tsx`
- `app/page.tsx`
- `app/games/page.tsx`
- `app/game/[eventId]/page.tsx`
- `app/games/[eventId]/page.tsx`
- `app/internal/engine/page.tsx`
- `app/globals.css`
- `next.config.mjs`
- `scripts/visual-regression.ts`

## Verified

- lint
- typecheck
- unit/integration tests
- production build
- visual regression
