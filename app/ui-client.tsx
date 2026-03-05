"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FairBoardResponse, FairEvent, FairOutcomeBook } from "@/lib/server/odds/types";
import { bookMetaFor } from "@/lib/ui/bookMeta";
import { teamAbbrev, teamLogoFor } from "@/lib/ui/teamMeta";

const LEAGUES = [
  { key: "nba", label: "NBA" },
  { key: "nfl", label: "NFL" },
  { key: "nhl", label: "NHL" },
  { key: "ncaab", label: "NCAAB" },
  { key: "mlb", label: "MLB" }
] as const;

const MARKETS = [
  { key: "h2h", label: "Moneyline" },
  { key: "spreads", label: "Spread" },
  { key: "totals", label: "Total" }
] as const;

type SortKey = "soonest" | "edge" | "best";
type HistoryWindowKey = "15m" | "1h" | "6h" | "24h";
type ChartView = "best" | "top_books";

type UiFlags = {
  condensed: boolean;
  bestOnly: boolean;
  showLogos: boolean;
  showTeamLogos: boolean;
  editorNoteOpen: boolean;
};

const HISTORY_WINDOWS: Array<{ key: HistoryWindowKey; label: string; ms: number }> = [
  { key: "15m", label: "15m", ms: 15 * 60 * 1000 },
  { key: "1h", label: "1h", ms: 60 * 60 * 1000 },
  { key: "6h", label: "6h", ms: 6 * 60 * 60 * 1000 },
  { key: "24h", label: "24h", ms: 24 * 60 * 60 * 1000 }
];

const CHART_COLORS = ["#56cfff", "#7aefc3", "#ffd36a", "#f59666"];
const EDGE_THRESHOLD_FOR_SOON = 1;

type ChartSeries = {
  id: string;
  label: string;
  color: string;
  points: Array<{ ts: number; priceAmerican: number }>;
};

type EditorNoteItem = {
  id: string;
  eventId: string;
  matchup: string;
  startTime: string;
  rationale: string;
  marketLabel: string;
};

function formatAmerican(price: number): string {
  return price > 0 ? `+${price}` : `${price}`;
}

function setParam(router: ReturnType<typeof useRouter>, searchParams: URLSearchParams, key: string, value: string) {
  const next = new URLSearchParams(searchParams.toString());
  next.set(key, value);
  router.replace(`/?${next.toString()}`);
}

function formatUpdatedAt(updatedAtIso: string): string {
  const ts = Date.parse(updatedAtIso);
  if (!Number.isFinite(ts)) return "Updated recently";
  const diffMinutes = Math.max(0, Math.floor((Date.now() - ts) / 60_000));
  const relative = diffMinutes < 1 ? "just now" : `${diffMinutes}m ago`;
  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(ts));
  return `Updated ${relative} (${clock} ET)`;
}

function edgeBucket(edgePct: number): "good" | "bad" | "neutral" {
  if (edgePct >= 0.5) return "good";
  if (edgePct <= -0.5) return "bad";
  return "neutral";
}

function edgeHeatStyle(edgePct: number): CSSProperties {
  const bucket = edgeBucket(edgePct);
  if (bucket === "good") return { backgroundColor: "var(--edge-good-bg)" };
  if (bucket === "bad") return { backgroundColor: "var(--edge-bad-bg)" };
  return {};
}

function marketLabel(market: FairBoardResponse["market"]): string {
  if (market === "spreads") return "Spread";
  if (market === "totals") return "Total";
  return "Moneyline";
}

function windowMs(key: HistoryWindowKey): number {
  return HISTORY_WINDOWS.find((entry) => entry.key === key)?.ms ?? 24 * 60 * 60 * 1000;
}

function pointsForBook(book: FairOutcomeBook, windowRangeMs: number): Array<{ ts: number; priceAmerican: number }> {
  const raw = book.movement?.history || [];
  if (!raw.length) return [];

  const parsed = raw
    .map((entry) => ({ ts: Date.parse(entry.ts), priceAmerican: entry.priceAmerican }))
    .filter((entry) => Number.isFinite(entry.ts) && Number.isFinite(entry.priceAmerican));
  if (!parsed.length) return [];

  const latestTs = parsed.reduce((max, item) => Math.max(max, item.ts), 0);
  const minTs = latestTs - windowRangeMs;
  const sliced = parsed.filter((item) => item.ts >= minTs);
  return sliced.length ? sliced : parsed;
}

