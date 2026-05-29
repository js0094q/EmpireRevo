import { NextResponse } from "next/server";

export const runtime = "nodejs";

const INTENTS = new Set(["launch_access", "individual_checkout", "pro_checkout", "resource_download", "contact"]);
const RESOURCES = new Set(["ev-betting", "clv", "bankroll", "line-shopping", "market-inefficiencies", "none"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_PATTERN = /^\d{5}$/;

function cleanString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function webhookUrl(): URL | null {
  const raw = (process.env.LEAD_CAPTURE_WEBHOOK_URL || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON payload." }, { status: 400 });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const email = cleanString(record.email, 254).toLowerCase();
  const zipCode = cleanString(record.zipCode, 5);
  const intent = cleanString(record.intent, 40) || "launch_access";
  const resource = cleanString(record.resource, 80) || "none";
  const placement = cleanString(record.placement, 80) || "unknown";

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ ok: false, message: "Enter a valid email address." }, { status: 400 });
  }
  if (!ZIP_PATTERN.test(zipCode)) {
    return NextResponse.json({ ok: false, message: "Enter a 5-digit ZIP code." }, { status: 400 });
  }
  if (!INTENTS.has(intent)) {
    return NextResponse.json({ ok: false, message: "Unsupported lead intent." }, { status: 400 });
  }
  if (!RESOURCES.has(resource)) {
    return NextResponse.json({ ok: false, message: "Unsupported resource." }, { status: 400 });
  }

  const configuredWebhook = webhookUrl();
  const payload = {
    email,
    zipCode,
    intent,
    resource,
    placement,
    createdAt: new Date().toISOString()
  };

  if (configuredWebhook) {
    const response = await fetch(configuredWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      return NextResponse.json({ ok: false, message: "Lead capture destination rejected the request." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, captured: true });
  }

  return NextResponse.json(
    {
      ok: true,
      captured: false,
      message: "Lead capture webhook is not configured; use email fallback."
    },
    { status: 202 }
  );
}
