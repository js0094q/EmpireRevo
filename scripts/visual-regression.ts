import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium, devices } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { Redis } from "@upstash/redis";
import type {
  ClvResult,
  PersistedEvaluationResult,
  PersistedOutcomeResult,
  PersistedValidationEvent
} from "../lib/server/odds/types";

type RawOddsEvent = {
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    last_update: string;
    markets: Array<{
      key: "h2h" | "spreads" | "totals";
      last_update: string;
      outcomes: Array<{ name: string; price: number; point?: number }>;
    }>;
  }>;
};

type Scenario = {
  name: string;
  path: string;
  mobilePath?: string;
  expectedText: string;
  mobileExpectedText?: string;
  expectedBodyText?: string;
  expectedBodyTexts?: string[];
  expectedStatus?: number;
  internalAuth?: boolean;
};

const MAX_DIFF_RATIO = 0.008;
const FIXED_NOW_ISO = "2026-04-10T12:26:00.000Z";
const FIXED_NOW_MS = Date.parse(FIXED_NOW_ISO);
const ROOT = process.cwd();
const VISUAL_ROOT = path.join(ROOT, "tests", "visual");
const BASELINE_DIR = path.join(VISUAL_ROOT, "baseline");
const CURRENT_DIR = path.join(VISUAL_ROOT, "current");
const DIFF_DIR = path.join(VISUAL_ROOT, "diff");

const updateBaselines = process.argv.includes("--update");
const externalRedisSmoke = process.argv.includes("--external-redis-smoke");

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function eventId(league: string, away: string, home: string, commenceTime: string): string {
  return `${league}_${slugify(away)}_at_${slugify(home)}_${commenceTime}`;
}

type FixtureState = "fresh" | "stale";

function buildFixture(state: FixtureState): RawOddsEvent[] {
  const firstStart = new Date(FIXED_NOW_MS + 2 * 60 * 60 * 1000).toISOString();
  const secondStart = new Date(FIXED_NOW_MS + 5 * 60 * 60 * 1000).toISOString();
  const freshUpdate = new Date(FIXED_NOW_MS - 30 * 1000).toISOString();
  const staleUpdate = new Date(FIXED_NOW_MS - 95 * 60 * 1000).toISOString();
  const timestamp = state === "stale" ? staleUpdate : freshUpdate;

  const commonBooks =
    state === "stale"
      ? ([
          {
            key: "pinnacle",
            title: "Pinnacle",
            h2h: {
              home: -152,
              away: 132
            }
          },
          {
            key: "draftkings",
            title: "DraftKings",
            h2h: {
              home: -146,
              away: 126
            }
          },
          {
            key: "fanduel",
            title: "FanDuel",
            h2h: {
              home: -142,
              away: 122
            }
          },
          {
            key: "caesars",
            title: "Caesars",
            h2h: {
              home: -104,
              away: -104
            }
          }
        ] as const)
      : ([
          {
            key: "pinnacle",
            title: "Pinnacle",
            h2h: {
              home: -126,
              away: 112
            }
          },
          {
            key: "draftkings",
            title: "DraftKings",
            h2h: {
              home: -118,
              away: 106
            }
          },
          {
            key: "fanduel",
            title: "FanDuel",
            h2h: {
              home: -114,
              away: 102
            }
          },
          {
            key: "caesars",
            title: "Caesars",
            h2h: {
              home: -108,
              away: -104
            }
          }
        ] as const);

  function marketSet(params: {
    homeTeam: string;
    awayTeam: string;
    totalPoint: number;
    spreadPoint: number;
    timestamp: string;
  }): RawOddsEvent["bookmakers"] {
    return commonBooks.map((book, index) => ({
      key: book.key,
      title: book.title,
      last_update: params.timestamp,
      markets: [
        {
          key: "h2h",
          last_update: params.timestamp,
          outcomes: [
            { name: params.homeTeam, price: book.h2h.home - index },
            { name: params.awayTeam, price: book.h2h.away + index }
          ]
        },
        {
          key: "spreads",
          last_update: params.timestamp,
          outcomes: [
            { name: params.homeTeam, price: -110 + index, point: -params.spreadPoint },
            { name: params.awayTeam, price: -110 - index, point: params.spreadPoint }
          ]
        },
        {
          key: "totals",
          last_update: params.timestamp,
          outcomes: [
            { name: "Over", price: -112 + index, point: params.totalPoint },
            { name: "Under", price: -108 - index, point: params.totalPoint }
          ]
        }
      ]
    }));
  }

  return [
    {
      commence_time: firstStart,
      home_team: "New York Knicks",
      away_team: "Boston Celtics",
      bookmakers: marketSet({
        homeTeam: "New York Knicks",
        awayTeam: "Boston Celtics",
        totalPoint: 225.5,
        spreadPoint: 3.5,
        timestamp
      })
    },
    {
      commence_time: secondStart,
      home_team: "Los Angeles Lakers",
      away_team: "Phoenix Suns",
      bookmakers: marketSet({
        homeTeam: "Los Angeles Lakers",
        awayTeam: "Phoenix Suns",
        totalPoint: 231.5,
        spreadPoint: 2.5,
        timestamp
      })
    }
  ];
}

