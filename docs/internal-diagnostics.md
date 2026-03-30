# Internal Diagnostics (Phase 7)

Internal diagnostics remain server-side and now include outcome-aware evaluation and reporting.

## Internal APIs

- `GET /api/internal/diagnostics`
- `GET /api/internal/timeline`
- `GET /api/internal/evaluation`
- `GET /api/internal/snapshots/collect`
- `POST /api/internal/snapshots/collect`

Behavior:

- stable JSON with `ok/error`
- fail closed (`503`) when durable persistence is unavailable
- explicit evaluation methodology metadata on CLV/ROI outputs
- internal collection route requires `x-empire-internal-key` when `EMPIRE_INTERNAL_API_KEY` is configured

## Evaluation Sections

Diagnostics responses now include:

- `evaluation` (CLV summary + methodology)
- `roiSummary` (units, ROI, win rate, settled sample size)
- `probabilityCalibration` (bucketed expected vs observed, Brier, calibration errors)
- `factorPerformance` (avg CLV/ROI/win-rate by factor)
- `factorAnalytics` (contributions, penalties, pressure-vs-performance slices)
- `evaluationReports` (daily, weekly, rolling-30 windows with confidence intervals where possible)

## Pressure and Factor Semantics

Pressure and factor outputs are descriptive analytics built from persisted validation/evaluation/outcome records. They are not predictive claims.

## Persistence Health

Diagnostics expose persistence telemetry from `persistenceTelemetry.ts`:

- `writesAttempted`
- `writesSucceeded`
- `writesFailed`
- `fallbackWrites`
- `avgSnapshotPayloadBytes`
- `avgValidationPayloadBytes`
- `recentReadFailures`
- `recentWriteFailures`
- `namespacesTouched`
- optional timeline/validation read-latency averages

Diagnostics also expose history coverage details from `internalDiagnostics.ts`:

- history config values in effect
- recent events with stored history
- total stored snapshot count in the sampled window
- movement coverage (`marketsWithHistory` vs `totalMarkets`)

## Operator Page

`/internal/engine` includes:

- ROI panel
- calibration panel + calibration curve table
- factor panel (avg CLV / avg ROI / win rate)
- pressure signal analysis table
- evaluation report window table
- persistence panel
- history coverage and fallback-state context

## Authentication

Optional key-based protection is supported with:

- `EMPIRE_INTERNAL_API_KEY`
- request header `x-empire-internal-key`
