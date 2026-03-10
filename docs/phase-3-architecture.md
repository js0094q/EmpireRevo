# Phase 3 Architecture

## Goal

Phase 3 turns EmpirePicks from a summary board into a production line-shopping grid while preserving the Phase 2 server-side pipeline.

## Board Data Flow

1. `getNormalizedOdds` fetches upstream odds and normalizes data.
2. `buildFairBoard` computes no-vig probabilities, weighted fair probabilities, fair prices, edge, and EV.
3. `attachMovement` enriches each book line with persisted movement history.
4. `app/page.tsx` renders `OddsBoard` from server-fetched fair board.

No client-side calls to third-party odds providers are performed.

## Fair-Board Dependency Chain

- `lib/server/odds/client.ts`
- `lib/server/odds/normalize.ts`
- `lib/server/odds/fairMath.ts`
- `lib/server/odds/weights.ts`
- `lib/server/odds/marketCompare.ts`
- `lib/server/odds/fairEngine.ts`
- `lib/server/odds/oddsService.ts`

Single-source fair math remains in the server layer.

## Book Column Rendering Strategy

- Board exposes a stable `books[]` directory in response payload.
- Grid columns are generated from this directory, preserving order.
- Missing lines render placeholder cells (`--`) instead of collapsing layout.
- Pinned books are sorted first client-side without mutating raw board data.
- Optional "hide unavailable books" removes columns with no current market offers.

## Filtering and Sorting Architecture

Pure selectors live in `components/board/selectors.ts`:

- `filterEvents(...)`
- `sortEvents(...)`
- `orderBooksForGrid(...)`

Supported scan controls:
- team search
- start time window
- edge threshold
- minimum contributing books
- side filter (favorites/underdogs)
- positive EV only
- best edges only
- sportsbook visibility and pinning

This keeps filtering deterministic and testable.

## Performance Decisions

- Expensive movement parsing is cached per render cycle (`buildPointCache`).
- Event row sparkline series are memoized by event and history window.
- Long table virtualization uses row-window rendering in `OddsBoardTable` for large slates.
- Detail drawer remains lightweight and only computes visible event detail on demand.

## Transparency + Auditability

Fair event payload now includes:
- total books seen
- contributing books used in fair line
- excluded books and reason (`point_mismatch`, `missing_market_or_outcomes`)

Book rows now expose:
- tier
- sharp flag
- applied weight
- implied probability
- no-vig probability

UI drawer provides explicit formula labels for Implied Prob, No-Vig Prob, Fair Prob, Fair Price, Edge, and Expected Value.

## Failure-State Handling

Phase 3 distinguishes:
- missing API key
- upstream auth failure
- upstream rate limit
- upstream empty payload
- no games/books for selected filters

Both API and page layer map these to user-readable states.
