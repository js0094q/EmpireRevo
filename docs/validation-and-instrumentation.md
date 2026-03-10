# Validation and Instrumentation (Phase 6)

Phase 6 upgrades Phase 5 instrumentation into persistent longitudinal tracking without fake backtests.

Core modules:
- `lib/server/odds/validationEvents.ts`
- `lib/server/odds/validationStore.ts`
- `lib/server/odds/evaluationRunner.ts`

Integration points:
- `lib/server/odds/fairEngine.ts` emits opportunity snapshots for top-ranked outcomes each board build.
- `lib/server/odds/snapshotPersistence.ts` persists board-time market snapshots.
- `lib/server/odds/evaluation.ts` summarizes per-book responsiveness behavior from current snapshots.

## What Is Tracked

Each persisted opportunity snapshot captures:
- `eventId`, `market`, `outcome`, `commenceTime`
- displayed `score`, `edgePct`, `fairPriceAmerican`
- `confidenceLabel`, `confidenceScore`
- `staleFlag`, `staleStrength`
- timing label (`Likely closing`, `Single-book holdout`, etc.)
- `contributingBookCount`, `totalBookCount`, `sharpParticipationPct`
- global best book/price
- pinned/global context
- diagnostic reason list + factor contribution map
- snapshot reference to persisted board-time history

## Why This Data Matters

This enables future analysis of:
- whether stale-flagged lines converge toward consensus
- whether high-confidence opportunities persist longer
- whether top-ranked opportunities converge more often than lower-ranked ones
- which books lag or disagree more frequently
- which timing and stale signal combinations are predictive

## Persistence Model

- Redis-backed store when configured
- in-memory fallback for safe runtime degradation
- optional custom sink via `setValidationEventSink(...)`
- sink/persistence failures remain non-fatal by design

## Current Limitations

- CLV and beat-close can be evaluated from line history, but not realized profit without true outcomes.
- Sparse markets can produce incomplete close snapshots.
- Signals remain descriptive; no predictive claims are made.

This is intentional groundwork for empirical validation, not a marketing-performance feature.