function frozenClockSource(): string {
  return `
(() => {
  const fixedNowMs = ${FIXED_NOW_MS};
  Date.now = () => fixedNowMs;
})();
`;
}

async function writeClockShim(): Promise<string> {
  const clockShimPath = path.join(ROOT, ".next", "visual-regression-clock.cjs");
  await mkdir(path.dirname(clockShimPath), { recursive: true });
  await writeFile(clockShimPath, frozenClockSource());
  return clockShimPath;
}

function parseEnvValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

async function loadLocalEnv(keys: string[]): Promise<void> {
  const shellProvided = new Set(keys.filter((key) => Boolean(process.env[key])));
  const aliases = new Map<string, string>([
    ["KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"],
    ["KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"]
  ]);
  for (const fileName of [".env.local", ".env.development.local", ".redis.local"]) {
    const filePath = path.join(ROOT, fileName);
    let contents = "";
    try {
      contents = await readFile(filePath, "utf8");
    } catch {
      continue;
    }

    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) continue;
      const key = trimmed.slice(0, separatorIndex).trim();
      const targetKey = aliases.get(key) || key;
      if (!keys.includes(targetKey) || shellProvided.has(targetKey)) continue;
      process.env[targetKey] = parseEnvValue(trimmed.slice(separatorIndex + 1));
    }
  }
}

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required for --external-redis-smoke`);
  }
  return value;
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to resolve free port"));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

async function waitForHttp(url: string, timeoutMs = 45_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function sportKeyFromPathname(pathname: string): string {
  const [, version, resource, sportKey] = pathname.split("/");
  if (version !== "v4" || resource !== "sports") return "";
  return sportKey || "";
}

function sendJson(res: http.ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.setHeader("Connection", "close");
  res.end(body);
}

function encodeRedisResult(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return Buffer.from(value).toString("base64");
}

function redisKeyDateBucket(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${d.getUTCDate()}`.padStart(2, "0");
  return `${y}${m}${day}`;
}

function seedJson(store: Map<string, string>, key: string, value: unknown): void {
  store.set(key, JSON.stringify(value));
}

function buildVisualValidationEvent(params: {
  id: string;
  eventId: string;
  sideKey: string;
  createdAt: number;
  fairProb: number;
  fairAmerican: number;
  displayedPrice: number;
  rankingScore: number;
  confidenceScore: number;
  evDefensibility: "full" | "qualified" | "suppressed";
}): PersistedValidationEvent {
  return {
    version: 1,
    id: params.id,
    createdAt: params.createdAt,
    sportKey: "basketball_nba",
    eventId: params.eventId,
    marketKey: "h2h",
    sideKey: params.sideKey,
    commenceTime: new Date(FIXED_NOW_MS - 90 * 60 * 1000).toISOString(),
    point: null,
    bookKey: "caesars",
    snapshotRef: null,
    pinnedContext: {
      pinnedBookKey: "caesars",
      pinnedBestPriceAmerican: params.displayedPrice,
      globalBestPriceAmerican: params.displayedPrice
    },
    model: {
      fairAmerican: params.fairAmerican,
      fairProb: params.fairProb,
      rankingScore: params.rankingScore,
      confidenceScore: params.confidenceScore,
      evPct: 2.1,
      evDefensibility: params.evDefensibility
    },
    diagnostics: {
      stalePenalty: 0.22,
      marketPressureLabel: "broad-consensus",
      timingPenalty: 0.18,
      coveragePenalty: 0.08,
      widthPenalty: null,
      reasons: ["Broad market support"],
      factorBreakdown: {
        edge: 0.24,
        confidence: 0.18,
        sharpParticipation: 0.13,
        freshness: 0.11
      }
    },
    execution: {
      displayedPriceAmerican: params.displayedPrice,
      displayedBookKey: "caesars",
      displayedPoint: null
    }
  };
}

