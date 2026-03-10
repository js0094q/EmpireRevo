import { NextResponse } from "next/server";
import { authorizeInternalRequest } from "@/lib/server/odds/internalAuth";
import { getPersistenceStatus } from "@/lib/server/odds/persistence";
import { buildFactorAnalytics } from "@/lib/server/odds/factorAnalytics";
import { buildFactorPerformance } from "@/lib/server/odds/factorPerformance";
import { buildProbabilityCalibration } from "@/lib/server/odds/calibrationAnalysis";
import { buildEvaluationReports } from "@/lib/server/odds/evaluationReport";
import { getEvaluationSummary, parseCloseReference } from "@/lib/server/odds/evaluationRunner";

export const runtime = "nodejs";

function parseLimit(value: string | null, fallback = 300): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(25, Math.min(1000, Math.floor(parsed)));
}

export async function GET(req: Request) {
  const auth = authorizeInternalRequest(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: auth.code,
          message: auth.message
        }
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
    const limit = parseLimit(url.searchParams.get("limit"), 300);
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
    const message = error instanceof Error ? error.message : "Unexpected evaluation summary error";
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UNEXPECTED_ERROR",
          message
        }
      },
      { status: 500 }
    );
  }
}
