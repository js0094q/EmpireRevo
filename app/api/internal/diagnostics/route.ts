import { NextResponse } from "next/server";
import { internalUnexpectedErrorResponse, isValidationError, validationErrorResponse } from "@/lib/server/odds/apiErrors";
import { authorizeInternalRequest, toInternalAuthError } from "@/lib/server/odds/internalAuth";
import { getInternalDiagnostics } from "@/lib/server/odds/internalDiagnostics";
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

  try {
    const url = new URL(req.url);
    const limit = parseIntegerParam({
      name: "limit",
      value: url.searchParams.get("limit"),
      fallback: 400,
      min: 25,
      max: 1000
    });
    const payload = await getInternalDiagnostics(limit);
    if (!payload.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "PERSISTENCE_UNAVAILABLE",
            message: payload.unavailableReason || "Durable persistence unavailable"
          },
          persistence: payload.persistence,
          persistenceHealth: payload.persistenceHealth
        },
        { status: 503 }
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    if (isValidationError(error)) {
      return validationErrorResponse(error);
    }
    return internalUnexpectedErrorResponse();
  }
}