function clv(params: { bet: number; close: number; fair: number; delta: number; beat: boolean }): ClvResult {
  return {
    betPriceAmerican: params.bet,
    closePriceAmerican: params.close,
    fairAtBetTime: params.fair,
    betImpliedProb: 0.51,
    closeImpliedProb: 0.53,
    clvProbDelta: params.delta,
    beatClose: params.beat,
    displayAmericanDelta: params.bet - params.close,
    clvAmericanDelta: params.bet - params.close,
    closeReference: "closing_global_best"
  };
}

function buildVisualEvaluation(params: {
  id: string;
  validationEventId: string;
  eventId: string;
  createdAt: number;
  bet: number;
  fair: number;
  beat: boolean;
  rankingDecile: number;
  confidenceBucket: "low" | "medium" | "high";
  evDefensibility: "full" | "qualified" | "suppressed";
}): PersistedEvaluationResult {
  return {
    version: 1,
    id: params.id,
    validationEventId: params.validationEventId,
    createdAt: params.createdAt,
    sportKey: "basketball_nba",
    eventId: params.eventId,
    marketKey: "h2h",
    historyRef: null,
    recommendation: {
      capturedAt: params.createdAt - 15 * 60 * 1000,
      priceAmerican: params.bet,
      point: null,
      impliedProbability: 0.51,
      fairAmerican: params.fair,
      fairProbability: 0.53
    },
    close: {
      globalBestAmerican: params.beat ? params.bet - 8 : params.bet + 8,
      globalBestPoint: null,
      pinnedBestAmerican: params.beat ? params.bet - 6 : params.bet + 10,
      pinnedBestPoint: null,
      sharpConsensusAmerican: params.beat ? params.bet - 5 : params.bet + 6,
      sharpConsensusPoint: null,
      fairAmerican: params.fair,
      fairPoint: null
    },
    clv: {
      global: clv({ bet: params.bet, close: params.beat ? params.bet - 8 : params.bet + 8, fair: params.fair, delta: params.beat ? 0.018 : -0.016, beat: params.beat }),
      pinned: clv({ bet: params.bet, close: params.beat ? params.bet - 6 : params.bet + 10, fair: params.fair, delta: params.beat ? 0.012 : -0.02, beat: params.beat }),
      sharpConsensus: clv({ bet: params.bet, close: params.beat ? params.bet - 5 : params.bet + 6, fair: params.fair, delta: params.beat ? 0.01 : -0.014, beat: params.beat }),
      fair: clv({ bet: params.bet, close: params.fair, fair: params.fair, delta: params.beat ? 0.008 : -0.008, beat: params.beat })
    },
    beatCloseGlobal: params.beat,
    beatClosePinned: params.beat,
    modelEdgeHeld: params.beat,
    confidenceBucket: params.confidenceBucket,
    rankingDecile: params.rankingDecile,
    evDefensibility: params.evDefensibility,
    methodology: {
      closeReference: "closing_global_best",
      clvSpace: "implied_probability",
      displaySpace: "american_odds",
      roiStakeModel: "flat_unit_stake",
      probabilitySource: "validation_event_fair_probability",
      isDefaultCloseReference: true
    }
  };
}

function buildVisualOutcome(params: {
  eventId: string;
  sideKey: string;
  result: "win" | "loss";
  updatedAt: number;
}): PersistedOutcomeResult {
  const id = `basketball_nba:${params.eventId}:h2h:${params.sideKey}`;
  return {
    version: 1,
    id,
    createdAt: params.updatedAt - 5 * 60 * 1000,
    updatedAt: params.updatedAt,
    sportKey: "basketball_nba",
    eventId: params.eventId,
    marketKey: "h2h",
    sideKey: params.sideKey,
    result: params.result,
    finalScore: params.result === "win" ? "112-104" : "98-105",
    closeTimestamp: new Date(params.updatedAt).toISOString(),
    source: "reconciliation"
  };
}

