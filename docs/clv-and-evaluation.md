# CLV and Evaluation

EmpirePicks computes evaluation from surfaced recommendations plus self-collected market history. CLV remains authoritative in implied-probability space.

## CLV vs ROI

- CLV measures price quality at bet-time versus close.
- ROI measures realized outcome performance from persisted results.

These are separate metrics. Positive CLV does not guarantee positive ROI in short windows.

## Closing-Line Selection

`lib/server/odds/closingLine.ts` supports:

- `closing_global_best`
- `closing_pinned_best`
- `closing_sharp_consensus`
- `closing_fair`

Evaluation outputs always state the active close reference.

Closing-line reads now come from persisted snapshot history keyed by the canonical event and market history reference captured with the validation event.

## Recommendation-Time Reference

Validation events persist enough context to reconnect a surfaced pick to historical odds:

- recommendation timestamp
- displayed American odds
- displayed point when applicable
- `historyRef` for canonical event/market history lookup
- fair probability at recommendation time

This allows the evaluator to compare the surfaced recommendation against the later closing snapshot without re-fetching upstream data.

## Authoritative CLV Method

`lib/server/odds/clv.ts` computes:

- `betImpliedProb`
- `closeImpliedProb`
- `clvProbDelta = closeImpliedProb - betImpliedProb`
- `beatClose = clvProbDelta > 0`

This remains the authoritative CLV signal.

American-odds deltas remain compatibility display helpers only.

## Historical Snapshot Semantics

When enough self-collected history exists, evaluation can derive:

- recommendation price and implied probability
- closing price and implied probability
- closing point for spreads/totals when applicable
- `clvProbDelta`

When history is sparse or a matching closing snapshot is unavailable, CLV fields stay null-safe instead of fabricating a close.

## ROI Method

ROI is computed only when an outcome is available for the same event/market/side:

- stake model: `1` unit flat stake
- `win`: profit from American payout
- `loss`: `-1`
- `push` / `void`: `0`
- missing outcome: excluded from settled ROI sample

If no settled outcomes exist, ROI fields return `null`.

## Probability Calibration

Fair probabilities are evaluated against realized win/loss outcomes using bucketed analysis and Brier scoring:

- expected vs observed win rate by bucket (`0.05` width)
- Brier score
- mean/max calibration error

Push/void/unknown outcomes are excluded from calibration samples.

## Evaluation Methodology Metadata

Evaluation payloads include:

- `closeReference`
- `clvSpace: implied_probability`
- `displaySpace: american_odds`
- `roiStakeModel: flat_unit_stake`
- `probabilitySource: validation_event_fair_probability`
- `historySource: self_collected_normalized_snapshots`

## Limitations

- CLV, ROI, and calibration outputs are descriptive diagnostics, not guarantees.
- Small samples can produce unstable ROI and calibration estimates.
- Missing outcome data intentionally yields null-safe ROI/calibration fields.
- Missing or incomplete history intentionally yields null-safe CLV/close fields.
