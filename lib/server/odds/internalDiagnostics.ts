import { getCalibrationMeta, getOddsCalibration } from "@/lib/server/odds/calibration";
import { summarizeValidationDistributions } from "@/lib/server/odds/evaluation";
import { buildFactorAnalytics } from "@/lib/server/odds/factorAnalytics";
import { buildFactorPerformance } from "@/lib/server/odds/factorPerformance";
import { buildProbabilityCalibration } from "@/lib/server/odds/calibrationAnalysis";
import { buildEvaluationReports } from "@/lib/server/odds/evaluationReport";
import { getEvaluationSummary } from "@/lib/server/odds/evaluationRunner";
import { getPersistenceStatus } from "@/lib/server/odds/persistence";
import { readPersistenceTelemetry } from "@/lib/server/odds/persistenceTelemetry";
import { listValidationEvents } from "@/lib/server/odds/validationStore";

function countBy<T extends string>(items: T[]): Array<{ key: T; count: number }> {
  const map = new Map<T, number>();
  for (const item of items) {
    map.set(item, (map.get(item) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export type InternalDiagnosticsPayload = {
  ok: boolean;
  persistence: ReturnType<typeof getPersistenceStatus>;
  persistenceHealth: Awaited<ReturnType<typeof readPersistenceTelemetry>>;
  unavailableReason?: string;
  calibration?: ReturnType<typeof getOddsCalibration>;
  calibrationMeta?: ReturnType<typeof getCalibrationMeta>;
  validation?: {
    total: number;
    bySport: Array<{ key: string; count: number }>;
    byMarket: Array<{ key: string; count: number }>;
    byEvClass: Array<{ label: string; count: number }>;
    byConfidenceBucket: Array<{ bucket: "low" | "medium" | "high"; count: number }>;
    penaltyReasons: Array<{ reason: string; count: number }>;
  };
  factorAnalytics?: Awaited<ReturnType<typeof buildFactorAnalytics>>;
  evaluation?: Awaited<ReturnType<typeof getEvaluationSummary>>;
  roiSummary?: Awaited<ReturnType<typeof getEvaluationSummary>>["roiSummary"];
  probabilityCalibration?: Awaited<ReturnType<typeof buildProbabilityCalibration>>;
  factorPerformance?: Awaited<ReturnType<typeof buildFactorPerformance>>;
  evaluationReports?: Awaited<ReturnType<typeof buildEvaluationReports>>;
};

export async function getInternalDiagnostics(limit = 400): Promise<InternalDiagnosticsPayload> {
  const persistence = getPersistenceStatus();
  const persistenceHealth = await readPersistenceTelemetry();
  if (!persistence.durable) {
    return {
      ok: false,
      persistence,
      persistenceHealth,
      unavailableReason: "Durable persistence unavailable (Redis not configured)."
    };
  }

  const validationEvents = await listValidationEvents(limit);
  const distributions = summarizeValidationDistributions(validationEvents);

  const [factorAnalytics, evaluation, probabilityCalibration, factorPerformance, evaluationReports] = await Promise.all([
    buildFactorAnalytics(limit),
    getEvaluationSummary(limit),
    buildProbabilityCalibration(limit),
    buildFactorPerformance(limit),
    buildEvaluationReports(limit)
  ]);

  return {
    ok: true,
    persistence,
    persistenceHealth,
    calibration: getOddsCalibration(),
    calibrationMeta: getCalibrationMeta(),
    validation: {
      total: validationEvents.length,
      bySport: countBy(validationEvents.map((event) => event.sportKey)),
      byMarket: countBy(validationEvents.map((event) => event.marketKey)),
      byEvClass: distributions.evDefensibility,
      byConfidenceBucket: distributions.confidenceBuckets,
      penaltyReasons: distributions.penaltyReasons
    },
    factorAnalytics,
    evaluation,
    roiSummary: evaluation.roiSummary,
    probabilityCalibration,
    factorPerformance,
    evaluationReports
  };
}
