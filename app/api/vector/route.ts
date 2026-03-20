import { Index } from "@upstash/vector";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type VectorConfig = {
  url: string;
  token: string;
};

function readVectorConfig(): VectorConfig | null {
  const url = (process.env.UPSTASH_VECTOR_REST_URL || "").trim();
  const token = (process.env.UPSTASH_VECTOR_REST_TOKEN || "").trim();
  if (!url || !token) return null;
  return { url, token };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = (searchParams.get("id") || "").trim();

  if (!id) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "BAD_REQUEST",
          message: "Missing id parameter"
        }
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const config = readVectorConfig();
  if (!config) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VECTOR_NOT_CONFIGURED",
          message: "Vector index is not configured"
        }
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const index = new Index({
      url: config.url,
      token: config.token
    });
    const result = await index.fetch([id], {
      includeData: true
    });

    return NextResponse.json(
      { result: result[0] ?? null },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VECTOR_FETCH_FAILED",
          message: "Failed to fetch vector"
        }
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
