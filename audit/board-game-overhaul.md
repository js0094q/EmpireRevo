# Board + Game UX Audit

## Current State

- The public board is rendered from `app/page.tsx` through `components/board/BoardView.tsx`, `components/board/BoardFilters.tsx`, `components/board/BoardTable.tsx`, and `components/board/BoardRow.tsx`.
- Board display data is shaped in `lib/ui/view-models/boardViewModel.ts` from `FairBoardResponse` data built by `lib/server/odds/pageData.ts` and `lib/server/odds/oddsService.ts`.
- Game detail is served by `app/game/[eventId]/page.tsx`, with `/games/[eventId]` redirecting to it from `app/games/[eventId]/page.tsx`.
- Game detail data comes from `lib/server/odds/gameDetailPageData.ts`; presentation is split across `components/game/GameDetailView.tsx`, `components/game/GameHeader.tsx`, `components/game/ConsensusSummary.tsx`, `components/game/BookComparisonTable.tsx`, `components/game/MarketHistoryPanel.tsx`, and `components/game/QualityNotesPanel.tsx`.
- Odds math and EV behavior are already centralized under `lib/server/odds/`, especially `fairEngine.ts`, `fairMath.ts`, `ev.ts`, `ranking.ts`, `confidence.ts`, and `calibration.ts`.
- EV copy/tone is centralized in `lib/ui/evPresentation.ts`; board and detail use it through `lib/ui/view-models/boardViewModel.ts` and `lib/ui/view-models/gameDetailViewModel.ts`.
- Outcome persistence already exists in `lib/server/odds/outcomes.ts`; ROI evaluation already exists in `lib/server/odds/roiEvaluation.ts`, `lib/server/odds/evaluationRunner.ts`, and `lib/server/odds/evaluationReport.ts`.
- Internal/operator protection is enforced by `proxy.ts`, `app/internal/layout.tsx`, and `lib/server/odds/internalAuth.ts`.
- Analytics currently exists only for links and lead capture in `components/analytics/TrackedLink.tsx` and `components/lead/LeadCapture.tsx`.

## Main Board Problems

- `components/board/BoardTable.tsx` exposes too many columns for fast scanning: Event, Market, Best line, Book, Fair line, Gap, Opportunity, Signal, Confidence, Coverage, Movement, and Updated.
- `components/board/BoardFilters.tsx` hides several high-value controls in advanced mode, and it does not expose outcome status or confidence filtering directly.
- `lib/ui/view-models/boardViewModel.ts` does not attach persisted outcome status to rows, so the board cannot answer whether a pick was settled.
- `components/board/BoardRow.tsx` mixes market selection, signal interpretation, movement, coverage, and freshness across separate cells, making the row denser than the core workflow needs.
- `components/board/BoardView.tsx` tracks URL state for search/sort/book/stale/pinned controls, but no product-use analytics events are emitted for board views, filters, sorts, or refreshes.

## Game Detail Problems

- `components/game/GameDetailView.tsx` is compact, but the section order does not clearly separate best available price, fair-line summary, book comparison, signal quality, history, and realized result.
- `components/game/BookComparisonTable.tsx` shows fair line and EV, but not the requested implied probability, no-vig probability, or book weight columns even though `FairOutcomeBook` has those fields in `lib/server/odds/types.ts`.
- `lib/server/odds/gameDetailPageData.ts` resolves history and pressure, but it does not fetch the matching persisted outcome or latest validation snapshot for the selected market.
- `lib/ui/view-models/gameDetailViewModel.ts` has no realized-result model, so `components/game/GameDetailView.tsx` cannot show recorded price, recorded EV, settlement timestamp, profit/loss, or ROI.

## Outcome Tracking Gaps