function seedDurableDiagnostics(store: Map<string, string>): void {
  const dayBucket = redisKeyDateBucket(FIXED_NOW_MS);
  const firstCreatedAt = FIXED_NOW_MS - 2 * 60 * 60 * 1000;
  const secondCreatedAt = FIXED_NOW_MS - 70 * 60 * 1000;
  const events = [
    buildVisualValidationEvent({
      id: "visual-validation-1",
      eventId: "visual-event-1",
      sideKey: "away",
      createdAt: firstCreatedAt,
      fairProb: 0.53,
      fairAmerican: -113,
      displayedPrice: -104,
      rankingScore: 74,
      confidenceScore: 0.72,
      evDefensibility: "full"
    }),
    buildVisualValidationEvent({
      id: "visual-validation-2",
      eventId: "visual-event-2",
      sideKey: "home",
      createdAt: secondCreatedAt,
      fairProb: 0.49,
      fairAmerican: 104,
      displayedPrice: 118,
      rankingScore: 66,
      confidenceScore: 0.64,
      evDefensibility: "qualified"
    })
  ];
  const evaluations = [
    buildVisualEvaluation({
      id: "visual-validation-1:eval",
      validationEventId: "visual-validation-1",
      eventId: "visual-event-1",
      createdAt: firstCreatedAt + 30 * 60 * 1000,
      bet: -104,
      fair: -113,
      beat: true,
      rankingDecile: 8,
      confidenceBucket: "medium",
      evDefensibility: "full"
    }),
    buildVisualEvaluation({
      id: "visual-validation-2:eval",
      validationEventId: "visual-validation-2",
      eventId: "visual-event-2",
      createdAt: secondCreatedAt + 30 * 60 * 1000,
      bet: 118,
      fair: 104,
      beat: false,
      rankingDecile: 7,
      confidenceBucket: "medium",
      evDefensibility: "qualified"
    })
  ];
  const outcomes = [
    buildVisualOutcome({ eventId: "visual-event-1", sideKey: "away", result: "win", updatedAt: firstCreatedAt + 75 * 60 * 1000 }),
    buildVisualOutcome({ eventId: "visual-event-2", sideKey: "home", result: "loss", updatedAt: secondCreatedAt + 75 * 60 * 1000 })
  ];

  seedJson(store, "empire:validation:index:days", [dayBucket]);
  seedJson(store, `empire:validation:index:${dayBucket}`, events.map((event) => event.id));
  for (const event of events) {
    seedJson(store, `empire:validation:event:${event.id}`, event);
  }

  seedJson(store, "empire:evaluation:index:days", [dayBucket]);
  seedJson(store, `empire:evaluation:index:${dayBucket}`, evaluations.map((evaluation) => evaluation.id));
  for (const evaluation of evaluations) {
    seedJson(store, `empire:evaluation:event:${evaluation.id}`, evaluation);
  }

  seedJson(store, "empire:outcomes:index:days", [dayBucket]);
  seedJson(store, `empire:outcome:index:${dayBucket}`, outcomes.map((outcome) => outcome.id));
  for (const outcome of outcomes) {
    seedJson(store, `empire:outcome:event:${outcome.id}`, outcome);
  }

  seedJson(store, "empire:odds:history:index:events", ["basketball_nba:visual-event-1", "basketball_nba:visual-event-2"]);
  seedJson(store, "empire:odds:history:index:basketball_nba:visual-event-1", {
    version: 1,
    sportKey: "basketball_nba",
    eventId: "visual-event-1",
    snapshotCount: 4,
    oldestObservedAt: FIXED_NOW_MS - 4 * 60 * 60 * 1000,
    newestObservedAt: FIXED_NOW_MS - 30 * 60 * 1000,
    markets: [
      { marketKey: "h2h", snapshotCount: 3, firstTs: FIXED_NOW_MS - 4 * 60 * 60 * 1000, lastTs: FIXED_NOW_MS - 30 * 60 * 1000 },
      { marketKey: "spreads", snapshotCount: 1, firstTs: FIXED_NOW_MS - 3 * 60 * 60 * 1000, lastTs: FIXED_NOW_MS - 3 * 60 * 60 * 1000 }
    ]
  });
  seedJson(store, "empire:odds:history:index:basketball_nba:visual-event-2", {
    version: 1,
    sportKey: "basketball_nba",
    eventId: "visual-event-2",
    snapshotCount: 2,
    oldestObservedAt: FIXED_NOW_MS - 3 * 60 * 60 * 1000,
    newestObservedAt: FIXED_NOW_MS - 45 * 60 * 1000,
    markets: [
      { marketKey: "h2h", snapshotCount: 2, firstTs: FIXED_NOW_MS - 3 * 60 * 60 * 1000, lastTs: FIXED_NOW_MS - 45 * 60 * 1000 }
    ]
  });
  seedJson(store, "empire:telemetry:persistence:v1", {
    version: 1,
    updatedAt: FIXED_NOW_MS + 1,
    writesAttempted: 12,
    writesSucceeded: 12,
    writesFailed: 0,
    fallbackWrites: 0,
    avgSnapshotPayloadBytes: 1240,
    avgValidationPayloadBytes: 860,
    recentReadFailures: 0,
    recentWriteFailures: 0,
    namespacesTouched: ["empire:evaluation:event", "empire:odds:history", "empire:validation:event"],
    avgTimelineReadLatencyMs: 2,
    avgValidationReadLatencyMs: 3
  });
}

