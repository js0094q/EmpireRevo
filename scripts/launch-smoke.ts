import process from "node:process";

type SmokeResult = {
  ok: boolean;
  status: number;
  text: string;
};

const baseUrl =
  process.argv.find((arg) => arg.startsWith("--base-url="))?.split("=")[1] ??
  process.env.SMOKE_BASE_URL ??
  "http://127.0.0.1:3000";

const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS) || 8000;
const failures: string[] = [];

async function fetchWithTimeout(path: string): Promise<SmokeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, { signal: controller.signal, cache: "no-store" });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text };
  } finally {
    clearTimeout(timer);
  }
}

async function check(path: string, expectation: (result: SmokeResult) => string | null) {
  const result = await fetchWithTimeout(path);
  const error = expectation(result);
  if (error) {
    failures.push(`${path}: ${error} (status: ${result.status})`);
  }
}

const startsWithJson = (result: SmokeResult, prefix: string) =>
  result.text.slice(0, 64).trim().toLowerCase().startsWith(prefix.toLowerCase());

function isBoardPayloadText(rawText: string): boolean {
  try {
    const parsed = JSON.parse(rawText);
    return Boolean(parsed && typeof parsed === "object" && "updatedAt" in parsed);
  } catch {
    return false;
  }
}

function oddsProviderConfigured(rawText: string): boolean {
  try {
    const parsed = JSON.parse(rawText);
    return Boolean(parsed?.odds_api_status?.configured);
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const statusResult = await fetchWithTimeout("/api/status");
  const hasConfiguredOddsProvider = statusResult.ok && oddsProviderConfigured(statusResult.text);

  await Promise.all([
    check("/", (result) => {
      if (!result.ok) return `HTTP ${result.status}`;
      if (!result.text.includes("Public read-only preview")) return "Testing-phase preview copy missing";
      return null;
    }),
    check("/props", (result) => {
      if (!result.ok) return `HTTP ${result.status}`;
      if (!result.text.includes("Props roadmap")) return "Props route did not render roadmap structure";
      return null;
    }),
    check("/pricing", (result) => (result.status === 404 ? null : "Pricing should remain unavailable in testing mode")),
    check("/api/leads", (result) => (result.status === 405 || result.status === 410 ? null : "Lead capture endpoint should not accept public collection")),
    check("/api/health", (result) => {
      if (!result.ok) return `HTTP ${result.status}`;
      if (!startsWithJson(result, "{\"ok\":true")) return "Did not receive expected health payload";
      return null;
    }),
    check("/api/status", (result) => {
      if (!result.ok) return `HTTP ${result.status}`;
      if (!startsWithJson(result, "{\"ok\":true")) return "Did not receive expected status payload";
      return null;
    }),
    hasConfiguredOddsProvider
      ? check("/api/board?sport=nba&market=h2h&model=weighted&minBooks=2", (result) => {
          if (!result.ok) return `HTTP ${result.status}`;
          if (!isBoardPayloadText(result.text)) return "Board payload shape mismatch";
          return null;
        })
      : check("/api/board?sport=nba&market=h2h&model=weighted&minBooks=2", (result) => {
          if (result.status !== 500) return "Expected missing-key failure when odds provider is not configured";
          if (!result.text.includes("MISSING_KEY")) return "Missing-key failure did not use sanitized public error";
          return null;
        })
  ]);

  if (failures.length) {
    console.error("Launch smoke checks failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Launch smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