- `lib/server/odds/outcomes.ts` supports `win`, `loss`, `push`, `void`, and `unknown`, but there is no internal API route for manual operator recording.
- `tests/outcomes.test.ts` covers storage behavior, but no route-level test covers internal outcome recording authorization or validation.
- `lib/server/odds/validationEvents.ts` already records eventId, sportKey, marketKey, sideKey, fair probability, fair odds, EV, confidence, best book, and displayed price; the UI does not yet surface that tracked-pick snapshot.
- `app/internal/engine/page.tsx` and `components/internal/InternalEngineView.tsx` show ROI summary, but not ROI by sport, market, or confidence bucket.

## Data Presentation Problems

- Board labels still use product-specific terms like "Gap" and "Opportunity"; the requested workflow is clearer with "Best Price", "Fair Price", and "EV %".
- Game detail has a generic "Books" section rather than a book-by-book price table aligned to implied probability, no-vig probability, weight, and freshness.
- History display in `components/game/MarketHistoryPanel.tsx` has the right data source, but it does not label unavailable history as a clean market-movement empty state.
- Outcome states are not represented with compact labels on either the board or detail page.

## Mobile Problems

- `components/board/workstation.module.css` correctly swaps the board table for mobile cards, but the cards do not include outcome status.
- The board mobile card repeats metrics but does not prioritize selection, best book, fair price, EV, confidence, freshness, and result in the requested order.
- `components/game/detail.module.css` stacks summary metrics, but game detail has no compact outcome/result panel for mobile.

## Performance Risks

- `components/board/BoardView.tsx` builds the board view model client-side and syncs URL parameters on each control change; unnecessary remounts should be avoided while adding filters.
- Outcome status lookups should be fetched once on the server and passed as compact data, not fetched per row from the client.
- `lib/server/odds/gameDetailPageData.ts` should reuse existing persistence helpers and bounded list reads; it should not add new odds-engine calls.
- Analytics should stay client-only and product-use-only; it should not add invasive tracking or new server calls.

## Highest ROI Fixes

- Simplify the board table to Game, Market, Selection, Best Book, Best Price, Fair Price, EV %, Confidence, Freshness, and Outcome.
- Add simple board controls for sport, market, book, EV threshold, confidence, outcome status, and visible sorting.
- Pass persisted outcomes into the board view model so status filtering and outcome badges are available without client API fanout.
- Add an internal `/api/internal/outcomes` route for manual operator recording using the existing auth boundary and `persistOutcomeResult`.
- Add game-detail outcome/result display sourced from persisted outcomes plus the latest matching validation event.
- Add ROI segment summaries by sport, market, and confidence bucket on the existing internal engine surface.
- Add product-use analytics events: `board_view`, `game_open`, `filter_change`, `sort_change`, `odds_refresh`, `pick_recorded`, `outcome_updated`, and `evaluation_viewed`.

## Implementation Plan

1. Update `audit/implementation-roadmap.md` with the change log format requested by the prompt.
2. Extend `lib/ui/view-models/boardViewModel.ts` to accept compact persisted outcome rows, produce outcome labels/tone, and support confidence/outcome filters.
3. Update `components/board/BoardView.tsx`, `components/board/BoardFilters.tsx`, `components/board/BoardTable.tsx`, `components/board/BoardRow.tsx`, and `components/board/workstation.module.css` for the simplified board workflow and analytics.
4. Fetch `listOutcomeResults` in `app/page.tsx` and pass the result into `BoardView`.
5. Extend `lib/server/odds/gameDetailPageData.ts` to fetch the latest matching validation event, persisted outcome, and closing evaluation for the selected outcome.
6. Extend `lib/ui/view-models/gameDetailViewModel.ts` and game components to show best price, fair line, book table, signal quality, outcome recording, and realized result.
7. Create an internal `app/api/internal/outcomes/route.ts` for outcome recording and update tests around outcome persistence and API behavior.
8. Extend `lib/server/odds/roiEvaluation.ts`, `lib/server/odds/internalDiagnostics.ts`, and `lib/ui/view-models/internalDiagnosticsViewModel.ts` to show segmented ROI metrics.
9. Run targeted tests first, then `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:visual` if the environment supports it.
