# EmpirePicks

EmpirePicks is a sportsbook odds aggregation and betting intelligence workstation focused on pro-grade line shopping with transparent fair-line math.

## Why Fair Line Matters

Raw sportsbook prices include vig and disagree across books. EmpirePicks:

- converts each book to implied probability
- removes vig per market
- applies weighted consensus (sharp books weighted higher)
- converts fair probability back to fair American odds
- shows **Edge** and **Expected Value** context alongside book-level pricing

## Historical Snapshot Highlights

The current system extends the existing fair-engine path without adding a parallel odds subsystem:

- centralized calibration surface for ranking/confidence/stale/timing/pinned/EV defensibility
- self-collected normalized odds snapshots at the event/market/outcome/book/timestamp level
- durable odds snapshots + event timelines (Redis-backed, memory fallback)
- history-backed movement, pressure, staleness, and value-persistence signals
- persisted validation events with snapshot references
- closing-line + CLV evaluation with implied-probability normalization from self-collected history
- optional persisted outcome layer (`win/loss/push/void/unknown`)
- realized ROI evaluation (flat 1-unit stake model)
- fair-probability calibration analysis (Brier + calibration buckets)
- historical factor-performance tracking (avg CLV/ROI/win rate)
- daily/weekly/rolling-30/rolling-90 evaluation reports with confidence intervals where possible
- internal diagnostics APIs (`/api/internal/*`) and operator page (`/internal/engine`)
- real event-detail history charts from persisted data (no fabricated sparkline history)
- deterministic market-pressure labels from observed history (`sharp-up`, `sharp-down`, `broad-consensus`, `fragmented`, `stale`, `none`)
- internal snapshot collection route for cron/operator triggers (`/api/internal/snapshots/collect`)
- persistence health telemetry (write success/failure/fallback + payload/latency signals)
- conservative history pressure signals can inform live ranking, while broader historical signals remain available for UI, diagnostics, CLV, and research/backtests

The next clean backtesting step is a shadow/offline variant that persists history-aware scores alongside the live baseline, so CLV and ROI can be compared without letting those broader features touch production ranking.

## Calibration in EmpirePicks

Calibration is centralized in `lib/server/odds/calibration.ts`.

You can override defaults with:

```bash
ODDS_CALIBRATION_OVERRIDES_JSON='{"ranking":{"penalties":{"sparseCoveragePenalty":18}}}'
```

Defaults are conservative by design.

## Persistence + Validation

`lib/server/odds/validationEvents.ts` now writes versioned validation events into the persistence layer.

`lib/server/odds/snapshotPersistence.ts` and `lib/server/odds/historyStore.ts` persist normalized snapshot buckets and timelines from the existing fair-engine pass.

Historical snapshots are written after normalization and reuse the same internal fetch path that powers board rendering. No separate raw-history ingestion path is introduced.

Persistence failures are non-fatal; board rendering continues.

## CLV and ROI Semantics

Authoritative CLV is now computed in implied probability space (`clvProbDelta`).

American-odds delta fields remain as display-only compatibility helpers for internal consumers.

ROI is computed only when matching outcomes are persisted; missing outcomes remain null-safe and are never inferred.

## Board Behavior

The board keeps upcoming games within the selected start window, and once a game has started it remains visible as long as the live odds feed is still publishing it. That supports late-game betting without relying on a fixed two-hour post-kickoff cutoff.

## Pinned-Book Actionability

Pinned-book handling distinguishes:
- global best line
- best actionable pinned-book line

The board now supports pinned-first ranking and filtering:
- `Sort: Pinned-book edge`
- `Sort: Pinned stale strength`
- `Sort: Pinned actionable score`
- `Bettable at pinned books`

## Tech Stack

- Next.js (App Router)
- React + TypeScript
- Node.js runtime (>=20)

## Run Locally

```bash
npm ci
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create `.env.local`:

```bash
ODDS_API_KEY=your_key_here
# optional
ODDS_API_BASE=https://api.the-odds-api.com
ODDS_API_ALLOWED_HOSTS=api.the-odds-api.com
ODDS_ALLOWED_SPORT_KEYS=
ODDS_CALIBRATION_OVERRIDES_JSON={"ranking":{"penalties":{"sparseCoveragePenalty":14}}}
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
EMPIRE_INTERNAL_API_KEY=...
ODDS_SNAPSHOT_COLLECTION_ENABLED=false
ODDS_SNAPSHOT_INTERVAL_SECONDS=60
ODDS_SNAPSHOT_RETENTION_HOURS=72
ODDS_SNAPSHOT_BATCH_SIZE=500
ODDS_HISTORY_SHORT_WINDOW_MINUTES=5
ODDS_HISTORY_LONG_WINDOW_MINUTES=30
ODDS_VALUE_PERSISTENCE_THRESHOLD_PCT=1.0
ODDS_HISTORY_LIVE_RANKING_MODE=conservative
ODDS_SNAPSHOT_TTL_SECONDS=
ODDS_TIMELINE_TTL_SECONDS=
ODDS_VALIDATION_TTL_SECONDS=
ODDS_EVALUATION_TTL_SECONDS=
ODDS_DIAGNOSTICS_TTL_SECONDS=
```

Never expose keys in client code.

## Validation Commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Optional visual regression run:

```bash
npm run test:visual
```

## Documentation

- [Odds Math](./docs/odds-math.md)
- [Calibration Framework](./docs/calibration-framework.md)
- [Validation and Instrumentation](./docs/validation-and-instrumentation.md)
- [Historical Odds Collection](./docs/historical-odds-collection.md)
- [Persistence and History](./docs/persistence-and-history.md)
- [CLV and Evaluation](./docs/clv-and-evaluation.md)
- [Phase 7 Outcome Evaluation](./docs/phase-7-outcome-evaluation.md)
- [Internal Diagnostics](./docs/internal-diagnostics.md)
- [Phase 6.1 CLV Normalization](./docs/phase-6-1-clv-normalization.md)
- [Pinned-Book Workflows](./docs/pinned-book-workflows.md)
- [Ranking and Confidence](./docs/ranking-and-confidence.md)
- [Market Signal Framework](./docs/market-signal-framework.md)
- [System Architecture](./docs/architecture.md)