function buildOutcomeSeries(outcome: FairEvent["outcomes"][number], view: ChartView, windowRangeMs: number): ChartSeries[] {
  const ranked = [...outcome.books]
    .filter((book) => (book.movement?.history?.length || 0) > 0)
    .sort((a, b) => b.weight - a.weight || Number(b.isBestPrice) - Number(a.isBestPrice));
  if (!ranked.length) return [];

  const selected = view === "best" ? [ranked.find((book) => book.isBestPrice) || ranked[0]] : ranked.slice(0, 3);

  return selected.map((book, index) => ({
    id: `${book.bookKey}-${outcome.name}`,
    label: book.title,
    color: CHART_COLORS[index % CHART_COLORS.length],
    points: pointsForBook(book, windowRangeMs)
  }));
}

function rowSeriesForEvent(event: FairEvent, windowRangeMs: number): ChartSeries[] {
  const firstOutcome = event.outcomes[0];
  if (!firstOutcome) return [];
  return buildOutcomeSeries(firstOutcome, "best", windowRangeMs).slice(0, 1);
}

function Sparkline({ series, compact = true }: { series: ChartSeries[]; compact?: boolean }) {
  const usable = series.filter((entry) => entry.points.length >= 2);
  if (!usable.length) return <div className="sparkline-placeholder">--</div>;

  const allPoints = usable.flatMap((entry) => entry.points);
  const minTs = Math.min(...allPoints.map((entry) => entry.ts));
  const maxTs = Math.max(...allPoints.map((entry) => entry.ts));
  const minPrice = Math.min(...allPoints.map((entry) => entry.priceAmerican));
  const maxPrice = Math.max(...allPoints.map((entry) => entry.priceAmerican));
  const tsRange = Math.max(1, maxTs - minTs);
  const priceRange = Math.max(1, maxPrice - minPrice);

  const height = compact ? 26 : 86;
  const width = 100;
  const strokeWidth = compact ? 2.8 : 1.8;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={compact ? "sparkline" : "sparkline-lg"}
      role="img"
      aria-label="Odds movement history"
    >
      {usable.map((entry) => {
        const polyline = entry.points
          .map((point) => {
            const x = ((point.ts - minTs) / tsRange) * width;
            const y = height - ((point.priceAmerican - minPrice) / priceRange) * height;
            return `${x},${y}`;
          })
          .join(" ");
        const last = entry.points[entry.points.length - 1];
        const lastX = ((last.ts - minTs) / tsRange) * width;
        const lastY = height - ((last.priceAmerican - minPrice) / priceRange) * height;
        return (
          <g key={entry.id}>
            <polyline
              points={polyline}
              fill="none"
              stroke={entry.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx={lastX} cy={lastY} r={compact ? 2.4 : 1.9} fill={entry.color} />
          </g>
        );
      })}
    </svg>
  );
}

