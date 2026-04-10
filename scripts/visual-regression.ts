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
};

const MAX_DIFF_RATIO = 0.008;
const ROOT = process.cwd();
const VISUAL_ROOT = path.join(ROOT, "tests", "visual");
const BASELINE_DIR = path.join(VISUAL_ROOT, "baseline");
const CURRENT_DIR = path.join(VISUAL_ROOT, "current");
const DIFF_DIR = path.join(VISUAL_ROOT, "diff");

const updateBaselines = process.argv.includes("--update");

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function eventId(league: string, away: string, home: string, commenceTime: string): string {
  return `${league}_${slugify(away)}_at_${slugify(home)}_${commenceTime}`;
}

function buildFixture(): RawOddsEvent[] {
  const now = Date.now();
  const firstStart = new Date(now + 2 * 60 * 60 * 1000).toISOString();
  const secondStart = new Date(now + 5 * 60 * 60 * 1000).toISOString();

  const commonBooks = [
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
  ] as const;

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
        timestamp: firstStart
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
        timestamp: secondStart
      })
    }
  ];
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

async function createMockOddsServer(fixture: RawOddsEvent[]): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");

    if (requestUrl.pathname.startsWith("/v4/sports/") && requestUrl.pathname.endsWith("/odds")) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(fixture));
      return;
    }

    if (requestUrl.pathname === "/health") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true }));
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
}): ChildProcessWithoutNullStreams {
  const child = spawn("npm", ["run", "dev", "--", "--port", String(params.port)], {
    cwd: ROOT,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      ODDS_API_KEY: "visual-regression-key",
      ODDS_API_BASE: params.mockBaseUrl,
      EMPIRE_INTERNAL_API_KEY: "visual-internal-key"
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

async function run(): Promise<void> {
  await mkdir(BASELINE_DIR, { recursive: true });
  await mkdir(CURRENT_DIR, { recursive: true });
  await mkdir(DIFF_DIR, { recursive: true });

  const fixture = buildFixture();
  const primary = fixture[0];
  if (!primary) throw new Error("Fixture generation failed");

  const gameEventId = eventId("nba", primary.away_team, primary.home_team, primary.commence_time);
  const scenarios: Scenario[] = [
    {
      name: "home",
      path: "/?league=nba&market=h2h&model=weighted&window=today"
    },
    {
      name: "games",
      path: "/games?league=nba&market=h2h&model=weighted"
    },
    {
      name: "game",
      path: `/game/${encodeURIComponent(gameEventId)}?league=nba&market=h2h&model=weighted`
    },
    {
      name: "empty",
      path: "/?league=mlb&market=h2h&model=weighted"
    },
    {
      name: "internal",
      path: "/internal/engine"
    }
  ];

  const viewports: Array<{ name: string; config: Parameters<typeof chromium.launch>[0]; device?: keyof typeof devices }> = [
    {
      name: "desktop",
      config: {
        headless: true
      }
    },
    {
      name: "mobile",
      config: {
        headless: true
      },
      device: "iPhone 13"
    }
  ];

  const { server: mockServer, port: mockPort } = await createMockOddsServer(fixture);
  const appPort = await getFreePort();
  const appServer = startNextServer({
    port: appPort,
    mockBaseUrl: `http://127.0.0.1:${mockPort}`
  });

  try {
    await waitForHttp(`http://127.0.0.1:${appPort}/api/health`);

    const browser = await chromium.launch({ headless: true });
    try {
      let hasFailures = false;

      for (const viewport of viewports) {
        const context = viewport.device
          ? await browser.newContext({
              ...devices[viewport.device]
            })
          : await browser.newContext({
              viewport: { width: 1440, height: 920 },
              deviceScaleFactor: 1
            });

        const page = await context.newPage();

        for (const scenario of scenarios) {
          if (scenario.name === "internal") {
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

          await page.goto(`http://127.0.0.1:${appPort}${scenario.path}`, { waitUntil: "networkidle" });
          await page.addStyleTag({
            content: "* { animation: none !important; transition: none !important; caret-color: transparent !important; }"
          });
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

          if (!baselineExists || updateBaselines) {
            await writeFile(baselinePath, await readFile(currentPath));
            process.stdout.write(`[visual] baseline ${baselineExists ? "updated" : "created"}: ${key}\n`);
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
  }
}

run().catch((error) => {
  process.stderr.write(`visual regression failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
