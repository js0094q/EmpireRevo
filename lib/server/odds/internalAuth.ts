export type InternalAuthResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      code: "FORBIDDEN" | "UNAUTHORIZED";
      message: string;
    };

export function authorizeInternalRequest(req: Request): InternalAuthResult {
  const key = process.env.EMPIRE_INTERNAL_API_KEY?.trim() || "";
  const nodeEnv = process.env.NODE_ENV || "development";

  if (!key) {
    if (nodeEnv !== "production") {
      return { ok: true };
    }
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "Internal API key is not configured"
    };
  }

  const provided = req.headers.get("x-empire-internal-key") || new URL(req.url).searchParams.get("internalKey") || "";
  if (provided !== key) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED",
      message: "Unauthorized internal diagnostics request"
    };
  }

  return { ok: true };
}
