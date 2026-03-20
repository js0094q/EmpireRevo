import { INTERNAL_SESSION_COOKIE, readCookieValue } from "@/lib/server/odds/internalSession";

export type InternalAuthResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      code: "UNAUTHORIZED" | "INTERNAL_AUTH_UNAVAILABLE";
    };

function parseBearerToken(value: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return "";
  return trimmed.slice(7).trim();
}

function safeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);

  // Use a fixed loop with length folding to avoid short-circuit timing leaks.
  let mismatch = leftBytes.length ^ rightBytes.length;
  for (let idx = 0; idx < maxLength; idx += 1) {
    mismatch |= (leftBytes[idx] ?? 0) ^ (rightBytes[idx] ?? 0);
  }
  return mismatch === 0;
}

export function getInternalApiKey(): string {
  return (process.env.EMPIRE_INTERNAL_API_KEY || "").trim();
}

function readProvidedKeyFromHeaders(headers: Headers): string {
  const authHeader = parseBearerToken(headers.get("authorization"));
  if (authHeader) return authHeader;
  const headerKey = (headers.get("x-empire-internal-key") || "").trim();
  if (headerKey) return headerKey;
  return readCookieValue(headers.get("cookie"), INTERNAL_SESSION_COOKIE);
}

export function authorizeInternalHeaders(headers: Headers): InternalAuthResult {
  const configuredKey = getInternalApiKey();
  if (!configuredKey) {
    return {
      ok: false,
      status: 503,
      code: "INTERNAL_AUTH_UNAVAILABLE"
    };
  }

  const provided = readProvidedKeyFromHeaders(headers);
  if (!provided || !safeEqual(provided, configuredKey)) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHORIZED"
    };
  }

  return { ok: true };
}

export function authorizeInternalRequest(req: Request): InternalAuthResult {
  return authorizeInternalHeaders(req.headers);
}

export function toInternalAuthError(auth: Extract<InternalAuthResult, { ok: false }>): {
  code: "UNAUTHORIZED" | "INTERNAL_AUTH_UNAVAILABLE";
  message: string;
} {
  if (auth.code === "INTERNAL_AUTH_UNAVAILABLE") {
    return {
      code: auth.code,
      message: "Internal access is not configured"
    };
  }
  return {
    code: auth.code,
    message: "Unauthorized internal request"
  };
}
