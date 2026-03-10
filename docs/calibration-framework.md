# Calibration Framework (Phase 5)

EmpirePicks now centralizes ranking, confidence, stale-line, timing, pinned, and EV defensibility knobs in:

- `lib/server/odds/calibration.ts`

Use `ODDS_CALIBRATION_OVERRIDES_JSON` to override defaults without editing engine code.

## Tunable Parameters

## Ranking
- normalization caps (`edgePctMax`, `evPctMax`, `sharpDeviationMax`)
- component weights (edge, EV, confidence, coverage, sharp share, freshness, stale, deviation)
- penalties (sparse coverage, limited sharp participation, stale freshness, weak confidence labels)
- reason thresholds for explanation and audits

## Confidence
- freshness windows
- dispersion noise cap
- movement-history quality thresholds
- component weights and label boundaries
- explanatory-note thresholds

## Stale Detection
- stale component weights (edge, age, movement divergence, consensus gap)
- stale / lagging / off-market thresholds
- market-specific scaling for moneyline vs spreads/totals
- market-confirmation and moving-against triggers

## Timing / Decay
- urgency thresholds for:
  - `Likely closing`
  - `Single-book holdout`
  - `Market converging`
  - `Stable for now`
  - `Weak timing signal`
- urgency component weights (stale strength, confidence, movement strength, holdout factor, freshness)

## Pinned-Book Actionability
- minimum pinned actionable edge threshold
- pinned scoring weights (edge, confidence, stale, urgency)

## EV Defensibility (Spreads/Totals)
- minimum confidence
- minimum coverage ratio
- minimum contributing books
- outcomes below threshold are `suppressed` for EV display

## Heuristic vs Stronger Assumptions

Heuristic (tunable by market behavior):
- score weights and penalties
- stale/timing urgency boundaries
- pinned actionability thresholds

Stronger assumptions (domain-constrained):
- no-vig conversion and weighted fair-line math
- equivalent-line grouping for spreads/totals
- market-specific EV caution for non-moneyline contexts

## Notes

- Defaults are conservative and favor false-negative over false-positive stale/value signaling.
- Calibration metadata is exposed in `board.diagnostics.calibration` and `board.diagnostics.calibrationMeta`.
