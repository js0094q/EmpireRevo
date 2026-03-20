import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { applyFallbackRateLimit } from "./lib/server/odds/fallbackRateLimit";
import { authorizeInternalHeaders } from "./lib/server/odds/internalAuth";

type RateLimitRule = {
  id: string;
  limit: number;
  windowSec: number;
  match: (req: NextRequest) => boolean;
};

type RateLimitOutcome = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  source: "upstash" | "memory";
};

const hasUpstashConfig = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const INTERNAL_ROUTE_PREFIXES = ["/api/internal/", "/internal/"];

const RATE_LIMIT_RULES: RateLimitRule[] = [
  {
    id: "api_internal_session",
    limit: 12,
    windowSec: 60,
    match: (req) => req.nextUrl.pathname.startsWith("/api/internal/session")
  },
  {
    id: "api_fair",
    limit: 30,
    windowSec: 60,
    match: (req) => req.nextUrl.pathname.startsWith("/api/fair")
  },
  {
    id: "api_board",
    limit: 40,
    windowSec: 60,
    match: (req) => req.nextUrl.pathname.startsWith("/api/board")
  },
  {
    id: "api_odds_raw",
    limit: 10,
    windowSec: 60,
    match: (req) => req.nextUrl.pathname.startsWith("/api/odds") && req.nextUrl.searchParams.get("format") === "raw"
  },
  {
    id: "api_odds",
    limit: 60,
    windowSec: 60,
    match: (req) => req.nextUrl.pathname.startsWith("/api/odds")
  },
  {
    id: "api_internal",
    limit: 25,
    windowSec: 60,
    match: (req) => req.nextUrl.pathname.startsWith("/api/internal/")
  },
  {
    id: "internal_pages",
    limit: 20,
    windowSec: 60,
    match: (req) => req.nextUrl.pathname.startsWith("/internal/")
  },
  {
    id: "api_status",
    limit: 30,
    windowSec: 60,
    match: (req) => req.nextUrl.pathname.startsWith("/api/status")
  },
  {
    id: "api_health",
    limit: 120,
    windowSec: 60,
    match: (req) => req.nextUrl.pathname.startsWith("/api/health")
  },
  {
    id: "api_default",
    limit: 60,
    windowSec: 60,
    match: () => true
  }
];

const upstashLimiters = hasUpstashConfig
  ? new Map(
      RATE_LIMIT_RULES.map((rule) => [
        rule.id,
        new Ratelimit({
          redis: new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL!,
            token: process.env.UPSTASH_REDIS_REST_TOKEN!
          }),
          limiter: Ratelimit.slidingWindow(rule.limit, `${rule.windowSec} s`),
          analytics: true,
          prefix: `ratelimit:empirepicks:${rule.id}`
        })
      ])
    )
  : null;

function selectedRule(req: NextRequest): RateLimitRule {
  return RATE_LIMIT_RULES.find((rule) => rule.match(req)) || RATE_LIMIT_RULES[RATE_LIMIT_RULES.length - 1];
}

function readClientIdentifier(req: NextRequest): string {
  const forwarded = (req.headers.get("x-forwarded-for") || "")
    .split(",")
    .map((value) => value.trim())
    .find(Boolean);
  if (forwarded) return forwarded;
  const realIp = (req.headers.get("x-real-ip") || "").trim();
  if (realIp) return realIp;
  const userAgent = (req.headers.get("user-agent") || "unknown").slice(0, 80);
  return `anonymous:${userAgent}`;
}

function internalRoute(pathname: string): boolean {
  return INTERNAL_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function rejectInternal(req: NextRequest, status: number, code: "UNAUTHORIZED" | "INTERNAL_AUTH_UNAVAILABLE"): NextResponse {
  const isApi = req.nextUrl.pathname.startsWith("/api/");
  if (isApi) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code,
          message: code === "UNAUTHORIZED" ? "Unauthorized internal request" : "Internal access is not configured"
        }
      },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }

  return new NextResponse("Unauthorized", {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}

function conservativeLimit(limit: number): number {
  return Math.max(5, Math.floor(limit / 2));
}

async function applyRateLimit(req: NextRequest): Promise<RateLimitOutcome> {
  const rule = selectedRule(req);
  const clientId = readClientIdentifier(req);
  const key = `${rule.id}:${clientId}`;

  if (!upstashLimiters) {
    const fallback = applyFallbackRateLimit({
      key,
      limit: conservativeLimit(rule.limit),
      windowSec: rule.windowSec
    });
    return {
      ...fallback,
      source: "memory"
    };
  }

  try {
    const limiter = upstashLimiters.get(rule.id);
    if (!limiter) {
      const fallback = applyFallbackRateLimit({
        key,
        limit: conservativeLimit(rule.limit),
        windowSec: rule.windowSec
      });
      return {
        ...fallback,
        source: "memory"
      };
    }
    const { success, limit, remaining, reset } = await limiter.limit(key);
    return {
      success,
      limit,
      remaining,
      reset,
      source: "upstash"
    };
  } catch {
    const fallback = applyFallbackRateLimit({
      key,
      limit: conservativeLimit(rule.limit),
      windowSec: rule.windowSec
    });
    return {
      ...fallback,
      source: "memory"
    };
  }
}

function rateLimitHeaders(result: RateLimitOutcome): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
    "X-RateLimit-Policy": result.source
  };
}

export async function proxy(req: NextRequest) {
  if (internalRoute(req.nextUrl.pathname)) {
    const auth = authorizeInternalHeaders(req.headers);
    if (!auth.ok) {
      return rejectInternal(req, auth.status, auth.code);
    }
  }

  if (req.nextUrl.pathname.startsWith("/api/") || req.nextUrl.pathname.startsWith("/internal/")) {
    const result = await applyRateLimit(req);
    if (!result.success) {
      if (req.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json(
          {
            ok: false,
            error: {
              code: "RATE_LIMITED",
              message: "Too many requests"
            }
          },
          {
            status: 429,
            headers: rateLimitHeaders(result)
          }
        );
      }

      return new NextResponse("Too many requests", {
        status: 429,
        headers: rateLimitHeaders(result)
      });
    }

    const response = NextResponse.next();
    const headers = rateLimitHeaders(result);
    for (const [name, value] of Object.entries(headers)) {
      response.headers.set(name, value);
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/internal/:path*"]
};
