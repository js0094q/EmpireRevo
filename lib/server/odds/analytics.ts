export { summarizeBookBehavior } from "@/lib/server/odds/evaluation";
export { summarizeOutcomeDistributions } from "@/lib/server/odds/evaluation";
export {
  getValidationEvents,
  getValidationSinkMode,
  resetValidationEventsForTests,
  setValidationEventSink,
  trackValidationEvent,
  type ValidationEvent,
  type ValidationOpportunitySnapshot
} from "@/lib/server/odds/validationEvents";
export { buildFactorAnalytics, type FactorAnalyticsSummary } from "@/lib/server/odds/factorAnalytics";
export { buildFactorPerformance, type FactorPerformanceSummary } from "@/lib/server/odds/factorPerformance";
export { buildProbabilityCalibration, type ProbabilityCalibrationSummary } from "@/lib/server/odds/calibrationAnalysis";
export { buildEvaluationReports, type EvaluationReportBundle } from "@/lib/server/odds/evaluationReport";
export { getRoiSummary, type RoiSummary } from "@/lib/server/odds/roiEvaluation";
export {
  DEFAULT_EVALUATION_CLOSE_REFERENCE,
  evaluateRecentValidationEvents,
  evaluateValidationEvent,
  getEvaluationSummary,
  parseCloseReference,
  summarizeEvaluationResults,
  type EvaluationSummary
} from "@/lib/server/odds/evaluationRunner";