function buildDurableDiagnosticsSeed(): Array<{ key: string; value: unknown }> {
  const store = new Map<string, string>();
  seedDurableDiagnostics(store);
  return Array.from(store.entries()).map(([key, rawValue]) => ({
    key,
    value: JSON.parse(rawValue) as unknown
  }));
}

async function createMockRedisServer(): Promise<{ server: http.Server; port: number }> {
  const store = new Map<string, string>();
  seedDurableDiagnostics(store);

  function runCommand(command: unknown): { result?: unknown; error?: string } {
    if (!Array.isArray(command)) {
      return { error: "invalid redis command" };
    }

    const [verbRaw, keyRaw, valueRaw] = command;
    const verb = String(verbRaw || "").toLowerCase();
    const key = String(keyRaw || "");

    if (verb === "get") {
      const value = store.has(key) ? store.get(key)! : null;
      return { result: encodeRedisResult(value) };
    }

    if (verb === "set") {
      store.set(key, String(valueRaw ?? ""));
      return { result: encodeRedisResult("OK") };
    }

    if (verb === "del") {
      const deleted = store.delete(key) ? 1 : 0;
      return { result: deleted };
    }

    return { error: `unsupported redis command: ${verb}` };
  }

  const server = http.createServer(async (req, res) => {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "method not allowed" });
      return;
    }

    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
    }

    let command: unknown;
    try {
      command = JSON.parse(raw);
    } catch {
      sendJson(res, 400, { error: "invalid redis command" });
      return;
    }

    if (!Array.isArray(command)) {
      sendJson(res, 400, { error: "invalid redis command" });
      return;
    }

    const isPipeline = Array.isArray(command[0]);
    if (isPipeline) {
      sendJson(res, 200, command.map(runCommand));
      return;
    }

    sendJson(res, 200, runCommand(command));
  });

  const port = await getFreePort();
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  return { server, port };
}

async function createMockOddsServer(params: {
  freshFixture: RawOddsEvent[];
  staleFixture: RawOddsEvent[];
}): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");

    if (requestUrl.pathname.startsWith("/v4/sports/") && requestUrl.pathname.endsWith("/odds")) {
      const sportKey = sportKeyFromPathname(requestUrl.pathname);
      if (sportKey === "icehockey_nhl" || sportKey === "americanfootball_nfl") {
        sendJson(res, 429, { message: "visual regression rate limit" });
        return;
      }
      if (sportKey === "baseball_mlb") {
        sendJson(res, 200, []);
        return;
      }
      sendJson(res, 200, sportKey === "basketball_ncaab" ? params.staleFixture : params.freshFixture);
      return;
    }

    if (requestUrl.pathname === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    res.statusCode = 404;
    res.end("Not found");
  });

  const port = await getFreePort();
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  return { server, port };
}

function startNextServer(params: {
  port: number;
  mockBaseUrl: string;
  redisBaseUrl?: string;
  redisToken?: string;
  clockShimPath: string;
}): ChildProcessWithoutNullStreams {
  const nodeOptions = [process.env.NODE_OPTIONS, `--require=${params.clockShimPath}`].filter(Boolean).join(" ");
  const child = spawn("npm", ["run", "dev", "--", "--port", String(params.port)], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions,
      NEXT_TELEMETRY_DISABLED: "1",
      ODDS_API_KEY: "visual-regression-key",
      ODDS_API_BASE: params.mockBaseUrl,
      EMPIRE_INTERNAL_API_KEY: "visual-internal-key",
      ...(params.redisBaseUrl
        ? {
            UPSTASH_REDIS_REST_URL: params.redisBaseUrl,
            UPSTASH_REDIS_REST_TOKEN: params.redisToken || "visual-redis-token"
          }
        : {})
    },
    stdio: "pipe"
  });

  child.stdout.on("data", (chunk: Buffer) => {
    const line = chunk.toString();
    if (line.includes("ready") || line.includes("Ready in")) {
      process.stdout.write(line);
    }
  });

  child.stderr.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk.toString());
  });

  return child;
}

