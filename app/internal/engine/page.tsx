import { InternalTable } from "@/components/internal/InternalTable";
import { PersistenceUnavailable } from "@/components/internal/PersistenceUnavailable";
import { StatCard } from "@/components/internal/StatCard";
import { getInternalDiagnostics } from "@/lib/server/odds/internalDiagnostics";

export const runtime = "nodejs";

function pct(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return "--";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function fixed(value: number | null | undefined, digits = 3): string {
  if (!Number.isFinite(value)) return "--";
  return Number(value).toFixed(digits);
}

function reliabilityWarning(tier: "low" | "medium" | "high"): string {
  return tier === "low" ? "Low sample reliability" : "--";
}

export default async function InternalEnginePage() {
  const diagnostics = await getInternalDiagnostics(500);

  if (
    !diagnostics.ok ||
    !diagnostics.calibration ||
    !diagnostics.validation ||
    !diagnostics.factorAnalytics ||
    !diagnostics.evaluation ||
    !diagnostics.roiSummary ||
    !diagnostics.probabilityCalibration ||
    !diagnostics.factorPerformance ||
    !diagnostics.evaluationReports
  ) {
    return <PersistenceUnavailable reason={diagnostics.unavailableReason || "Durable persistence is not configured."} />;
  }

  const calibration = diagnostics.calibration;
  const validation = diagnostics.validation;
  const factor = diagnostics.factorAnalytics;
  const evaluation = diagnostics.evaluation;
  const roi = diagnostics.roiSummary;
  const probabilityCalibration = diagnostics.probabilityCalibration;
  const factorPerformance = diagnostics.factorPerformance;
  const reports = diagnostics.evaluationReports;

  return (
    <main className="grid-shell">
      <h1>Engine Diagnostics</h1>
      <p className="muted">Internal operator surface for CLV, ROI, calibration, factor attribution, and persistence health.</p>

      <section className="internal-card-grid">
        <StatCard label="Persisted Events" value={`${validation.total}`} hint={`Source: ${diagnostics.persistence.mode}`} />
        <StatCard label="Evaluated Samples" value={`${evaluation.sampleSize}`} hint="Joined to closing snapshots" />
        <StatCard label="Beat Close" value={pct(evaluation.beatCloseRate)} hint={`${evaluation.closeReference} (${evaluation.isDefaultCloseReference ? "default" : "operator-selected"})`} />
        <StatCard label="ROI" value={pct(roi.roi)} hint={`${roi.settledSampleSize} settled samples`} />
      </section>

      <InternalTable
        title="Evaluation Methodology"
        rows={[
          {
            key: "Close reference",
            value: evaluation.closeReference
          },
          {
            key: "Reference notes",
            value: evaluation.closeReferenceDescription
          },
          {
            key: "CLV space",
            value: evaluation.evaluationMethodology.clvSpace
          },
          {
            key: "ROI stake model",
            value: evaluation.evaluationMethodology.roiStakeModel
          },
          {
            key: "Probability source",
            value: evaluation.evaluationMethodology.probabilitySource
          },
          {
            key: "Avg display delta (American)",
            value: fixed(evaluation.averageDisplayAmericanDelta, 2)
          }
        ]}
        columns={[
          { key: "key", header: "Field", render: (row) => row.key },
          { key: "value", header: "Value", render: (row) => row.value }
        ]}
      />

      <InternalTable
        title="ROI Panel"
        rows={[
          { metric: "ROI", value: pct(roi.roi) },
          { metric: "Units won", value: fixed(roi.unitsWon, 3) },
          { metric: "Win rate", value: pct(roi.winRate) },
          { metric: "Average edge", value: fixed(roi.averageEdge, 3) },
          { metric: "Sample size", value: `${roi.sampleSize}` },
          { metric: "Settled sample size", value: `${roi.settledSampleSize}` },
          { metric: "Confidence tier", value: roi.confidenceTier },
          { metric: "Sample warning", value: reliabilityWarning(roi.confidenceTier) }
        ]}
        columns={[
          { key: "metric", header: "Metric", render: (row) => row.metric },
          { key: "value", header: "Value", render: (row) => row.value }
        ]}
      />

      <InternalTable
        title="Calibration Panel"
        rows={[
          { metric: "Brier score", value: fixed(probabilityCalibration.brierScore, 4) },
          { metric: "Log loss", value: fixed(probabilityCalibration.logLoss, 4) },
          { metric: "Mean calibration error", value: fixed(probabilityCalibration.meanCalibrationError, 4) },
          { metric: "Max calibration error", value: fixed(probabilityCalibration.maxCalibrationError, 4) },
          { metric: "Sample size", value: `${probabilityCalibration.sampleSize}` },
          { metric: "Settled sample size", value: `${probabilityCalibration.settledSampleSize}` },
          { metric: "Confidence tier", value: probabilityCalibration.confidenceTier },
          { metric: "Sample warning", value: reliabilityWarning(probabilityCalibration.confidenceTier) }
        ]}
        columns={[
          { key: "metric", header: "Metric", render: (row) => row.metric },
          { key: "value", header: "Value", render: (row) => row.value }
        ]}
      />

      <InternalTable
        title="Calibration Curve"
        rows={probabilityCalibration.buckets}
        columns={[
          { key: "bucket", header: "Bucket", render: (row) => row.bucketLabel },
          { key: "samples", header: "Samples", render: (row) => row.sampleSize },
          { key: "expected", header: "Expected", render: (row) => pct(row.expectedWinRate) },
          { key: "actual", header: "Actual", render: (row) => pct(row.actualWinRate) },
          { key: "error", header: "Error", render: (row) => fixed(row.calibrationError, 4) }
        ]}
      />

      <InternalTable
        title="Factor Panel"
        rows={factorPerformance.factors.slice(0, 15)}
        columns={[
          { key: "factor", header: "Factor", render: (row) => row.factor },
          { key: "samples", header: "Samples", render: (row) => row.sampleSize },
          { key: "avgClv", header: "Avg CLV", render: (row) => fixed(row.avgCLV, 5) },
          { key: "avgRoi", header: "Avg ROI", render: (row) => fixed(row.avgROI, 5) },
          { key: "winRate", header: "Win Rate", render: (row) => pct(row.winRate) }
        ]}
      />

      <InternalTable
        title="Factor Reliability"
        rows={[
          { metric: "Sample size", value: `${factorPerformance.sampleSize}` },
          { metric: "Settled sample size", value: `${factorPerformance.settledSampleSize}` },
          { metric: "Confidence tier", value: factorPerformance.confidenceTier },
          { metric: "Sample warning", value: reliabilityWarning(factorPerformance.confidenceTier) }
        ]}
        columns={[
          { key: "metric", header: "Metric", render: (row) => row.metric },
          { key: "value", header: "Value", render: (row) => row.value }
        ]}
      />

      <InternalTable
        title="Pressure Signal Analysis"
        rows={factor.pressureVsCLV.map((clvRow) => {
          const roiRow = factor.pressureVsROI.find((entry) => entry.pressureBucket === clvRow.pressureBucket);
          const timingRow = factor.pressureVsTiming.find((entry) => entry.pressureBucket === clvRow.pressureBucket);
          return {
            pressureBucket: clvRow.pressureBucket,
            samples: clvRow.samples,
            avgClvProbDelta: clvRow.avgClvProbDelta,
            avgROI: roiRow?.avgROI ?? null,
            likelyClosingRate: timingRow?.likelyClosingRate ?? null
          };
        })}
        columns={[
          { key: "bucket", header: "Pressure", render: (row) => row.pressureBucket },
          { key: "samples", header: "Samples", render: (row) => row.samples },
          { key: "clv", header: "Pressure vs CLV", render: (row) => fixed(row.avgClvProbDelta, 5) },
          { key: "roi", header: "Pressure vs ROI", render: (row) => fixed(row.avgROI, 5) },
          { key: "timing", header: "Pressure vs Timing", render: (row) => pct(row.likelyClosingRate) }
        ]}
      />

      <InternalTable
        title="Evaluation Reports"
        rows={reports.windows}
        columns={[
          { key: "window", header: "Window", render: (row) => row.window },
          { key: "samples", header: "Samples", render: (row) => row.sampleSize },
          { key: "settled", header: "Settled", render: (row) => row.settledSampleSize },
          { key: "tier", header: "Tier", render: (row) => row.confidenceTier },
          { key: "warning", header: "Warning", render: (row) => reliabilityWarning(row.confidenceTier) },
          { key: "beatClose", header: "Beat Close", render: (row) => pct(row.clvPerformance.beatCloseRate) },
          { key: "roi", header: "ROI", render: (row) => pct(row.roiPerformance.roi) },
          { key: "brier", header: "Brier", render: (row) => fixed(row.probabilityCalibration.brierScore, 4) }
        ]}
      />

      <InternalTable
        title="Calibration Summary"
        rows={[
          {
            name: "Pinned actionable edge",
            value: calibration.pinned.actionableEdgePct,
            detail: "Minimum edge for pinned actionability"
          },
          {
            name: "Stale threshold",
            value: calibration.stale.thresholds.stalePriceStrength,
            detail: "Stale strength trigger"
          },
          {
            name: "Likely closing urgency",
            value: calibration.timing.thresholds.likelyClosingUrgency,
            detail: "Timing signal cutoff"
          },
          {
            name: "Spread/Totals EV minimum confidence",
            value: calibration.ev.spreadTotals.minimumConfidence,
            detail: "EV defensibility gate"
          }
        ]}
        columns={[
          { key: "name", header: "Parameter", render: (row) => row.name },
          { key: "value", header: "Value", render: (row) => row.value.toFixed(3) },
          { key: "detail", header: "Notes", render: (row) => row.detail }
        ]}
      />

      <InternalTable
        title="Validation Summary"
        rows={validation.bySport}
        columns={[
          { key: "sport", header: "Sport", render: (row) => row.key },
          { key: "count", header: "Events", render: (row) => row.count }
        ]}
      />

      <InternalTable
        title="Validation by Market"
        rows={validation.byMarket}
        columns={[
          { key: "market", header: "Market", render: (row) => row.key },
          { key: "count", header: "Events", render: (row) => row.count }
        ]}
      />

      <InternalTable
        title="EV Defensibility Distribution"
        rows={validation.byEvClass}
        columns={[
          { key: "klass", header: "Class", render: (row) => row.label },
          { key: "count", header: "Events", render: (row) => row.count }
        ]}
      />

      <InternalTable
        title="Confidence Bucket Distribution"
        rows={validation.byConfidenceBucket}
        columns={[
          { key: "bucket", header: "Bucket", render: (row) => row.bucket },
          { key: "count", header: "Events", render: (row) => row.count }
        ]}
      />

      <InternalTable
        title="Factor Contribution vs Beat Close"
        rows={factor.factorContributions.slice(0, 12)}
        columns={[
          { key: "factor", header: "Factor", render: (row) => row.factor },
          { key: "samples", header: "Samples", render: (row) => row.samples },
          { key: "beat", header: "Avg When Beat", render: (row) => (row.avgWhenBeat === null ? "--" : row.avgWhenBeat.toFixed(4)) },
          { key: "miss", header: "Avg When Miss", render: (row) => (row.avgWhenMiss === null ? "--" : row.avgWhenMiss.toFixed(4)) },
          { key: "delta", header: "Delta", render: (row) => (row.delta === null ? "--" : row.delta.toFixed(4)) }
        ]}
      />

      <InternalTable
        title="Penalty Correlation"
        rows={factor.penaltyCorrelations.slice(0, 12)}
        columns={[
          { key: "reason", header: "Reason", render: (row) => row.reason },
          { key: "samples", header: "Samples", render: (row) => row.samples },
          { key: "failRate", header: "Failure Rate", render: (row) => pct(row.failRate) }
        ]}
      />

      <InternalTable
        title="CLV Summary"
        rows={[
          {
            label: "Global beat-close rate",
            value: pct(evaluation.beatCloseRate)
          },
          {
            label: "Pinned beat-close rate",
            value: pct(evaluation.pinnedVsGlobal.pinnedBeatRate)
          },
          {
            label: "Pinned-vs-global sample",
            value: `${evaluation.pinnedVsGlobal.samples}`
          },
          {
            label: "Active close reference",
            value: evaluation.closeReference
          }
        ]}
        columns={[
          { key: "label", header: "Metric", render: (row) => row.label },
          { key: "value", header: "Value", render: (row) => row.value }
        ]}
      />

      <InternalTable
        title="Persistence Panel"
        rows={[
          { label: "Durability mode", value: diagnostics.persistence.mode },
          { label: "Writes attempted", value: `${diagnostics.persistenceHealth.writesAttempted}` },
          { label: "Writes succeeded", value: `${diagnostics.persistenceHealth.writesSucceeded}` },
          { label: "Writes failed", value: `${diagnostics.persistenceHealth.writesFailed}` },
          { label: "Fallback writes", value: `${diagnostics.persistenceHealth.fallbackWrites}` },
          { label: "Recent read failures", value: `${diagnostics.persistenceHealth.recentReadFailures}` },
          { label: "Recent write failures", value: `${diagnostics.persistenceHealth.recentWriteFailures}` },
          { label: "Avg snapshot payload bytes", value: fixed(diagnostics.persistenceHealth.avgSnapshotPayloadBytes, 1) },
          { label: "Avg validation payload bytes", value: fixed(diagnostics.persistenceHealth.avgValidationPayloadBytes, 1) },
          { label: "Avg timeline read latency (ms)", value: fixed(diagnostics.persistenceHealth.avgTimelineReadLatencyMs, 2) },
          { label: "Avg validation read latency (ms)", value: fixed(diagnostics.persistenceHealth.avgValidationReadLatencyMs, 2) },
          { label: "Namespaces touched", value: diagnostics.persistenceHealth.namespacesTouched.join(", ") || "--" },
          { label: "Last telemetry update", value: new Date(diagnostics.persistenceHealth.updatedAt).toLocaleString() }
        ]}
        columns={[
          { key: "label", header: "Metric", render: (row) => row.label },
          { key: "value", header: "Value", render: (row) => row.value }
        ]}
      />
    </main>
  );
}
