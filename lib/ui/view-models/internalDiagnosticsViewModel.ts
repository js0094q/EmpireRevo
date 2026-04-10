import type { InternalDiagnosticsPayload } from "@/lib/server/odds/internalDiagnostics";
import { formatPercent, formatUpdatedLabel } from "@/lib/ui/formatters/display";

export type InternalSummaryItem = {
  label: string;
  value: string;
  hint?: string;
};

export type InternalTableSection = {
  title: string;
  columns: Array<{ key: string; header: string }>;
  rows: Array<Record<string, string>>;
};

export type InternalDiagnosticsViewModel = {
  title: string;
  subtitle: string;
  summary: InternalSummaryItem[];
  sections: InternalTableSection[];
};

function fixed(value: number | null | undefined, digits = 3): string {
  if (!Number.isFinite(value)) return "—";
  return Number(value).toFixed(digits);
}

function reliabilityWarning(tier: "low" | "medium" | "high"): string {
  return tier === "low" ? "Low sample reliability" : "—";
}

export function buildInternalDiagnosticsViewModel(diagnostics: InternalDiagnosticsPayload): InternalDiagnosticsViewModel {
  if (
    !diagnostics.ok ||
    !diagnostics.validation ||
    !diagnostics.evaluation ||
    !diagnostics.roiSummary ||
    !diagnostics.probabilityCalibration ||
    !diagnostics.factorPerformance ||
    !diagnostics.evaluationReports ||
    !diagnostics.history ||
    !diagnostics.calibration
  ) {
    return {
      title: "Internal",
      subtitle: "Diagnostics unavailable.",
      summary: [],
      sections: []
    };
  }

  const evaluation = diagnostics.evaluation;
  const roi = diagnostics.roiSummary;
  const calibration = diagnostics.probabilityCalibration;
  const factorPerformance = diagnostics.factorPerformance;
  const reports = diagnostics.evaluationReports;
  const history = diagnostics.history;

  return {
    title: "Internal",
    subtitle: "Operator diagnostics for evaluation, calibration, persistence, and history coverage.",
    summary: [
      { label: "Persisted Events", value: `${diagnostics.validation.total}`, hint: diagnostics.persistence.mode },
      { label: "Beat Close", value: formatPercent(evaluation.beatCloseRate), hint: evaluation.closeReference },
      { label: "ROI", value: formatPercent(roi.roi), hint: `${roi.settledSampleSize} settled` },
      { label: "Snapshots", value: `${history.totalSnapshots}`, hint: `${history.movementCoverage.marketsWithHistory}/${history.movementCoverage.totalMarkets} markets` }
    ],
    sections: [
      {
        title: "Methodology",
        columns: [
          { key: "field", header: "Field" },
          { key: "value", header: "Value" }
        ],
        rows: [
          { field: "Close reference", value: evaluation.closeReference },
          { field: "CLV space", value: evaluation.evaluationMethodology.clvSpace },
          { field: "ROI stake", value: evaluation.evaluationMethodology.roiStakeModel },
          { field: "Probability source", value: evaluation.evaluationMethodology.probabilitySource }
        ]
      },
      {
        title: "ROI",
        columns: [
          { key: "metric", header: "Metric" },
          { key: "value", header: "Value" }
        ],
        rows: [
          { metric: "ROI", value: formatPercent(roi.roi) },
          { metric: "Units Won", value: fixed(roi.unitsWon, 3) },
          { metric: "Win Rate", value: formatPercent(roi.winRate) },
          { metric: "Confidence", value: roi.confidenceTier },
          { metric: "Sample Warning", value: reliabilityWarning(roi.confidenceTier) }
        ]
      },
      {
        title: "Calibration",
        columns: [
          { key: "metric", header: "Metric" },
          { key: "value", header: "Value" }
        ],
        rows: [
          { metric: "Brier", value: fixed(calibration.brierScore, 4) },
          { metric: "Log Loss", value: fixed(calibration.logLoss, 4) },
          { metric: "Mean Error", value: fixed(calibration.meanCalibrationError, 4) },
          { metric: "Confidence", value: calibration.confidenceTier }
        ]
      },
      {
        title: "Evaluation Windows",
        columns: [
          { key: "window", header: "Window" },
          { key: "samples", header: "Samples" },
          { key: "beatClose", header: "Beat Close" },
          { key: "roi", header: "ROI" }
        ],
        rows: reports.windows.map((window) => ({
          window: window.window,
          samples: `${window.sampleSize}`,
          beatClose: formatPercent(window.clvPerformance.beatCloseRate),
          roi: formatPercent(window.roiPerformance.roi)
        }))
      },
      {
        title: "Factor Performance",
        columns: [
          { key: "factor", header: "Factor" },
          { key: "samples", header: "Samples" },
          { key: "avgClv", header: "Avg CLV" },
          { key: "avgRoi", header: "Avg ROI" }
        ],
        rows: factorPerformance.factors.slice(0, 12).map((factor) => ({
          factor: factor.factor,
          samples: `${factor.sampleSize}`,
          avgClv: fixed(factor.avgCLV, 5),
          avgRoi: fixed(factor.avgROI, 5)
        }))
      },
      {
        title: "History Coverage",
        columns: [
          { key: "field", header: "Field" },
          { key: "value", header: "Value" }
        ],
        rows: [
          { field: "Snapshot Interval", value: `${history.config.intervalSeconds}s` },
          { field: "Retention Window", value: `${history.config.retentionHours}h` },
          { field: "Recent Events", value: `${history.recentEvents.length}` },
          { field: "Recent Update", value: formatUpdatedLabel(history.recentEvents[0]?.newestObservedAt ? new Date(history.recentEvents[0].newestObservedAt).toISOString() : null) }
        ]
      }
    ]
  };
}
