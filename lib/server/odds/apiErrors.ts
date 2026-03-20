import { NextResponse } from "next/server";
import { RequestValidationError } from "@/lib/server/odds/requestValidation";

type AppError = Error & { code?: string; status?: number; body?: string };

export type PublicError = {
  status: number;
  code: string;
  message: string;
};

type ErrorPayload = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

function toAppError(error: unknown): AppError {
  if (error instanceof Error) return error as AppError;
  return new Error("Unexpected server error");
}

export function isValidationError(error: unknown): error is RequestValidationError {
  return error instanceof RequestValidationError;
}

export function errorPayload(code: string, message: string): ErrorPayload {
  return {
    ok: false,
    error: {
      code,
      message
    }
  };
}

export function validationErrorResponse(error: RequestValidationError): NextResponse {
  return NextResponse.json(errorPayload(error.code, error.message), { status: error.status });
}

export function mapPublicError(error: unknown): PublicError {
  const appError = toAppError(error);
  switch (appError.code) {
    case "MISSING_KEY":
      return {
        status: 500,
        code: "MISSING_KEY",
        message: "Server is missing required odds provider credentials"
      };
    case "UPSTREAM_AUTH_FAILURE":
      return {
        status: 502,
        code: "UPSTREAM_AUTH_FAILURE",
        message: "Upstream authentication failed"
      };
    case "UPSTREAM_RATE_LIMIT":
      return {
        status: 429,
        code: "UPSTREAM_RATE_LIMIT",
        message: "Upstream rate limit reached"
      };
    case "UPSTREAM_EMPTY_PAYLOAD":
      return {
        status: 502,
        code: "UPSTREAM_EMPTY_PAYLOAD",
        message: "Upstream returned an empty payload"
      };
    case "UPSTREAM_UNAVAILABLE":
      return {
        status: 502,
        code: "UPSTREAM_UNAVAILABLE",
        message: "Upstream service unavailable"
      };
    case "UPSTREAM_ERROR":
      return {
        status: 502,
        code: "UPSTREAM_ERROR",
        message: "Upstream service unavailable"
      };
    default:
      return {
        status: 500,
        code: "UNEXPECTED_ERROR",
        message: "Unexpected server error"
      };
  }
}

export function publicErrorResponse(error: PublicError, options: { noStore?: boolean } = {}): NextResponse {
  return NextResponse.json(errorPayload(error.code, error.message), {
    status: error.status,
    headers: options.noStore ? { "Cache-Control": "no-store" } : undefined
  });
}

export function internalUnexpectedErrorResponse(): NextResponse {
  return NextResponse.json(errorPayload("UNEXPECTED_ERROR", "Unexpected internal server error"), { status: 500 });
}
