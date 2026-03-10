# CLV and Evaluation (Phase 7)

Phase 7 extends the existing Phase 6.1 evaluation path from CLV-only into outcome-aware evaluation while keeping the same pipeline.

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

## Authoritative CLV Method

`lib/server/odds/clv.ts` computes:

- `betImpliedProb`
- `closeImpliedProb`
- `clvProbDelta = closeImpliedProb - betImpliedProb`
- `beatClose = clvProbDelta > 0`

This remains the authoritative CLV signal.

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

## Limitations

- CLV, ROI, and calibration outputs are descriptive diagnostics, not guarantees.
- Small samples can produce unstable ROI and calibration estimates.
- Missing outcome data intentionally yields null-safe ROI/calibration fields.