function SeriesLegend({ series }: { series: ChartSeries[] }) {
  const visible = series.filter((item) => item.points.length >= 2);
  if (visible.length <= 1) return null;

  return (
    <div className="series-legend">
      {visible.map((item) => (
        <span key={item.id}>
          <i style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function formatLastPointTs(series: ChartSeries[]): string {
  const lastTs = series
    .flatMap((entry) => entry.points)
    .reduce((max, point) => Math.max(max, point.ts), 0);
  if (!lastTs) return "--";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(lastTs));
}

function HistoryControls({
  historyWindow,
  setHistoryWindow,
  chartView,
  setChartView
}: {
  historyWindow: HistoryWindowKey;
  setHistoryWindow: (next: HistoryWindowKey) => void;
  chartView: ChartView;
  setChartView: (next: ChartView) => void;
}) {
  return (
    <div className="history-controls">
      <div className="toggle-group">
        {HISTORY_WINDOWS.map((entry) => (
          <button
            key={entry.key}
            className={historyWindow === entry.key ? "active" : ""}
            onClick={() => setHistoryWindow(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div className="toggle-group">
        <button className={chartView === "best" ? "active" : ""} onClick={() => setChartView("best")}>
          Best book line
        </button>
        <button className={chartView === "top_books" ? "active" : ""} onClick={() => setChartView("top_books")}>
          Top books
        </button>
      </div>
    </div>
  );
}

function FairBestMicrobar({ fairProb, bestBookProb }: { fairProb: number; bestBookProb: number }) {
  const fairPct = Math.max(0, Math.min(100, fairProb * 100));
  const bestPct = Math.max(0, Math.min(100, bestBookProb * 100));
  const edge = (bestBookProb - fairProb) * 100;

  return (
    <div className="microbar-wrap" title="Edge = implied(best) vs implied(fair)">
      <div className="microbar-track">
        <span className="microbar-fair" style={{ left: `${fairPct}%` }} />
        <span className="microbar-best" style={{ left: `${bestPct}%` }} />
      </div>
      <small className={Math.abs(edge) >= 1 ? "edge-badge" : "muted"}>{edge.toFixed(2)}%</small>
    </div>
  );
}

function bestBookProb(outcomes: FairOutcomeBook[]): number {
  const best = outcomes.find((row) => row.isBestPrice) || outcomes[0];
  return best?.impliedProbNoVig || 0.5;
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const sq = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  return sq / (values.length - 1);
}

function buildEditorNoteItems(events: FairEvent[], market: FairBoardResponse["market"]): EditorNoteItem[] {
  if (!hasAny(events.length)) return [];

  const byId = new Map(events.map((event) => [event.id, event]));
  const picks: Array<{ eventId: string; rationale: string; weight: number }> = [];

  const topEdge = [...events].sort((a, b) => b.maxAbsEdgePct - a.maxAbsEdgePct)[0];
  if (topEdge) {
    picks.push({
      eventId: topEdge.id,
      rationale: `Top edge signal (${topEdge.maxAbsEdgePct.toFixed(2)}% max).`,
      weight: Math.abs(topEdge.maxAbsEdgePct)
    });
  }

  const shopGapRanked = events
    .map((event) => {
      let bestGap = 0;
      for (const outcome of event.outcomes) {
        const prices = outcome.books.map((book) => book.priceAmerican).sort((a, b) => b - a);
        if (prices.length > 1) bestGap = Math.max(bestGap, prices[0] - prices[1]);
      }
      return { event, bestGap };
    })
    .sort((a, b) => b.bestGap - a.bestGap);
  if (shopGapRanked[0] && shopGapRanked[0].bestGap > 0) {
    picks.push({
      eventId: shopGapRanked[0].event.id,
      rationale: `Largest shop gap (${shopGapRanked[0].bestGap} cents).`,
      weight: shopGapRanked[0].bestGap
    });
  }

  const disagreementRanked = events
    .map((event) => {
      const outcomeVars = event.outcomes.map((outcome) => variance(outcome.books.map((book) => book.impliedProbNoVig)));
      return { event, disagreement: Math.max(...outcomeVars, 0) };
    })
    .sort((a, b) => b.disagreement - a.disagreement);
  if (disagreementRanked[0] && disagreementRanked[0].disagreement > 0) {
    picks.push({
      eventId: disagreementRanked[0].event.id,
      rationale: `Highest book disagreement (variance ${disagreementRanked[0].disagreement.toFixed(4)}).`,
      weight: disagreementRanked[0].disagreement
    });
  }

  const soonEdge = events
    .filter((event) => event.maxAbsEdgePct >= EDGE_THRESHOLD_FOR_SOON)
    .sort((a, b) => Date.parse(a.commenceTime) - Date.parse(b.commenceTime))[0];
  if (soonEdge) {
    picks.push({
      eventId: soonEdge.id,
      rationale: `Starts soon with >= ${EDGE_THRESHOLD_FOR_SOON.toFixed(1)}% edge.`,
      weight: 0.5
    });
  }

  const unique = new Set<string>();
  const marketText = marketLabel(market);
  const items: EditorNoteItem[] = [];

  for (const pick of picks.sort((a, b) => b.weight - a.weight)) {
    if (unique.has(pick.eventId)) continue;
    const event = byId.get(pick.eventId);
    if (!event) continue;
    unique.add(pick.eventId);
    items.push({
      id: `${pick.eventId}-${items.length}`,
      eventId: pick.eventId,
      matchup: `${event.awayTeam} @ ${event.homeTeam}`,
      startTime: new Date(event.commenceTime).toLocaleString(),
      rationale: pick.rationale,
      marketLabel: marketText
    });
    if (items.length >= 4) break;
  }

  return items;
}

function hasAny(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function TeamLabel({
  teamName,
  showLogo,
  logoFailed,
  onLogoError
}: {
  teamName: string;
  showLogo: boolean;
  logoFailed: boolean;
  onLogoError: () => void;
}) {
  const logo = teamLogoFor(teamName);
  const showImage = showLogo && logo && !logoFailed;

  return (
    <span className="team-label">
      <span className="team-logo-slot" aria-hidden>
        {showImage ? (
          <img
            src={logo}
            alt=""
            width={18}
            height={18}
            loading="lazy"
            decoding="async"
            className="team-logo"
            onError={onLogoError}
          />
        ) : (
          <span className="team-abbrev">{teamAbbrev(teamName)}</span>
        )}
      </span>
      <strong>{teamName}</strong>
    </span>
  );
}

function BookMark({
  bookKey,
  title,
  showLogo,
  failed,
  onError,
  compact = false
}: {
  bookKey: string;
  title: string;
  showLogo: boolean;
  failed: boolean;
  onError: () => void;
  compact?: boolean;
}) {
  const meta = bookMetaFor(bookKey, title);
  const showImage = showLogo && meta.logoSrc && !failed;

  return (
    <span className={`book-mark ${compact ? "compact" : ""}`}>
      <span className="book-logo-slot" aria-hidden>
        {showImage ? (
          <img
            src={meta.logoSrc}
            alt=""
            width={16}
            height={16}
            loading="lazy"
            decoding="async"
            className="book-logo"
            onError={onError}
          />
        ) : (
          <span className="book-logo-fallback">{meta.shortLabel}</span>
        )}
      </span>
      {!compact ? <span>{meta.label}</span> : null}
    </span>
  );
}

export function OddsGridClient({
  board,
  league,
  windowKey
}: {
  board: FairBoardResponse;
  league: string;
  windowKey: "today" | "next24";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sortBy, setSortBy] = useState<SortKey>("edge");
  const [search, setSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<FairEvent | null>(null);
  const [bookFilter, setBookFilter] = useState<Set<string>>(new Set());
  const [showBookMenu, setShowBookMenu] = useState(false);
  const [historyWindow, setHistoryWindow] = useState<HistoryWindowKey>("6h");
  const [chartView, setChartView] = useState<ChartView>("best");
  const defaultShowTeamLogos = typeof window === "undefined" ? true : !window.matchMedia("(max-width: 900px)").matches;
  const [uiFlags, setUiFlags] = useState<UiFlags>({
    condensed: false,
    bestOnly: false,
    showLogos: true,
    showTeamLogos: defaultShowTeamLogos,
    editorNoteOpen: true
  });
  const [failedBookLogos, setFailedBookLogos] = useState<Set<string>>(new Set());
  const [failedTeamLogos, setFailedTeamLogos] = useState<Set<string>>(new Set());

  function setFlag(flag: keyof UiFlags, value: boolean) {
    setUiFlags((prev) => ({ ...prev, [flag]: value }));
  }

  const historyWindowRangeMs = useMemo(() => windowMs(historyWindow), [historyWindow]);

  const visibleBooks = useMemo(() => {
    if (bookFilter.size === 0) return board.books;
    return board.books.filter((book) => bookFilter.has(book.key));
  }, [board.books, bookFilter]);
  const visibleBookKeys = useMemo(() => new Set(visibleBooks.map((book) => book.key)), [visibleBooks]);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    let events = board.events;

    if (query) {
      events = events.filter((event) => `${event.awayTeam} ${event.homeTeam}`.toLowerCase().includes(query));
    }

    events = events.filter((event) => {
      if (bookFilter.size === 0) return true;
      return event.outcomes.some((outcome) => outcome.books.some((row) => bookFilter.has(row.bookKey)));
    });

    if (sortBy === "soonest") {
      return [...events].sort((a, b) => Date.parse(a.commenceTime) - Date.parse(b.commenceTime));
    }

    if (sortBy === "best") {
      return [...events].sort((a, b) => {
        const aBest = Math.max(...a.outcomes.map((outcome) => outcome.bestPrice));
        const bBest = Math.max(...b.outcomes.map((outcome) => outcome.bestPrice));
        return bBest - aBest;
      });
    }

    return [...events].sort((a, b) => b.maxAbsEdgePct - a.maxAbsEdgePct);
  }, [board.events, bookFilter, search, sortBy]);

  const maxEdgeAbs = useMemo(() => {
    let maxAbs = 0;
    for (const event of filteredEvents) {
      for (const outcome of event.outcomes) {
        for (const row of outcome.books) {
          if (!visibleBookKeys.has(row.bookKey)) continue;
          if (uiFlags.bestOnly && !row.isBestPrice) continue;
          maxAbs = Math.max(maxAbs, Math.abs(row.edgePct));
        }
      }
    }
    return maxAbs;
  }, [filteredEvents, uiFlags.bestOnly, visibleBookKeys]);

  const editorItems = useMemo(() => buildEditorNoteItems(filteredEvents, board.market), [filteredEvents, board.market]);

  function openEvent(eventId: string) {
    const event = filteredEvents.find((item) => item.id === eventId);
    if (!event) return;
    setSelectedEvent(event);
    const el = document.getElementById(`event-row-${eventId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
  }

  return (
    <main className={`grid-shell league-${league}`}>
      <header className="grid-topbar">
        <div className="brand">
          <div className="logo-mark" aria-hidden>
            <span className="logo-bar" />
            <span className="logo-arc" />
          </div>
          <div>
            <strong>EmpirePicks</strong>
            <p>Odds Grid + Sharp-Weighted Fair Line</p>
          </div>
        </div>

        <div className="toolbar-controls">
          <div className="league-tabs">
            {LEAGUES.map((item) => (
              <button
                key={item.key}
                className={league === item.key ? "active" : ""}
                onClick={() => setParam(router, new URLSearchParams(searchParams?.toString() || ""), "league", item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="league-tabs">
            {MARKETS.map((item) => (
              <button
                key={item.key}
                className={board.market === item.key ? "active" : ""}
                onClick={() => setParam(router, new URLSearchParams(searchParams?.toString() || ""), "market", item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="league-tabs">
            <button
              className={windowKey === "today" ? "active" : ""}
              onClick={() => setParam(router, new URLSearchParams(searchParams?.toString() || ""), "window", "today")}
            >
              Today
            </button>
            <button
              className={windowKey === "next24" ? "active" : ""}
              onClick={() => setParam(router, new URLSearchParams(searchParams?.toString() || ""), "window", "next24")}
            >
              Next 24h
            </button>
          </div>

          <div className="league-tabs">
            <button
              className={board.model === "sharp" ? "active" : ""}
              onClick={() => setParam(router, new URLSearchParams(searchParams?.toString() || ""), "model", "sharp")}
              title="Weighted blend of sharper books; not a guarantee."
            >
              Sharp-weighted fair
            </button>
            <button
              className={board.model === "equal" ? "active" : ""}
              onClick={() => setParam(router, new URLSearchParams(searchParams?.toString() || ""), "model", "equal")}
            >
              Equal-weighted fair
            </button>
          </div>

          <button className="refresh-btn" onClick={() => router.refresh()}>
            Refresh
          </button>
        </div>
      </header>

      <section className="summary-strip">
        <div>
          <strong>{filteredEvents.length}</strong>
          <span> games</span>
        </div>
        <div>
          <strong>{formatUpdatedAt(board.updatedAt)}</strong>
        </div>
        <div>
          <strong>{visibleBooks.length}</strong>
          <span> books visible</span>
        </div>
      </section>

      <section className="controls-row">
        <input
          className="search"
          placeholder="Search teams"
          value={search}
          onChange={(event) => setSearch(event.target.value)}

        />

        <select className="sort-select" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortKey)}>
          <option value="edge">Sort: Highest edge</option>
          <option value="soonest">Sort: Soonest start</option>
          <option value="best">Sort: Best price</option>
        </select>

        <div className="toggle-group">
          <button className={uiFlags.bestOnly ? "active" : ""} onClick={() => setFlag("bestOnly", !uiFlags.bestOnly)}>
            Best price only
          </button>
          <button className={uiFlags.condensed ? "active" : ""} onClick={() => setFlag("condensed", !uiFlags.condensed)}>
            Condensed rows
          </button>
          <button className={uiFlags.showLogos ? "active" : ""} onClick={() => setFlag("showLogos", !uiFlags.showLogos)}>
            Show book logos
          </button>
          <button
            className={uiFlags.showTeamLogos ? "active" : ""}
            onClick={() => setFlag("showTeamLogos", !uiFlags.showTeamLogos)}
          >
            Show team logos
          </button>
          <button
            className={uiFlags.editorNoteOpen ? "active" : ""}
            onClick={() => setFlag("editorNoteOpen", !uiFlags.editorNoteOpen)}
          >
            Editor&apos;s Note
          </button>
        </div>

        <HistoryControls
          historyWindow={historyWindow}
          setHistoryWindow={setHistoryWindow}
          chartView={chartView}
          setChartView={setChartView}
        />

        <div className="book-picker">
          <button className="book-picker-btn" onClick={() => setShowBookMenu((open) => !open)}>
            Books ({visibleBooks.length})
          </button>
          {showBookMenu ? (
            <div className="book-picker-menu">
              {board.books.map((book) => {
                const active = bookFilter.size === 0 || bookFilter.has(book.key);
                const meta = bookMetaFor(book.key, book.title);

                return (
                  <label key={book.key}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => {
                        setBookFilter((prev) => {
                          const next = new Set(prev);
                          if (next.size === 0) board.books.forEach((entry) => next.add(entry.key));
                          if (next.has(book.key)) next.delete(book.key);
                          else next.add(book.key);
                          if (next.size === board.books.length || next.size === 0) return new Set();
                          return next;
                        });
                      }}
                    />
                    <span className="book-logo-pill">{meta.shortLabel}</span>
                    <span>{meta.label}</span>
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      <section className="content-shell">
        <div className="content-main">
          {uiFlags.editorNoteOpen ? (
            <section className="editor-note mobile-only">
              <details open>
                <summary>Editor&apos;s Note</summary>
                {editorItems.length === 0 ? <p className="muted">No qualifying games in current filters.</p> : null}
                {editorItems.map((item) => (
                  <article key={`mobile-note-${item.id}`} className="editor-item">
                    <strong>{item.matchup}</strong>
                    <small>{item.startTime} · {item.marketLabel}</small>
                    <p>{item.rationale}</p>
                    <button onClick={() => openEvent(item.eventId)}>Open</button>
                  </article>
                ))}
              </details>
            </section>
          ) : null}

          <section className="odds-grid-wrap desktop-only">
            <table className={`odds-grid ${uiFlags.condensed ? "condensed" : ""}`}>
              <thead>
                <tr>
                  <th className="sticky-col">Matchup</th>
                  <th title="Fair line">Fair line</th>
                  <th>Best price</th>
                  {visibleBooks.map((book) => (
                    <th key={book.key}>
                      <BookMark
                        bookKey={book.key}
                        title={book.title}
                        showLogo={uiFlags.showLogos}
                        failed={failedBookLogos.has(book.key)}
                        onError={() => setFailedBookLogos((prev) => new Set(prev).add(book.key))}
                        compact
                      />
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredEvents.map((event) => (
                  <tr id={`event-row-${event.id}`} key={event.id} onClick={() => setSelectedEvent(event)}>
                    <td className="sticky-col">
                      <div className="matchup-cell">
                        <TeamLabel
                          teamName={event.awayTeam}
                          showLogo={uiFlags.showTeamLogos}
                          logoFailed={failedTeamLogos.has(event.awayTeam)}
                          onLogoError={() => setFailedTeamLogos((prev) => new Set(prev).add(event.awayTeam))}
                        />
                        <TeamLabel
                          teamName={event.homeTeam}
                          showLogo={uiFlags.showTeamLogos}
                          logoFailed={failedTeamLogos.has(event.homeTeam)}
                          onLogoError={() => setFailedTeamLogos((prev) => new Set(prev).add(event.homeTeam))}
                        />
                        <small>{new Date(event.commenceTime).toLocaleString()}</small>
                        <Sparkline series={rowSeriesForEvent(event, historyWindowRangeMs)} />
                        <button
                          className="quick-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            const first = event.outcomes[0];
                            const best = first?.books.find((row) => row.isBestPrice);
                            if (!best) return;
                            navigator.clipboard.writeText(
                              `${event.awayTeam} @ ${event.homeTeam} ${first.name} ${formatAmerican(best.priceAmerican)} (${best.title})`
                            );
                          }}
                        >
                          Copy line
                        </button>
                      </div>
                    </td>

                    <td>
                      {event.outcomes.map((outcome) => (
                        <div key={`${event.id}-fair-${outcome.name}`} className="dual-line">
                          <span>{outcome.name}</span>
                          <strong>{formatAmerican(outcome.fairAmerican)}</strong>
                          <FairBestMicrobar fairProb={outcome.fairProb} bestBookProb={bestBookProb(outcome.books)} />
                        </div>
                      ))}
                    </td>

                    <td>
                      {event.outcomes.map((outcome) => {
                        const bestBook = outcome.books.find((book) => book.isBestPrice);
                        return (
                          <div key={`${event.id}-best-${outcome.name}`} className="dual-line">
                            <span>{outcome.name}</span>
                            <strong>{formatAmerican(outcome.bestPrice)}</strong>
                            {bestBook ? (
                              <small className="best-chip with-logo">
                                Best ·
                                <BookMark
                                  bookKey={bestBook.bookKey}
                                  title={bestBook.title}
                                  showLogo={uiFlags.showLogos}
                                  failed={failedBookLogos.has(bestBook.bookKey)}
                                  onError={() => setFailedBookLogos((prev) => new Set(prev).add(bestBook.bookKey))}
                                  compact
                                />
                              </small>
                            ) : (
                              <small className="best-chip">Best</small>
                            )}
                          </div>
                        );
                      })}
                    </td>

                    {visibleBooks.map((book) => (
                      <td key={`${event.id}-${book.key}`}>
                        {event.outcomes.map((outcome) => {
                          const row = outcome.books.find((item) => item.bookKey === book.key);
                          if (!row) {
                            return (
                              <div key={`${event.id}-${book.key}-${outcome.name}`} className="dual-line muted placeholder-cell">
                                --
                              </div>
                            );
                          }

                          if (uiFlags.bestOnly && !row.isBestPrice) {
                            return (
                              <div key={`${event.id}-${book.key}-${outcome.name}`} className="dual-line muted placeholder-cell">
                                --
                              </div>
                            );
                          }

                          const normalizedEdgeWidth = maxEdgeAbs > 0 ? Math.min(100, (Math.abs(row.edgePct) / maxEdgeAbs) * 100) : 0;
                          const bucketClass = edgeBucket(row.edgePct);

                          return (
                            <div
                              key={`${event.id}-${book.key}-${outcome.name}`}
                              className={`dual-line edge-${bucketClass} ${row.isBestPrice ? "best-cell" : ""}`}
                              style={edgeHeatStyle(row.edgePct)}
                            >
                              <strong className={row.isBestPrice ? "best-highlight" : ""}>{formatAmerican(row.priceAmerican)}</strong>
                              {row.isBestPrice ? <small className="best-chip">Best</small> : null}
                              <small className={Math.abs(row.edgePct) >= 1 ? "edge-badge" : "muted"}>Edge {row.edgePct.toFixed(2)}%</small>
                              <span className="edge-meter" aria-hidden>
                                <span className="edge-meter-fill" style={{ width: `${normalizedEdgeWidth}%` }} />
                              </span>
                            </div>
                          );
                        })}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mobile-cards mobile-only">
            {filteredEvents.map((event) => (
              <article
                id={`event-row-${event.id}`}
                key={`mobile-${event.id}`}
                className="mobile-card"
                onClick={() => setSelectedEvent(event)}
              >
                <div className="mobile-card-head">
                  <div>
                    <strong>{event.awayTeam} @ {event.homeTeam}</strong>
                    <small>{new Date(event.commenceTime).toLocaleString()}</small>
                  </div>
                  <Sparkline series={rowSeriesForEvent(event, historyWindowRangeMs)} />
                </div>

                <div className="mobile-lines">
                  {event.outcomes.map((outcome) => (
                    <div key={`mobile-${event.id}-${outcome.name}`}>
                      <div className="dual-line">
                        <span>{outcome.name}</span>
                        <strong>{formatAmerican(outcome.bestPrice)}</strong>
                        <small className="best-chip">Best price</small>
                      </div>
                      <FairBestMicrobar fairProb={outcome.fairProb} bestBookProb={bestBookProb(outcome.books)} />
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        </div>

        {uiFlags.editorNoteOpen ? (
          <aside className="editor-note desktop-only">
            <h3>Editor&apos;s Note</h3>
            <p className="muted">Today&apos;s highest-conviction spots in the active view.</p>
            {editorItems.length === 0 ? <p className="muted">No qualifying games in current filters.</p> : null}
            {editorItems.map((item) => (
              <article key={item.id} className="editor-item">
                <strong>{item.matchup}</strong>
                <small>{item.startTime} · {item.marketLabel}</small>
                <p>{item.rationale}</p>
                <button onClick={() => openEvent(item.eventId)}>Open</button>
              </article>
            ))}
          </aside>
        ) : null}
      </section>

      {selectedEvent ? (
        <aside className="detail-drawer">
          <div className="detail-head">
            <strong>
              {selectedEvent.awayTeam} @ {selectedEvent.homeTeam}
            </strong>
            <button onClick={() => setSelectedEvent(null)}>Close</button>
          </div>

          <p className="muted">
            {new Date(selectedEvent.commenceTime).toLocaleString()} · {selectedEvent.market.toUpperCase()}
            {selectedEvent.linePoint !== undefined ? ` ${selectedEvent.linePoint}` : ""}
          </p>

          <section className="detail-section">
            <h4>Movement history</h4>
            <p className="muted">Persisted snapshots only. No synthetic interpolation.</p>
            <HistoryControls
              historyWindow={historyWindow}
              setHistoryWindow={setHistoryWindow}
              chartView={chartView}
              setChartView={setChartView}
            />
          </section>

          {selectedEvent.outcomes.map((outcome) => (
            <section key={`${selectedEvent.id}-${outcome.name}`} className="detail-section">
              <h4>{outcome.name}</h4>
              <p className="muted">
                Fair line: {formatAmerican(outcome.fairAmerican)} ({(outcome.fairProb * 100).toFixed(2)}%)
              </p>
              {(() => {
                const series = buildOutcomeSeries(outcome, chartView, historyWindowRangeMs);
                return (
                  <div className="detail-history">
                    <Sparkline series={series} compact={false} />
                    <SeriesLegend series={series} />
                    <small className="muted">Last snapshot: {formatLastPointTs(series)} ET</small>
                  </div>
                );
              })()}
              <div className="detail-table">
                {outcome.books.map((book) => (
                  <div
                    key={`${selectedEvent.id}-${outcome.name}-${book.bookKey}`}
                    className="detail-row"
                    style={edgeHeatStyle(book.edgePct)}
                  >
                    <span>{book.title}</span>
                    <strong>{formatAmerican(book.priceAmerican)}</strong>
                    <small>Edge {book.edgePct.toFixed(2)}%</small>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <p className="muted">{board.disclaimer}</p>
        </aside>
      ) : null}
    </main>
  );
}
