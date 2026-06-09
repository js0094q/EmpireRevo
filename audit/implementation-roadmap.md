# Board + Game UX Implementation Roadmap

## Change

Audit the existing board/detail/outcome/evaluation structure before code changes.

## Files Modified

- `audit/board-game-overhaul.md`
- `audit/implementation-roadmap.md`

## Why It Was Needed

The overhaul touches public board UI, game detail UI, internal outcome workflow, analytics, and evaluation reporting. The audit locks the implementation to actual repo files instead of assumptions.

## User Impact

The implementation can stay narrow: reuse the existing odds engine, validation snapshots, persisted outcomes, and internal auth boundary.

## Verification

Initial verification is source inspection of `app/page.tsx`, `app/game/[eventId]/page.tsx`, `components/board/*`, `components/game/*`, `lib/server/odds/*`, and `lib/ui/view-models/*`.

## Planned Changes

### Change

Simplify the board into a faster table-first workflow.

### Files Modified

- `app/page.tsx`
- `components/board/BoardView.tsx`
- `components/board/BoardFilters.tsx`
- `components/board/BoardTable.tsx`
- `components/board/BoardRow.tsx`
- `components/board/workstation.module.css`
- `lib/ui/view-models/boardViewModel.ts`

### Why It Was Needed

The existing board is dense, but it exposes too many secondary concepts as top-level columns and does not show outcome status.

### User Impact

Users will scan game, market, selection, best book, best price, fair price, EV, confidence, freshness, and outcome status in one row.

### Verification

Targeted board view-model tests, board helper tests, lint, typecheck, and visual regression.

### Change

Improve game detail as an analytical drilldown.

### Files Modified

- `app/game/[eventId]/page.tsx`
- `components/game/GameDetailView.tsx`
- `components/game/GameHeader.tsx`
- `components/game/ConsensusSummary.tsx`
- `components/game/BookComparisonTable.tsx`
- `components/game/MarketHistoryPanel.tsx`
- `components/game/detail.module.css`
- `lib/server/odds/gameDetailPageData.ts`
- `lib/ui/view-models/gameDetailViewModel.ts`

### Why It Was Needed

The detail page already has fair-line and history data, but it does not surface the tracked price/outcome/ROI workflow.

### User Impact

Users can open a game from the board and see why it appears, which books contribute, whether history exists, and what happened after settlement.

### Verification

Targeted game detail view-model tests, route build checks, typecheck, and visual regression.

### Change

Add internal outcome recording.

### Files Modified

- `app/api/internal/outcomes/route.ts`
- `components/game/OutcomeRecorder.tsx`
- `lib/server/odds/outcomes.ts`
- `tests/outcomes.test.ts`

### Why It Was Needed

Outcome persistence exists, but there is no internal operator workflow for recording results.

### User Impact

Internal operators can record win, loss, push, void, or unknown results without accounts, signup, or public editing controls.

### Verification

Route-level tests, outcome persistence tests, lint, typecheck, and API behavior inspection.

### Change

Expose realized ROI and evaluation segments.

### Files Modified

- `lib/server/odds/roiEvaluation.ts`
- `lib/server/odds/internalDiagnostics.ts`
- `lib/ui/view-models/internalDiagnosticsViewModel.ts`
- `components/internal/InternalEngineView.tsx`
- `tests/roiEvaluation.test.ts`

### Why It Was Needed

The internal surface shows aggregate ROI, but not the requested breakdown by sport, market, or confidence bucket.

### User Impact

Internal review can compare realized performance by segment without exposing operator controls publicly.

### Verification

ROI tests, internal diagnostics route tests, lint, typecheck, and build.

### Change

Add product-use analytics events.

### Files Modified

- `components/analytics/ProductAnalytics.tsx`
- `components/board/BoardView.tsx`
- `components/board/BoardFilters.tsx`
- `components/game/GameDetailView.tsx`
- `components/game/OutcomeRecorder.tsx`
- `components/internal/InternalEngineView.tsx`

### Why It Was Needed

The current analytics layer tracks links and lead actions, not board/detail/product workflow events.

### User Impact

Product-use events can show board usage, game opens, filters, sorting, refreshes, outcome updates, and evaluation views without adding signup tracking.

### Verification

Lint/typecheck and source inspection to confirm no signup, account, newsletter, gated-content, popup, or invasive tracking logic was added.
