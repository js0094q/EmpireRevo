# Ranking and Confidence Framework

## Opportunity Score

EmpirePicks ranks with calibrated component scoring, not raw edge alone.

Primary components:
- edge size at best book
- EV contribution (market-weighted)
- confidence score
- market coverage ratio
- sharp-book participation
- freshness
- stale-line strength
- sharp-vs-retail deviation

Each outcome now exposes a score decomposition (`rankingBreakdown`) including:
- normalized component scores
- weighted contributions
- explicit penalties applied

This makes "why A outranks B" auditable and testable.

## Historical Signals

Historical signals are split into two tiers:

- conservative live ranking inputs: pressure labels with enough confidence to flag `sharp-up`, `sharp-down`, `fragmented`, or `stale`
- research/backtest inputs: broader value-persistence and edge-trend signals that remain collected and exposed without changing live ranking in the default mode

This keeps some market-history context in production ordering without letting the full historical feature set dominate live scores.

The next clean backtesting step is a shadow/offline variant that persists history-aware scores alongside the live baseline, so CLV and ROI can be compared without letting those broader features touch production ranking.

## Confidence Score

Confidence is still deterministic and market-structure based:
- coverage ratio
- sharp participation share
- freshness of updates
- probability dispersion
- exclusion pressure

Each outcome includes `confidenceBreakdown` with component contributions and exclusion impact.

Movement history is still measured and surfaced as context, but it does not directly change the live confidence score.

## Live Ranking Mode

`ODDS_HISTORY_LIVE_RANKING_MODE` controls how much history reaches live opportunity scoring:

- `conservative` (default): only pressure-based history adjusts live ranking
- `off`: history is collected and surfaced but does not change live ranking
- `full`: pressure and value-timing history can both adjust live ranking

## Label Boundaries and Calibration

All thresholds are centralized in `calibration.ts`:
- label transitions (`Thin Market`, `Stale Market`, `Limited Sharp Coverage`, `High Confidence`)
- note thresholds
- component weights

No hidden confidence magic numbers should remain in UI or engine callsites.

## Stale Confidence Interplay

Stale-line triggers are confidence-aware:
- stale actionable flags require sufficient confidence in most cases
- low-confidence, large-gap outliers can be marked `off_market`

This preserves stale signal discipline and avoids noise-driven action prompts.

## Timing Interaction

Timing labels now interact with stale and confidence context:
- `Likely closing`
- `Single-book holdout`
- `Market converging`
- `Stable for now`
- `Weak timing signal`

Timing is presented as a calibrated urgency signal, not an expiration prediction.

## Phase 6 Empirical Tracking

Ranking and confidence are now persisted with each validation event and later joined to closing-line evaluation.

Operator diagnostics aggregate:

- ranking decile beat-close rates
- confidence bucket beat-close rates
- factor contribution deltas (beat-close vs miss)
- penalty reason failure correlations

These aggregates are descriptive only and do not auto-retune live calibration.