async function comparePng(params: {
  name: string;
  baselinePath: string;
  currentPath: string;
  diffPath: string;
}): Promise<{ pass: boolean; ratio: number }> {
  const baselineBuffer = await readFile(params.baselinePath);
  const currentBuffer = await readFile(params.currentPath);

  const baseline = PNG.sync.read(baselineBuffer);
  const current = PNG.sync.read(currentBuffer);

  if (baseline.width !== current.width || baseline.height !== current.height) {
    return { pass: false, ratio: 1 };
  }

  const diff = new PNG({ width: baseline.width, height: baseline.height });
  const mismatched = pixelmatch(baseline.data, current.data, diff.data, baseline.width, baseline.height, {
    threshold: 0.12
  });

  const ratio = mismatched / (baseline.width * baseline.height);
  if (ratio > MAX_DIFF_RATIO) {
    await writeFile(params.diffPath, PNG.sync.write(diff));
    return { pass: false, ratio };
  }

  return { pass: true, ratio };
}

type RedisBackup = {
  key: string;
  existed: boolean;
  value: unknown;
};

async function seedExternalRedis(redis: Redis): Promise<RedisBackup[]> {
  const backups: RedisBackup[] = [];
  for (const entry of buildDurableDiagnosticsSeed()) {
    const existing = await redis.get<unknown>(entry.key);
    backups.push({
      key: entry.key,
      existed: existing !== null,
      value: existing
    });
    await redis.set(entry.key, entry.value, { ex: 10 * 60 });
  }
  return backups;
}

async function restoreExternalRedis(redis: Redis, backups: RedisBackup[]): Promise<void> {
  for (const backup of backups.reverse()) {
    if (backup.existed) {
      await redis.set(backup.key, backup.value, { ex: 10 * 60 });
    } else {
      await redis.del(backup.key);
    }
  }
}

async function assertInternalDiagnosticsPage(params: {
  appPort: number;
  viewportName: string;
  device?: keyof typeof devices;
  screenshotName: string;
}): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = params.device
      ? await browser.newContext({
          ...devices[params.device],
          timezoneId: "America/New_York"
        })
      : await browser.newContext({
          viewport: { width: 1440, height: 920 },
          deviceScaleFactor: 1,
          timezoneId: "America/New_York"
        });
    await context.addInitScript({ content: frozenClockSource() });
    await context.addCookies([
      {
        name: "empire_internal_session",
        value: "visual-internal-key",
        domain: "127.0.0.1",
        path: "/"
      }
    ]);

    const page = await context.newPage();
    const response = await page.goto(`http://127.0.0.1:${params.appPort}/internal/engine`, { waitUntil: "networkidle" });
    if (response?.status() !== 200) {
      throw new Error(`external-redis-${params.viewportName} returned ${response?.status() ?? "no response"}; expected 200`);
    }
    await page.addStyleTag({
      content: `
        * { animation: none !important; transition: none !important; caret-color: transparent !important; }
        nextjs-portal,
        [data-nextjs-dev-tools-button],
        [data-nextjs-toast],
        [aria-label="Next.js Dev Tools"] {
          display: none !important;
        }
      `
    });

    for (const expectedText of ["Persisted Events", "History Coverage", "redis", "50.0%", "flat_unit_stake"]) {
      try {
        await page.getByText(expectedText).first().waitFor({ state: "visible", timeout: 10_000 });
      } catch (error) {
        const bodyText = await page.locator("body").innerText().catch(() => "");
        const detail = bodyText.trim().replace(/\s+/g, " ").slice(0, 500);
        throw new Error(`external-redis-${params.viewportName} did not render "${expectedText}". Body text: ${detail}`, {
          cause: error
        });
      }
    }

    await page.evaluate(async () => {
      const doc = document as Document & { fonts?: { ready: Promise<unknown> } };
      await doc.fonts?.ready;
    });
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(CURRENT_DIR, params.screenshotName), fullPage: true });
    await context.close();
  } finally {
    await browser.close();
  }
}

