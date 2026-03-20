import { NextResponse } from "next/server";
import { internalUnexpectedErrorResponse, isValidationError, validationErrorResponse } from "@/lib/server/odds/apiErrors";
import { authorizeInternalRequest, toInternalAuthError } from "@/lib/server/odds/internalAuth";
import { getPersistenceStatus } from "@/lib/server/odds/persistence";
import { buildFactorAnalytics } from "@/lib/server/odds/factorAnalytics";
import { buildFactorPerformance } from "@/lib/server/odds/factorPerformance";
import { buildProbabilityCalibration } from "@/lib/server/odds/calibrationAnalysis";
import { buildEvaluationReports } from "@/lib/server/odds/evaluationReport";
import { getEvaluationSummary, parseCloseReference } from "@/lib/server/odds/evaluationRunner";
import { parseIntegerParam } from "@/lib/server/odds/requestValidation";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = authorizeInternalRequest(req);
  if (!auth.ok) {
    const authError = toInternalAuthError(auth);
    return NextResponse.json(
      {
        ok: false,
        error: authError
      },
      { status: auth.status }
    );
  }

  const persistence = getPersistenceStatus();
  if (!persistence.durable) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "PERSISTENCE_UNAVAILABLE",
          message: "Durable persistence unavailable"
        },
        persistence
      },
      { status: 503 }
    );
  }

  try {
    const url = new URL(req.url);
    const limit = parseIntegerParam({
      name: "limit",
      value: url.searchParams.get("limit"),
      fallback: 300,
      min: 25,
      max: 1000
    });
    const closeReference = parseCloseReference(url.searchParams.get("closeReference"));

    const [evaluation, factorAnalytics, probabilityCalibration, factorPerformance, evaluationReports] = await Promise.all([
      getEvaluationSummary(limit, { closeReference }),
      buildFactorAnalytics(limit),
      buildProbabilityCalibration(limit),
      buildFactorPerformance(limit, { closeReference }),
      buildEvaluationReports(limit, { closeReference })
    ]);

    return NextResponse.json({
      ok: true,
      evaluationMethodology: evaluation.evaluationMethodology,
      evaluation,
      roiSummary: evaluation.roiSummary,
      probabilityCalibration,
      factorPerformance,
      factorAnalytics,
      evaluationReports
    });
  } catch (error) {
    if (isValidationError(error)) {
      return validationErrorResponse(error);
    }
    return internalUnexpectedErrorResponse();
  }
}
