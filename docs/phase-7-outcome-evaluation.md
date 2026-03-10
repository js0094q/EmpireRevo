# Phase 7 Outcome Evaluation

Phase 7 adds outcome-aware evaluation on top of the existing Phase 6.1 pipeline.

## Added Modules

- `lib/server/odds/outcomes.ts`
- `lib/server/odds/roiEvaluation.ts`
- `lib/server/odds/calibrationAnalysis.ts`
- `lib/server/odds/factorPerformance.ts`
- `lib/server/odds/evaluationReport.ts`

## Outcome Persistence

Outcome records are keyed by `sport:event:market:side` and store:

- `eventId`
- `marketKey`
- `sideKey`
- `result` (`win | loss | push | void | unknown`)
- `finalScore`
- `closeTimestamp`

Outcome persistence is optional. Missing outcomes are never inferred.

## ROI Methodology

ROI is computed only for validation events with matching persisted outcomes.

- stake model: flat 1 unit
- win profit: American payout
- loss profit: `-1`
- push/void profit: `0`
- unknown/missing outcome: excluded from settled sample

If no settled outcomes are available, `roi` is `null`.

## Calibration Methodology

Calibration compares fair probability at validation time against realized binary outcomes:

- bucket width: `0.05`
- metrics: expected win rate, observed win rate, calibration error
- summary: Brier score, mean calibration error, max calibration error

Only win/loss samples are included.

## Factor Performance

Historical factor output now reports:

- `avgCLV`
- `avgROI`
- `winRate`
- `sampleSize`

Synthetic descriptive factors are included for:

- `marketPressure`
- `sharpConsensus`
- `timingSignal`
- `confidenceScore`

## Evaluation Reports

Report windows:

- `daily` (last 24h)
- `weekly` (last 7d)
- `rolling30d` (last 30d)

Each window includes:

- CLV performance
- ROI performance
- probability calibration
- factor performance
- pressure signal analysis
- confidence intervals where sample supports it

## Interpretation Guardrails

- Outputs are descriptive, not predictive guarantees.
- Small samples can distort ROI and calibration.
- Factor relationships should not be interpreted as causal without deeper study.