async function runExternalRedisSmoke(): Promise<void> {
  await mkdir(CURRENT_DIR, { recursive: true });
  await loadLocalEnv(["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]);

  const redisUrl = requireEnv("UPSTASH_REDIS_REST_URL");
  const redisToken = requireEnv("UPSTASH_REDIS_REST_TOKEN");
  const redis = new Redis({ url: redisUrl, token: redisToken });
  const backups = await seedExternalRedis(redis);

  const freshFixture = buildFixture("fresh");
  const staleFixture = buildFixture("stale");
  const clockShimPath = await writeClockShim();
  const { server: mockServer, port: mockPort } = await createMockOddsServer({ freshFixture, staleFixture });
  const appPort = await getFreePort();
  const appServer = startNextServer({
    port: appPort,
    mockBaseUrl: `http://127.0.0.1:${mockPort}`,
    redisBaseUrl: redisUrl,
    redisToken,
    clockShimPath
  });

  try {
    await waitForHttp(`http://127.0.0.1:${appPort}/api/health`);
    await assertInternalDiagnosticsPage({
      appPort,
      viewportName: "desktop",
      screenshotName: "external-redis-internal-desktop.png"
    });
    await assertInternalDiagnosticsPage({
      appPort,
      viewportName: "mobile",
      device: "iPhone 13",
      screenshotName: "external-redis-internal-mobile.png"
    });
    process.stdout.write("[visual] external redis smoke passed: internal engine rendered Redis-backed diagnostics\n");
  } finally {
    appServer.kill("SIGTERM");
    mockServer.close();
    await restoreExternalRedis(redis, backups);
  }
}

async function run(): Promise<void> {
  await mkdir(BASELINE_DIR, { recursive: true });
  await mkdir(CURRENT_DIR, { recursive: true });
  await mkdir(DIFF_DIR, { recursive: true });

  const freshFixture = buildFixture("fresh");
  const staleFixture = buildFixture("stale");
  const primary = freshFixture[0];
  if (!primary) throw new Error("Fixture generation failed");

  const gameEventId = eventId("nba", primary.away_team, primary.home_team, primary.commence_time);
  const scenarios: Scenario[] = [
    {
      name: "home",
      path: "/?league=nba&market=h2h&model=weighted&window=today",
      expectedText: "Board"
    },
    {
      name: "games",
      path: "/games?league=nba&market=h2h&model=weighted",
      expectedText: "Games"
    },
    {
      name: "game",
      path: `/game/${encodeURIComponent(gameEventId)}?league=nba&market=h2h&model=weighted`,
      expectedText: "Market"
    },
    {
      name: "empty",
      path: "/?league=nba&market=h2h&model=weighted&search=__visual_no_match__",
      expectedText: "No qualifying markets for current filters."
    },
    {
      name: "empty-feed",
      path: "/?league=mlb&market=h2h&model=weighted",
      expectedText: "No qualifying markets for current filters.",
      expectedBodyText: "EmpirePicks only shows markets with live comparable prices."
    },
    {
      name: "error",
      path: "/?league=nhl&market=h2h&model=weighted",
      mobilePath: "/?league=nfl&market=h2h&model=weighted",
      expectedText: "Odds feed is temporarily unavailable",
      mobileExpectedText: "Live odds unavailable"
    },
    {
      name: "stale",
      path: "/?league=ncaab&market=h2h&model=weighted&stale=1",
      expectedText: "Stale on",
      expectedBodyText: "STALE MARKET"
    },
    {
      name: "internal",
      path: "/internal/engine",
      expectedText: "Persisted Events",
      expectedBodyText: "History Coverage",
      expectedBodyTexts: ["redis", "50.0%", "flat_unit_stake"],
      internalAuth: true
    },
    {
      name: "internal-locked",
      path: "/internal/engine",
      expectedText: "Unauthorized",
      expectedStatus: 401
    },
    {
      name: "game-not-found",
      path: "/game/not-current-event?league=nba&market=h2h&model=weighted",
      expectedText: "Game unavailable",
      expectedBodyText: "Return to the board and choose another market."
    },
    {
      name: "game-error",
      path: "/game/error-event?league=nfl&market=h2h&model=weighted",
      expectedText: "Odds unavailable",
      expectedBodyText: "Game detail could not be loaded."
    }
  ];

  const viewports: Array<{ name: string; device?: keyof typeof devices }> = [
    {
      name: "desktop"
    },
    {
      name: "mobile",
      device: "iPhone 13"
    }
  ];

  const clockShimPath = await writeClockShim();
  const { server: mockServer, port: mockPort } = await createMockOddsServer({ freshFixture, staleFixture });
  const { server: mockRedisServer, port: mockRedisPort } = await createMockRedisServer();
  const appPort = await getFreePort();
  const appServer = startNextServer({
    port: appPort,
    mockBaseUrl: `http://127.0.0.1:${mockPort}`,
    redisBaseUrl: `http://127.0.0.1:${mockRedisPort}`,
    clockShimPath
  });

  try {
    await waitForHttp(`http://127.0.0.1:${appPort}/api/health`);

    const browser = await chromium.launch({ headless: true });
    try {
      let hasFailures = false;

      for (const viewport of viewports) {
        const context = viewport.device
          ? await browser.newContext({
              ...devices[viewport.device],
              timezoneId: "America/New_York"
            })
          : await browser.newContext({
              viewport: { width: 1440, height: 920 },
              deviceScaleFactor: 1,
              timezoneId: "America/New_York"
            });
        await context.addInitScript({ content: frozenClockSource() });

        const page = await context.newPage();

        for (const scenario of scenarios) {
          await context.clearCookies();
          if (scenario.internalAuth) {
            await context.addCookies([
              {
                name: "empire_internal_session",
                value: "visual-internal-key",
                domain: "127.0.0.1",
                path: "/"
              }
            ]);
          }
          const key = `${scenario.name}-${viewport.name}`;
          const currentPath = path.join(CURRENT_DIR, `${key}.png`);
          const baselinePath = path.join(BASELINE_DIR, `${key}.png`);
          const diffPath = path.join(DIFF_DIR, `${key}.png`);

          const scenarioPath = viewport.name === "mobile" && scenario.mobilePath ? scenario.mobilePath : scenario.path;
          const expectedText =
            viewport.name === "mobile" && scenario.mobileExpectedText
              ? scenario.mobileExpectedText
              : scenario.expectedText;
          const response = await page.goto(`http://127.0.0.1:${appPort}${scenarioPath}`, { waitUntil: "networkidle" });
          const expectedStatus = scenario.expectedStatus ?? 200;
          if (response?.status() !== expectedStatus) {
            throw new Error(`${key} returned ${response?.status() ?? "no response"}; expected ${expectedStatus}`);
          }
          await page.addStyleTag({
            content: `
              * { animation: none !important; transition: none !important; caret-color: transparent !important; }
              nextjs-portal,
              [data-nextjs-dev-tools-button],
              [data-nextjs-toast],
              [aria-label="Next.js Dev Tools"] {
                display: none !important;
              }
            `
          });
          try {
            await page.getByText(expectedText).first().waitFor({ state: "visible", timeout: 10_000 });
          } catch (error) {
            const bodyText = await page.locator("body").innerText().catch(() => "");
            const detail = bodyText.trim().replace(/\s+/g, " ").slice(0, 500);
            throw new Error(`${key} did not render expected text "${expectedText}". Body text: ${detail}`, {
              cause: error
            });
          }
          const expectedBodyTexts = [
            scenario.expectedBodyText,
            ...(scenario.expectedBodyTexts || [])
          ].filter((entry): entry is string => Boolean(entry));
          if (expectedBodyTexts.length) {
            const bodyText = await page.locator("body").innerText();
            for (const expectedBodyText of expectedBodyTexts) {
              if (!bodyText.includes(expectedBodyText)) {
                const detail = bodyText.trim().replace(/\s+/g, " ").slice(0, 500);
                throw new Error(`${key} did not render required body text "${expectedBodyText}". Body text: ${detail}`);
              }
            }
          }
          await page.evaluate(async () => {
            const doc = document as Document & { fonts?: { ready: Promise<unknown> } };
            await doc.fonts?.ready;
          });
          await page.waitForTimeout(150);
          await page.screenshot({ path: currentPath, fullPage: true });

          let baselineExists = true;
          try {
            await readFile(baselinePath);
          } catch {
            baselineExists = false;
          }

          if (!baselineExists) {
            if (!updateBaselines) {
              hasFailures = true;
              process.stdout.write(`[visual] baseline missing: ${key} (run npm run test:visual -- --update after review)\n`);
              continue;
            }
            await writeFile(baselinePath, await readFile(currentPath));
            process.stdout.write(`[visual] baseline created: ${key}\n`);
            continue;
          }

          if (updateBaselines) {
            await writeFile(baselinePath, await readFile(currentPath));
            process.stdout.write(`[visual] baseline updated: ${key}\n`);
            continue;
          }

          const result = await comparePng({
            name: key,
            baselinePath,
            currentPath,
            diffPath
          });

          if (!result.pass) {
            hasFailures = true;
            process.stdout.write(`[visual] diff failed: ${key} (${(result.ratio * 100).toFixed(2)}% mismatch)\n`);
          } else {
            process.stdout.write(`[visual] pass: ${key} (${(result.ratio * 100).toFixed(2)}% mismatch)\n`);
          }
        }

        await context.close();
      }

      if (hasFailures) {
        throw new Error("Visual regression mismatch detected. Inspect tests/visual/diff/*.png");
      }
    } finally {
      await browser.close();
    }
  } finally {
    appServer.kill("SIGTERM");
    mockServer.close();
    mockRedisServer.close();
  }
}

const command = externalRedisSmoke ? runExternalRedisSmoke : run;

command().catch((error) => {
  process.stderr.write(`visual regression failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
