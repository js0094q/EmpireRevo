import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message: "Lead capture is disabled while EmpirePicks is in public testing mode."
    },
    { status: 410 }
  );
}
