import { NextResponse } from "next/server";
import { getOddsApiKey } from "@/lib/server/odds/env";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    oddsApiConfigured: Boolean(getOddsApiKey())
  });
}
