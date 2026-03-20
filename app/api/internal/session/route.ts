import { NextResponse } from "next/server";
import { errorPayload } from "@/lib/server/odds/apiErrors";
import { authorizeInternalRequest, getInternalApiKey, toInternalAuthError } from "@/lib/server/odds/internalAuth";
import { INTERNAL_SESSION_COOKIE, INTERNAL_SESSION_MAX_AGE_SECONDS } from "@/lib/server/odds/internalSession";

export const runtime = "nodejs";

function sessionCookieBase() {
  return {
    name: INTERNAL_SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/"
  };
}

export async function POST(req: Request) {
  const auth = authorizeInternalRequest(req);
  if (!auth.ok) {
    const authError = toInternalAuthError(auth);
    return NextResponse.json(errorPayload(authError.code, authError.message), {
      status: auth.status,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const configuredKey = getInternalApiKey();
  const response = NextResponse.json(
    {
      ok: true
    },
    { headers: { "Cache-Control": "no-store" } }
  );
  response.cookies.set({
    ...sessionCookieBase(),
    value: configuredKey,
    maxAge: INTERNAL_SESSION_MAX_AGE_SECONDS
  });
  return response;
}

export async function DELETE(req: Request) {
  const auth = authorizeInternalRequest(req);
  if (!auth.ok) {
    const authError = toInternalAuthError(auth);
    return NextResponse.json(errorPayload(authError.code, authError.message), {
      status: auth.status,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const response = NextResponse.json(
    {
      ok: true
    },
    { headers: { "Cache-Control": "no-store" } }
  );
  response.cookies.set({
    ...sessionCookieBase(),
    value: "",
    maxAge: 0
  });
  return response;
}
